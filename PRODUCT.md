# Solli - Product Plan

> Voice-Native Onchain Process Operator
> Hackathon: Colosseum (Open Track + ElevenLabs)

---

## 1. Sharp Use Case

**Problem:** AI assistants answer questions, but they don't *do* the work. ChatGPT can write a cover letter, but it won't send it. Claude can research a company, but it won't apply for you. There is no voice-native system that guides you through a complete workflow - asking questions, executing steps, and closing the loop.

**Target User:** Crypto-native knowledge workers who want an operator, not a chatbot.

**Solution:** Solli is a voice-native process operator. You speak naturally, and Solli:
1. **Asks clarifying questions** (ElevenLabs voice conversation)
2. **Picks the right agent** (coordinator → research / inbox / planning)
3. **Executes tool calls** (browser search, email draft, calendar create)
4. **Asks for approval** before irreversible actions
5. **Closes the loop** with a summary + on-chain receipt

**The magic moment:**
> *User:* "Help me apply to AI internships."
> *Solli:* "What kind of roles? ML, research, or data science?"
> *User:* "ML."
> *Solli:* "Remote or on-site?"
> *User:* "Warsaw or remote."
> *Solli:* *(searches, finds 3 openings)* "I found XYZ Labs, TechCorp, and Global Analytics. Which two?"
> *User:* "First two."
> *Solli:* *(generates CV + cover letter)* "Ready to send?"
> *User:* "Yes."
> *Solli:* *(sends emails)* "Done. Receipt saved on-chain. Good luck!"

This is **not** "ChatGPT with voice." This is a **voice operator** that runs multi-step workflows with human-in-the-loop approval.

---

## 2. Core User Flow

### Flow A: Voice Job Application (Primary Demo)

1. **User opens Solli** → sees landing with "Talk through your work"
2. **User speaks:** "Help me apply to AI internships in Warsaw"
3. **Coordinator agent** (ElevenLabs voice):
   - "Sure! What kind of roles? ML, research, or data science?"
4. **User speaks:** "ML and research"
5. **Coordinator:** "Remote, hybrid, or on-site in Warsaw?"
6. **User speaks:** "Warsaw or remote is fine"
7. **Research agent** runs browser search (x402 micropayment deducted)
8. **Coordinator voice:** "I found 5 matches. Top three: XYZ Labs, TechCorp Poland, Global Analytics. Which ones?"
9. **User speaks:** "First two"
10. **Inbox agent** generates tailored CV + cover letter (x402 micropayment)
11. **Coordinator:** "Drafts ready. For XYZ Labs I highlighted your Rust experience. Want to review?"
12. **User speaks:** "In the TechCorp one add that I know PyTorch"
13. **Inbox agent** updates draft
14. **Coordinator:** "Updated. Sending both applications now..."
15. **Inbox agent** sends emails (x402 micropayment)
16. **Summary agent** wraps up: "Applied to 2 internships. Spent 0.0045 SOL. Save receipt on-chain?"
17. **User speaks:** "Yes"
18. **Phantom wallet pops up** → user signs → Receipt PDA created on Solana
19. **UI shows:** Conversation transcript, results, cost breakdown, on-chain receipt hash

### Flow B: Inbox Management

1. **User speaks:** "Sort my unread emails and draft replies"
2. **Coordinator:** "How many unread? Should I focus on work or everything?"
3. **User speaks:** "Work emails only, the last 20"
4. **Inbox agent** reads Gmail, sorts by priority, drafts replies
5. **Coordinator:** "I drafted 3 replies. The most urgent is from your manager about the deadline. Want me to send it?"
6. **User speaks:** "Send the manager one, show me the other two"
7. **UI shows:** Draft previews with send/approve buttons
8. **User approves** → emails sent → receipt saved on-chain

### Flow C: Research + On-chain Receipt

1. **User types:** "Research Solana DeFi yields for next week"
2. **Research agent** runs browser search
3. **Coordinator voice:** "I analyzed 3 protocols. Marinade at 6.8%, JitoSOL at 7.2%, Solend at 8.1%. Save as receipt?"
4. **User clicks:** "Save receipt on-chain"
5. **Wallet signs** → Receipt PDA with hash of results stored on Solana

---

## 3. Solana Integration (Core, Not Glued-On)

