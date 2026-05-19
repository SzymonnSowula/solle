"""Volle Agent Worker — FastAPI + WebSocket voice backend."""

from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware

from agent import llm
from agent import mcp_client
from agent.orchestrator import run_pipeline, handle_confirmation
from db import init_pool, close_pool, run_migrations
from db.repository import UserRepo, SettingsRepo
from api import onboarding, settings, voice, actions, voice_stream, notifications, meeting
from tasks.auto_fetch import start_scheduler, stop_scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Volle Agent Worker starting...")
    print(f"LLM ready: {'YES' if llm._OPENAI_KEY or llm._PROVIDER == 'local' else 'NO (mock fallback)'}")
    await init_pool()
    await run_migrations()
    print("DB ready")
    # Load persisted LLM provider settings
    try:
        user = await UserRepo().get_or_create()
        prov = await SettingsRepo().get(user["id"], "llm_provider")
        if prov:
            llm._PROVIDER = prov
        local_model = await SettingsRepo().get(user["id"], "local_llm_model")
        if local_model:
            llm._LOCAL_MODEL = local_model
        local_url = await SettingsRepo().get(user["id"], "local_llm_url")
        if local_url:
            llm._LOCAL_BASE = local_url
        print(f"LLM provider loaded from DB: {llm._PROVIDER}")
    except Exception as exc:
        print(f"[settings] Could not load persisted LLM provider: {exc}")
    await mcp_client.registry.start_all()
    print(f"MCP servers: {len(mcp_client.registry.list_tools())} tools available")
    start_scheduler()
    yield
    stop_scheduler()
    await mcp_client.registry.stop_all()
    await close_pool()
    print("Volle Agent Worker shutting down...")


app = FastAPI(title="Volle Agent", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(onboarding.router)
app.include_router(settings.router)
app.include_router(voice.router)
app.include_router(actions.router)
app.include_router(voice_stream.router)
app.include_router(notifications.router)
app.include_router(meeting.router)


# ------------------------------------------------------------------
# WebSocket voice endpoint
# ------------------------------------------------------------------

@app.websocket("/ws/voice")
async def voice_ws(websocket: WebSocket):
    await websocket.accept()
    await websocket.send_json({"type": "connected"})
    try:
        while True:
            msg = await websocket.receive_json()
            if msg.get("type") == "confirm":
                session_id = msg.get("session_id")
                tool = msg.get("tool")
                args = msg.get("args", {})
                result = await handle_confirmation(session_id, tool, args)
                await websocket.send_json({
                    "type": "response",
                    "text": result["text"],
                    "visual_card": result["card"],
                    "session_id": result["session_id"],
                })
                continue

            if msg.get("type") != "utterance":
                continue

            session_id = msg.get("session_id")
            result = await run_pipeline(msg["text"], session_id=session_id)
            await websocket.send_json({
                "type": "response",
                "text": result["text"],
                "visual_card": result["card"],
                "session_id": result["session_id"],
                "needs_confirmation": result.get("needs_confirmation", False),
                "pending_action": result.get("pending_action"),
            })
    except Exception as exc:
        print(f"WS error: {exc}")


@app.get("/health")
async def health():
    return {"status": "ok", "llm_ready": bool(llm.API_KEY)}
