# Solli - Voice-Native Session Operator

## Czym Solli NIE jest
Nie jest kolejnym ogólnym desktop assistentem sterującym myszką i klawiaturą.
Nie automatyzuje UI innych aplikacji. Nie klika, nie scrolluje.

## Czym Solli JEST
Głosowy operator workflowu oparty na ElevenLabs Conversational AI.
Użytkownik uruchamia KONKRETNĄ sesję pracy (research, inbox cleanup, life admin),
a agent prowadzi naturalny dialog, dopytuje, deleguje do wyspecjalizowanych
agentów i kończy krótkim podsumowaniem.

## Conversation-first, session-based
- Każda sesja ma cel, historię i kontekst w Postgres (trwała)
- Follow-upy w obrębie jednej sesji ("a teraz zapisz w kalendarzu")
- Low latency przez ElevenLabs + streaming audio
- LangGraph = execution engine (nie master dialogu)
- ElevenLabs = master dialogu przez function calling

## Blockchain jako ukryta warstwa zaufania
Solana/x402 jest niewidoczna w UI. Służy do:
- Zapisywania receiptów (hashy) ważnych akcji jako proof-of-work
- Mikropłatności między agentem a płatnymi usługami/API (przyszłość)
- Zamiast głównego elementu - zaufana infrastruktura w tle

## Architektura
```
User (voice/web)
  ↔ Next.js App Router (frontend + API routes)
    ↔ ElevenLabs Conversational AI (WebSocket via API proxy)
      ↔ [function calls] → Route Handlers (/api/*)
        ↔ LangGraph (agent-core) - wykonuje workflow, trzyma stan w Postgres
          ↔ Workers (browser, google)
        ↔ Postgres - checkpoints, sessions, events, tasks, receipts
        ↔ Redis - transient state, cache, pub/sub
        ↔ Solana Devnet - receipts on-chain (async)
```
