# Status Projektu — Solli

> Ostatnia aktualizacja: 2026-05-04

---

## Co mamy gotowe

### Architektura

- **Monorepo**: pnpm workspaces + Turborepo
- **Czysta webówka**: Next.js 14 App Router (bez Electrona, bez Tauri)
- **Backend w Next.js**: Route Handlers zamiast osobnego Fastify API
- **Baza danych**: PostgreSQL + pgvector (via Docker)
- **Cache / PubSub**: Redis (via Docker)
- **Workers**: Playwright browser worker + Google APIs worker

### Aplikacja Webowa (`apps/web/`)

#### Backend (API Routes)

| Endpoint | Status | Opis |
|----------|--------|------|
| `POST /api/sessions` | ✅ | Tworzy nową sesję w Postgres |
| `GET /api/sessions` | ✅ | Lista ostatnich sesji |
| `GET /api/sessions/[id]` | ✅ | Szczegóły sesji |
| `POST /api/sessions/[id]/run` | ✅ | Uruchamia orchestrację asynchronicznie |
| `GET /api/sessions/[id]/events` | ✅ | Timeline eventów |
| `GET /api/sessions/[id]/stream` | ✅ | SSE stream na żywo (Redis pub/sub) |
| `POST /api/voice/session` | ✅ | Konfiguracja ElevenLabs (stub) |
| `POST /api/receipts` | ✅ | Generowanie hashy receiptów |

#### SSE (Live Updates)

| Feature | Status | Opis |
|---------|--------|------|
| `GET /api/sessions/[id]/stream` | ✅ | Redis pub/sub → SSE |
| EventSource w UI | ✅ | Auto-connect na session page, live timeline updates |
| Fallback polling | ✅ | Co 5s gdy SSE nie działa |

| Strona | Status | Opis |
|--------|--------|------|
| `/` — Landing | ✅ | Design w stylu Perplexity (jasny, beżowy, typografia Inter) |
| `/session/[id]` | ✅ | Szczegóły sesji z live SSE timeline, wynikami, summary, voice |
| Wallet Connect | ✅ | Solana (Phantom, Solflare) via `@solana/wallet-adapter` |
| Voice Panel | ✅ | WebSocket do ElevenLabs, MediaRecorder z mikrofonu, transcript + audio playback |

#### Design System

- **Kolorystyka**: Jasna, ciepła (cream/white/teal/ink)
- **Typografia**: Inter
- **Brak gradientów, brak emoji** — tylko Lucide SVG icons
- **Responsive**: Mobile + desktop

#### Orchestracja (własna, bez LangGraph)

| Agent | Status | Opis |
|-------|--------|------|
| Coordinator | ✅ | Klasyfikacja intentu (OpenAI API + keyword fallback) |
| Research | ✅ | Browser search via worker-browser + fallback |
| Summary | ✅ | Generowanie podsumowania (OpenAI API + fallback) |
| Inbox | 🟡 | Stub (wymaga worker-google + Gmail API) |
| Planning | 🟡 | Stub (wymaga worker-google + Calendar API) |

#### Tools

| Tool | Status | Opis |
|------|--------|------|
| `browserSearchTool` | ✅ | Wola worker-browser lub fallback |
| `gmailTool` | 🟡 | Stub |
| `calendarTool` | 🟡 | Stub |

#### Database Layer

| Tabela | Status | Opis |
|--------|--------|------|
| `sessions` | ✅ | CRUD via `lib/db/sessions.ts` |
| `agent_events` | ✅ | Timeline + Redis pub/sub |
| `tasks` | ✅ | Logowanie tool calls |
| `receipts` | ✅ | Schema gotowe, API endpoint ready |

#### Solana / Blockchain (Anchor Program)

| Feature | Status | Opis |
|---------|--------|------|
| Program Anchor | ✅ | Rust program: `initialize_treasury`, `fund_agent`, `record_session_cost`, `create_session`, `update_session_status`, `create_receipt` |
| Session PDA | ✅ | Onchain account: owner, session_id, query, intent, status, estimated_cost, actual_cost, timestamps |
| Receipt PDA | ✅ | Onchain account: session ref, hash, cost, timestamp |
| Agent Treasury PDA | ✅ | User wpłaca SOL do treasury, agent ma budżet na tool calls |
| x402 stub | ✅ | `lib/x402.ts` — payment headers, tool costs, verification |
| x402 in tool calls | ✅ | `browser-search.tool.ts` wysyła x402 headers do worker-browser |
| Cost tracking (DB) | ✅ | `sessions.estimated_cost_sol`, `sessions.actual_cost_sol`, `tasks.cost_sol` |
| Cost estimation | ✅ | `coordinatorAgent` estymuje koszt na podstawie intentu |
| Cost Breakdown UI | ✅ | `CostBreakdown` component na stronie sesji |
| Devnet deploy scripts | ✅ | `deploy-devnet.sh`, `verify-devnet.sh` w `programs/solli/scripts/` |
| IDL | ✅ | Wygenerowane, skopiowane do `apps/web/src/lib/solana/idl.json` |
| Klient TS | ✅ | `lib/solana/anchor-client.ts` — treasury, session, receipt |
| Wallet adapter | ✅ | Phantom + Solflare |
| Receipt hash | ✅ | SHA-256 hash z sesji |
| On-chain memo | ✅ | Frontend buduje tx, podpisuje przez wallet, wysyła na Solanę (devnet), zapisuje signature |

