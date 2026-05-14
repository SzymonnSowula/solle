"""Volle Agent Worker — FastAPI + WebSocket voice backend."""

import os
import json
from pathlib import Path
from contextlib import asynccontextmanager

import pandas as pd
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware

from agent import llm
from agent import mcp_client
from agent.orchestrator import run_orchestrator

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
# Analytics engine
# ------------------------------------------------------------------

def get_sales_analytics() -> dict:
    """Return structured sales data for yesterday vs current month."""
    if not CSV_PATH.exists():
        return {"error": "no_data"}

    df = pd.read_csv(CSV_PATH)
    df["date"] = pd.to_datetime(df["date"]).dt.date
    df = df[df["status"] == "completed"]

    yesterday = pd.Timestamp.now().date() - pd.Timedelta(days=1)
    month_start = yesterday.replace(day=1)
    days_so_far = max(1, yesterday.day)

    y_df = df[df["date"] == yesterday]
    m_df = df[(df["date"] >= month_start) & (df["date"] <= yesterday)]

    y_orders = int(y_df.shape[0])
    y_revenue = float(y_df["amount"].sum())
    m_orders = int(m_df.shape[0])
    m_revenue = float(m_df["amount"].sum())

    m_avg_orders = m_orders / days_so_far
    m_avg_revenue = m_revenue / days_so_far

    diff_pct = ((y_revenue - m_avg_revenue) / m_avg_revenue * 100) if m_avg_revenue else 0
    diff_orders_pct = ((y_orders - m_avg_orders) / m_avg_orders * 100) if m_avg_orders else 0

    return {
        "yesterday": {
            "date": str(yesterday),
            "orders": y_orders,
            "revenue_pln": round(y_revenue, 2),
        },
        "month_avg_daily": {
            "orders": round(m_avg_orders, 1),
            "revenue_pln": round(m_avg_revenue, 2),
        },
        "diff": {
            "revenue_pct": round(diff_pct, 1),
            "orders_pct": round(diff_orders_pct, 1),
        },
    }


def build_card(data: dict) -> dict:
    """Build visual card from analytics dict."""
    y = data["yesterday"]
    avg = data["month_avg_daily"]
    diff = data["diff"]
    return {
        "title": "Podsumowanie sprzedaży",
        "metrics": [
            {"label": "Wczoraj (zamówienia)", "value": f"{y['orders']}"},
            {"label": "Wczoraj (przychód)", "value": f"{y['revenue_pln']:,.0f} PLN"},
            {"label": "Średnia dzienna (miesiąc)", "value": f"{avg['revenue_pln']:,.0f} PLN"},
            {"label": "Różnica przychodu", "value": f"{diff['revenue_pct']:+.0f}%"},
            {"label": "Różnica zamówień", "value": f"{diff['orders_pct']:+.0f}%"},
        ],
    }


def build_mock_text(data: dict) -> str:
    """Hardcoded text generator when LLM is unavailable."""
    y = data["yesterday"]
    avg = data["month_avg_daily"]
    diff = data["diff"]
    trend = "wyżej" if diff["revenue_pct"] > 0 else "niżej"
    tone = "dobry" if diff["revenue_pct"] > 0 else "słabszy"
    return (
        f"Wczoraj był {tone} dzień. "
        f"Zrealizowaliśmy {y['orders']} zamówień na kwotę {y['revenue_pln']:,.0f} złotych. "
        f"To o {abs(diff['revenue_pct']):.0f} procent {trend} od średniej dziennej tego miesiąca, "
        f"która wynosi {avg['revenue_pln']:,.0f} zł. "
        f"Liczba zamówień wzrosła o {abs(diff['orders_pct']):.0f} procent względem średniej."
    )


async def process_sales_query(user_text: str) -> dict:
    """Run analytics and ask LLM to narrate the result."""
    data = get_sales_analytics()
    if data.get("error"):
        return {"text": "Nie znalazłem danych sprzedażowych.", "card": None}

    card = build_card(data)

    llm_prompt = (
        f"Użytkownik pyta: '{user_text}'\n\n"
        f"Oto dane analityczne (JSON):\n{json.dumps(data, ensure_ascii=False)}\n\n"
        "Przedstaw to naturalnie, po polsku, jak podczas rozmowy. "
        "Użyj konkretnych liczb. Maksymalnie 3-4 zdania. Zacznij od razu od sedna."
    )

    llm_text = await llm.chat(llm_prompt)
    text = llm_text if llm_text else build_mock_text(data)
    return {"text": text, "card": card}


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

            result = await run_orchestrator(msg["text"])
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
