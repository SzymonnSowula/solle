"""Onboarding API endpoints."""

from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter, HTTPException

from db import UserRepo, IntegrationRepo, SettingsRepo, run_migrations, init_pool

router = APIRouter(prefix="/api/onboarding", tags=["onboarding"])


@router.on_event("startup")
async def _startup():
    await init_pool()
    await run_migrations()


@router.get("/status")
async def onboarding_status() -> dict[str, Any]:
    """Return onboarding completion status."""
    user = await UserRepo().get_or_create()
    integrations = await IntegrationRepo().list(user["id"])
    return {
        "complete": user["onboarding_complete"],
        "profile_done": bool(user["user_name"]),
        "integrations_count": len(integrations),
        "integrations": [
            {"name": i["name"], "active": i["active"]} for i in integrations
        ],
    }


@router.post("/profile")
async def save_profile(body: dict[str, Any]) -> dict[str, Any]:
    """Save user profile during onboarding."""
    user = await UserRepo().get_or_create()
    updates: dict[str, Any] = {}
    if "user_name" in body:
        updates["user_name"] = body["user_name"]
    if "preferred_tone" in body:
        updates["preferred_tone"] = body["preferred_tone"]
    if updates:
        await UserRepo().update_profile(user["id"], **updates)

    # Store workflow fields as settings kv since DB schema has no columns for them
    settings = SettingsRepo()
    if "tasks" in body:
        await settings.set(user["id"], "tasks", json.dumps(body["tasks"]))
    if "important_folders" in body:
        await settings.set(user["id"], "important_folders", json.dumps(body["important_folders"]))

    return {"status": "saved"}


@router.post("/integrations")
async def save_integrations(body: dict[str, Any]) -> dict[str, Any]:
    """Save one or more integrations. Body: { integrations: [{name, config, active}] }."""
    user = await UserRepo().get_or_create()
    repo = IntegrationRepo()
    saved = []
    for item in body.get("integrations", []):
        row = await repo.upsert(
            user_id=user["id"],
            name=item["name"],
            config=item.get("config", {}),
            active=item.get("active", True),
        )
        saved.append({"name": row["name"], "active": row["active"]})
    return {"saved": saved}


@router.post("/complete")
async def complete_onboarding() -> dict[str, Any]:
    """Mark onboarding as complete."""
    user = await UserRepo().get_or_create()
    updated = await UserRepo().update_profile(
        user["id"], onboarding_complete=True
    )
    return {"complete": updated["onboarding_complete"]}
