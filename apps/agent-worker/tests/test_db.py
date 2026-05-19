"""Tests for DB layer."""

import pytest
import asyncpg

from db.connection import init_pool, close_pool, get_pool, DATABASE_URL
from db.migrations import run_migrations
from db.repository import UserRepo, SettingsRepo, SessionRepo, IntegrationRepo


@pytest.fixture
async def pool():
    p = await init_pool()
    yield p
    await close_pool()


@pytest.fixture
async def fresh_db(pool):
    async with pool.acquire() as conn:
        await conn.execute("""
            DROP TABLE IF EXISTS messages CASCADE;
            DROP TABLE IF EXISTS sessions CASCADE;
            DROP TABLE IF EXISTS integrations CASCADE;
            DROP TABLE IF EXISTS settings CASCADE;
            DROP TABLE IF EXISTS users CASCADE;
            DROP TABLE IF EXISTS _migrations CASCADE;
        """)
    await run_migrations()


@pytest.mark.asyncio
async def test_migrations_run(fresh_db):
    pool = get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchval("SELECT COUNT(*) FROM _migrations")
        assert row == 2  # 001_initial + 002_add_encryption


@pytest.mark.asyncio
async def test_user_repo_get_or_create(fresh_db):
    user = await UserRepo().get_or_create()
    assert user["user_name"] == "Szef"
    assert user["onboarding_complete"] is False

    # Second call returns same user
    user2 = await UserRepo().get_or_create()
    assert user2["id"] == user["id"]


@pytest.mark.asyncio
async def test_user_repo_update(fresh_db):
    user = await UserRepo().get_or_create()
    updated = await UserRepo().update_profile(
        user["id"],
        user_name="Marek",
        onboarding_complete=True,
    )
    assert updated["user_name"] == "Marek"
    assert updated["onboarding_complete"] is True


@pytest.mark.asyncio
async def test_settings_repo(fresh_db):
    user = await UserRepo().get_or_create()
    await SettingsRepo().set(user["id"], "theme", "dark")
    val = await SettingsRepo().get(user["id"], "theme")
    assert val == "dark"


@pytest.mark.asyncio
async def test_integration_repo(fresh_db):
    user = await UserRepo().get_or_create()
    row = await IntegrationRepo().upsert(
        user["id"], "shopify", {"store_url": "test.myshopify.com"}, active=True
    )
    assert row["name"] == "shopify"
    assert row["active"] is True

    rows = await IntegrationRepo().list(user["id"])
    assert len(rows) == 1

    await IntegrationRepo().delete(user["id"], "shopify")
    rows = await IntegrationRepo().list(user["id"])
    assert len(rows) == 0


@pytest.mark.asyncio
async def test_session_repo(fresh_db):
    user = await UserRepo().get_or_create()
    sid = await SessionRepo().create(user["id"])
    assert sid

    await SessionRepo().add_message(sid, "user", "Hello")
    history = await SessionRepo().get_history(sid)
    assert len(history) == 1
    assert history[0]["role"] == "user"
