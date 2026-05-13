# Volle

Voice-native business agent for desktop (Windows/macOS).

## Quick start

```bash
# 1. Setup Python venv + npm
bash scripts/setup.sh

# 2. Generate mock data
python data/mock/generate_sales.py

# 3. Start backend
cd apps/agent-worker && source .venv/bin/activate && uvicorn main:app --reload --port 8000

# 4. Start desktop client (new terminal)
cd apps/client-desktop && npm run tauri dev
```

## Project structure

- `apps/client-desktop` — Tauri v2 desktop app (Rust + Svelte)
- `apps/agent-worker` — Python FastAPI backend (WebSocket + Agent)
- `packages/voice-runtime` — Rust shared audio library (WASAPI/CoreAudio)
- `mcp-servers/*` — MCP capability servers
- `data/mock` — Demo datasets
- `infra/docker` — Local infrastructure (Postgres, Redis)
