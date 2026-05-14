use std::sync::{Arc, Mutex};
use std::time::Duration;
use tokio::time::Instant;
use volle_voice_runtime::{AudioCapture, VoiceWsClient};

#[tokio::main]
async fn main() {
    env_logger::init();

    let capture = match AudioCapture::new() {
        Ok(c) => c,
        Err(e) => {
            eprintln!("Failed to initialise audio capture: {}", e);
            return;
        }
    };

    let buffer = Arc::new(Mutex::new(Vec::<i16>::new()));
    let buffer_clone = Arc::clone(&buffer);

    if let Err(e) = capture.start(move |chunk| {
        if let Ok(mut buf) = buffer_clone.lock() {
            buf.extend_from_slice(chunk);
        }
    }) {
        eprintln!("Failed to start audio capture: {}", e);
        return;
    }

    let url = "ws://localhost:8000/ws/audio";
    let mut client = match VoiceWsClient::connect(url).await {
        Ok(c) => c,
        Err(e) => {
            eprintln!("Warning: could not connect to {}: {}", url, e);
            return;
        }
    };

    let start = Instant::now();
    let mut total_bytes = 0usize;

    while start.elapsed() < Duration::from_secs(5) {
        tokio::time::sleep(Duration::from_millis(500)).await;

        let chunk: Vec<i16> = {
            let mut buf = match buffer.lock() {
                Ok(b) => b,
                Err(_) => continue,
            };
            // 16 kHz mono => 8000 samples = 0.5 s
            let take = buf.len().min(8000);
            if take == 0 {
                continue;
            }
            let drained: Vec<i16> = buf.drain(..take).collect();
            drained
        };

        // Convert i16 samples to little-endian bytes.
        let bytes: Vec<u8> = chunk.iter().flat_map(|&s| s.to_le_bytes()).collect();
        if let Err(e) = client.send_audio_chunk(bytes).await {
            eprintln!("Failed to send audio chunk: {}", e);
            break;
        }
        total_bytes += chunk.len() * std::mem::size_of::<i16>();
    }

    if let Err(e) = client.close().await {
        eprintln!("Failed to close WebSocket cleanly: {}", e);
    }

    println!("Sent {} bytes of audio", total_bytes);
}
