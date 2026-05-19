use anyhow::{Context, Result};
use futures_util::{SinkExt, StreamExt};
use log::{debug, error, info, warn};
use serde::{Deserialize, Serialize};
use tokio::net::TcpStream;
use tokio_tungstenite::{
    connect_async,
    tungstenite::protocol::{CloseFrame, Message},
    MaybeTlsStream, WebSocketStream,
};

/// Wire-format message sent before each binary audio chunk.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioMetadata {
    pub seq: u64,
    pub sample_rate: u32,
    pub channels: u16,
    pub format: String, // "opus" or "pcm"
    pub is_final: bool,
}

/// A WebSocket client that sends structured audio frames.
pub struct VoiceWsClient {
    ws_stream: WebSocketStream<MaybeTlsStream<TcpStream>>,
    url: String,
    seq: u64,
}

impl VoiceWsClient {
    /// Connect to a WebSocket server at `url`.
    pub async fn connect(url: &str) -> Result<Self> {
        info!("Connecting to WebSocket: {}", url);
        let (ws_stream, response) = connect_async(url)
            .await
            .with_context(|| format!("failed to connect to {}", url))?;

        info!("WebSocket connected (status={})", response.status());

        Ok(Self {
            ws_stream,
            url: url.to_string(),
            seq: 0,
        })
    }

    /// Send a chunk of encoded audio data.
    ///
    /// The data is preceded by a JSON metadata frame so the server knows how
    /// to decode it.
    pub async fn send_audio_chunk(
        &mut self,
        data: Vec<u8>,
        sample_rate: u32,
        channels: u16,
        format: &str,
    ) -> Result<()> {
        let meta = AudioMetadata {
            seq: self.seq,
            sample_rate,
            channels,
            format: format.to_string(),
            is_final: false,
        };
        self.seq += 1;

        let meta_json =
            serde_json::to_string(&meta).context("failed to serialize audio metadata")?;

        self.ws_stream
            .send(Message::Text(meta_json))
            .await
            .context("failed to send metadata frame")?;

        self.ws_stream
            .send(Message::Binary(data))
            .await
            .context("failed to send audio chunk")?;

        debug!("Sent audio chunk seq={}", meta.seq);
        Ok(())
    }

    /// Send a final "end of utterance" message.
    pub async fn send_final(&mut self) -> Result<()> {
        let meta = AudioMetadata {
            seq: self.seq,
            sample_rate: 16_000,
            channels: 1,
            format: "none".to_string(),
            is_final: true,
        };
        self.seq += 1;

        let meta_json =
            serde_json::to_string(&meta).context("failed to serialize final metadata")?;

        self.ws_stream
            .send(Message::Text(meta_json))
            .await
            .context("failed to send final frame")?;

        info!("Sent final frame");
        Ok(())
    }

    /// Attempt to read a single text message from the server.
    ///
    /// Returns `Ok(Some(String))` for text frames, `Ok(None)` for other
    /// frames (binary / ping / pong), and `Err` on connection problems.
    pub async fn recv_text(&mut self) -> Result<Option<String>> {
        match self.ws_stream.next().await {
            Some(Ok(Message::Text(t))) => Ok(Some(t)),
            Some(Ok(Message::Binary(b))) => {
                debug!("Received binary frame ({} bytes)", b.len());
                Ok(None)
            }
            Some(Ok(Message::Ping(_))) | Some(Ok(Message::Pong(_))) => Ok(None),
            Some(Ok(Message::Close(_))) => {
                warn!("WebSocket closed by server");
                anyhow::bail!("WebSocket closed");
            }
            Some(Ok(Message::Frame(_))) => Ok(None),
            Some(Err(e)) => {
                error!("WebSocket error: {}", e);
                Err(e.into())
            }
            None => {
                warn!("WebSocket stream ended");
                anyhow::bail!("WebSocket stream ended");
            }
        }
    }

    /// Close the WebSocket connection gracefully.
    pub async fn close(&mut self) -> Result<()> {
        info!("Closing WebSocket connection to {}", self.url);
        self.ws_stream
            .close(None)
            .await
            .context("failed to close websocket")?;
        Ok(())
    }
}
