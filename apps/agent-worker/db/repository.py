"""Data access layer."""

from __future__ import annotations

import json
import uuid
from typing import Any

import asyncpg

from .connection import get_pool


class _BaseRepo:
    def __init__(self, pool: asyncpg.Pool | None = None):
        self._pool = pool

    async def _get_conn(self) -> asyncpg.Pool:
        return self._pool or get_pool()


class UserRepo(_BaseRepo):
    async def get_or_create(self) -> asyncpg.Record:
        pool = await self._get_conn()
        async with pool.acquire() as conn:
            row = await conn.fetchrow("SELECT * FROM users ORDER BY id LIMIT 1")
            if row:
                return row
            return await conn.fetchrow(
                "INSERT INTO users DEFAULT VALUES RETURNING *"
            )

    async def update_profile(
        self,
        user_id: int,
        *,
        user_name: str | None = None,
        company_type: str | None = None,
        preferred_tone: str | None = None,
        common_metrics: list[str] | None = None,
        onboarding_complete: bool | None = None,
    ) -> asyncpg.Record:
        pool = await self._get_conn()
        async with pool.acquire() as conn:
            parts = []
            vals = []
            if user_name is not None:
                parts.append("user_name = $1")
                vals.append(user_name)
            if company_type is not None:
                parts.append(f"company_type = ${len(vals)+1}")
                vals.append(company_type)
            if preferred_tone is not None:
                parts.append(f"preferred_tone = ${len(vals)+1}")
                vals.append(preferred_tone)
            if common_metrics is not None:
                parts.append(f"common_metrics = ${len(vals)+1}")
                vals.append(common_metrics)
            if onboarding_complete is not None:
                parts.append(f"onboarding_complete = ${len(vals)+1}")
                vals.append(onboarding_complete)
            if not parts:
                return await conn.fetchrow("SELECT * FROM users WHERE id=$1", user_id)
            sql = f"UPDATE users SET {', '.join(parts)}, updated_at=NOW() WHERE id=${len(vals)+1} RETURNING *"
            vals.append(user_id)
            return await conn.fetchrow(sql, *vals)


class SettingsRepo(_BaseRepo):
    async def get(self, user_id: int, key: str) -> str | None:
        pool = await self._get_conn()
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT value FROM settings WHERE user_id=$1 AND key=$2",
                user_id, key,
            )
            return row["value"] if row else None

    async def set(self, user_id: int, key: str, value: str) -> None:
        pool = await self._get_conn()
        async with pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO settings (user_id, key, value)
                VALUES ($1, $2, $3)
                ON CONFLICT (user_id, key)
                DO UPDATE SET value = EXCLUDED.value
                """,
                user_id, key, value,
            )


class IntegrationRepo(_BaseRepo):
    async def list(self, user_id: int) -> list[asyncpg.Record]:
        pool = await self._get_conn()
        async with pool.acquire() as conn:
            return await conn.fetch(
                "SELECT id, name, config, active, created_at FROM integrations WHERE user_id=$1",
                user_id,
            )

    async def upsert(
        self,
        user_id: int,
        name: str,
        config: dict[str, Any],
        active: bool = True,
    ) -> asyncpg.Record:
        pool = await self._get_conn()
        async with pool.acquire() as conn:
            return await conn.fetchrow(
                """
                INSERT INTO integrations (user_id, name, config, active)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (user_id, name)
                DO UPDATE SET config = EXCLUDED.config, active = EXCLUDED.active, updated_at = NOW()
                RETURNING *
                """,
                user_id, name, json.dumps(config), active,
            )

    async def delete(self, user_id: int, name: str) -> None:
        pool = await self._get_conn()
        async with pool.acquire() as conn:
            await conn.execute(
                "DELETE FROM integrations WHERE user_id=$1 AND name=$2",
                user_id, name,
            )


class SessionRepo(_BaseRepo):
    async def create(self, user_id: int, session_id: str | None = None) -> str:
        sid = session_id or str(uuid.uuid4())
        pool = await self._get_conn()
        async with pool.acquire() as conn:
            await conn.execute(
                "INSERT INTO sessions (id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
                sid, user_id,
            )
        return sid

    async def add_message(
        self,
        session_id: str,
        role: str,
        content: str,
        *,
        tool_calls: list[dict] | None = None,
        tool_results: list[Any] | None = None,
        visual_card: dict[str, Any] | None = None,
    ) -> None:
        pool = await self._get_conn()
        async with pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO messages (session_id, role, content, tool_calls, tool_results, visual_card)
                VALUES ($1, $2, $3, $4, $5, $6)
                """,
                session_id,
                role,
                content,
                json.dumps(tool_calls) if tool_calls else None,
                json.dumps(tool_results) if tool_results else None,
                json.dumps(visual_card) if visual_card else None,
            )

    async def get_history(self, session_id: str, limit: int = 20) -> list[asyncpg.Record]:
        pool = await self._get_conn()
        async with pool.acquire() as conn:
            return await conn.fetch(
                """
                SELECT role, content, tool_calls, tool_results, visual_card, created_at
                FROM messages
                WHERE session_id=$1
                ORDER BY created_at DESC
                LIMIT $2
                """,
                session_id, limit,
            )


