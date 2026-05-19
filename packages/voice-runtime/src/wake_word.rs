//! Wake-word detector — **MVP stub**.
//!
//! The current implementation uses a simple energy-threshold gate.  It is NOT
//! a real wake-word engine.  For production, replace this module with one of:
//!
//! - **openWakeWord** (ONNX-based, free, custom phrases) — export a
//!   “hey_volle.onnx” model and load it via `ort` or `tract-onnx`.
//! - **Picovoice Porcupine** (commercial, very accurate) — use `pv_porcupine`
//!   crate with a `.ppn` wake-word file.
//! - **Silero wake-word** — train a custom model and run it with Silero
//!   tools.
//!
//! The stub below is enough to exercise the rest of the voice pipeline
//! during development.

use log::{debug, info, warn};
use std::path::PathBuf;

#[derive(Debug, Clone)]
pub struct WakeWordConfig {
    pub model_path: PathBuf,
    pub sample_rate: usize,
    pub threshold: f32,
    pub min_consecutive: usize,
}

impl Default for WakeWordConfig {
    fn default() -> Self {
        Self {
            model_path: PathBuf::from("models/hej_volle.onnx"),
            sample_rate: 16_000,
            threshold: 0.01, // energy threshold — very sensitive
            min_consecutive: 15, // ~480 ms @ 16 kHz / 512 samples per chunk
        }
    }
}

pub struct WakeWordDetector {
    config: WakeWordConfig,
    trigger_count: usize,
    armed: bool,
}

impl WakeWordDetector {
    pub fn new(config: WakeWordConfig) -> anyhow::Result<Self> {
        if !config.model_path.exists() {
            warn!(
                "Wake-word model not found at {:?}. Using energy-gate stub.",
                config.model_path
            );
        } else {
            info!("Wake-word model exists at {:?} but stub detector ignores it.", config.model_path);
        }
        Ok(Self {
            config,
            trigger_count: 0,
            armed: true,
        })
    }

    pub fn with_model_path<P: AsRef<std::path::Path>>(path: P) -> anyhow::Result<Self> {
        let mut config = WakeWordConfig::default();
        config.model_path = path.as_ref().to_path_buf();
        Self::new(config)
    }

    /// Feed a chunk of **mono f32** samples.
    /// Returns `true` when the gate opens.
    pub fn process(&mut self, samples: &[f32]) -> bool {
        if !self.armed {
            return false;
        }

        let energy: f32 = samples.iter().map(|&s| s * s).sum::<f32>() / samples.len().max(1) as f32;
        debug!("Wake-word energy={:.6}", energy);

        if energy >= self.config.threshold {
            self.trigger_count += 1;
            if self.trigger_count >= self.config.min_consecutive {
                info!("Wake word triggered (energy-gate stub)");
                self.armed = false;
                return true;
            }
        } else {
            self.trigger_count = 0;
        }

        false
    }

    pub fn reset(&mut self) {
        self.trigger_count = 0;
        self.armed = true;
    }

    pub fn force_trigger(&mut self) {
        self.armed = false;
    }
}
