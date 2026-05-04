# AGENTS.md — Solli

Monorepo: pnpm workspaces + Turborepo. Apps (`web`, `worker-browser`, `worker-google`) and packages (`agent-core`, `shared`, `blockchain`).

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

# Terminal 2: Web app
pnpm --filter @solli/web dev

# Terminal 3: Browser worker
pnpm --filter @solli/worker-browser dev
```

Open `http://localhost:3000`, enter a query like "Find me 3 AI internship opportunities in Poland", and click **Start Session**.

## Running Individual Apps

Use `pnpm --filter @solli/<name> <script>`:

- **Web**: `pnpm --filter @solli/web dev` — Next.js on port 3000
- **Worker Browser**: `pnpm --filter @solli/worker-browser dev` — Express + Playwright on port 3002
- **Worker Google**: `pnpm --filter @solli/worker-google dev` — Express + Google APIs

## Build / Verify

- `pnpm build` — Turborepo builds all packages first, then apps (`^build` dependency)
- `pnpm lint` / `pnpm typecheck` / `pnpm test` — run across all packages
- Order when validating: `lint` → `typecheck` → `test`

## Monorepo Boundaries & Entrypoints

| Package | Role | Key Entry |
|---------|------|-----------|
| `@solli/web` | Next.js fullstack app | `apps/web/src/app/page.tsx` |
| `@solli/worker-browser` | Playwright automation worker | `apps/worker-browser/src/index.ts` |
| `@solli/worker-google` | Gmail/Calendar worker | `apps/worker-google/src/index.ts` |
| `@solli/agent-core` | LangGraph orchestration (legacy) | `packages/agent-core/src/index.ts` |
| `@solli/shared` | Types + Zod schemas | `packages/shared/src/index.ts` (subpath exports: `./types`, `./schemas`) |
| `@solli/blockchain` | Solana/x402 stubs | `packages/blockchain/src/index.ts` |

## Architecture Notes

- **Web** is a Next.js App Router app. Backend logic lives in Route Handlers under `app/api/`. Frontend lives in `app/` and `components/`.
- **MVP Session Flow**: `POST /api/sessions` (create with input) → `POST /api/sessions/:id/run` (fire graph) → poll `GET /api/sessions/:id` and `GET /api/sessions/:id/events`.
- **Orchestration** in `@solli/web` uses a clean async pipeline: `coordinator` → `research` → `summary`. It replaces the legacy LangGraph implementation due to upstream type breakage.
- The coordinator uses OpenAI API (or keyword fallback) for intent classification.
- The research node calls the browser worker over HTTP at `WORKER_BROWSER_URL` (default `http://localhost:3002`).

## Toolchain Quirks

- All packages use `"type": "module"` and TS 5.4+.
- Workspace packages (`shared`, `agent-core`, `blockchain`) have `main`/`types` pointing directly to `.ts` source files.
- Turbo `globalDependencies` watches `**/.env.*local`.

## Testing

- `agent-core` uses **Vitest**. No tests are present yet in the repo, but the runner is configured.
- To run a single package's tests: `pnpm --filter @solli/agent-core test`.

## Environment & Operational Gotchas

- The web app and workers will fail to start if Postgres/Redis are not running.
- `docker-compose up -d` must be run before `pnpm dev`.
- Google OAuth redirect URI is configured to `http://localhost:3000/auth/google/callback` in `.env.example`.
- The browser worker may fall back to mock results if Google blocks the Playwright scrape.
