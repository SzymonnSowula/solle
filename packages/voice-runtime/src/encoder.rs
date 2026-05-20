//! Opus audio encoder with an optional real Opus backend.
//!
//! When the `opus-encode` feature is enabled the `opus` crate is used to
//! compress audio.  Otherwise the encoder returns little-endian f32 PCM as a
//! passthrough.

#[derive(Debug, Clone)]
pub struct OpusConfig {
    pub sample_rate: u32,
    pub channels: u16,
    pub bitrate: u32,
}

impl Default for OpusConfig {
    fn default() -> Self {
        Self {
            sample_rate: 16_000,
            channels: 1,
            bitrate: 24_000,
        }
    }
}

#[cfg(feature = "opus-encode")]
pub struct OpusEncoder {
    config: OpusConfig,
    encoder: opus::Encoder,
}

#[cfg(not(feature = "opus-encode"))]
pub struct OpusEncoder {
    config: OpusConfig,
}

#[cfg(feature = "opus-encode")]
impl OpusEncoder {
    pub fn new(config: OpusConfig) -> anyhow::Result<Self> {
        let channels = match config.channels {
            1 => opus::Channels::Mono,
            2 => opus::Channels::Stereo,
            n => anyhow::bail!("unsupported channel count: {n} (expected 1 or 2)"),
        };

        let mut encoder =
            opus::Encoder::new(config.sample_rate as i32, channels, opus::Application::Voip)?;

        encoder.set_bitrate(opus::Bitrate::BitsPerSecond(config.bitrate as i32))?;

        Ok(Self { config, encoder })
    }

    /// Encode a chunk of f32 PCM into Opus.
    ///
    /// Samples are clamped to [-1.0, 1.0], converted to i16, and fed to the
    /// Opus encoder.  The caller is responsible for providing a frame size
    /// accepted by Opus for the configured sample rate.
    pub fn encode_f32(&mut self, input: &[f32]) -> anyhow::Result<Vec<u8>> {
        let i16_samples: Vec<i16> = input
            .iter()
            .map(|&s| (s.clamp(-1.0, 1.0) * i16::MAX as f32) as i16)
            .collect();

        let max_size = i16_samples.len() * std::mem::size_of::<i16>();
        let encoded = self.encoder.encode_vec_i16(&i16_samples, max_size)?;

        Ok(encoded)
    }

    pub fn config(&self) -> &OpusConfig {
        &self.config
    }
}

#[cfg(not(feature = "opus-encode"))]
impl OpusEncoder {
    pub fn new(config: OpusConfig) -> anyhow::Result<Self> {
        Ok(Self { config })
    }

    /// Passthrough: return little-endian f32 PCM bytes.
    pub fn encode_f32(&mut self, input: &[f32]) -> anyhow::Result<Vec<u8>> {
        Ok(input.iter().flat_map(|&s| s.to_le_bytes()).collect())
    }

    pub fn config(&self) -> &OpusConfig {
        &self.config
    }
}
