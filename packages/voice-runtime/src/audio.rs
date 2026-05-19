//! WASAPI (cross-platform) audio capture via `cpal`.
//!
//! The capture is configured for 16 kHz mono f32, which is the common
//! denominator required by Silero VAD and openWakeWord.  If the hardware
//! does not natively support 16 kHz, cpal performs a software
//! resample (host side) – no extra resampling crate is needed.

use anyhow::{Context, Result};
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{SampleFormat, SampleRate, StreamConfig};
use log::{error, info, warn};
use std::sync::mpsc::{self, Receiver};

/// Audio capture configured for 16 kHz mono f32.
pub struct AudioCapture {
    device: cpal::Device,
    config: StreamConfig,
}

impl AudioCapture {
    /// Create a new `AudioCapture` configured for 16 kHz mono f32.
    pub fn new() -> Result<Self> {
        let host = cpal::default_host();
        let device = host
            .default_input_device()
            .context("no default input device available")?;

        let device_name = device.name().unwrap_or_else(|_| "unknown".to_string());
        info!("Using audio input device: {}", device_name);

        let mut supported_configs = device
            .supported_input_configs()
            .context("failed to query supported input configs")?;

        // Prefer f32, fallback to i16, then u16.
        let preferred = supported_configs
            .find(|c| {
                c.sample_format() == SampleFormat::F32
                    && c.min_sample_rate() <= SampleRate(16_000)
                    && c.max_sample_rate() >= SampleRate(16_000)
                    && c.channels() >= 1
            })
            .or_else(|| {
                supported_configs.find(|c| {
                    c.min_sample_rate() <= SampleRate(16_000)
                        && c.max_sample_rate() >= SampleRate(16_000)
                        && c.channels() >= 1
                })
            })
            .context("no supported 16kHz mono input config")?;

        let sample_format = preferred.sample_format();
        let mut config: StreamConfig = preferred.with_sample_rate(SampleRate(16_000)).into();
        config.channels = 1;

        info!(
            "Audio stream config: {} Hz, {} channel(s), format={:?}",
            config.sample_rate.0, config.channels, sample_format
        );

        Ok(Self { device, config })
    }

    /// Start capturing audio.
    ///
    /// Returns a [`Receiver`] that yields chunks of **mono f32** samples
    /// at 16 kHz.  The channel is bounded (capacity 64) so that slow
    /// consumers do not cause unbounded memory growth.
    ///
    /// Drop the `AudioCapture` to stop the stream.
    pub fn start(&self) -> Result<Receiver<Vec<f32>>> {
        let (tx, rx) = mpsc::sync_channel(64);
        let sample_format = self
            .device
            .default_input_config()
            .map(|c| c.sample_format())
            .unwrap_or(SampleFormat::F32);

        let err_fn = |err| error!("cpal stream error: {}", err);

        let stream = match sample_format {
            SampleFormat::F32 => {
                self.device.build_input_stream(
                    &self.config,
                    move |data: &[f32], _info: &cpal::InputCallbackInfo| {
                        if tx.send(data.to_vec()).is_err() {}
                    },
                    err_fn,
                    None,
                )?
            }
            SampleFormat::I16 => {
                self.device.build_input_stream(
                    &self.config,
                    move |data: &[i16], _info: &cpal::InputCallbackInfo| {
                        let f32_samples: Vec<f32> = data
                            .iter()
                            .map(|&s| s as f32 / i16::MAX as f32)
                            .collect();
                        if tx.send(f32_samples).is_err() {}
                    },
                    err_fn,
                    None,
                )?
            }
            SampleFormat::U16 => {
                self.device.build_input_stream(
                    &self.config,
                    move |data: &[u16], _info: &cpal::InputCallbackInfo| {
                        let f32_samples: Vec<f32> = data
                            .iter()
                            .map(|&s| (s as f32 / u16::MAX as f32) * 2.0 - 1.0)
                            .collect();
                        if tx.send(f32_samples).is_err() {}
                    },
                    err_fn,
                    None,
                )?
            }
            _ => {
                warn!("Unknown sample format {:?}, trying f32", sample_format);
                self.device.build_input_stream(
                    &self.config,
                    move |data: &[f32], _info: &cpal::InputCallbackInfo| {
                        if tx.send(data.to_vec()).is_err() {}
                    },
                    err_fn,
                    None,
                )?
            }
        };

        stream.play().context("failed to start audio stream")?;
        let _ = Box::leak(Box::new(stream));
        Ok(rx)
    }
}
