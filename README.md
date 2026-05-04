# Solli - Voice-Native Session Operator

A production-ready monorepo for a voice-native web application with multi-agent orchestration, powered by Next.js, React, and a custom async agent pipeline.

## Architecture Overview

```
solli/
├── apps/
│   ├── web/              # Next.js fullstack web app
│   ├── worker-browser/   # Playwright browser automation worker
│   └── worker-google/    # Google APIs (Gmail/Calendar) worker
├── packages/
│   ├── agent-core/       # LangGraph multi-agent orchestration (legacy)
│   ├── shared/           # Shared types and Zod schemas
│   └── blockchain/        # Solana/x402 payment stubs
└── docker/               # PostgreSQL + Redis configuration
```

## Tech Stack

- **Frontend & Backend**: Next.js App Router + React 18 + TypeScript
- **Orchestration**: Custom async pipeline (coordinator → research → summary)
- **Voice**: ElevenLabs WebSocket API
- **Browser Automation**: Playwright
- **APIs**: Google Gmail & Calendar
- **Database**: PostgreSQL + pgvector
- **Cache**: Redis
- **Monorepo**: pnpm workspaces + Turborepo

## Agent System

The multi-agent orchestration (in `apps/web/src/lib/agents/`) routes user intent through specialized agents:

1. **Coordinator** - Classifies user intent (RESEARCH | INBOX | PLANNING | APPLICATION | GENERAL)
2. **Research** - Web search and information gathering
3. **Inbox** - Email management via Gmail (stub)
4. **Planning** - Calendar and scheduling via Google Calendar (stub)
5. **Summary** - Session summary generation

## Prerequisites

- Node.js 20+
- pnpm 8+
- Docker & Docker Compose

## Quick Start

### 1. Clone and Install Dependencies

```bash
git clone <repo-url> solli
cd solli
pnpm install
```

### 2. Set Up Environment Variables

```bash
cp .env.example .env.local
# Edit .env.local with your API keys
```

### 3. Start Infrastructure

```bash
docker-compose up -d
```

> **Note:** If you previously ran `docker-compose up` with an older schema, you may need to recreate the database to pick up schema changes:
> ```bash
> docker-compose down -v
> docker-compose up -d
> ```

### 4. Start Development Servers

```bash
# Start all apps in development mode
pnpm dev

# Or start individual apps
pnpm --filter @solli/web dev
pnpm --filter @solli/worker-browser dev
pnpm --filter @solli/worker-google dev
```

### 5. Run the MVP Vertical Slice

The MVP supports a complete research session flow:

```bash
# Terminal 1: Start infrastructure
docker-compose up -d

# Terminal 2: Start web app
pnpm --filter @solli/web dev

# Terminal 3: Start browser worker
pnpm --filter @solli/worker-browser dev
```

Then open `http://localhost:3000` and try:
> "Find me 3 AI internship opportunities in Poland"

The system will:
1. Create a session
2. Classify intent as RESEARCH
3. Run the browser search tool
4. Return structured results
5. Generate a session summary

You can also start all services at once with `pnpm dev`, but for debugging the MVP it's easier to run them separately.

### 6. Build for Production

```bash
pnpm build
```

## Project Structure Details

### Web App (`apps/web/`)

Next.js fullstack app with:
- Route Handlers for session API (`/api/sessions/*`)
- Real-time voice conversation via ElevenLabs WebSocket
- Session UI: input, timeline, results, summary
- Wallet connection for on-chain receipts

### Agent Core (`packages/agent-core/`)

Legacy LangGraph-based orchestration. The active orchestration lives in `apps/web/src/lib/agents/`.

### Browser Worker (`apps/worker-browser/`)

Playwright-based automation:
- Web search
- Page scraping
- Form filling

### Google Worker (`apps/worker-google/`)

Google API integrations:
- Gmail (read/draft/send)
- Calendar (list/create/update/delete events)

## Environment Variables

| Variable | Description |
|----------|-------------|
| `ELEVENLABS_API_KEY` | ElevenLabs API key for voice |
| `ELEVENLABS_AGENT_ID` | ElevenLabs agent ID |
| `OPENAI_API_KEY` | OpenAI API key for LLM |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `SOLANA_RPC_URL` | Solana RPC endpoint |
| `USE_OLLAMA` | Set to `true` to use local Ollama instead of OpenAI |
| `OLLAMA_MODEL` | Ollama model name (default: `llama3`) |
| `OLLAMA_BASE_URL` | Ollama server URL (default: `http://localhost:11434`) |
| `WORKER_BROWSER_URL` | Browser worker URL (default: `http://localhost:3002`) |

## Database Schema

The PostgreSQL database includes:
- `sessions` - User session tracking
- `tasks` - Agent task execution records
- `agent_events` - Agent activity timeline
- `receipts` - Execution receipts for payments
- `checkpoints` - LangGraph state persistence

## License

MIT
