'use client';

import Link from 'next/link';
import { ArrowLeft, BookOpen, Code, Server, Database, Zap, Globe, Terminal } from 'lucide-react';
import { VolleLogo } from '@/components/VolleLogo';

export default function DocumentationPage() {
  return (
    <div className="min-h-screen flex flex-col bg-neutral-950 text-white">
      <Nav />

      {/* Hero */}
      <section className="relative px-4 sm:px-6 pt-28 sm:pt-32 pb-16 sm:pb-20 overflow-hidden border-b border-white/5">
        <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[100%] bg-gradient-to-bl from-red-600/20 to-transparent blur-[140px] pointer-events-none rounded-full" />
        <div className="mx-auto max-w-4xl relative z-10">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors mb-8">
            <ArrowLeft className="h-4 w-4" /> Back to Home
          </Link>
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-xl bg-red-500/10 flex items-center justify-center">
              <BookOpen className="h-5 w-5 text-red-500" />
            </div>
            <span className="text-xs font-bold text-red-400 uppercase tracking-wider">Learn</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">Documentation</h1>
          <p className="mt-4 text-lg text-neutral-400 max-w-2xl leading-relaxed">
            Everything you need to understand, deploy, and extend the Volle platform.
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="mx-auto max-w-4xl px-4 sm:px-6 py-16 sm:py-20 space-y-16">

        {/* Overview */}
        <DocSection
          icon={<Globe className="h-5 w-5 text-red-500" />}
          title="What is Volle?"
        >
          <p>
            Volle is a <Strong>voice-native AI process operator</Strong> built on Solana. Users speak natural-language requests
            which are routed through a multi-agent orchestration pipeline. Each agent executes a specialized task — web research,
            inbox management, calendar planning, or job applications — and every session is settled on-chain via <Strong>x402 micropayments</Strong>.
          </p>
          <p>
            The platform ships as a monorepo with three deployable apps (<code>web</code>, <code>worker-browser</code>,{' '}
            <code>worker-google</code>) and three shared packages (<code>agent-core</code>, <code>shared</code>, <code>blockchain</code>).
          </p>
        </DocSection>

        {/* Tech Stack */}
        <DocSection
          icon={<Code className="h-5 w-5 text-red-500" />}
          title="Tech Stack"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <StackCard label="Frontend" value="Next.js 14, React, TailwindCSS" />
            <StackCard label="Desktop" value="Electron + Vite" />
            <StackCard label="Blockchain" value="Solana, Anchor, wallet-adapter" />
            <StackCard label="AI / LLM" value="OpenAI GPT, LangGraph pipeline" />
            <StackCard label="Voice" value="ElevenLabs Conversational AI" />
            <StackCard label="Automation" value="Playwright (browser worker)" />
            <StackCard label="Google APIs" value="Gmail API, Calendar API" />
            <StackCard label="Infrastructure" value="PostgreSQL + pgvector, Redis" />
            <StackCard label="Monorepo" value="pnpm workspaces, Turborepo" />
            <StackCard label="Auth" value="Google OAuth 2.0, Solana wallet" />
          </div>
        </DocSection>

        {/* API Routes */}
        <DocSection
          icon={<Server className="h-5 w-5 text-red-500" />}
          title="API Routes"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-neutral-400">
                  <th className="pb-3 pr-4 font-medium">Route</th>
                  <th className="pb-3 pr-4 font-medium">Method</th>
                  <th className="pb-3 font-medium">Purpose</th>
                </tr>
              </thead>
              <tbody className="text-neutral-300">
                <ApiRow route="/api/sessions" method="POST, GET" purpose="Create / list sessions" />
                <ApiRow route="/api/sessions/:id" method="GET" purpose="Get session state" />
                <ApiRow route="/api/sessions/:id/run" method="POST" purpose="Fire orchestration graph" />
                <ApiRow route="/api/sessions/:id/message" method="POST" purpose="Continue clarifying session" />
                <ApiRow route="/api/sessions/:id/events" method="GET" purpose="List agent events" />
                <ApiRow route="/api/sessions/:id/stream" method="GET" purpose="SSE live event stream" />
                <ApiRow route="/api/sessions/:id/tasks" method="GET" purpose="List tool execution tasks" />
                <ApiRow route="/api/sessions/:id/settle" method="POST" purpose="Compute final cost + receipt" />
                <ApiRow route="/api/voice/session" method="POST" purpose="ElevenLabs agent config" />
                <ApiRow route="/api/voice/tool-call" method="POST" purpose="Voice tool call proxy" />
                <ApiRow route="/api/voice/webhook" method="POST" purpose="ElevenLabs webhook" />
              </tbody>
            </table>
          </div>
        </DocSection>

        {/* Session Lifecycle */}
        <DocSection
          icon={<Zap className="h-5 w-5 text-red-500" />}
          title="Session Lifecycle"
        >
          <div className="space-y-4">
            <Step n={1} text="User speaks or types a request" />
            <Step n={2} text="POST /api/sessions creates a new session record" />
            <Step n={3} text="POST /api/sessions/:id/run fires the orchestration graph" />
            <Step n={4} text="Conversation loop analyzes if clarification is needed" />
            <Step n={5} text="Coordinator classifies intent → RESEARCH / INBOX / PLANNING / APPLICATION" />
            <Step n={6} text="Specialized agent executes the task with tool calls" />
            <Step n={7} text="Summary agent generates a closing summary" />
            <Step n={8} text="Settlement: SUM(cost_sol) computed, treasury debited on-chain" />
            <Step n={9} text="On-chain receipt created via createOnchainReceipt()" />
          </div>
        </DocSection>

        {/* Dev Setup */}
        <DocSection
          icon={<Terminal className="h-5 w-5 text-red-500" />}
          title="Development Setup"
        >
          <div className="rounded-xl bg-neutral-900 border border-white/5 p-6 font-mono text-sm text-neutral-300 space-y-2 overflow-x-auto">
            <div><span className="text-neutral-500"># 1.</span> pnpm install</div>
            <div><span className="text-neutral-500"># 2.</span> cp .env.example .env.local <span className="text-neutral-500">— fill API keys</span></div>
            <div><span className="text-neutral-500"># 3.</span> docker-compose up -d <span className="text-neutral-500">— Postgres + Redis</span></div>
            <div><span className="text-neutral-500"># 4.</span> pnpm dev <span className="text-neutral-500">— starts all apps via Turborepo</span></div>
          </div>
          <p className="mt-4 text-neutral-500 text-sm">
            Individual apps can be started with <code className="text-neutral-300">pnpm --filter @solli/web dev</code>,{' '}
            <code className="text-neutral-300">pnpm --filter @solli/worker-browser dev</code>, etc.
          </p>
        </DocSection>

        {/* Database */}
        <DocSection
          icon={<Database className="h-5 w-5 text-red-500" />}
          title="Database Schema"
        >
          <p>
            Volle uses <Strong>PostgreSQL with pgvector</Strong> for session storage and future semantic search capabilities.
            The schema is initialized automatically from <code>docker/postgres/init.sql</code> when running <code>docker-compose up</code>.
          </p>
          <p>
            Key tables: <code>sessions</code>, <code>events</code>, <code>tasks</code>, <code>accounts</code>.
            Redis is used for pub/sub event streaming (SSE) and real-time session updates.
          </p>
        </DocSection>

        {/* Nav */}
        <div className="flex flex-wrap gap-3 pt-8 border-t border-white/10">
          <NavPill href="/learn/architecture" label="Architecture →" />
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
          <span>Colosseum 2026</span>
        </div>
      </div>
    </footer>
  );
}

