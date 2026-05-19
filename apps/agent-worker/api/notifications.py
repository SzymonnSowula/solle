"""Notifications API."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from db.repository import NotificationRepo, UserRepo

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


async def _get_first_user_id() -> int:
    user = await UserRepo().get_or_create()
    return user["id"]


@router.get("")
async def list_notifications(unread_only: bool = False, limit: int = 20):
    user_id = await _get_first_user_id()
    rows = await NotificationRepo().list(user_id, unread_only=unread_only, limit=limit)
    return {
        "notifications": [
            {
                "id": r["id"],
                "type": r["type"],
                "title": r["title"],
                "message": r["message"],
                "data": r["data"],
                "read": r["read"],
                "created_at": r["created_at"].isoformat(),
            }
            for r in rows
        ]
    }


@router.post("/{notification_id}/read")
async def mark_read(notification_id: int):
    await NotificationRepo().mark_read(notification_id)
    return {"status": "ok"}


@router.post("/read-all")
async def mark_all_read():
    user_id = await _get_first_user_id()
    await NotificationRepo().mark_all_read(user_id)
    return {"status": "ok"}
