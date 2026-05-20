pub mod audio;
pub mod encoder;
pub mod vad;
pub mod wake_word;
pub mod ws_client;

pub use audio::AudioCapture;
pub use encoder::{OpusConfig, OpusEncoder};
pub use vad::{SileroVad, VadConfig, VAD_CHUNK_SAMPLES};
pub use wake_word::{WakeWordConfig, WakeWordDetector, WAKE_WORD_WINDOW_SAMPLES};
pub use ws_client::VoiceWsClient;

use anyhow::Result;
use crossbeam_channel::Sender;
use log::{info, warn};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};

/// Events emitted by the voice pipeline.
#[derive(Debug, Clone)]
pub enum VoiceEvent {
    /// The wake phrase was detected.
    WakeWord,
    /// Streaming to the backend has started.
    SpeechStarted,
    /// The utterance finished (silence detected).
    SpeechEnded,
    /// A non-fatal error occurred.
    Error(String),
}

/// Configuration for the full voice pipeline.
#[derive(Clone)]
pub struct VoicePipelineConfig {
    pub vad_model_path: String,
    pub wake_word_model_path: String,
    pub backend_ws_url: String,
    pub silence_threshold: f32,
    pub silence_duration: Duration,
    pub sample_rate: usize,
    /// Optional channel for pipeline events (wake word, speech end, etc.).
    pub event_sender: Option<Sender<VoiceEvent>>,
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
            event_sender: None,
        }
    }
}

/// The main voice pipeline.
pub struct VoicePipeline {
    config: VoicePipelineConfig,
    /// Set to true to gracefully shut down.
    shutdown: Arc<AtomicBool>,
}

impl VoicePipeline {
    pub fn new(config: VoicePipelineConfig) -> Result<Self> {
        Ok(Self {
            config,
            shutdown: Arc::new(AtomicBool::new(false)),
        })
    }

    pub fn shutdown(&self) {
        self.shutdown.store(true, Ordering::Relaxed);
    }

    fn emit(&self, event: VoiceEvent) {
        if let Some(tx) = &self.config.event_sender {
            let _ = tx.send(event);
        }
    }

    /// Run the pipeline in a blocking manner.
    pub fn run_blocking(&self) -> Result<()> {
        let capture = AudioCapture::new()?;
        let rx = capture.start()?;

        info!("Voice pipeline started. Say \"Hej Volle\" to trigger.");

        let mut vad = SileroVad::new(VadConfig {
            model_path: PathBuf::from(&self.config.vad_model_path),
            sample_rate: self.config.sample_rate,
            ..VadConfig::default()
        })?;

        let mut wake = WakeWordDetector::new(WakeWordConfig {
            model_path: PathBuf::from(&self.config.wake_word_model_path),
            sample_rate: self.config.sample_rate,
            ..WakeWordConfig::default()
        })?;

        let mut state = PipelineState::Idle;
        let mut silence_start: Option<Instant> = None;
        let mut ws_client: Option<VoiceWsClient> = None;

        let rt = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()?;

        let mut chunk_buf: Vec<f32> = Vec::with_capacity(512);
        let mut wake_buffer: Vec<f32> = Vec::with_capacity(WAKE_WORD_WINDOW_SAMPLES);
        let mut stream_buffer: Vec<f32> = Vec::new();

        while !self.shutdown.load(Ordering::Relaxed) {
            let samples = match rx.recv_timeout(Duration::from_millis(100)) {
                Ok(s) => s,
                Err(_) => continue,
            };

            chunk_buf.extend_from_slice(&samples);

            while chunk_buf.len() >= 512 {
                let frame: Vec<f32> = chunk_buf.drain(..512).collect();

                match state {
                    PipelineState::Idle => {
                        wake_buffer.extend_from_slice(&frame);

                        while wake_buffer.len() >= WAKE_WORD_WINDOW_SAMPLES {
                            let window: Vec<f32> =
                                wake_buffer.drain(..WAKE_WORD_WINDOW_SAMPLES).collect();

                            if wake.process(&window) {
                                info!("Wake word triggered! Switching to Streaming.");
                                state = PipelineState::Streaming;
                                silence_start = None;
                                vad.reset();
                                stream_buffer.clear();

                                self.emit(VoiceEvent::WakeWord);
                                self.emit(VoiceEvent::SpeechStarted);

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

                        // Keep a small overlap so we don't miss a wake word that
                        // straddles two windows.
                        let keep = wake_buffer.len().min(WAKE_WORD_WINDOW_SAMPLES / 2);
                        if wake_buffer.len() > keep {
                            wake_buffer.drain(..wake_buffer.len() - keep);
                        }
                    }

                    PipelineState::Streaming => {
                        stream_buffer.extend_from_slice(&frame);

                        while stream_buffer.len() >= VAD_CHUNK_SAMPLES {
                            let vad_chunk: Vec<f32> =
                                stream_buffer.drain(..VAD_CHUNK_SAMPLES).collect();

                            let (prob, speech_ended) = match vad.process(&vad_chunk) {
                                Ok(r) => r,
                                Err(e) => {
                                    warn!("VAD error: {}", e);
                                    self.emit(VoiceEvent::Error(e.to_string()));
                                    (1.0, false)
                                }
                            };

                            if prob >= self.config.silence_threshold {
                                silence_start = None;
                            } else if silence_start.is_none() {
                                silence_start = Some(Instant::now());
                            }

                            if let Some(ref mut ws) = ws_client {
                                let pcm_bytes: Vec<u8> =
                                    vad_chunk.iter().flat_map(|&s| s.to_le_bytes()).collect();
                                let sr = self.config.sample_rate as u32;
                                let _ = rt.block_on(async {
                                    let _ = ws
                                        .send_audio_chunk(pcm_bytes, sr, 1, "pcm")
                                        .await;
                                });
                            }

                            if speech_ended {
                                info!("End of speech detected by VAD.");
                                state = PipelineState::Closing;
                                break;
                            }

                            // Fallback: legacy silence-duration timeout.
                            if let Some(start) = silence_start {
                                if start.elapsed() >= self.config.silence_duration {
                                    info!("Silence timeout — closing stream.");
                                    state = PipelineState::Closing;
                                    break;
                                }
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
                        self.emit(VoiceEvent::SpeechEnded);
                        info!("Returned to Idle. Listening for wake word.");
                    }
                }
            }
        }

        info!("Voice pipeline shutting down.");
        Ok(())
    }
}

/// Pipeline state machine (internal).
#[derive(Debug, Clone, Copy, PartialEq)]
enum PipelineState {
    /// Listening for wake word, discarding audio.
    Idle,
    /// Wake word detected — streaming audio to backend.
    Streaming,
    /// Silence detected — grace period before returning to Idle.
    Closing,
}
