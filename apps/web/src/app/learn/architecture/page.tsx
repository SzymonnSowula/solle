'use client';

import Link from 'next/link';
import { ArrowLeft, Layers, ArrowRight, Cpu, Globe, Mic, Shield, Zap, Database, Radio } from 'lucide-react';
import { VolleLogo } from '@/components/VolleLogo';

export default function ArchitecturePage() {
  return (
    <div className="min-h-screen flex flex-col bg-neutral-950 text-white">
      <Nav />

      {/* Hero */}
      <section className="relative px-4 sm:px-6 pt-28 sm:pt-32 pb-16 sm:pb-20 overflow-hidden border-b border-white/5">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[100%] bg-gradient-to-br from-red-600/20 to-transparent blur-[140px] pointer-events-none rounded-full" />
        <div className="mx-auto max-w-4xl relative z-10">
          <Link href="/learn/documentation" className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors mb-8">
            <ArrowLeft className="h-4 w-4" /> Documentation
          </Link>
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-xl bg-red-500/10 flex items-center justify-center">
              <Layers className="h-5 w-5 text-red-500" />
            </div>
            <span className="text-xs font-bold text-red-400 uppercase tracking-wider">Learn</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">Architecture</h1>
          <p className="mt-4 text-lg text-neutral-400 max-w-2xl leading-relaxed">
            How Volle&apos;s multi-agent system processes your voice intents into verified on-chain actions.
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="mx-auto max-w-4xl px-4 sm:px-6 py-16 sm:py-20 space-y-16">

        {/* High-Level Flow */}
        <div>
          <SectionTitle icon={<ArrowRight className="h-5 w-5 text-red-500" />} title="Request Flow" />
          <div className="sm:pl-[52px] space-y-3">
            <FlowStep label="Input" desc="User speaks via ElevenLabs WebSocket or types text in the dashboard." />
            <FlowArrow />
            <FlowStep label="Conversation Loop" desc="Analyzes if the request is clear or needs 1-2 clarifying questions before routing." />
            <FlowArrow />
            <FlowStep label="Coordinator" desc="OpenAI classifier + keyword fallback → RESEARCH | INBOX | PLANNING | APPLICATION | DESKTOP | GENERAL" />
            <FlowArrow />
            <FlowStep label="Specialized Agent" desc="Executes the task using tool calls (browser_search, gmail_list, calendar_create, etc.)" />
            <FlowArrow />
            <FlowStep label="Summary Agent" desc="Generates a natural-language closing summary incorporating all agent results." />
            <FlowArrow />
            <FlowStep label="Settlement" desc="SUM(cost_sol) from tasks → treasury PDA debited → on-chain receipt created." />
          </div>
        </div>

        {/* Agents */}
        <div>
          <SectionTitle icon={<Cpu className="h-5 w-5 text-red-500" />} title="Agents" />
          <div className="sm:pl-[52px] grid grid-cols-1 sm:grid-cols-2 gap-4">
            <AgentCard name="Coordinator" intent="All" desc="Classifies intent using OpenAI + keyword fallback. Routes to the right specialized agent." />
            <AgentCard name="Research" intent="RESEARCH" desc="Searches the web via Playwright browser worker. Falls back to mock results." />
            <AgentCard name="Inbox" intent="INBOX" desc="Lists emails, drafts replies via Google Gmail API through worker-google." />
            <AgentCard name="Planning" intent="PLANNING" desc="Lists calendar events, creates new events via Google Calendar API." />
            <AgentCard name="Application" intent="APPLICATION" desc="Generates tailored CV summaries and cover letters via OpenAI." />
            <AgentCard name="Desktop" intent="DESKTOP" desc="Generates file organization plans with wildcard-based actions for Windows." />
            <AgentCard name="Conversation Loop" intent="Pre-routing" desc="Multi-turn refinement before classification. Asks clarifying questions." />
            <AgentCard name="Summary" intent="Post-execution" desc="Generates closing summary incorporating results from all specialized agents." />
          </div>
        </div>

        {/* Workers */}
        <div>
          <SectionTitle icon={<Globe className="h-5 w-5 text-red-500" />} title="Worker Services" />
          <div className="sm:pl-[52px] space-y-4">
            <WorkerCard name="worker-browser" port="3002" desc="Express + Playwright. Executes browser_search tool calls. Navigates Google, scrapes results, returns structured data." />
            <WorkerCard name="worker-google" port="3003" desc="Express + Google APIs. Handles gmail_list, gmail_draft, calendar_list, calendar_create via OAuth tokens." />
          </div>
        </div>

        {/* Voice */}
        <div>
          <SectionTitle icon={<Mic className="h-5 w-5 text-red-500" />} title="Voice Integration" />
          <div className="sm:pl-[52px] space-y-4">
            <div className="rounded-xl bg-neutral-900 border border-white/5 p-6">
              <h4 className="text-sm font-bold text-white mb-2">Browser WebSocket (Client-side)</h4>
              <p className="text-sm text-neutral-400 leading-relaxed">
                VoiceConversationPanel opens a WebSocket to <code className="text-neutral-300">wss://api.elevenlabs.io/v1/convai/conversation</code>.
                The prompt includes tool definitions for session management. Handles bidirectional <code className="text-neutral-300">client_tool_call</code> / <code className="text-neutral-300">client_tool_result</code> messages.
              </p>
            </div>
            <div className="rounded-xl bg-neutral-900 border border-white/5 p-6">
              <h4 className="text-sm font-bold text-white mb-2">Dashboard Webhook (Server-side)</h4>
              <p className="text-sm text-neutral-400 leading-relaxed">
                <code className="text-neutral-300">POST /api/voice/webhook</code> — configured in ElevenLabs dashboard as server tool URL.
                Authenticated via <code className="text-neutral-300">X-ElevenLabs-Secret</code> header. Enables voice sessions outside the browser.
              </p>
            </div>
          </div>
        </div>

        {/* Payments */}
        <div>
          <SectionTitle icon={<Zap className="h-5 w-5 text-red-500" />} title="Payments (x402)" />
          <div className="sm:pl-[52px] text-neutral-300 leading-relaxed space-y-4">
            <p>
              Every tool execution has a cost key (e.g. <code className="text-neutral-200">browser_search</code>, <code className="text-neutral-200">gmail_read</code>).
              The <strong className="text-white">requireToolPayment()</strong> function enforces per-tool micropayments:
            </p>
            <ol className="list-decimal list-inside space-y-2 text-sm">
              <li>Looks up <code className="text-neutral-200">user_id</code> (wallet address) from sessions table</li>
              <li>Skips enforcement for anonymous sessions</li>
              <li>Checks if treasury PDA exists on-chain</li>
              <li>Computes <code className="text-neutral-200">alreadySpent = SUM(cost_sol) FROM tasks</code></li>
              <li>Fetches on-chain balance via <code className="text-neutral-200">getTreasuryBalanceServer()</code></li>
              <li>Throws <code className="text-red-400">InsufficientBalanceError</code> if funds are insufficient</li>
            </ol>
          </div>
        </div>

        {/* Streaming */}
        <div>
          <SectionTitle icon={<Radio className="h-5 w-5 text-red-500" />} title="Real-time Streaming" />
          <div className="sm:pl-[52px] text-neutral-300 leading-relaxed space-y-4">
            <p>
              Every database event is published to Redis channel <code className="text-neutral-200">session:&#123;sessionId&#125;:events</code>.
              The SSE endpoint <code className="text-neutral-200">GET /api/sessions/:id/stream</code> subscribes to this channel and pushes
              events to the browser in real-time. Both the VoiceConversationPanel and session detail page consume this stream.
            </p>
          </div>
        </div>

        {/* Blockchain */}
        <div>
          <SectionTitle icon={<Shield className="h-5 w-5 text-red-500" />} title="On-chain Program (Anchor)" />
          <div className="sm:pl-[52px] text-neutral-300 leading-relaxed space-y-4">
            <p>
              The Solana program is built with <strong className="text-white">Anchor</strong> and provides five instructions:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <InstructionCard name="initialize_treasury" desc="Creates a PDA-based treasury account for the user." />
              <InstructionCard name="fund_agent" desc="Deposits SOL into the treasury PDA." />
              <InstructionCard name="record_session_cost" desc="Debits the treasury balance for a session." />
              <InstructionCard name="withdraw" desc="Withdraws SOL from the treasury back to the owner." />
              <InstructionCard name="create_session" desc="Creates an on-chain session PDA with query + intent." />
              <InstructionCard name="update_session_status" desc="Updates session status (pending → completed)." />
              <InstructionCard name="create_receipt" desc="Creates a receipt PDA linked to a completed session." />
            </div>
          </div>
        </div>

        {/* Monorepo */}
        <div>
          <SectionTitle icon={<Database className="h-5 w-5 text-red-500" />} title="Monorepo Structure" />
          <div className="sm:pl-[52px] overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-neutral-400">
                  <th className="pb-3 pr-4 font-medium">Package</th>
                  <th className="pb-3 font-medium">Role</th>
                </tr>
              </thead>
              <tbody className="text-neutral-300">
                <tr className="border-b border-white/5"><td className="py-3 pr-4 font-mono text-xs text-red-400">@solli/web</td><td className="py-3">Next.js fullstack app (port 3000)</td></tr>
                <tr className="border-b border-white/5"><td className="py-3 pr-4 font-mono text-xs text-red-400">@solli/desktop</td><td className="py-3">Electron desktop app (tray, overlay, voice)</td></tr>
                <tr className="border-b border-white/5"><td className="py-3 pr-4 font-mono text-xs text-red-400">@solli/worker-browser</td><td className="py-3">Playwright automation worker (port 3002)</td></tr>
                <tr className="border-b border-white/5"><td className="py-3 pr-4 font-mono text-xs text-red-400">@solli/worker-google</td><td className="py-3">Gmail/Calendar worker (port 3003)</td></tr>
                <tr className="border-b border-white/5"><td className="py-3 pr-4 font-mono text-xs text-red-400">@solli/agent-core</td><td className="py-3">LangGraph orchestration (legacy)</td></tr>
                <tr className="border-b border-white/5"><td className="py-3 pr-4 font-mono text-xs text-red-400">@solli/shared</td><td className="py-3">Types + Zod schemas</td></tr>
                <tr className="border-b border-white/5"><td className="py-3 pr-4 font-mono text-xs text-red-400">@solli/blockchain</td><td className="py-3">Solana/x402 + receipts</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 pt-8 border-t border-white/10">
          <NavPill href="/learn/documentation" label="← Documentation" />
          <NavPill href="/learn/solana-setup" label="Solana Setup →" />
          <NavPill href="/learn/voice-commands" label="Voice Commands →" />
        </div>
      </section>

      <PageFooter />
    </div>
  );
}

