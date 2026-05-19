"""ElevenLabs Conversational AI management endpoints.

Allows the frontend to:
  - list configured agents
  - switch the active agent persona (business / desktop / general)
  - get signed WebSocket URLs for direct ElevenLabs voice streaming
  - update system prompts live
"""

from __future__ import annotations

import os
from typing import Any

from fastapi import APIRouter, HTTPException

from agent import elevenlabs_agent as el
from db import UserRepo, SettingsRepo

router = APIRouter(prefix="/api/elevenlabs", tags=["elevenlabs"])


@router.get("/agents")
async def list_agents() -> dict[str, Any]:
    """List all ElevenLabs agents owned by this account."""
    if not el.ELEVENLABS_API_KEY:
        raise HTTPException(status_code=503, detail="ElevenLabs API key not configured")
    client = el.ElevenLabsAgentClient()
    agents = await client.list_agents()
    return {
        "agents": [
            {
                "id": a.get("agent_id"),
                "name": a.get("name"),
                "voice_id": a.get("conversation_config", {}).get("tts", {}).get("voice_id"),
            }
            for a in agents
        ]
    }


@router.post("/ensure-defaults")
async def ensure_defaults() -> dict[str, Any]:
    """Idempotently create / update the three Volle personas on ElevenLabs.

    Returns the agent IDs so the frontend can cache them.
    """
    if not el.ELEVENLABS_API_KEY:
        raise HTTPException(status_code=503, detail="ElevenLabs API key not configured")
    ids = await el.ensure_volle_agents()
    return {"agents": ids}


@router.get("/signed-url/{agent_key}")
async def signed_url(agent_key: str) -> dict[str, str]:
    """Return a short-lived signed WebSocket URL for the requested agent persona.

    agent_key: business | desktop | general
    """
    if not el.ELEVENLABS_API_KEY:
        raise HTTPException(status_code=503, detail="ElevenLabs API key not configured")

    # Load cached agent IDs from settings
    user = await UserRepo().get_or_create()
    raw = await SettingsRepo().get(user["id"], "elevenlabs_agent_ids")
    if not raw:
        raise HTTPException(status_code=400, detail="Agents not initialized. Call POST /ensure-defaults first.")

    ids: dict = __import__("json").loads(raw)
    agent_id = ids.get(agent_key)
    if not agent_id:
        raise HTTPException(status_code=404, detail=f"No agent for key '{agent_key}'")

    client = el.ElevenLabsAgentClient()
    url = await client.create_signed_url(agent_id)
    return {"signed_url": url, "agent_key": agent_key}


@router.get("/system-prompts")
async def list_system_prompts() -> dict[str, Any]:
    """Return the three built-in system prompt templates for review / editing."""
    return {
        "business": el.BUSINESS_ANALYTICS_SYSTEM_PROMPT,
        "desktop": el.DESKTOP_AUTOMATION_SYSTEM_PROMPT,
        "general": el.GENERAL_PURPOSE_SYSTEM_PROMPT,
    }


@router.post("/system-prompts/{mode}")
async def update_system_prompt(mode: str, body: dict[str, Any]) -> dict[str, Any]:
    """Push a new system prompt to the ElevenLabs agent (and persist locally)."""
    if mode not in ("business", "desktop", "general"):
        raise HTTPException(status_code=400, detail="mode must be business | desktop | general")

    prompt = body.get("prompt", "").strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="prompt is required")

    # Persist locally
    user = await UserRepo().get_or_create()
    await SettingsRepo().set(user["id"], f"system_prompt_{mode}", prompt)

    # Push to ElevenLabs if we have IDs
    raw = await SettingsRepo().get(user["id"], "elevenlabs_agent_ids")
    if raw and el.ELEVENLABS_API_KEY:
        ids = __import__("json").loads(raw)
        agent_id = ids.get(mode)
        if agent_id:
            client = el.ElevenLabsAgentClient()
            await client.update_agent(agent_id, system_prompt=prompt)
            return {"status": "synced", "mode": mode}

    return {"status": "saved_locally", "mode": mode}


@router.get("/config")
async def get_config() -> dict[str, Any]:
    """Current ElevenLabs integration status."""
    return {
        "enabled": bool(el.ELEVENLABS_API_KEY),
        "voice_id": el.DEFAULT_VOICE_ID,
    }
