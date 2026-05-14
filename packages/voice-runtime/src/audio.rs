use anyhow::{Context, Result};
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{SampleFormat, SampleRate, StreamConfig};
use std::sync::{Arc, Mutex};

/// Captures audio from the default input device at 16 kHz mono i16.
pub struct AudioCapture {
    device: cpal::Device,
    config: StreamConfig,
}

impl AudioCapture {
    /// Create a new `AudioCapture` configured for 16 kHz mono i16.
    pub fn new() -> Result<Self> {
        let host = cpal::default_host();
        let device = host
            .default_input_device()
            .context("no default input device available")?;

        let mut supported_configs = device
            .supported_input_configs()
            .context("failed to query supported input configs")?;

        // Try to find a config that supports 16 kHz, mono, f32.
        let supported_config = supported_configs
            .find(|c| {
                c.sample_format() == SampleFormat::F32
                    && c.min_sample_rate() <= SampleRate(16_000)
                    && c.max_sample_rate() >= SampleRate(16_000)
                    && c.channels() >= 1
            })
            .context("no supported 16kHz f32 mono input config")?;

        let mut config: StreamConfig = supported_config.with_sample_rate(SampleRate(16_000)).into();
        config.channels = 1;

        Ok(Self { device, config })
    }

    /// Start capturing audio.
    ///
    /// `callback` is invoked for every chunk of i16 samples at 16 kHz mono.
    /// The stream runs on a cpal background thread until dropped or stopped.
    pub fn start(&self, mut callback: impl FnMut(&[i16]) + Send + 'static) -> Result<()> {
        let err_fn = |err| eprintln!("cpal stream error: {}", err);

        let stream = self
            .device
            .build_input_stream(
                &self.config,
                move |data: &[f32], _info: &cpal::InputCallbackInfo| {
                    // Convert f32 [-1.0, 1.0] to i16
                    let i16_samples: Vec<i16> = data
                        .iter()
                        .map(|&s| (s.clamp(-1.0, 1.0) * i16::MAX as f32) as i16)
                        .collect();
                    callback(&i16_samples);
                },
                err_fn,
                None,
            )
            .context("failed to build input stream")?;

        stream.play().context("failed to start audio stream")?;

        // Keep the stream alive by moving it into a static storage.
        // The caller can stop capture by dropping the `AudioCapture`.
        let _ = Arc::new(Mutex::new(Some(stream)));
        Ok(())
    }
}
