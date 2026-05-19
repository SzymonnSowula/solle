"""Voice API endpoints — STT via Deepgram, TTS via ElevenLabs."""

from __future__ import annotations

import os
from typing import Any

import httpx
from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse

router = APIRouter(prefix="/api/voice", tags=["voice"])

DEEPGRAM_API_KEY = os.getenv("DEEPGRAM_API_KEY", "")
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "")
ELEVENLABS_VOICE_ID = os.getenv("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM")
ELEVENLABS_MODEL = os.getenv("ELEVENLABS_MODEL", "eleven_turbo_v2_5")


@router.post("/stt")
async def speech_to_text(audio: UploadFile = File(...)) -> dict[str, Any]:
    if not DEEPGRAM_API_KEY:
        raise HTTPException(status_code=503, detail="Deepgram API key not configured")

    headers = {
        "Authorization": f"Token {DEEPGRAM_API_KEY}",
        "Content-Type": audio.content_type or "audio/webm",
    }

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://api.deepgram.com/v1/listen?model=nova-2&language=pl&smart_format=true",
            headers=headers,
            content=await audio.read(),
            timeout=30.0,
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=resp.status_code, detail=resp.text)

    data = resp.json()
    transcript = ""
    try:
        transcript = data["results"]["channels"][0]["alternatives"][0]["transcript"]
    except (KeyError, IndexError):
        pass

    return {"text": transcript}


@router.post("/tts")
async def text_to_speech(body: dict[str, Any]) -> StreamingResponse:
    if not ELEVENLABS_API_KEY:
        raise HTTPException(status_code=503, detail="ElevenLabs API key not configured")

    text = body.get("text", "")
    if not text:
        raise HTTPException(status_code=400, detail="text is required")

    voice_id = body.get("voice_id", ELEVENLABS_VOICE_ID)
    model_id = body.get("model_id", ELEVENLABS_MODEL)

    headers = {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
    }

    payload = {
        "text": text,
        "model_id": model_id,
    }

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}/stream",
            headers=headers,
            json=payload,
            timeout=60.0,
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=resp.status_code, detail=resp.text)

    return StreamingResponse(
        resp.aiter_bytes(),
        media_type="audio/mpeg",
    )
