//! Voice Activity Detection using the Silero VAD ONNX model via tract-onnx.
//!
//! Replaces the previous webrtc-vad implementation with a neural detector.
//! The model is loaded once at start-up and fed fixed-size chunks of mono f32 PCM.

use anyhow::{Context, Result};
use log::debug;
use std::path::PathBuf;
use tract_onnx::prelude::*;

/// Number of samples processed by the VAD in a single `process` call.
/// At 16 kHz this is exactly 32 ms.
pub const VAD_CHUNK_SAMPLES: usize = 512;

/// Silero VAD runtime configuration.
#[derive(Debug, Clone)]
pub struct VadConfig {
    /// Absolute or relative path to the ONNX model file.
    pub model_path: PathBuf,
    /// Probability threshold in `[0.0, 1.0]`.  Values ≥ threshold are
    /// considered speech.
    pub threshold: f32,
    /// Expected sample rate in Hz.  The bundled model is trained for 16 kHz.
    pub sample_rate: usize,
}

impl Default for VadConfig {
    fn default() -> Self {
        Self {
            model_path: PathBuf::from("src/models/silero_vad.onnx"),
            threshold: 0.5,
            sample_rate: 16_000,
        }
    }
}

/// Silero VAD engine backed by tract-onnx.
///
/// Maintains a simple state machine to detect *end-of-speech*: once speech
/// has been observed, a counter tracks consecutive silent frames.  When
/// ~300 ms of silence have elapsed, `process` returns `speech_ended = true`.
pub struct SileroVad {
    /// Compiled and optimised ONNX graph ready for inference.
    model: TypedRunnableModel<TypedModel>,
    /// Copy of the configuration (needed for threshold & sample-rate).
    config: VadConfig,
    /// `true` as soon as at least one chunk scores above threshold.
    speech_detected: bool,
    /// Number of consecutive **silent** chunks observed after `speech_detected`
    /// became true.
    silence_frames: usize,
    /// How many silent chunks correspond to ~300 ms at the configured
    /// sample rate.
    silence_frames_needed: usize,
}

impl SileroVad {
    /// Load the ONNX model from `config.model_path`, optimise it, and
    /// prepare the internal silence counter.
    pub fn new(config: VadConfig) -> Result<Self> {
        debug!(
            "SileroVad::new model={:?} threshold={} sample_rate={}",
            config.model_path, config.threshold, config.sample_rate
        );

        let model = tract_onnx::onnx()
            .model_for_path(&config.model_path)
            .with_context(|| {
                format!("Failed to load ONNX model from {:?}", config.model_path)
            })?
            .into_optimized()
            .context("Failed to optimise ONNX model")?
            .into_runnable()
            .context("Failed to compile ONNX model into runnable form")?;

        let chunk_duration_ms =
            (VAD_CHUNK_SAMPLES as f32 * 1000.0) / config.sample_rate.max(1) as f32;
        let silence_frames_needed = (300.0f32 / chunk_duration_ms).ceil().max(1.0) as usize;

        debug!(
            "SileroVad ready chunk_duration={:.1}ms silence_frames_needed={}",
            chunk_duration_ms, silence_frames_needed
        );

        Ok(Self {
            model,
            config: config.clone(),
            speech_detected: false,
            silence_frames: 0,
            silence_frames_needed,
        })
    }

    /// Reset the end-of-speech state machine.  Does **not** reload the model.
    pub fn reset(&mut self) {
        debug!("SileroVad::reset");
        self.speech_detected = false;
        self.silence_frames = 0;
    }

    /// Run a single 512-sample frame through the neural VAD.
    ///
    /// Returns `(speech_probability, speech_ended)`.
    ///
    /// * `speech_probability` — raw model output in `[0.0, 1.0]`.
    /// * `speech_ended` — `true` **once** after speech was detected and at
    ///   least ~300 ms of consecutive silence have followed.
    pub fn process(&mut self, chunk: &[f32]) -> Result<(f32, bool)> {
        if chunk.len() != VAD_CHUNK_SAMPLES {
            anyhow::bail!(
                "SileroVad::process expected {} samples, got {}",
                VAD_CHUNK_SAMPLES,
                chunk.len()
            );
        }

        // Build [1, N] input tensor.
        let input = tract_ndarray::Array2::from_shape_vec((1, chunk.len()), chunk.to_vec())
            .context("Failed to build ndarray from audio chunk")?;
        let tensor = Tensor::from(input);
        let outputs = self
            .model
            .run(tvec!(tensor.into()))
            .context("ONNX inference failed")?;

        // The Silero model returns a single scalar probability.
        let prob = outputs
            .first()
            .context("ONNX model produced no outputs")?
            .to_array_view::<f32>()
            .context("Failed to view output as f32 tensor")?
            .iter()
            .next()
            .copied()
            .unwrap_or(0.0);

        let is_speech = prob >= self.config.threshold;
        let mut speech_ended = false;

        if is_speech {
            self.speech_detected = true;
            self.silence_frames = 0;
            debug!("VAD speech  prob={:.3}", prob);
        } else if self.speech_detected {
            self.silence_frames += 1;
            debug!(
                "VAD silence {}/{}  prob={:.3}",
                self.silence_frames, self.silence_frames_needed, prob
            );
            if self.silence_frames >= self.silence_frames_needed {
                speech_ended = true;
                debug!("VAD speech ENDED ({} silent frames)", self.silence_frames);
                self.speech_detected = false;
                self.silence_frames = 0;
            }
        } else {
            debug!("VAD silence  prob={:.3}", prob);
        }

        Ok((prob, speech_ended))
    }
}
