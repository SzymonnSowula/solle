import os
import json
import asyncio
from pathlib import Path
from contextlib import asynccontextmanager

import pandas as pd
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware

CSV_PATH = Path(__file__).resolve().parents[2] / "data" / "mock" / "sales_data.csv"

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Volle Agent Worker starting...")
    print(f"Mock data: {CSV_PATH}")
    yield
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

def analyze_sales():
    if not CSV_PATH.exists():
        return {
            "text": "Nie znalazłem danych sprzedażowych. Upewnij się, że plik CSV istnieje.",
            "card": None,
        }

    df = pd.read_csv(CSV_PATH)
    df["date"] = pd.to_datetime(df["date"]).dt.date
    df = df[df["status"] == "completed"]

    yesterday = pd.Timestamp.now().date() - pd.Timedelta(days=1)
    month_start = yesterday.replace(day=1)
    days_in_month_so_far = max(1, yesterday.day)

    y_df = df[df["date"] == yesterday]
    m_df = df[(df["date"] >= month_start) & (df["date"] <= yesterday)]

    y_orders = int(y_df.shape[0])
    y_revenue = float(y_df["amount"].sum())

    m_orders = int(m_df.shape[0])
    m_revenue = float(m_df["amount"].sum())

    m_avg_orders = m_orders / days_in_month_so_far
    m_avg_revenue = m_revenue / days_in_month_so_far

    diff_pct = ((y_revenue - m_avg_revenue) / m_avg_revenue * 100) if m_avg_revenue else 0
    diff_orders_pct = ((y_orders - m_avg_orders) / m_avg_orders * 100) if m_avg_orders else 0

    trend_word = "wyżej" if diff_pct > 0 else "niżej"
    tone = "dobry" if diff_pct > 0 else "słabszy"

    text = (
        f"Wczoraj był {tone} dzień. "
        f"Zrealizowaliśmy {y_orders} zamówień na kwotę {y_revenue:,.0f} złotych. "
        f"To o {abs(diff_pct):.0f} procent {trend_word} od średniej dziennej tego miesiąca, "
        f"która wynosi {m_avg_revenue:,.0f} zł. "
        f"Liczba zamówień wzrosła o {abs(diff_orders_pct):.0f} procent względem średniej."
    )

    card = {
        "title": "Podsumowanie sprzedaży",
        "metrics": [
            {"label": "Wczoraj (zamówienia)", "value": f"{y_orders}"},
            {"label": "Wczoraj (przychód)", "value": f"{y_revenue:,.0f} PLN"},
            {"label": "Średnia dzienna (miesiąc)", "value": f"{m_avg_revenue:,.0f} PLN"},
            {"label": "Różnica przychodu", "value": f"{diff_pct:+.0f}%"},
            {"label": "Różnica zamówień", "value": f"{diff_orders_pct:+.0f}%"},
        ],
    }
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
            if msg.get("type") == "utterance":
                text = msg.get("text", "").lower()
                # Simple intent routing
                if any(k in text for k in ["sprzedaż", "sprzedaz", "zamówienia", "zamowienia", "wczoraj", "miesiąc", "miesiac", "porównaj", "porownaj", "podsumowanie"]):
                    result = analyze_sales()
                else:
                    result = {
                        "text": "Hej, jestem Volle. Powiedz mi np. 'porównaj wczorajszą sprzedaż z miesiącem', a przygotuję analizę.",
                        "card": None,
                    }
                await websocket.send_json({
                    "type": "response",
                    "text": result["text"],
                    "visual_card": result["card"],
                })
    except Exception as e:
        print(f"WS error: {e}")

@app.get("/health")
async def health():
    return {"status": "ok"}