| Feature | Onchain | Why |
|---------|---------|-----|
| Session PDA | ✅ | Every session is an onchain account with query, intent, status, owner |
| Agent Treasury PDA | ✅ | User deposits SOL; agent has a budget for tool calls |
| x402 micropayments | ✅ | Each tool call deducts a micropayment from treasury |
| Status transitions | ✅ | Only wallet owner can approve/confirm status |
| Receipt PDA | ✅ | SHA-256 hash + cost stored as onchain proof-of-work |
| Session registry | ✅ | All user sessions queryable onchain |

**Session PDA structure:**
```
Session {
  owner: Pubkey,
  session_id: u64,
  query: String<200>,
  intent: String<20>,
  status: String<20>,
  estimated_cost: u64,
  actual_cost: u64,
  created_at: i64,
  updated_at: i64,
  bump: u8,
}
```

**Receipt PDA structure:**
```
Receipt {
  session: Pubkey,
  hash: String<64>,
  cost: u64,
  timestamp: i64,
  bump: u8,
}
```

**Agent Treasury PDA structure:**
```
AgentTreasury {
  owner: Pubkey,
  balance: u64,
  total_deposited: u64,
  total_spent: u64,
  session_count: u64,
  bump: u8,
}
```

---

## 4. ElevenLabs Integration (Primary Interface)

ElevenLabs is NOT a side feature. It is the PRIMARY way to interact with Solli.

Unlike "ChatGPT with voice," Solli uses ElevenLabs as a **process orchestrator**:

| Feature | Implementation |
|---------|---------------|
| Voice conversation | Natural back-and-forth with clarifying questions |
| Subagent transfers | Coordinator transfers to research / inbox / planning agents |
| Tool calls | Agent triggers browser search, email send, calendar create |
| Human-in-the-loop | Agent asks for approval before irreversible actions |
| Transcript | Full conversation shown as chat bubbles in real-time |
| Personality | "Solli, your voice process operator" |

**Architecture:**
- **Coordinator Agent** (ElevenLabs primary) - understands intent, asks clarifying questions, routes to subagents
- **Research Agent** - executes browser search, returns results to coordinator
- **Inbox Agent** - drafts/sends emails, returns drafts for approval
- **Planning Agent** - reads/creates calendar events
- **Summary Agent** - wraps up session, presents cost + receipt option

**Why this is better than one big agent:**
Each agent has a focused system prompt and tool set. ElevenLabs workflows support routing between conversational stages. This is more stable than a single massive prompt trying to do everything.

---

## 5. UI / Product Polish

| Screen | Purpose |
|--------|---------|
| Landing | Clean hero, mic button, recent sessions |
| Session Page | Live timeline, results, voice panel, onchain actions |
| Onboarding | First-time: connect wallet, grant mic permission |
| Receipt Viewer | Solscan link, hash, status |

**Design:** Light, warm, beżowy (Perplexity-inspired), Inter font, no gradients, SVG icons only.

---

## 6. Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 14 App Router, React 18, Tailwind |
| Voice | ElevenLabs Conversational AI WebSocket |
| Blockchain | Solana (devnet), Anchor 0.29, Rust |
| Wallet | Solana Wallet Adapter (Phantom, Solflare) |
| Research | Browser worker (Playwright) |
| DB | PostgreSQL (sessions, events) |
| Cache | Redis (SSE pub/sub) |

---

## 7. MVP Scope for Demo

**Must have (demo-ready):**
- [x] Landing page: "Talk through your work. Solli handles the rest."
- [x] Voice conversation with clarifying questions (ElevenLabs WebSocket)
- [x] Multi-agent orchestration (coordinator → research → inbox → summary)
- [x] Session creation + research flow with x402 cost tracking
- [x] Onchain session PDA creation
- [x] Onchain receipt with wallet sign + cost hash
- [x] Agent Treasury PDA - user funds SOL, agent spends per tool call
- [x] Live timeline via SSE + Cost Breakdown UI
- [x] Demo simulation as conversation transcript
- [x] Clean, product-grade UI

**Nice to have:**
- [ ] Real Inbox/Planning agents (Gmail + Calendar API)
- [ ] ElevenLabs native subagent workflow (when API stable)
- [ ] Dark mode
- [ ] Mobile app

---

## 8. Validation / Traction

**What we can show:**
- Working voice interaction with ElevenLabs
- Real browser search results
- Onchain transaction with wallet signature
- Clean UI that looks like a real product

**For pitch:**
- "ChatGPT answers. Solli does. A voice-native process operator that talks you through real work - research, applications, planning - and proves it on Solana."
- "Voice-first, onchain-native, human-in-the-loop. The AI era needs operators, not chatbots."
