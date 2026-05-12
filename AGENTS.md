# AGENTS.md - Solli

Monorepo: pnpm workspaces + Turborepo. Apps (`web`, `worker-browser`, `worker-google`) and packages (`agent-core`, `shared`, `blockchain`).

## Dev Setup (required order)

1. `pnpm install`
2. `cp .env.example .env.local` - fill keys (OpenAI, ElevenLabs, Google OAuth, etc.)
3. `docker-compose up -d` - starts Postgres (`ankane/pgvector`) + Redis (`redis/redis-stack`). Init SQL runs automatically from `docker/postgres/init.sql`.
   - If you previously ran docker-compose with an older schema, run `docker-compose down -v && docker-compose up -d` to recreate the database with the latest schema.
4. `pnpm dev` - starts all apps concurrently via Turborepo.

## Running the MVP Vertical Slice

For debugging the research flow, run services separately:

```bash
# Terminal 1: Infrastructure (must be running first)
docker-compose up -d

# Terminal 2: Web app
pnpm --filter @solli/web dev

# Terminal 3: Browser worker
pnpm --filter @solli/worker-browser dev

# Terminal 4: Google worker (for inbox/planning agents)
pnpm --filter @solli/worker-google dev
```

Open `http://localhost:3000`, connect wallet, and start talking to Solli via voice or text.

## Running Individual Apps

Use `pnpm --filter @solli/<name> <script>`:

- **Web**: `pnpm --filter @solli/web dev` - Next.js on port 3000
- **Desktop**: `pnpm --filter @solli/desktop dev` - Electron + Vite (tray, overlay, voice)
- **Worker Browser**: `pnpm --filter @solli/worker-browser dev` - Express + Playwright on port 3002
- **Worker Google**: `pnpm --filter @solli/worker-google dev` - Express + Google APIs on port 3003

## Build / Verify

- `pnpm build` - Turborepo builds all packages first, then apps (`^build` dependency)
- `pnpm typecheck` - run across all packages
- Order when validating: `typecheck` → build

## Monorepo Boundaries & Entrypoints

| Package | Role | Key Entry |
|---------|------|-----------|
| `@solli/web` | Next.js fullstack app | `apps/web/src/app/page.tsx` |
| `@solli/desktop` | Electron desktop app (Windows) | `apps/desktop/src/main/index.ts` |
| `@solli/worker-browser` | Playwright automation worker | `apps/worker-browser/src/index.ts` |
| `@solli/worker-google` | Gmail/Calendar worker | `apps/worker-google/src/index.ts` |
| `@solli/agent-core` | LangGraph orchestration (legacy) | `packages/agent-core/src/index.ts` |
| `@solli/shared` | Types + Zod schemas | `packages/shared/src/index.ts` (subpath exports: `./types`, `./schemas`) |
| `@solli/blockchain` | Solana/x402 + receipts | `packages/blockchain/src/index.ts` |

## Architecture

### Session Lifecycle (Conversation-First)

```
User speaks/types request
  -> POST /api/sessions (create)
  -> POST /api/sessions/:id/run
       -> conversation-loop: analyze & ask clarifying questions?
            -> if clarifying: status='clarifying', store questions in metadata
                 -> user answers via UI voice/text or POST /api/sessions/:id/message
                 -> conversation-loop re-runs with accumulated history
            -> if ready: coordinator classifies intent
                 -> research / inbox / planning / application agent executes
                 -> summary agent generates closing summary
       -> settlement: compute SUM(cost_sol) from tasks, update actual_cost_sol
```

### API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/sessions` | POST, GET | Create / list sessions |
| `/api/sessions/:id` | GET | Get session state |
| `/api/sessions/:id/run` | POST | Fire the orchestration graph |
| `/api/sessions/:id/message` | POST | Continue a clarifying session with user answer |
| `/api/sessions/:id/events` | GET | List agent events |
| `/api/sessions/:id/stream` | GET | SSE live event stream (Redis pub/sub) |
| `/api/sessions/:id/tasks` | GET | List tool execution tasks |
| `/api/sessions/:id/settle` | POST | Compute final cost + create on-chain receipt |
| `/api/receipts` | POST, PUT | Get hash / confirm on-chain receipt signature |
| `/api/voice/session` | POST | Get ElevenLabs agent config (WebSocket) |
| `/api/voice/tool-call` | POST | Browser-side voice tool call proxy (includes `execute_desktop_plan` for desktop app) |
| `/api/voice/webhook` | POST | ElevenLabs dashboard server-tool webhook |
| `/api/health` | GET | Health check |

