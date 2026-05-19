"""Deepgram streaming STT WebSocket proxy.

Frontend opens /ws/voice-stream, sends audio chunks (webm/opus),
backend proxies to Deepgram streaming API and forwards transcripts back.
"""

from __future__ import annotations

import asyncio
import json
import os

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import websockets

router = APIRouter(tags=["voice-stream"])

DEEPGRAM_URL = (
    "wss://api.deepgram.com/v1/listen?"
    "model=nova-2&language=pl&encoding=opus&container=webm&sample_rate=16000&channels=1"
)


@router.websocket("/ws/voice-stream")
async def voice_stream_ws(websocket: WebSocket):
    await websocket.accept()
    deepgram_key = os.getenv("DEEPGRAM_API_KEY", "")
    if not deepgram_key:
        await websocket.close(code=1011, reason="Deepgram API key not configured")
        return

    headers = {"Authorization": f"Token {deepgram_key}"}

    try:
        async with websockets.connect(DEEPGRAM_URL, extra_headers=headers) as dg_ws:
            async def frontend_to_deepgram():
                while True:
                    try:
                        msg = await websocket.receive()
                        if isinstance(msg, bytes):
                            await dg_ws.send(msg)
                        elif isinstance(msg, str):
                            data = json.loads(msg)
                            if data.get("type") == "close":
                                await dg_ws.close()
                                break
                        else:
                            # FastAPI starlette wrapper: dict with bytes/text
                            if "bytes" in msg:
                                await dg_ws.send(msg["bytes"])
                            elif "text" in msg:
                                data = json.loads(msg["text"])
                                if data.get("type") == "close":
                                    await dg_ws.close()
                                    break
                    except WebSocketDisconnect:
                        break
                    except Exception:
                        break

            async def deepgram_to_frontend():
                try:
                    async for raw in dg_ws:
                        data = json.loads(raw)
                        channel = data.get("channel", {})
                        alt = channel.get("alternatives", [{}])[0]
                        transcript = alt.get("transcript", "")
                        is_final = data.get("is_final", False)
                        speech_final = data.get("speech_final", False)

                        await websocket.send_json({
                            "type": "final" if is_final else "interim",
                            "text": transcript,
                            "speech_final": speech_final,
                        })
                except Exception:
                    pass

            await asyncio.gather(frontend_to_deepgram(), deepgram_to_frontend())
    except Exception as exc:
        print(f"Voice stream error: {exc}")
    finally:
        try:
            await websocket.close()
        except Exception:
            pass
