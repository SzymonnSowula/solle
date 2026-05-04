# Solli — Product Plan

> Voice-Native Onchain Research Agent
> Hackathon: Colosseum (Open Track + ElevenLabs)

---

## 1. Sharp Use Case

**Problem:** People research things online every day — jobs, investments, travel plans — but there is no proof-of-action. No audit trail of what the AI recommended. No way to prove that research was done by a trusted agent and approved by the user.

**Target User:** Crypto-native knowledge workers who want verifiable AI research.

**Solution:** Solli is a voice-native operator that:
1. Takes a voice query (ElevenLabs)
2. Executes research (browser agent)
3. Stores the session onchain (Solana PDA)
4. Allows the user to approve the result onchain (wallet sign)
5. Writes a receipt with a hash of results as proof-of-action (Solana memo)

**The magic moment:** User speaks a query, hears natural voice response, sees real results, clicks one button to make it permanent on Solana.

---

## 2. Core User Flow

### Flow A: Voice Research + Onchain Receipt

1. **User opens Solli** → sees clean landing with mic button
2. **User speaks:** "Find me 3 AI internships in Poland"
3. **ElevenLabs voice responds:** "I'm on it. Searching for AI internships in Poland."
4. **Backend:**
   - Creates Solana PDA session (query, intent, status="pending")
   - Classifies intent → RESEARCH
   - Runs browser search
   - Returns structured results
5. **Voice continues:** "I found 3 opportunities. First: AI Research Intern at XYZ Labs in Warsaw..."
6. **UI shows:** Timeline, 3 research cards, summary
7. **User says or clicks:** "Save this as a receipt"
8. **Backend computes hash** of results + summary + timestamp
9. **Phantom wallet pops up** → user signs transaction
10. **Solana stores:** Receipt memo with hash
11. **UI shows:** "Receipt saved onchain. View on Solscan."

### Flow B: Browse + Approve Session

1. **User opens Solli**
2. **User types:** "Research Solana DeFi yields for next week"
3. **Session created onchain** (PDA with query, status="pending")
4. **Research runs** → results in UI
5. **User clicks "Approve onchain"**
6. **Wallet signs** → status PDA changes to "approved"
7. **Receipt created** → hash of results stored onchain

---

## 3. Solana Integration (Core, Not Glued-On)

| Feature | Onchain | Why |
|---------|---------|-----|
| Session PDA | ✅ | Every session is an onchain account with query, intent, status, owner |
| Status transitions | ✅ | Only wallet owner can approve/confirm status |
| Receipt memo | ✅ | SHA-256 hash of results stored as onchain proof |
| Session registry | ✅ | All user sessions queryable onchain |
| Budget/approval | 🟡 | Future: agent budgets for paid tools |

**Session PDA structure:**
```
Session {
  owner: Pubkey,
  query: String<200>,
  intent: String<20>,
  status: String<20>, // pending, researching, completed, approved
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
  signature: String<88>,
  timestamp: i64,
  bump: u8,
}
```

---

## 4. ElevenLabs Integration (Primary Interface)

ElevenLabs is NOT a side feature. It is the PRIMARY way to interact with Solli.

| Feature | Implementation |
|---------|---------------|
| Voice query | User holds mic button, speaks query |
| Voice response | Agent speaks results naturally |
| Tool execution | Agent calls browser search as tool |
| Transcript | Shown in UI in real-time |
| Personality | "Solli, your onchain research operator" |

**Agent System Prompt:**
"You are Solli, a voice-native onchain research operator. You help users research topics and save results as verifiable onchain receipts. You speak clearly, concisely, and naturally. When asked to research, confirm the request, execute the search, and summarize results verbally."

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
- [x] Landing page with voice input
- [x] Session creation + research flow
- [x] ElevenLabs voice conversation
- [x] Onchain session PDA creation
- [x] Onchain receipt with wallet sign
- [x] Live timeline via SSE
- [x] Clean, product-grade UI

**Nice to have:**
- [ ] Inbox/Planning agents (Gmail/Calendar)
- [ ] Agent budgets onchain
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
- "Every AI interaction deserves proof. Solli makes your research verifiable on Solana."
- "Voice-first, onchain-native, operator for the AI era."