function Nav() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-neutral-950/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 py-4">
        <Link href="/" className="flex items-center gap-3">
          <VolleLogo className="h-8 w-8 text-white" />
          <span className="text-xl font-bold tracking-tight text-white">VOLLE</span>
        </Link>
        <div className="flex items-center gap-4 sm:gap-6 text-sm font-medium text-neutral-300">
          <Link href="/learn/documentation" className="text-white">Learn</Link>
          <Link href="/explore/agents" className="hover:text-white transition-colors hidden sm:block">Explore</Link>
          <Link href="/dashboard" className="hover:text-white transition-colors">Dashboard</Link>
        </div>
      </div>
    </nav>
  );
}

function PageFooter() {
  return (
    <footer className="border-t border-white/5 mt-auto">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <VolleLogo className="h-5 w-5 text-white" />
          <span className="text-sm font-medium text-white">Volle</span>
        </div>
        <div className="flex items-center gap-6 text-xs text-neutral-400">
          <Link href="/" className="hover:text-white transition-colors">Home</Link>
          <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
        </div>
      </div>
    </footer>
  );
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <div className="h-10 w-10 rounded-xl bg-neutral-900 border border-white/5 flex items-center justify-center">{icon}</div>
      <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
    </div>
  );
}

function FlowStep({ label, desc }: { label: string; desc: string }) {
  return (
    <div className="rounded-xl bg-neutral-900 border border-white/5 p-5">
      <span className="text-xs font-bold text-red-400 uppercase tracking-wider">{label}</span>
      <p className="mt-1 text-sm text-neutral-300">{desc}</p>
    </div>
  );
}