---

## Co jest legacy / nieużywane

| Package | Status | Uwagi |
|---------|--------|-------|
| `apps/api/` (Fastify) | ❌ Usunięte | Zastąpione Next.js Route Handlers |
| `apps/desktop/` (Tauri) | ❌ Usunięte | Zastąpione czystą webówką |
| `solli-nextjs/` (Electron) | ❌ Usunięte | Zastąpione `apps/web/` |
| `packages/agent-core/` (LangGraph) | 🟡 Legacy | Nowa orchestracja jest w `apps/web/src/lib/agents/` — LangGraph zostawiony jako reference ale nieużywany |

---

## Co wymaga konfiguracji (env vars)

Zmienne w `.env.local` (wymagane do działania):

```bash
# OpenAI (dla orchestracji)
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini

# ElevenLabs (dla voice — opcjonalne)
ELEVENLABS_API_KEY=...
ELEVENLABS_AGENT_ID=...

# Baza danych
DATABASE_URL=postgresql://solli:solli_dev_password@localhost:5432/solli
REDIS_URL=redis://default:solli_dev_password@localhost:6379

# Solana (dla wallet / receipts)
SOLANA_RPC_URL=https://api.devnet.solana.com

# Worker
WORKER_BROWSER_URL=http://localhost:3002
```

---

## Jak uruchomić

```bash
# 1. Infrastruktura (Postgres + Redis)
docker-compose up -d

# 2. Web app (port 3000)
pnpm --filter @solli/web dev

# 3. Browser worker (port 3002, osobny terminal)
pnpm --filter @solli/worker-browser dev

# 4. Wszystko na raz
cd /home/szymon/solli && pnpm dev
```

---

## Roadmap / TODO

### MVP Blockers (muszą być gotowe na demo)

- [x] **Sharp use case** — Voice-Native Onchain Research Agent (nie generyczny AI)
- [x] **Realna integracja ElevenLabs** — WebSocket + MediaRecorder działa, voice jest primary interface
- [x] **On-chain transaction** — program Anchor + frontend podpisuje i wysyła realną tx na Solana
- [x] **On-chain Session PDA** — każda sesja to onchain account z cost tracking
- [x] **On-chain Receipt PDA** — hash wyników jako proof-of-action onchain
- [x] **Agent Treasury PDA** — user wpłaca SOL, agent ma budżet na tool calls
- [x] **x402 stub** — symulowane koszty tool calls, payment headers
- [x] **SSE live updates** — timeline aktualizuje się na żywo
- [x] **Onboarding** — 4-krokowy modal dla nowych użytkowników
- [x] **Hydration fix** — ClientOnly wrapper dla wallet components
- [x] **Demo Simulation** — przycisk "Try Demo" pokazujący jak agent działa z kosztami
- [x] **x402 w tool calls** — realne payment headers w HTTP do worker-browser
- [x] **Cost Breakdown UI** — panel kosztów na stronie sesji
- [x] **Devnet deploy scripts** — gotowe skrypty do deployu na devnet
- [ ] **Worker-browser** — przetestować czy Playwright scrape działa (może wymagać mock)
- [ ] **Deploy programu** — zdeployować program Anchor na devnet (wymaga terminala + funduszy)

### Nice to Have (po MVP)

- [ ] **Auth** — obecnie wszystko jako `anonymous` user
- [ ] **SSE** — podpiąć realny frontend listener pod `/api/sessions/[id]/stream`
- [ ] **Inbox / Planning** — podłączyć worker-google (Gmail + Calendar)
- [ ] **LangGraph** — rozważyć powrót gdy upstream będzie stable
- [ ] **Tests** — Vitest skonfigurowany, brak testów
- [ ] **Dark mode** — obecnie tylko light mode

---

## Liczby

| Metryka | Wartość |
|---------|---------|
| Pliki źródłowe `apps/web/` | ~35 |
| Build time | ~15s |
| Bundle size (First Load JS) | ~94KB (shared) + ~7KB (home) + ~16KB (session) |
| TypeScript errors | 0 |
| Test coverage | 0% |

---

## Decyzje architektoniczne

1. **LangGraph został porzucony** — upstream typy były broken, nie dało się zbudować. Zastąpiliśmy własną, prostą async pipeline.
2. **Fastify API usunięty** — Next.js Route Handlers są wystarczające i redukują complexity.
3. **Tauri/Electron usunięte** — user chce wyłącznie webówkę.
4. **OpenAI zamiast LangChain** — dla MVP prostsze jest użycie surowego fetch do OpenAI API.