### Agents

| Agent | File | Intent | Description |
|-------|------|--------|-------------|
| `conversation-loop` | `lib/agents/conversation-loop.ts` | Pre-classification | Analyzes if request needs clarification; asks 1-2 questions before routing. Supports multi-turn refinement via `metadata.conversationHistory`. |
| `coordinator` | `lib/agents/coordinator.ts` | All | Classifies intent into RESEARCH / INBOX / PLANNING / APPLICATION / GENERAL / DESKTOP using OpenAI + keyword fallback. |
| `research` | `lib/agents/research-agent.ts` | RESEARCH | Searches the web via `worker-browser` (Playwright). Falls back to mock results. |
| `inbox` | `lib/agents/inbox-agent.ts` | INBOX | Lists emails, drafts replies via `worker-google` Gmail API. |
| `planning` | `lib/agents/planning-agent.ts` | PLANNING | Lists calendar events, creates new events via `worker-google` Calendar API. |
| `application` | `lib/agents/application-agent.ts` | APPLICATION | Generates CV summary and cover letter via OpenAI. |
| `desktop` | `lib/agents/desktop-agent.ts` | DESKTOP | Generates a file organization plan for the Windows Desktop using OpenAI. Returns `FileOperationPlan` with wildcard-based actions. |
| `summary` | `lib/agents/summary-agent.ts` | All | Generates closing summary incorporating results from all specialized agents. |

### Tools

| Tool | File | Worker | Payment Key |
|------|------|--------|-------------|
| `browser_search` | `lib/tools/browser-search.tool.ts` | `worker-browser` | `browser_search` |
| `gmail_list` | `lib/tools/gmail.tool.ts` | `worker-google` | `gmail_read` |
| `gmail_draft` | `lib/tools/gmail.tool.ts` | `worker-google` | `gmail_send` |
| `calendar_list` | `lib/tools/calendar.tool.ts` | `worker-google` | `calendar_list` |
| `calendar_create` | `lib/tools/calendar.tool.ts` | `worker-google` | `calendar_create` |
| `summary_generate` | `lib/agents/summary-agent.ts` | N/A (OpenAI) | `summary_generate` |
| `application_generate` | `lib/agents/application-agent.ts` | N/A (OpenAI) | `application_generate` |

### Payments (x402 / Treasury)

- **`lib/payments/tool-payment.ts`** - `requireToolPayment(sessionId, toolName)` enforces per-tool micropayments:
  1. Looks up `user_id` (wallet address) from `sessions` table
  2. Skips enforcement for anonymous sessions
  3. Checks if treasury PDA exists on-chain
  4. Computes `alreadySpent = SUM(cost_sol) FROM tasks WHERE session_id = ?`
  5. Fetches on-chain balance via `getTreasuryBalanceServer(wallet)`
  6. Throws `InsufficientBalanceError` or `TreasuryNotFoundError` if funds are insufficient
- **Settlement flow** (`POST /api/sessions/:id/settle`):
  1. Backend computes final cost from tasks
  2. Frontend calls `recordSessionCost()` (Anchor instruction) to debit treasury PDA on-chain
  3. Updates on-chain session status to `completed`
  4. Creates on-chain receipt via `createOnchainReceipt()`
- **Server Solana client** (`lib/solana/server-client.ts`): read-only connection for balance checks, no wallet adapter needed.

### Voice Integration (ElevenLabs)

Two integration paths:

**1. Browser WebSocket (client-side)**
- `VoiceConversationPanel` opens WebSocket to `wss://api.elevenlabs.io/v1/convai/conversation`
- Prompt includes tool definitions for `create_session`, `send_message`, `get_session_status`, `get_session_events`
- Handles `client_tool_call` / `client_tool_result` bidirectional messages
- Active session status is synced via SSE + polling (visible as badge under voice orb)

**2. Dashboard Webhook (server-side)**
- `POST /api/voice/webhook` - configured in ElevenLabs dashboard as server tool URL
- Authenticated via `X-ElevenLabs-Secret` header (`ELEVENLABS_WEBHOOK_SECRET` env)
- Same tool set as WebSocket path, enabling voice sessions outside the browser (phone, API, etc.)

