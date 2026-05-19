"""Meeting Assistant API (scaffold).

Captures desktop audio (Teams/Meet), streams to Deepgram for transcription,
writes notes to Obsidian, and allows voice Q&A during the meeting.

Full implementation requires:
- Windows WASAPI loopback capture (Rust/Tauri side)
- Audio routing from system output to Deepgram streaming STT
- Real-time transcript aggregation and summarization
- Voice interrupt during meeting for Q&A
"""

from __future__ import annotations

from fastapi import APIRouter

router = APIRouter(prefix="/api/meeting", tags=["meeting"])


@router.post("/start")
async def start_meeting():
    """Start capturing desktop audio and transcribing."""
    return {
        "status": "scaffold",
        "message": (
            "Meeting assistant requires Windows WASAPI loopback audio capture. "
            "Use a virtual audio cable (e.g. VB-Cable) and route system audio "
            "to the microphone input, then call /ws/voice-stream with that input."
        ),
    }


@router.post("/stop")
async def stop_meeting():
    """Stop capture and save transcript to Obsidian."""
    return {
        "status": "scaffold",
        "message": "Stop capture and save final transcript to Obsidian vault.",
    }


@router.get("/status")
async def meeting_status():
    return {"active": False, "transcript_lines": 0, "duration_seconds": 0}
