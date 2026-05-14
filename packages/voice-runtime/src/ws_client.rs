use anyhow::{Context, Result};
use futures_util::SinkExt;
use tokio::net::TcpStream;
use tokio_tungstenite::{connect_async, tungstenite::protocol::Message, MaybeTlsStream, WebSocketStream};

/// A simple WebSocket client that sends binary audio frames.
pub struct VoiceWsClient {
    ws_stream: WebSocketStream<MaybeTlsStream<TcpStream>>,
}

impl VoiceWsClient {
    /// Connect to a WebSocket server at `url`.
    pub async fn connect(url: &str) -> Result<Self> {
        let (ws_stream, _response) = connect_async(url)
            .await
            .with_context(|| format!("failed to connect to {}", url))?;

        Ok(Self { ws_stream })
    }

    /// Send a chunk of raw audio data as a binary WebSocket message.
    pub async fn send_audio_chunk(&mut self, data: Vec<u8>) -> Result<()> {
        self.ws_stream
            .send(Message::Binary(data))
            .await
            .context("failed to send audio chunk")?;
        Ok(())
    }

    /// Close the WebSocket connection gracefully.
    pub async fn close(&mut self) -> Result<()> {
        self.ws_stream
            .close(None)
            .await
            .context("failed to close websocket")?;
        Ok(())
    }
}
