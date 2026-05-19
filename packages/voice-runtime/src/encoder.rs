//! Opus audio encoder — currently a PCM passthrough stub.
//!
//! Enable the `opus-encode` feature and add the `opus` crate to Cargo.toml
//! to get real Opus compression.  On Windows builds this is strongly
//! recommended because it cuts bandwidth by ~10×.

#[derive(Debug, Clone)]
pub struct EncoderConfig {
    pub sample_rate: u32,
    pub channels: u16,
    pub bitrate: u32,
}

impl Default for EncoderConfig {
    fn default() -> Self {
        Self {
            sample_rate: 16_000,
            channels: 1,
            bitrate: 24_000,
        }
    }
}

pub struct OpusEncoder {
    config: EncoderConfig,
}

impl OpusEncoder {
    pub fn new(config: EncoderConfig) -> anyhow::Result<Self> {
        Ok(Self { config })
    }

    /// Encode a chunk of mono f32 PCM into Opus (or passthrough PCM when
    /// the `opus-encode` feature is disabled).
    pub fn encode(&mut self, _input: &[f32]) -> anyhow::Result<Vec<u8>> {
        // Stub: return little-endian f32 PCM bytes.
        // When opus-encode is enabled replace this with real Opus encoding.
        Ok(_input.iter().flat_map(|&s| s.to_le_bytes()).collect())
    }

    pub fn config(&self) -> &EncoderConfig {
        &self.config
    }
}
