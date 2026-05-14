# Volle — How To Run

## Wymagania

- Windows 10/11 (primary target) lub Linux/macOS (dev)
- Python 3.12
- Node.js 20+ + npm
- Rust (Tauri v2)

## 1. Setup (pierwsze uruchomienie)

```bash
# Klon / wejdz do repo
cd /home/szymon/volle

# Setup skrypt instaluje venv + zaleznosci
bash scripts/setup.sh

# Generuj mock dane (60 dni sprzedazy)
/home/szymon/volle/apps/agent-worker/.venv/bin/python data/mock/generate_sales.py
```

## 2. Konfiguracja API keys (opcjonalne na Phase 0)

```bash
cp apps/agent-worker/.env.example apps/agent-worker/.env
# Edytuj .env i wpisz klucze:
# OPENAI_API_KEY=sk-...
# OPENAI_BASE_URL=https://api.openai.com/v1   # lub OpenRouter
# OPENAI_MODEL=gpt-4o
```

Bez klucza: system dziala z fallbackiem — keyword routing + generator tekstu z wynikow tooli. Demo "porownaj sprzedaz" dziala bez LLM.

## 3. Start backend

```bash
cd apps/agent-worker
source .venv/bin/activate
uvicorn main:app --reload --port 8000 --host 0.0.0.0
```

Sprawdz health:
```bash
curl http://localhost:8000/health
# {"status":"ok","llm_ready":false}
```

MCP serwery startuja automatycznie w lifespan (5 serwerow, 11 tooli).

## 4. Start desktop client

### Windows (PowerShell — native webview)
```powershell
cd apps/client-desktop
npm install
npm run tauri dev
```

### WSL/Linux (bez Tauri native webview — headless / browser)
```bash
cd apps/client-desktop
npm install
npm run dev          # Vite dev server — otworz http://localhost:5173
```

WSL nie ma display server dla Tauri webview. Build windows rob na Windows host.

## 5. Test end-to-end

### WebSocket test (Python)
```python
import asyncio, websockets, json

async def test():
    uri = "ws://localhost:8000/ws/voice"
    async with websockets.connect(uri) as ws:
        await ws.recv()  # connected
        await ws.send(json.dumps({
            "type": "utterance",
            "text": "Porównaj sprzedaż wczoraj z całym miesiącem"
        }))
        msg = await ws.recv()
        data = json.loads(msg)
        print(data["text"])        # odpowiedz głosowa
        print(data["visual_card"])  # karta metryk

asyncio.run(test())
```

### curl test (direct)
```bash
curl -N -H "Accept:text/event-stream" \
  http://localhost:8000/health
```

## 6. Struktura deweloperska

```
Terminal 1: backend  (port 8000)
Terminal 2: client   (Tauri dev / Vite dev)
```

Globalny hotkey: `Ctrl+Shift+Space` (zarejestrowany w Rust-side Tauri).
Fallback: Spacja w oknie widgeta lub text input.

## 7. Placeholdery / co jeszcze do zrobienia

| Placeholder | Lokalizacja | Priorytet |
|---|---|---|
| Memory stub (hardcoded profile) | `agent/orchestrator.py:34` | Medium |
| Analytics engine (pusty modul) | `analytics/engine.py` | Low (logika w business-data MCP) |
| Audio I/O WASAPI/CoreAudio | `packages/voice-runtime/src/audio.rs` | High |
| Opus encoder | `packages/voice-runtime/src/encoder.rs` | High |
| Silero VAD | `packages/voice-runtime/src/vad.rs` | High |
| openWakeWord | `packages/voice-runtime/src/wake_word.rs` | High |
| WebSocket audio stream client | `packages/voice-runtime/src/ws_client.rs` | High |
| Shopify real API | `mcp-servers/mcp-shopify/main.py` | Medium |
| Calendar real API | `mcp-servers/mcp-calendar-tasks/main.py` | Medium |
| Email drafts real API | `mcp-servers/mcp-email-drafts/main.py` | Low |

## 8. Debug

### MCP serwery nie startuja
Sprawdz czy venv python ma zainstalowane `mcp` i `pandas`:
```bash
/home/szymon/volle/apps/agent-worker/.venv/bin/pip list | grep -E "mcp|pandas"
```

### WebSocket nie laczy sie
Backend musi byc na `--host 0.0.0.0` (nie domyslnie `127.0.0.1` w niektorych srodowiskach).

### Brak polskiego TTS
W Phase 0 uzywamy Web Speech API (browser-native). W Phase 1 zastapimy ElevenLabs Turbo v2.5.

## 9. Build produkcyjny

```bash
cd apps/client-desktop
npm run tauri build
# Output: apps/client-desktop/src-tauri/target/release/bundle/
```

MSI/EXE generuje sie tylko na Windows host (nie WSL).
