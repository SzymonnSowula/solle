pub mod audio;
pub mod encoder;
pub mod vad;
pub mod wake_word;
pub mod ws_client;

pub struct VoiceRuntime {
    _marker: (),
}

impl VoiceRuntime {
    pub fn new() -> Self {
        Self { _marker: () }
    }
}
