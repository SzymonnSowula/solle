//! Wake-word detector with ONNX (tract-onnx) primary path and energy-gate fallback.
//!
//! When a model file is present it is loaded via tract-onnx and run on a
//! fixed-size window.  If the model is missing or fails to load the detector
//! transparently falls back to the old energy-gate stub so that development
//! and CI never break.

use anyhow::{Context, Result};
use log::{debug, info, warn};
use std::path::PathBuf;
use tract_onnx::prelude::*;

/// Size of the audio window fed to the wake-word model.
/// At 16 kHz this is exactly 2 seconds.
pub const WAKE_WORD_WINDOW_SAMPLES: usize = 16_000 * 2;

/// Wake-word engine configuration.
#[derive(Debug, Clone)]
pub struct WakeWordConfig {
    /// Path to the ONNX wake-word model.
    pub model_path: PathBuf,
    /// Expected sample rate in Hz.
    pub sample_rate: usize,
    /// Detection threshold in `[0.0, 1.0]` for the ONNX path.
    /// For the energy fallback this is the RMS energy gate.
    pub threshold: f32,
    /// How many consecutive windows must cross the threshold before
    /// triggering (energy fallback only).
    pub min_consecutive: usize,
}

impl Default for WakeWordConfig {
    fn default() -> Self {
        Self {
            model_path: PathBuf::from("models/hej_volle.onnx"),
            sample_rate: 16_000,
            threshold: 0.5,
            min_consecutive: 15,
        }
    }
}

/// Wake-word detector.
pub struct WakeWordDetector {
    config: WakeWordConfig,
    /// ONNX path — `None` when the model is missing or fails to load.
    model: Option<TypedRunnableModel<TypedModel>>,
    /// Only used by the energy-gate fallback.
    trigger_count: usize,
    /// Detector is armed after a reset.
    armed: bool,
}

impl WakeWordDetector {
    /// Create a new detector.
    ///
    /// Attempts to load the ONNX model from `config.model_path`.  If the file
    /// does not exist or tract fails to parse it, a warning is logged and the
    /// detector falls back to the energy gate.
    pub fn new(config: WakeWordConfig) -> Result<Self> {
        let model = if config.model_path.exists() {
            match Self::load_model(&config.model_path) {
                Ok(m) => {
                    info!(
                        "Wake-word ONNX model loaded from {:?}",
                        config.model_path
                    );
                    Some(m)
                }
                Err(e) => {
                    warn!(
                        "Failed to load wake-word model from {:?}: {}. \
                         Falling back to energy gate.",
                        config.model_path, e
                    );
                    None
                }
            }
        } else {
            warn!(
                "Wake-word model not found at {:?}. Using energy-gate fallback.",
                config.model_path
            );
            None
        };

        Ok(Self {
            config,
            model,
            trigger_count: 0,
            armed: true,
        })
    }

    /// Convenience constructor that uses the default config except for the
    /// model path.
    pub fn with_model_path<P: AsRef<std::path::Path>>(path: P) -> Result<Self> {
        let mut config = WakeWordConfig::default();
        config.model_path = path.as_ref().to_path_buf();
        Self::new(config)
    }

    fn load_model(path: &PathBuf) -> Result<TypedRunnableModel<TypedModel>> {
        let model = tract_onnx::onnx()
            .model_for_path(path)
            .with_context(|| format!("Failed to load ONNX model from {:?}", path))?
            .into_optimized()
            .context("Failed to optimise ONNX model")?
            .into_runnable()
            .context("Failed to compile ONNX model into runnable form")?;
        Ok(model)
    }

    /// Feed a chunk of **mono f32** samples.
    ///
    /// In ONNX mode the slice is expected to contain exactly
    /// `WAKE_WORD_WINDOW_SAMPLES` elements.  In fallback mode any length is
    /// accepted.
    ///
    /// Returns `true` when the wake phrase is detected.
    pub fn process(&mut self, samples: &[f32]) -> bool {
        if !self.armed {
            return false;
        }

        let threshold = self.config.threshold;

        if let Some(ref model) = self.model {
            if self.process_onnx(model, threshold, samples) {
                self.armed = false;
                return true;
            }
            false
        } else {
            self.process_energy(threshold, samples)
        }
    }

    fn process_onnx(
        &self,
        model: &TypedRunnableModel<TypedModel>,
        threshold: f32,
        samples: &[f32],
    ) -> bool {
        if samples.len() != WAKE_WORD_WINDOW_SAMPLES {
            debug!(
                "WakeWord ONNX mode expects {} samples, got {} — skipping",
                WAKE_WORD_WINDOW_SAMPLES,
                samples.len()
            );
            return false;
        }

        let input =
            match tract_ndarray::Array2::from_shape_vec((1, samples.len()), samples.to_vec()) {
                Ok(a) => a,
                Err(e) => {
                    warn!("Failed to build ndarray for wake-word: {}", e);
                    return false;
                }
            };
        let tensor = Tensor::from(input);

        let outputs = match model.run(tvec!(tensor.into())) {
            Ok(o) => o,
            Err(e) => {
                warn!("Wake-word ONNX inference failed: {}", e);
                return false;
            }
        };

        let prob = outputs
            .first()
            .and_then(|t| t.to_array_view::<f32>().ok())
            .and_then(|v| v.iter().next().copied())
            .unwrap_or(0.0);

        debug!("Wake-word prob={:.3}", prob);

        prob >= threshold
    }

    fn process_energy(&mut self, threshold: f32, samples: &[f32]) -> bool {
        let energy: f32 = samples.iter().map(|&s| s * s).sum::<f32>() / samples.len().max(1) as f32;
        debug!("Wake-word energy={:.6}", energy);

        if energy >= threshold {
            self.trigger_count += 1;
            if self.trigger_count >= self.config.min_consecutive {
                info!("Wake word triggered (energy-gate fallback)");
                self.armed = false;
                return true;
            }
        } else {
            self.trigger_count = 0;
        }
        false
    }

    /// Re-arm the detector after a successful trigger.
    pub fn reset(&mut self) {
        self.trigger_count = 0;
        self.armed = true;
    }

    /// Force the detector into a triggered state (useful for manual override).
    pub fn force_trigger(&mut self) {
        self.armed = false;
    }
}