### Orchestration Graph

`lib/orchestration/session-graph.ts` replaces legacy LangGraph with a clean async pipeline:

```typescript
runSessionGraph(sessionId, input, store, existingState?)
  -> if pendingQuestions: return clarifying state
  -> analyzeIntentAndNeeds() -> ready | clarifying
  -> if clarifying: store questions, return
  -> coordinatorAgent() -> intent
  -> route to specialized agent (research/inbox/planning/application/desktop)
  -> summaryAgent() with all agent results
  -> compute SUM(cost_sol) and update session
```

`continueSessionWithMessage(sessionId, userMessage, store)` is used for multi-turn conversation resumption.

### Desktop App (Electron)

**Entry**: `apps/desktop/src/main/index.ts`

Solli Desktop is an Electron app wrapping the web UI with native Windows capabilities:

```
User presses Ctrl+Shift+S
  -> Tray icon app shows main window (hidden by default)
  -> VoicePanel opens WebSocket to ElevenLabs ConvAI
       -> user says "organize my desktop"
       -> ElevenLabs calls execute_desktop_plan tool
            -> POST /api/voice/tool-call -> desktopAgent() generates FileOperationPlan
            -> Desktop receives plan via client_tool_result
  -> FileOperationPreview shows planned actions (move *.png -> Screenshots, etc.)
       -> user confirms via voice or click
       -> IPC -> Node.js fs executes plan with safety validation
  -> Overlay widget shows blue spinner during execution -> done badge
```

**Key components:**
| Component | File | Purpose |
|-----------|------|---------|
| `main` | `src/main/index.ts` | Entry, single-instance lock, global shortcut `Ctrl+Shift+S`, tray |
| `tray` | `src/main/tray.ts` | System tray icon + context menu (Open / Toggle Voice / Start on Login / Quit) |
| `windows` | `src/main/windows.ts` | `BrowserWindow` configs: main (900x700) + overlay (140x140, frameless, alwaysOnTop) |
| `ipc` | `src/main/ipc.ts` | IPC handlers: fs operations, window visibility, overlay state, auto-start |
| `safety` | `src/main/safety.ts` | Path whitelist (Desktop/Docs/Downloads/Pictures), System32 block, banned extensions |
| `preload` | `src/preload/index.ts` | `contextBridge.exposeInMainWorld('electron', api)` |
| `VoicePanel` | `src/renderer/components/VoicePanel.tsx` | Compact voice UI (ElevenLabs WS), dispatches `desktop-plan` event |
| `OverlayWidget` | `src/renderer/components/OverlayWidget.tsx` | Frameless overlay: idle → hidden, listening → teal orb, working → blue spinner, done → checkmark |
| `FileOperationPreview` | `src/renderer/components/FileOperationPreview.tsx` | Shows plan actions with Confirm/Cancel, calls `desktop:fs:executePlan` |

**Safety rules for file operations:**
- Only paths within `Desktop`, `Documents`, `Downloads`, `Pictures` are allowed
- System directories (`Windows`, `Program Files`, `System32`, etc.) are blocked
- `.exe`, `.dll`, `.sys` files cannot be moved
- `fs.move` is used with `overwrite: false` to prevent accidental data loss

**Build:**
- `pnpm --filter @solli/desktop dev` - dev mode with Vite HMR
- `pnpm --filter @solli/desktop build` - electron-vite + electron-builder (portable .exe on Windows)

### Redis / SSE Event Streaming

- `lib/db/events.ts` publishes every DB event to Redis channel `session:${sessionId}:events`
- `GET /api/sessions/:id/stream` opens an SSE connection subscribing to that Redis channel
- `VoiceConversationPanel` and `session/[id]/page.tsx` both consume this stream for real-time updates

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
- **New env vars required**:
  - `WORKER_GOOGLE_URL=http://localhost:3003` - required for inbox/planning agents
  - `ELEVENLABS_WEBHOOK_SECRET` - required for dashboard webhook authentication
- Solana program must have `record_session_cost` instruction deployed for on-chain settlement to work.
- **Desktop app** (`@solli/desktop`) connects to `http://localhost:3000` for backend API. Run `pnpm --filter @solli/web dev` before starting the desktop app.
- Desktop build for Windows requires `electron-builder` on a Windows host or CI (build currently targets Linux AppImage on WSL).
