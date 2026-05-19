"""Action log + undo API."""

from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter, HTTPException, Query

from ..db.repository import ActionLogRepo

router = APIRouter(prefix="/api/actions", tags=["actions"])


@router.get("/log")
async def list_actions(
    session_id: str = Query(...),
    limit: int = Query(50, ge=1, le=200),
) -> dict[str, Any]:
    repo = ActionLogRepo()
    rows = await repo.list(session_id, limit)
    actions = [
        {
            "id": r["id"],
            "tool_name": r["tool_name"],
            "args": json.loads(r["args"]) if r["args"] else {},
            "result": json.loads(r["result"]) if r["result"] else {},
            "undo_data": json.loads(r["undo_data"]) if r["undo_data"] else None,
            "status": r["status"],
            "undoable": r["undoable"],
            "created_at": r["created_at"].isoformat() if r["created_at"] else None,
        }
        for r in rows
    ]
    return {"actions": actions}


@router.get("/undoable")
async def list_undoable(
    session_id: str = Query(...),
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    repo = ActionLogRepo()
    rows = await repo.get_undoable(session_id, limit)
    actions = [
        {
            "id": r["id"],
            "tool_name": r["tool_name"],
            "args": json.loads(r["args"]) if r["args"] else {},
            "created_at": r["created_at"].isoformat() if r["created_at"] else None,
        }
        for r in rows
    ]
    return {"actions": actions}


@router.post("/undo/{action_id}")
async def undo_action(action_id: int) -> dict[str, Any]:
    repo = ActionLogRepo()
    undo_data = await repo.get_undo_data(action_id)
    if undo_data is None:
        raise HTTPException(status_code=400, detail="Action not undoable or already undone")

    # Perform undo based on tool_name and undo_data
    ok = await _perform_undo(undo_data)
    if not ok:
        raise HTTPException(status_code=500, detail="Undo failed")

    marked = await repo.mark_undone(action_id)
    if not marked:
        raise HTTPException(status_code=400, detail="Action could not be marked as undone")

    return {"success": True, "message": "Action undone", "undo_data": undo_data}


async def _perform_undo(undo_data: dict[str, Any]) -> bool:
    """Execute the inverse operation stored in undo_data."""
    tool = undo_data.get("tool")
    moves = undo_data.get("moves", [])
    if not moves:
        return False

    import shutil
    from pathlib import Path

    for move in moves:
        src = move.get("destination")
        dst = move.get("source")
        if not src or not dst:
            continue
        src_path = Path(src)
        dst_path = Path(dst)
        if not src_path.exists():
            continue
        try:
            dst_path.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(str(src_path), str(dst_path))
        except Exception:
            return False
    return True
