"""Tests for onboarding API."""

import pytest
from httpx import ASGITransport, AsyncClient

from main import app
from db.connection import init_pool, close_pool
from db.migrations import run_migrations


@pytest.fixture
async def client():
    await init_pool()
    await run_migrations()
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac
    await close_pool()


@pytest.mark.asyncio
async def test_onboarding_status(client):
    r = await client.get("/api/onboarding/status")
    assert r.status_code == 200
    data = r.json()
    assert data["complete"] is False
    assert data["profile_done"] is True


@pytest.mark.asyncio
async def test_profile_and_complete(client):
    r = await client.post("/api/onboarding/profile", json={
        "user_name": "Marek",
        "company_type": "Sklep zoologiczny",
    })
    assert r.status_code == 200
    assert r.json()["user_name"] == "Marek"

    r = await client.post("/api/onboarding/integrations", json={
        "integrations": [{"name": "shopify", "config": {"url": "x"}, "active": True}]
    })
    assert r.status_code == 200

    r = await client.post("/api/onboarding/complete")
    assert r.status_code == 200
    assert r.json()["complete"] is True

    r = await client.get("/api/onboarding/status")
    assert r.json()["complete"] is True
