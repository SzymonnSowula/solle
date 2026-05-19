//! Full voice pipeline example.
//!
//! 1. Capture microphone audio at 16 kHz mono f32 via WASAPI/cpal.
//! 2. Continuously feed a rolling window to the wake-word detector.
//! 3. When the wake phrase ("Hej Volle") is detected:
//!    a. Connect to `ws://localhost:8000/ws/voice-stream`.
//!    b. Encode audio with Opus (or raw PCM fallback) and stream it.
//!    c. Run VAD in parallel; when sustained silence is detected send a
//!       final frame and return to wake-word listening.
//!
//! Models are loaded from `./models/`.  If they are missing the ONNX
//! modules fall back to dummy behaviour so the binary still compiles and
//! runs.

use anyhow::{Context, Result};
use log::{error, info, warn};
use std::path::PathBuf;
use std::time::{Duration, Instant};
use tokio::time::{sleep, timeout};
use volle_voice_runtime::{
    AudioCapture, OpusConfig, OpusEncoder, SileroVad, VadConfig, VoiceWsClient,
    WakeWordConfig, WakeWordDetector,
};

/// WebSocket endpoint for the voice backend.
const WS_URL: &str = "ws://localhost:8000/ws/voice-stream";

/// After this many seconds of silence we consider the utterance finished.
const SILENCE_TIMEOUT: Duration = Duration::from_secs(1);

/// Hard timeout for a single utterance (safety net).
const MAX_UTTERANCE_DURATION: Duration = Duration::from_secs(30);

