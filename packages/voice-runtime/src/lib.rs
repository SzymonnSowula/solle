pub mod audio;
pub mod encoder;
pub mod vad;
pub mod wake_word;
pub mod ws_client;

pub use audio::AudioCapture;
pub use vad::SileroVad;
pub use wake_word::WakeWordDetector;
pub use ws_client::VoiceWsClient;

use anyhow::Result;
use crossbeam_channel::{bounded, Receiver, Sender};
use log::{error, info, warn};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};

/// Pipeline state machine.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum PipelineState {
    /// Listening for wake word, discarding audio.
    Idle,
    /// Wake word detected — streaming audio to backend.
    Streaming,
    /// Silence detected — grace period before returning to Idle.
    Closing,
}

/// Configuration for the full voice pipeline.
pub struct VoicePipelineConfig {
    pub vad_model_path: String,
    pub wake_word_model_path: String,
    pub backend_ws_url: String,
    pub silence_threshold: f32,
    pub silence_duration: Duration,
    pub sample_rate: usize,
}

impl Default for VoicePipelineConfig {
    fn default() -> Self {
        Self {
            vad_model_path: "models/silero_vad.onnx".to_string(),
            wake_word_model_path: "models/hej_volle.onnx".to_string(),
            backend_ws_url: "ws://localhost:8000/ws/voice-stream".to_string(),
            silence_threshold: 0.3,
            silence_duration: Duration::from_millis(1200),
            sample_rate: 16_000,
        }
    }
}

/// The main voice pipeline.
pub struct VoicePipeline {
    config: VoicePipelineConfig,
    state: PipelineState,
    /// Set to true to gracefully shut down.
    shutdown: Arc<AtomicBool>,
}

impl VoicePipeline {
    pub fn new(config: VoicePipelineConfig) -> Result<Self> {
        Ok(Self {
            config,
            state: PipelineState::Idle,
            shutdown: Arc::new(AtomicBool::new(false)),
        })
    }

    pub fn shutdown(&self) {
        self.shutdown.store(true, Ordering::Relaxed);
    }

    /// Run the pipeline in a blocking manner.
    pub fn run_blocking(&mut self) -> Result<()> {
        let (audio_tx, audio_rx): (Sender<Vec<f32>>, Receiver<Vec<f32>>) = bounded(256);

        let capture = AudioCapture::new()?;
        let _capture_rx = capture.start()?;

        info!("Voice pipeline started. Say \"Hej Volle\" to trigger.");

        let mut vad = SileroVad::new(&self.config.vad_model_path, self.config.sample_rate)?;
        let mut wake =
            WakeWordDetector::with_model_path(&self.config.wake_word_model_path)?;

        let mut state = PipelineState::Idle;
        let mut silence_start: Option<Instant> = None;
        let mut ws_client: Option<VoiceWsClient> = None;

        let rt = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()?;

        let mut chunk_buf: Vec<f32> = Vec::with_capacity(512);

        while !self.shutdown.load(Ordering::Relaxed) {
            let samples = match audio_rx.recv_timeout(Duration::from_millis(100)) {
                Ok(s) => s,
                Err(_) => continue,
            };

            chunk_buf.extend_from_slice(&samples);

            while chunk_buf.len() >= 512 {
                let frame: Vec<f32> = chunk_buf.drain(..512).collect();

                match state {
                    PipelineState::Idle => {
                        if wake.process(&frame) {
                            info!("Wake word triggered! Switching to Streaming.");
                            state = PipelineState::Streaming;
                            silence_start = None;
                            vad.reset();

                            let url = self.config.backend_ws_url.clone();
                            ws_client = rt.block_on(async {
                                match VoiceWsClient::connect(&url).await {
                                    Ok(c) => Some(c),
                                    Err(e) => {
                                        warn!("WS connect failed: {}", e);
                                        None
                                    }
                                }
                            });
                        }
                    }

                    PipelineState::Streaming => {
                        let prob = match vad.process(&frame) {
                            Ok(p) => p,
                            Err(e) => {
                                warn!("VAD error: {}", e);
                                1.0
                            }
                        };

                        if prob >= self.config.silence_threshold {
                            silence_start = None;
                        } else if silence_start.is_none() {
                            silence_start = Some(Instant::now());
                        }

                        if let Some(ref mut ws) = ws_client {
                            let pcm_bytes: Vec<u8> =
                                frame.iter().flat_map(|&s| s.to_le_bytes()).collect();
                            let sr = self.config.sample_rate as u32;
                            let _ = rt.block_on(async move {
                                let _ = ws
                                    .send_audio_chunk(pcm_bytes, sr, 1, "pcm")
                                    .await;
                            });
                        }

                        if let Some(start) = silence_start {
                            if start.elapsed() >= self.config.silence_duration {
                                info!("Silence detected — closing stream.");
                                state = PipelineState::Closing;
                            }
                        }
                    }

                    PipelineState::Closing => {
                        if let Some(ref mut ws) = ws_client {
                            let _ = rt.block_on(async {
                                let _ = ws.send_final().await;
                                let _ = ws.close().await;
                            });
                        }
                        ws_client = None;
                        wake.reset();
                        state = PipelineState::Idle;
                        info!("Returned to Idle. Listening for wake word.");
                    }
                }
            }
        }

        info!("Voice pipeline shutting down.");
        Ok(())
    }
}
