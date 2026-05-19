# Volle

Voice-native desktop AI agent. Mówisz – Volle wykonuje pracę na Twoim komputerze.

## Core (co Volle robi)

- “Volle uporządkuj mi pulpit” → organizuje pliki
- “Napisz email do Jana” → pisze i wysyła email
- “Otwórz Outlooka” → otwiera aplikację
- “Zrób zrzut ekranu” → robi screenshot
- “Skopiuj to do schowka” / “Wklej” → clipboard
- “Wpisz ten tekst” → symuluje klawiaturę
- Sprzedaż / analityka to tylko demo – Volle potrafi też analizować dane

## Quick start

```bash
# 1. Setup Python venv + npm
bash scripts/setup.sh

# 2. Start Postgres & Redis
docker-compose up -d postgres redis

# 3. Start backend
cd apps/agent-worker && source .venv/bin/activate && uvicorn main:app --reload --port 8000

# 4. Start desktop client (new terminal)
cd apps/client-desktop && npm run tauri dev
```

## Project structure

- `apps/client-desktop` — Tauri v2 desktop app (Rust + Svelte)
- `apps/agent-worker` — Python FastAPI backend (WebSocket + Agent + DB)
- `packages/voice-runtime` — Rust shared audio library (WASAPI/CoreAudio)
- `mcp-servers/*` — MCP capability servers
- `data/mock` — Demo datasets
- `infra/docker` — Local infrastructure (Postgres, Redis)

## Onboarding

First launch always shows onboarding. User configures:
- Profile (name, tone)
- Workflow (tasks: emails, files, research, calendar; important folders)
- Integrations (Email SMTP, Calendar, Web Research)
- Voice test

Credentials stored in Postgres (encrypted). Agent works only after onboarding.

## Key features

- **Desktop automation**: screenshot, open app/folder, type text, clipboard (MCP + Rust Tauri)
- **File system**: organize desktop, sort by date, move files (MCP)
- **Email**: draft + send via SMTP (MCP)
- **Persistent memory**: user profile, conversation history, integrations in Postgres
- **MCP orchestration**: 7 servers, 20+ tools (desktop-automation, file-system, email, business-data, web-research, calendar, shopify stub)
- **Keyword fallback**: works without LLM API key for demo queries
- **Realistic mock data**: weekend spikes, seasonality, returns (sales demo)
- **Session continuity**: `session_id` passed via WebSocket, history persisted
- **Safety tiers**: green/yellow/orange classification per tool
- **Clickable action cards**: frontend opens folders/apps directly via Tauri commands

## Tests

```bash
cd apps/agent-worker
pytest tests/ -v
```

## Roadmap

1. **Phase 1 (done)**: Foundation + Onboarding + DB persistence + Tests
2. **Phase 2 (done)**: Desktop automation core (file system, email, screenshot, clipboard, type)
3. **Phase 3**: Voice pipeline (Silero VAD, openWakeWord, Opus, Deepgram STT, ElevenLabs TTS)
4. **Phase 4**: Vision + OCR ("co widzisz na ekranie")
5. **Phase 5**: Real integrations (Shopify API, Allegro, Baselinker) + alert engine
6. **Phase 6**: Windows installer + CI/CD + tray icon polish
