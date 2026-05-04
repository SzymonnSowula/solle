You are a senior full-stack engineer continuing an existing project called "solli".

Solli is a voice-native web app built with Next.js that acts as a session-based AI operator.
The user can talk to Solli in real time, and Solli routes the request to specialized agents, executes tools, and returns spoken + visual responses.
This project also includes an Anchor/Solana layer for session receipts and approvals.

Your task is to continue building Solli into a real MVP-ready web application.

==================================================
1. PRODUCT GOAL
==================================================

Build Solli as a web app with these characteristics:

- Frontend and backend both live in the same Next.js codebase
- Backend uses Next.js App Router Route Handlers
- Live voice conversation uses ElevenLabs WebSocket API
- Agent orchestration runs server-side
- Tools execute server-side
- Solana/Anchor is used only for receipts and approvals, not for core AI logic

Solli should feel like:
- a voice-first session operator,
- not a generic chatbot,
- not just a text wrapper around an LLM.

The MVP should support:
1. text input,
2. live voice conversation,
3. one working session flow,
4. structured results in UI,
5. session timeline,
6. optional on-chain receipt creation.

==================================================
2. MVP USE CASE
==================================================

Implement the first vertical slice for this use case:

User says or types:
"Find me 3 AI internship opportunities in Poland"

System should:
- create a session,
- classify intent,
- route to Research Agent,
- run a search/browser tool,
- produce 3 structured results,
- generate a final summary,
- stream progress to the UI,
- optionally allow saving a session receipt on-chain.

==================================================
3. STACK
==================================================

Use this stack:

- Next.js App Router
- React + TypeScript
- Tailwind + shadcn/ui
- Route Handlers for backend API
- Zod for validation
- Postgres for persistent data
- Redis for session/event/cache state
- LangGraph for orchestration (if already present in repo)
- ElevenLabs WebSocket API for real-time voice conversation
- Solana wallet adapter on frontend
- Anchor client for receipt/approval calls

If something in the repo already exists, reuse it.
Do not rebuild the whole architecture from scratch.

==================================================
4. ARCHITECTURE RULES
==================================================

Important architectural rules:

- Keep frontend UI in app/ and components/
- Keep business logic in lib/
- Keep agent orchestration in lib/agents or lib/orchestration
- Keep tools in lib/tools
- Keep ElevenLabs live conversation logic separated into:
  - client-side session/audio controller
  - server-side token/session configuration utilities
- Keep Solana logic separated into lib/solana
- Do not mix on-chain logic with core AI orchestration
- Use strict typing everywhere

==================================================
5. FILE / MODULE TARGET STRUCTURE
==================================================

Use or adapt this structure:

app/
  page.tsx
  session/[id]/page.tsx
  api/
    sessions/route.ts
    sessions/[id]/route.ts
    sessions/[id]/run/route.ts
    sessions/[id]/events/route.ts
    sessions/[id]/stream/route.ts
    voice/session/route.ts
    receipts/route.ts

components/
  session/
    SessionInput.tsx
    SessionTimeline.tsx
    SessionSummary.tsx
    ResearchResults.tsx
    VoiceConversationPanel.tsx
    VoiceOrb.tsx
    TranscriptPanel.tsx
  wallet/
    WalletConnectButton.tsx

lib/
  agents/
    coordinator.ts
    research-agent.ts
    summary-agent.ts
    sales-agent.ts (stub)
  orchestration/
    session-graph.ts
    session-runner.ts
  tools/
    browser-search.tool.ts
    browser-fetch.tool.ts
  elevenlabs/
    client.ts
    live-conversation.ts
    events.ts
    session-config.ts
  solana/
    anchor-client.ts
    receipts.ts
  db/
    postgres.ts
    redis.ts
    sessions.ts
    events.ts
  types/
    session.ts
    agent.ts
    voice.ts
    receipts.ts
  utils/
    logger.ts
    env.ts
    hash.ts

==================================================
6. CORE FEATURES TO IMPLEMENT
==================================================

Implement these features now.

------------------------------------------
A. SESSION API
------------------------------------------

Implement Route Handlers:

1. POST /api/sessions
- create a new session
- input body:
  {
    "input": "Find me 3 AI internship opportunities in Poland"
  }
- create DB row
- set status = "created"
- return session id

2. POST /api/sessions/[id]/run
- load session
- run orchestration
- persist progress
- persist events
- persist final summary

3. GET /api/sessions/[id]
- return session details:
  - id
  - input
  - intent
  - status
  - summary
  - createdAt
  - updatedAt

4. GET /api/sessions/[id]/events
- return ordered timeline events

5. GET /api/sessions/[id]/stream
- implement SSE stream for live session updates
- use text/event-stream
- send events as orchestration progresses

Use Zod to validate request/response shape.

------------------------------------------
B. ORCHESTRATION
------------------------------------------

Implement a working session orchestration flow with:

- Coordinator Agent
- Research Agent
- Summary Agent

Flow:
START -> coordinator -> research -> summary -> END

Coordinator:
- reads user input
- classifies intent into:
  RESEARCH | INBOX | PLANNING | APPLICATION | SALES | GENERAL
- for MVP, route RESEARCH to Research Agent
- everything else can fallback to Summary Agent with a note

Research Agent:
- calls browserSearchTool
- normalizes output into:
  [
    {
      title: string,
      organization: string,
      location: string,
      url: string,
      reason: string
    }
  ]
