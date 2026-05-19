"""Settings API endpoints."""

from __future__ import annotations

import json
import os
from typing import Any

from fastapi import APIRouter

from db import UserRepo, SettingsRepo, IntegrationRepo
from agent import llm

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("/llm/provider")
async def get_llm_provider() -> dict[str, Any]:
    """Return current LLM provider config."""
    return {
        "provider": llm._PROVIDER,
        "openai_model": llm._OPENAI_MODEL,
        "local_model": llm._LOCAL_MODEL,
        "local_url": llm._LOCAL_BASE,
    }


@router.post("/llm/provider")
async def set_llm_provider(body: dict[str, Any]) -> dict[str, Any]:
    """Switch LLM provider at runtime. Persists in settings DB."""
    user = await UserRepo().get_or_create()
    provider = body.get("provider", "openai")
    # Update in-memory module var (not thread-perfect but sufficient for single-worker dev)
    llm._PROVIDER = provider.lower().strip()
    if "local_model" in body:
        llm._LOCAL_MODEL = body["local_model"]
    if "local_url" in body:
        llm._LOCAL_BASE = body["local_url"]
    # Persist
    await SettingsRepo().set(user["id"], "llm_provider", llm._PROVIDER)
    await SettingsRepo().set(user["id"], "local_llm_model", llm._LOCAL_MODEL)
    await SettingsRepo().set(user["id"], "local_llm_url", llm._LOCAL_BASE)
    return {"provider": llm._PROVIDER}


@router.get("/llm/local-status")
async def get_local_llm_status() -> dict[str, Any]:
    """Probe local LLM server."""
    return await llm.local_llm_status()


@router.get("/profile")
async def get_profile() -> dict[str, Any]:
    user = await UserRepo().get_or_create()
    settings = SettingsRepo()
    tasks_raw = await settings.get(user["id"], "tasks")
    folders_raw = await settings.get(user["id"], "important_folders")
    tasks = json.loads(tasks_raw) if tasks_raw else []
    folders = json.loads(folders_raw) if folders_raw else []
    return {
        "user_name": user["user_name"],
        "preferred_tone": user["preferred_tone"],
        "tasks": tasks,
        "important_folders": folders,
    }


@router.patch("/profile")
async def patch_profile(body: dict[str, Any]) -> dict[str, Any]:
    user = await UserRepo().get_or_create()
    updates: dict[str, Any] = {}
    if "user_name" in body:
        updates["user_name"] = body["user_name"]
    if "preferred_tone" in body:
        updates["preferred_tone"] = body["preferred_tone"]
    if updates:
        await UserRepo().update_profile(user["id"], **updates)

    settings = SettingsRepo()
    if "tasks" in body:
        await settings.set(user["id"], "tasks", json.dumps(body["tasks"]))
    if "important_folders" in body:
        await settings.set(user["id"], "important_folders", json.dumps(body["important_folders"]))

    return {"status": "saved"}


@router.get("/integrations")
async def get_integrations() -> list[dict[str, Any]]:
    user = await UserRepo().get_or_create()
    rows = await IntegrationRepo().list(user["id"])
    return [
        {"id": r["id"], "name": r["name"], "config": r["config"], "active": r["active"]}
        for r in rows
    ]


@router.post("/integrations")
async def upsert_integration(body: dict[str, Any]) -> dict[str, Any]:
    user = await UserRepo().get_or_create()
    row = await IntegrationRepo().upsert(
        user_id=user["id"],
        name=body["name"],
        config=body.get("config", {}),
        active=body.get("active", True),
    )
    return {"id": row["id"], "name": row["name"], "active": row["active"]}


@router.delete("/integrations/{name}")
async def delete_integration(name: str) -> dict[str, str]:
    user = await UserRepo().get_or_create()
    await IntegrationRepo().delete(user["id"], name)
    return {"status": "deleted"}


@router.get("/kv/{key}")
async def get_kv(key: str) -> dict[str, Any]:
    user = await UserRepo().get_or_create()
    val = await SettingsRepo().get(user["id"], key)
    return {"key": key, "value": val}


@router.post("/kv/{key}")
async def set_kv(key: str, body: dict[str, Any]) -> dict[str, Any]:
    user = await UserRepo().get_or_create()
    await SettingsRepo().set(user["id"], key, body.get("value", ""))
    return {"key": key, "value": body.get("value", "")}


@router.post("/smtp/test")
async def test_smtp(body: dict[str, Any]) -> dict[str, Any]:
    """Basic SMTP connectivity test."""
    import smtplib
    host = body.get("host", "")
    port = int(body.get("port", 587))
    username = body.get("username", "")
    password = body.get("password", "")
    use_tls = body.get("tls", True)
    try:
        server = smtplib.SMTP(host, port, timeout=10)
        if use_tls:
            server.starttls()
        if username and password:
            server.login(username, password)
        server.quit()
        return {"ok": True}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}
