use anyhow::Result;
use log::debug;
use webrtc_vad::{SampleRate, Vad, VadMode};

pub struct SileroVad {
    vad: Vad,
    /// Buffer samples until we have a full 30ms frame for webrtc-vad.
    buffer: Vec<f32>,
    frame_size: usize,
}

impl SileroVad {
    pub fn new(_model_path: &str, sample_rate: usize) -> Result<Self> {
        let rate = match sample_rate {
            8000 => SampleRate::Rate8kHz,
            16000 => SampleRate::Rate16kHz,
            32000 => SampleRate::Rate32kHz,
            48000 => SampleRate::Rate48kHz,
            _ => SampleRate::Rate16kHz,
        };
        let vad = Vad::new_with_rate_and_mode(rate, VadMode::Quality);
        // 30 ms at 16 kHz = 480 samples.  webrtc-vad accepts 10, 20 or 30 ms.
        let frame_size = (sample_rate as f32 * 0.03) as usize;
        Ok(Self {
            vad,
            buffer: Vec::with_capacity(frame_size),
            frame_size,
        })
    }

    pub fn reset(&mut self) {
        self.vad.reset();
        self.buffer.clear();
    }

    /// Accumulate samples and run VAD on every full 30 ms frame.
    /// Returns the **last** speech probability [0.0, 1.0].
    pub fn process(&mut self, chunk: &[f32]) -> Result<f32> {
        self.buffer.extend_from_slice(chunk);
        let mut last_prob = 0.0f32;

        while self.buffer.len() >= self.frame_size {
            let frame: Vec<f32> = self.buffer.drain(..self.frame_size).collect();
            let i16_frame: Vec<i16> = frame
                .iter()
                .map(|&s| (s.clamp(-1.0, 1.0) * i16::MAX as f32) as i16)
                .collect();

            let is_speech = self.vad.is_voice_segment(&i16_frame).unwrap_or(false);
            last_prob = if is_speech { 1.0 } else { 0.0 };
            debug!("VAD prob={:.1}", last_prob);
        }
        Ok(last_prob)
    }
}