function DocSection({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 rounded-xl bg-neutral-900 border border-white/5 flex items-center justify-center">{icon}</div>
        <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
      </div>
      <div className="text-neutral-300 leading-relaxed space-y-4 pl-0 sm:pl-[52px]">{children}</div>
    </div>
  );
}

function Strong({ children }: { children: React.ReactNode }) {
  return <strong className="text-white font-semibold">{children}</strong>;
}

function StackCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-neutral-900 border border-white/5 p-4">
      <div className="text-xs text-neutral-500 font-bold uppercase tracking-wider mb-1">{label}</div>
      <div className="text-sm text-neutral-200">{value}</div>
    </div>
  );
}

function ApiRow({ route, method, purpose }: { route: string; method: string; purpose: string }) {
  return (
    <tr className="border-b border-white/5">
      <td className="py-3 pr-4 font-mono text-xs text-red-400">{route}</td>
      <td className="py-3 pr-4 text-xs text-neutral-500">{method}</td>
      <td className="py-3 text-neutral-300">{purpose}</td>
    </tr>
  );
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <div className="flex items-start gap-4">
      <div className="flex-shrink-0 h-7 w-7 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-xs font-bold text-red-400">{n}</div>
      <p className="text-neutral-300 pt-0.5">{text}</p>
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
