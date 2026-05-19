"""Background auto-fetch loop using APScheduler.

Checks configured integrations periodically and creates notifications
for upcoming events, new emails, etc.
"""

from __future__ import annotations

import json
from datetime import datetime, timedelta

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from agent import mcp_client
from db.repository import UserRepo, NotificationRepo

_scheduler: AsyncIOScheduler | None = None


async def _check_calendar() -> None:
    """Check calendar for events in the next 15 minutes."""
    try:
        user = await UserRepo().get_or_create()
        user_id = user["id"]
        result = await mcp_client.call_tool("list_events", {"days": 1})
        try:
            data = json.loads(result)
        except Exception:
            return
        events = data.get("events", [])
        now = datetime.utcnow()
        soon = now + timedelta(minutes=15)
        for ev in events:
            start_str = ev.get("start")
            if not start_str:
                continue
            try:
                ev_start = datetime.fromisoformat(start_str.replace("Z", "+00:00"))
            except Exception:
                continue
            if now <= ev_start <= soon:
                title = ev.get("title", "Wydarzenie")
                await NotificationRepo().create(
                    user_id=user_id,
                    type="calendar",
                    title="Nadchodzące wydarzenie",
                    message=f"{title} za {int((ev_start - now).total_seconds() / 60)} minut.",
                    data=ev,
                )
    except Exception as exc:
        print(f"[auto_fetch] calendar check failed: {exc}")


async def _check_tasks() -> None:
    """Check for tasks due today."""
    try:
        user = await UserRepo().get_or_create()
        user_id = user["id"]
        result = await mcp_client.call_tool("list_tasks", {"status": "pending"})
        try:
            data = json.loads(result)
        except Exception:
            return
        tasks = data.get("tasks", [])
        for t in tasks:
            due = t.get("due_date")
            if due:
                await NotificationRepo().create(
                    user_id=user_id,
                    type="task",
                    title="Zadanie do wykonania",
                    message=t.get("title", "Zadanie"),
                    data=t,
                )
    except Exception as exc:
        print(f"[auto_fetch] tasks check failed: {exc}")


def start_scheduler() -> AsyncIOScheduler:
    """Start the background auto-fetch scheduler."""
    global _scheduler
    _scheduler = AsyncIOScheduler()
    _scheduler.add_job(_check_calendar, IntervalTrigger(minutes=5), id="calendar_check", replace_existing=True)
    _scheduler.add_job(_check_tasks, IntervalTrigger(minutes=30), id="tasks_check", replace_existing=True)
    _scheduler.start()
    print("[auto_fetch] Scheduler started (calendar every 5min, tasks every 30min)")
    return _scheduler


def stop_scheduler() -> None:
    global _scheduler
    if _scheduler:
        _scheduler.shutdown()
        _scheduler = None
