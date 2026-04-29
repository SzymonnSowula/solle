# AGENTS.md — Solli

Monorepo: pnpm workspaces + Turborepo. Apps (`api`, `desktop`, `worker-browser`, `worker-google`) and packages (`agent-core`, `shared`, `blockchain`).

## Dev Setup (required order)

1. `pnpm install`
2. `cp .env.example .env.local` — fill keys (OpenAI, ElevenLabs, Google OAuth, etc.)
3. `docker-compose up -d` — starts Postgres (`ankane/pgvector`) + Redis (`redis/redis-stack`). Init SQL runs automatically from `docker/postgres/init.sql`.
   - If you previously ran docker-compose with an older schema, run `docker-compose down -v && docker-compose up -d` to recreate the database with the latest schema.
4. `pnpm dev` — starts all apps concurrently via Turborepo.

## Running the MVP Vertical Slice

For debugging the research flow, run services separately:

```bash
# Terminal 1: Infrastructure (must be running first)
docker-compose up -d

# Terminal 2: API
pnpm --filter @solli/api dev

# Terminal 3: Browser worker
pnpm --filter @solli/worker-browser dev

# Terminal 4: Desktop app
pnpm --filter @solli/desktop dev
```

Open `http://localhost:3000`, enter a query like "Find me 3 AI internship opportunities in Poland", and click **Start Session**.

## Running Individual Apps

Use `pnpm --filter @solli/<name> <script>`:

- **API**: `pnpm --filter @solli/api dev` — Fastify on port 3001 (`tsx watch src/server.ts`)
- **Desktop**: `pnpm --filter @solli/desktop dev` — Vite dev server on port 3000 (proxies `/api` to `localhost:3001`)
- **Tauri shell**: `pnpm --filter @solli/desktop tauri dev` — from `apps/desktop/src-tauri/package.json`
- **Worker Browser**: `pnpm --filter @solli/worker-browser dev` — Express + Playwright on port 3002
- **Worker Google**: `pnpm --filter @solli/worker-google dev` — Express + Google APIs

## Build / Verify

- `pnpm build` — Turborepo builds all packages first, then apps (`^build` dependency)
- `pnpm lint` / `pnpm typecheck` / `pnpm test` — run across all packages
- Order when validating: `lint` → `typecheck` → `test`

## Monorepo Boundaries & Entrypoints

| Package | Role | Key Entry |
|---------|------|-----------|
| `@solli/api` | Fastify backend | `apps/api/src/server.ts` |
| `@solli/desktop` | Tauri 2 + React 18 + Vite | `apps/desktop/src/main.tsx` |
| `@solli/worker-browser` | Playwright automation worker | `apps/worker-browser/src/index.ts` |
| `@solli/worker-google` | Gmail/Calendar worker | `apps/worker-google/src/index.ts` |
| `@solli/agent-core` | LangGraph orchestration | `packages/agent-core/src/index.ts` |
| `@solli/shared` | Types + Zod schemas | `packages/shared/src/index.ts` (subpath exports: `./types`, `./schemas`) |
| `@solli/blockchain` | Solana/x402 stubs | `packages/blockchain/src/index.ts` |

## Architecture Notes

- **API** registers Postgres + Redis on startup, then routes under `/api/sessions`, `/api/agents`, `/api/receipts`, plus `/health`.
- **MVP Session Flow**: `POST /api/sessions` (create with input) → `POST /api/sessions/:id/run` (fire graph) → poll `GET /api/sessions/:id` and `GET /api/sessions/:id/events`.
- **Agent Core** exports a LangGraph session graph with nodes: `coordinator` → `research` → `summary`. Inbox/planning are stubbed and route directly to summary.
- The coordinator uses LLM (OpenAI by default, Ollama if `USE_OLLAMA=true`) for intent classification with keyword fallback.
- The research node calls the browser worker over HTTP at `WORKER_BROWSER_URL` (default `http://localhost:3002`).
- **Desktop** has two `package.json` files: one in `apps/desktop/` (Vite/ React) and one in `apps/desktop/src-tauri/` (Tauri CLI). The Tauri `devUrl` is `http://localhost:3000`.
- A root `index.html` exists as a standalone landing page; it is **not** the Tauri build entrypoint (that is `apps/desktop/index.html`).

## Toolchain Quirks

- All packages use `"type": "module"` and TS 5.4+.
- Desktop TSConfig uses `allowImportingTsExtensions: true` + `noEmit: true`; it is built by Vite, not `tsc`.
- Workspace packages (`shared`, `agent-core`, `blockchain`) have `main`/`types` pointing directly to `.ts` source files.
- Turbo `globalDependencies` watches `**/.env.*local`.

## Testing

- `api` and `agent-core` use **Vitest**. No tests are present yet in the repo, but the runners are configured.
- To run a single package's tests: `pnpm --filter @solli/api test` or `pnpm --filter @solli/agent-core test`.

## Environment & Operational Gotchas

- The API and workers will fail to start if Postgres/Redis are not running.
- `docker-compose up -d` must be run before `pnpm dev`.
- Google OAuth redirect URI is configured to `http://localhost:3000/auth/google/callback` in `.env.example`.
- The browser worker may fall back to mock results if Google blocks the Playwright scrape.