function FlowArrow() {
  return (
    <div className="flex justify-center">
      <div className="h-6 w-px bg-gradient-to-b from-red-500/50 to-red-500/10" />
    </div>
  );
}

function AgentCard({ name, intent, desc }: { name: string; intent: string; desc: string }) {
  return (
    <div className="rounded-xl bg-neutral-900 border border-white/5 p-5 hover:border-red-500/20 transition-colors">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-bold text-white">{name}</h4>
        <span className="text-[10px] font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full uppercase">{intent}</span>
      </div>
      <p className="text-xs text-neutral-400 leading-relaxed">{desc}</p>
    </div>
  );
}

function WorkerCard({ name, port, desc }: { name: string; port: string; desc: string }) {
  return (
    <div className="rounded-xl bg-neutral-900 border border-white/5 p-5">
      <div className="flex items-center gap-2 mb-2">
        <h4 className="text-sm font-bold text-white font-mono">{name}</h4>
        <span className="text-[10px] text-neutral-500">:{port}</span>
      </div>
      <p className="text-xs text-neutral-400 leading-relaxed">{desc}</p>
    </div>
  );
}

function InstructionCard({ name, desc }: { name: string; desc: string }) {
  return (
    <div className="rounded-lg bg-neutral-900/50 border border-white/5 px-4 py-3">
      <code className="text-xs text-red-400">{name}</code>
      <p className="text-xs text-neutral-400 mt-1">{desc}</p>
    </div>
  );
}

function NavPill({ href, label }: { href: any; label: string }) {
  return (
    <Link href={href} className="px-4 py-2 rounded-full border border-white/10 text-sm text-neutral-300 hover:text-white hover:border-red-500/30 transition-colors">
      {label}
    </Link>
  );
}
