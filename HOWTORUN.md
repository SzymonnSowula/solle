# Volle — How To Run

## Wymagania

- Windows 10/11 (primary target) lub Linux/macOS (dev)
- Python 3.12
- Node.js 20+ + npm
- Rust (Tauri v2)
- PostgreSQL 16 (docker lub natywny)

## 1. Setup (pierwsze uruchomienie)

```bash
# Klon / wejdz do repo
cd /home/szymon/volle

# Setup skrypt instaluje venv + zaleznosci
bash scripts/setup.sh

# Generuj mock dane (90 dni sprzedazy z sezonowoscia)
/home/szymon/volle/apps/agent-worker/.venv/bin/python data/mock/generate_realistic_sales.py

# Uruchom Postgres (jesli masz docker)
docker-compose up -d postgres redis
# Lub skonfiguruj DATABASE_URL w .env
```

## 2. Konfiguracja API keys + .env

```bash
cp apps/agent-worker/.env.example apps/agent-worker/.env
# Edytuj .env i wpisz klucze:
# OPENAI_API_KEY=sk-...
# OPENAI_BASE_URL=https://api.openai.com/v1   # lub OpenRouter
# OPENAI_MODEL=gpt-4o
# DATABASE_URL=postgresql://volle:volle@localhost:5432/volle
```

Bez klucza: system dziala z fallbackiem — keyword routing + generator tekstu z wynikow tooli. Demo "uporzadkuj pulpit" / "napisz email" dziala bez LLM.

## 3. Start backend

```bash
cd apps/agent-worker
source .venv/bin/activate
uvicorn main:app --reload --port 8000 --host 0.0.0.0
```

Sprawdz health:
```bash
curl http://localhost:8000/health
# {"status":"ok","llm_ready":false,"db_ready":true}
```

MCP serwery startuja automatycznie w lifespan (7 serwerow, 20+ tooli). Migracje DB tez automatyczne.

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

## 5. Pierwsze uruchomienie — Onboarding

Przy pierwszym odpaleniu aplikacji (lub gdy `onboarding_complete` = false w DB):
1. Widok onboarding: profil (imie, ton), workflow (zadania, wazne foldery), integracje (Email SMTP, Kalendarz, Web Research), test.
2. Po zakonczeniu — redirect do glownego widgetu.
3. Ustawienia dostepne z przycisku ⚙️ w widget.

API onboarding:
```bash
curl http://localhost:8000/api/onboarding/status
curl -X POST http://localhost:8000/api/onboarding/profile -H "Content-Type: application/json" -d '{"user_name":"Marek","preferred_tone":"Bezposredni"}'
curl -X POST http://localhost:8000/api/onboarding/integrations -H "Content-Type: application/json" -d '{"integrations":[{"name":"email","config":{"host":"smtp.gmail.com","port":587,"username":"x","password":"x","tls":true},"active":true}]}'
curl -X POST http://localhost:8000/api/onboarding/complete
```

## 6. Test end-to-end

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
        print(data["text"])        # odpowiedz glosowa
        print(data["visual_card"])  # karta metryk
        print(data["session_id"])   # persist session

asyncio.run(test())
```

### Testy backend
```bash
cd apps/agent-worker
source .venv/bin/activate
pytest tests/ -v
```

## 7. Struktura deweloperska

```
Terminal 1: postgres (docker-compose)
Terminal 2: backend  (port 8000)
Terminal 3: client   (Tauri dev / Vite dev)
```

Globalny hotkey: `Ctrl+Shift+Space` (zarejestrowany w Rust-side Tauri).
Fallback: Spacja w oknie widgeta lub text input.

## 8. Placeholdery / co jeszcze do zrobienia

| Placeholder | Lokalizacja | Priorytet |
|---|---|---|
| Voice pipeline (VAD/Wake/Opus) | `packages/voice-runtime/src/*.rs` | High |
| Deepgram STT + ElevenLabs TTS | backend + frontend | High |
| Vision + OCR ("co widzisz na ekranie") | MCP desktop-automation + LLM vision | High |
| Desktop safety confirmations | frontend dialogi | Medium |
| Shopify real API | `mcp-servers/mcp-shopify/main.py` | Low (demo) |
| Allegro/Baselinker integrations | new MCP servers | Low (demo) |
| Alert engine (thresholds) | new module | Low (demo) |
| Windows installer (.exe) | Tauri build | High |
| CI/CD (GitHub Actions) | `.github/workflows/` | Medium |

## 9. Debug

### MCP serwery nie startuja
Sprawdz czy venv python ma zainstalowane `mcp` i `pandas`:
```bash
/home/szymon/volle/apps/agent-worker/.venv/bin/pip list | grep -E "mcp|pandas"
```

### WebSocket nie laczy sie
Backend musi byc na `--host 0.0.0.0` (nie domyslnie `127.0.0.1` w niektorych srodowiskach).

### Brak polskiego TTS
W Phase 0 uzywamy Web Speech API (browser-native). W Phase 1 zastapimy ElevenLabs Turbo v2.5.

### DB pool not initialized
Upewnij sie ze `DATABASE_URL` wskazuje na dzialajaca instancje Postgres. Domyslnie: `postgresql://volle:volle@localhost:5432/volle`

## 10. Build produkcyjny

```bash
cd apps/client-desktop
npm run tauri build
# Output: apps/client-desktop/src-tauri/target/release/bundle/
```

MSI/EXE generuje sie tylko na Windows host (nie WSL).