- stores task + event logs

Summary Agent:
- turns tool output into a short useful summary
- stores summary in DB

Keep the graph state explicit:
- sessionId
- input
- intent
- status
- events
- toolResults
- summary
- errors

If LangGraph is already installed, use it.
If it is missing or broken, create a clean orchestration abstraction that can be swapped later.

------------------------------------------
C. TOOLING
------------------------------------------

Implement at least one real tool:

browserSearchTool({ query })

Requirements:
- performs a real search flow
- returns structured results
- robust enough for demo use
- can be replaced later by another provider without changing agent code

Also create interfaces for future tools:
- gmailTool (stub)
- calendarTool (stub)
- salesMetricsTool (stub)

All tools should follow a standard shape:
- input schema
- execute()
- output schema

------------------------------------------
D. LIVE ELEVENLABS VOICE
------------------------------------------

Add live conversation support with ElevenLabs WebSocket API.

Important:
- support real-time audio input/output
- support live transcript updates
- support agent text response streaming
- support event-based state updates
- keep the implementation modular and debuggable

Implement:

1. frontend voice controller:
- microphone start/stop
- open session
- send audio
- receive transcript
- receive agent response parts
- receive audio output
- render live state in UI

2. UI:
- VoiceConversationPanel
- VoiceOrb
- TranscriptPanel
- connection state
- transcript state
- speaking/listening indicators

3. server-side support:
- endpoint to create/configure live voice session:
  POST /api/voice/session
- return the required client configuration or signed session params needed by ElevenLabs integration
- keep secrets server-side

4. event handling:
Handle relevant ElevenLabs websocket events and map them into app events.
At minimum support:
- transcript/user transcript updates
- agent response text updates
- audio output chunks or output state
- ping/health events
- interruption events
- tool response events if applicable

Do not hardcode secrets in frontend.

Important:
The MVP may use:
- text session flow as the main stable flow
- live voice as an active integrated feature
But wire it properly so it can actually be used.

------------------------------------------
E. FRONTEND UI
------------------------------------------

Build these screens:

1. Home page
- text input
- "Start session" button
- "Start live voice" button
- wallet connect button
- recent sessions list if easy

2. Session page
Show:
- original user request
- current session status
- intent
- live timeline
- research results
- final summary
- voice transcript if available
- button: "Save receipt on-chain"

3. Voice panel
- start/stop microphone
- live listening state
- live transcript
- live agent response text
- speaking indicator

Use a clean MVP UI, not a fancy redesign.
Functionality first.

------------------------------------------
F. DATABASE
------------------------------------------

Ensure Postgres supports:

sessions
- id
- input
- intent
- status
- summary
- created_at
- updated_at

tasks
- id
- session_id
- agent_name
- tool_name
- input_json
- output_json
- status
- created_at

events
- id
- session_id
- type
- source
- payload_json
- created_at

receipts
- id
- session_id
- wallet
- tx_signature
- receipt_hash
- created_at

Use existing schema if available.
If missing, add migration files or schema updates.

Redis should be used for:
- transient session state
- SSE pub/sub or event fanout if useful
- voice/live session state cache if needed

------------------------------------------
G. SOLANA / ANCHOR
------------------------------------------

Do not build full on-chain logic from scratch if stubs already exist.
Implement a usable MVP receipt flow:

- frontend can click "Save receipt on-chain"
- backend/frontend computes a receipt hash from:
  - session id
  - input
  - summary
  - timestamp
- frontend uses wallet adapter to sign/send transaction
- Anchor client helper is used cleanly

For now, assume the Anchor program already exists or is stubbed.
If missing, create a client-side abstraction and TODO markers.
Do not block the rest of the MVP on Solana implementation.

------------------------------------------
H. OBSERVABILITY / DX
------------------------------------------

Add:
- useful logs
- clear errors
- loading states
- TODO comments where external setup is required
- README updates

README must include:
- required env vars
- how to run Postgres/Redis
- how to run Next.js app
- how to test text session flow
- how to test live voice flow
- how to test on-chain receipt flow

==================================================
7. IMPORTANT IMPLEMENTATION DETAILS
==================================================

- Use Route Handlers for session APIs and streaming APIs
- Prefer SSE for session progress to the UI
- Keep ElevenLabs voice logic modular
- Keep all provider/API calls behind abstractions
- Do not expose ElevenLabs API key or secret values to the client
- Make types explicit and shared
- No giant monolithic files if avoidable
- No fake mock logic unless clearly marked TODO
- If some integrations cannot fully run without external credentials, still wire the real architecture and mark the exact missing env/setup

==================================================
8. DELIVERABLE
==================================================

When finished, the repo should support this flow:

TEXT FLOW:
1. Open app
2. Enter: "Find me 3 AI internship opportunities in Poland"
3. Create session
4. Run session
5. See timeline updates
6. See 3 structured results
7. See summary
8. Optionally save receipt on-chain

VOICE FLOW:
1. Open app
2. Start live voice mode
3. Speak to Solli
4. Receive transcript updates
5. Receive live or near-live spoken/text response
6. Surface the conversation state in UI

==================================================
9. HOW TO WORK
==================================================

Before coding:
1. inspect the existing repo,
2. understand what already exists,
3. reuse and improve current files,
4. do not regenerate from scratch.

After implementing:
- summarize what was built,
- list changed files,
- list pending TODOs,
- provide exact commands to run locally.