class ActionLogRepo(_BaseRepo):
    async def log(
        self,
        session_id: str | None,
        tool_name: str,
        args: dict[str, Any],
        result: dict[str, Any],
        undo_data: dict[str, Any] | None = None,
        undoable: bool = False,
        status: str = "completed",
    ) -> int:
        pool = await self._get_conn()
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                INSERT INTO action_logs (session_id, tool_name, args, result, undo_data, undoable, status)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING id
                """,
                session_id,
                tool_name,
                json.dumps(args),
                json.dumps(result),
                json.dumps(undo_data) if undo_data else None,
                undoable,
                status,
            )
            return row["id"]

    async def list(self, session_id: str, limit: int = 50) -> list[asyncpg.Record]:
        pool = await self._get_conn()
        async with pool.acquire() as conn:
            return await conn.fetch(
                """
                SELECT id, tool_name, args, result, undo_data, status, undoable, created_at
                FROM action_logs
                WHERE session_id=$1
                ORDER BY created_at DESC
                LIMIT $2
                """,
                session_id, limit,
            )

    async def get_undoable(self, session_id: str, limit: int = 20) -> list[asyncpg.Record]:
        pool = await self._get_conn()
        async with pool.acquire() as conn:
            return await conn.fetch(
                """
                SELECT id, tool_name, args, result, undo_data, created_at
                FROM action_logs
                WHERE session_id=$1 AND undoable = TRUE AND status = 'completed'
                ORDER BY created_at DESC
                LIMIT $2
                """,
                session_id, limit,
            )

    async def get_undo_data(self, action_id: int) -> dict[str, Any] | None:
        pool = await self._get_conn()
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT undo_data FROM action_logs WHERE id=$1 AND undoable = TRUE AND status = 'completed'",
                action_id,
            )
            if not row or not row["undo_data"]:
                return None
            return json.loads(row["undo_data"])

    async def mark_undone(self, action_id: int) -> bool:
        pool = await self._get_conn()
        async with pool.acquire() as conn:
            result = await conn.execute(
                "UPDATE action_logs SET status = 'undone' WHERE id=$1 AND undoable = TRUE AND status = 'completed'",
                action_id,
            )
            return result == "UPDATE 1"


class NotificationRepo(_BaseRepo):
    async def create(self, user_id: int, type: str, title: str, message: str, data: dict[str, Any] | None = None) -> int:
        pool = await self._get_conn()
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                INSERT INTO notifications (user_id, type, title, message, data)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING id
                """,
                user_id, type, title, message, json.dumps(data or {}),
            )
            return row["id"]

    async def list(self, user_id: int, unread_only: bool = False, limit: int = 20) -> list[asyncpg.Record]:
        pool = await self._get_conn()
        async with pool.acquire() as conn:
            if unread_only:
                return await conn.fetch(
                    """
                    SELECT id, type, title, message, data, read, created_at
                    FROM notifications
                    WHERE user_id = $1 AND read = FALSE
                    ORDER BY created_at DESC
                    LIMIT $2
                    """,
                    user_id, limit,
                )
            return await conn.fetch(
                """
                SELECT id, type, title, message, data, read, created_at
                FROM notifications
                WHERE user_id = $1
                ORDER BY created_at DESC
                LIMIT $2
                """,
                user_id, limit,
            )

    async def mark_read(self, notification_id: int) -> None:
        pool = await self._get_conn()
        async with pool.acquire() as conn:
            await conn.execute(
                "UPDATE notifications SET read = TRUE WHERE id = $1",
                notification_id,
            )

    async def mark_all_read(self, user_id: int) -> None:
        pool = await self._get_conn()
        async with pool.acquire() as conn:
            await conn.execute(
                "UPDATE notifications SET read = TRUE WHERE user_id = $1",
                user_id,
            )