#[tokio::main]
async fn main() -> Result<()> {
    env_logger::init();

    let models_dir = PathBuf::from("models");

    // ------------------------------------------------------------------
    // Initialise components
    // ------------------------------------------------------------------
    let capture = AudioCapture::new().context("audio capture initialisation failed")?;
    let rx = capture.start().context("failed to start audio capture")?;

    let mut wake = WakeWordDetector::new(WakeWordConfig {
        model_path: models_dir.join("hej_volle.onnx"),
        ..WakeWordConfig::default()
    })
    .context("wake-word detector initialisation failed")?;

    let mut vad = SileroVad::new(VadConfig {
        model_path: models_dir.join("silero_vad.onnx"),
        ..VadConfig::default()
    })
    .context("VAD initialisation failed")?;

    let mut encoder = OpusEncoder::new(OpusConfig::default())
        .context("Opus encoder initialisation failed")?;

    // ------------------------------------------------------------------
    // State machine
    // ------------------------------------------------------------------
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    enum State {
        /// Waiting for the wake phrase.
        Listening,
        /// Wake phrase detected; streaming audio to backend.
        Streaming,
        /// Graceful shutdown.
        Done,
    }

    let mut state = State::Listening;
    let mut ws_client: Option<VoiceWsClient> = None;
    let mut utterance_start: Option<Instant> = None;
    let mut silence_deadline: Option<Instant> = None;

    info!("Voice pipeline started. Waiting for wake word...");

    // Buffer used to accumulate a full wake-word window.
    let mut wake_buffer: Vec<f32> = Vec::with_capacity(
        volle_voice_runtime::wake_word::WAKE_WORD_WINDOW_SAMPLES,
    );

    // Buffer used while streaming to collect chunks for Opus/VAD.
    let mut stream_buffer: Vec<f32> = Vec::new();

    loop {
        // ----------------------------------------------------------------
        // Pull audio from cpal
        // ----------------------------------------------------------------
        let chunk = match timeout(Duration::from_millis(200), async {
            tokio::task::spawn_blocking(move || rx.recv().ok())
                .await
                .ok()
                .flatten()
        })
        .await
        {
            Ok(Some(c)) => c,
            Ok(None) => {
                warn!("Audio capture ended");
                break;
            }
            Err(_) => {
                // Timeout – check state transitions and continue.
                vec![]
            }
        };

        if chunk.is_empty() && state == State::Done {
            break;
        }

        match state {
            State::Listening => {
                wake_buffer.extend_from_slice(&chunk);

                // Feed complete windows to the wake-word detector.
                while wake_buffer.len()
                    >= volle_voice_runtime::wake_word::WAKE_WORD_WINDOW_SAMPLES
                {
                    let window: Vec<f32> = wake_buffer
                        .drain(..volle_voice_runtime::wake_word::WAKE_WORD_WINDOW_SAMPLES)
                        .collect();

                    if wake.process(&window) {
                        info!("Wake word detected! Transitioning to streaming state.");
                        state = State::Streaming;
                        utterance_start = Some(Instant::now());
                        silence_deadline = None;
                        vad.reset();
                        stream_buffer.clear();

                        // Attempt to connect WebSocket.
                        match VoiceWsClient::connect(WS_URL).await {
                            Ok(client) => {
                                info!("Connected to {}", WS_URL);
                                ws_client = Some(client);
                            }
                            Err(e) => {
                                warn!(
                                    "Failed to connect to {}: {}. Will retry on next chunk.",
                                    WS_URL, e
                                );
                                ws_client = None;
                            }
                        }
                        break;
                    }
                }

                // Keep a small overlap so we don't miss a wake word that
                // straddles two windows.
                let keep = wake_buffer
                    .len()
                    .min(volle_voice_runtime::wake_word::WAKE_WORD_WINDOW_SAMPLES / 2);
                if wake_buffer.len() > keep {
                    wake_buffer.drain(..wake_buffer.len() - keep);
                }
            }

            State::Streaming => {
                stream_buffer.extend_from_slice(&chunk);

                // Process audio in VAD-sized chunks (512 samples @ 16 kHz).
                while stream_buffer.len() >= volle_voice_runtime::vad::VAD_CHUNK_SAMPLES {
                    let vad_chunk: Vec<f32> = stream_buffer
                        .drain(..volle_voice_runtime::vad::VAD_CHUNK_SAMPLES)
                        .collect();

                    let (_speech_now, speech_ended) = vad.process(&vad_chunk);

                    // Encode and send regardless of VAD result while we're
                    // still inside the utterance.  The backend can do its own
                    // buffering; we only use VAD for end-of-utterance
                    // detection.
                    let encoded = encoder
                        .encode_f32(&vad_chunk)
                        .context("Opus encoding failed")?;

                    if let Some(ref mut client) = ws_client {
                        if let Err(e) = client
                            .send_audio_chunk(encoded, 16_000, 1, encoder_format())
                            .await
                        {
                            warn!("WebSocket send failed: {}. Will retry connection.", e);
                            ws_client = None;
                        }
                    } else {
                        // Retry connection lazily.
                        match VoiceWsClient::connect(WS_URL).await {
                            Ok(client) => {
                                info!("Re-connected to {}", WS_URL);
                                ws_client = Some(client);
                            }
                            Err(e) => {
                                warn!("Re-connection failed: {}", e);
                            }
                        }
                    }

                    if speech_ended {
                        info!("End of speech detected by VAD.");
                        if let Some(ref mut client) = ws_client {
                            let _ = client.send_final().await;
                            let _ = client.close().await;
                        }
                        ws_client = None;
                        wake.reset();
                        state = State::Listening;
                        break;
                    }
                }

                // Hard timeout safety net.
                if let Some(start) = utterance_start {
                    if start.elapsed() > MAX_UTTERANCE_DURATION {
                        warn!("Utterance exceeded max duration; forcing stop.");
                        if let Some(ref mut client) = ws_client {
                            let _ = client.send_final().await;
                            let _ = client.close().await;
                        }
                        ws_client = None;
                        wake.reset();
                        state = State::Listening;
                    }
                }
            }

            State::Done => break,
        }

        // Graceful shutdown on Ctrl-C is handled implicitly by tokio's
        // runtime; the channel will close and we exit the loop.
    }

    // Clean up
    if let Some(mut client) = ws_client {
        let _ = client.send_final().await;
        let _ = client.close().await;
    }

    info!("Voice pipeline stopped.");
    Ok(())
}

/// Returns the format string used in WebSocket metadata.
fn encoder_format() -> &'static str {
    if cfg!(feature = "opus-encode") {
        "opus"
    } else {
        "pcm"
    }
}
