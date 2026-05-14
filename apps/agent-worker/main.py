"""Volle Agent Worker — FastAPI + WebSocket voice backend."""

import os
import json
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware

from agent import llm
from agent import mcp_client
from agent.orchestrator import run_pipeline

CSV_PATH = Path(__file__).resolve().parents[2] / "data" / "mock" / "sales_data.csv"


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Volle Agent Worker starting...")
    print(f"Mock data: {CSV_PATH}")
    print(f"LLM ready: {'YES' if llm.API_KEY else 'NO (mock fallback)'}")
    await mcp_client.registry.start_all()
    print(f"MCP servers: {len(mcp_client.registry.list_tools())} tools available")
    yield
    await mcp_client.registry.stop_all()
    print("Volle Agent Worker shutting down...")


app = FastAPI(title="Volle Agent", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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
            if msg.get("type") != "utterance":
                continue

            result = await run_pipeline(msg["text"])
            await websocket.send_json({
                "type": "response",
                "text": result["text"],
                "visual_card": result["card"],
            })
    except Exception as exc:
        print(f"WS error: {exc}")


@app.get("/health")
async def health():
    return {"status": "ok", "llm_ready": bool(llm.API_KEY)}
