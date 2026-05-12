'use client';

import Link from 'next/link';
import { ArrowLeft, Plug, Mail, Calendar, Globe, Mic, Shield, Wallet, Database, ArrowRight } from 'lucide-react';
import { VolleLogo } from '@/components/VolleLogo';

export default function IntegrationsPage() {
  return (
    <div className="min-h-screen flex flex-col bg-neutral-950 text-white">
      <Nav />

      <section className="relative px-4 sm:px-6 pt-28 sm:pt-32 pb-16 sm:pb-20 overflow-hidden border-b border-white/5">
        <div className="absolute top-[-20%] left-[-5%] w-[50%] h-[100%] bg-gradient-to-br from-red-600/15 to-transparent blur-[140px] pointer-events-none rounded-full" />
        <div className="mx-auto max-w-5xl relative z-10">
          <Link href="/explore/agents" className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors mb-8">
            <ArrowLeft className="h-4 w-4" /> Explore
          </Link>
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-xl bg-red-500/10 flex items-center justify-center">
              <Plug className="h-5 w-5 text-red-500" />
            </div>
            <span className="text-xs font-bold text-red-400 uppercase tracking-wider">Explore</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">Integrations</h1>
          <p className="mt-4 text-lg text-neutral-400 max-w-2xl leading-relaxed">
            Volle connects to your existing tools. Every integration runs through a secure worker service with OAuth-based access.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 sm:px-6 py-16 sm:py-20">

        {/* Active */}
        <div className="mb-12">
          <h2 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-6">Active Integrations</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <IntegrationCard icon={<Mail className="h-6 w-6" />} name="Gmail" status="live" desc="Read inbox, list unread, draft replies. OAuth via worker-google." />
            <IntegrationCard icon={<Calendar className="h-6 w-6" />} name="Google Calendar" status="live" desc="List events, create meetings, find free slots. OAuth via worker-google." />
            <IntegrationCard icon={<Globe className="h-6 w-6" />} name="Web Search" status="live" desc="Playwright-powered search via worker-browser. Google scraping with fallback." />
            <IntegrationCard icon={<Mic className="h-6 w-6" />} name="ElevenLabs" status="live" desc="Real-time voice via WebSocket ConvAI. Server webhook for external voice sessions." />
            <IntegrationCard icon={<Shield className="h-6 w-6" />} name="Solana" status="live" desc="Anchor program for treasury, sessions, and receipts. Devnet deployment." />
            <IntegrationCard icon={<Wallet className="h-6 w-6" />} name="Phantom / Solflare" status="live" desc="Browser wallet connection via @solana/wallet-adapter for signing transactions." />
          </div>
        </div>

        {/* Infrastructure */}
        <div className="mb-12">
          <h2 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-6">Infrastructure</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <IntegrationCard icon={<Database className="h-6 w-6" />} name="PostgreSQL + pgvector" status="infra" desc="Session storage, event logging, task tracking. Auto-initialized via Docker." />
            <IntegrationCard icon={<Database className="h-6 w-6" />} name="Redis" status="infra" desc="Pub/sub for real-time SSE streaming. Channel per session for live event updates." />
          </div>
        </div>

        {/* Planned */}
        <div className="mb-12">
          <h2 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-6">Planned</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <IntegrationCard icon={<Globe className="h-6 w-6" />} name="Slack" status="planned" desc="Read channels, send messages, manage notifications via Slack API." />
            <IntegrationCard icon={<Globe className="h-6 w-6" />} name="Notion" status="planned" desc="Read and update pages, databases, and project boards." />
            <IntegrationCard icon={<Globe className="h-6 w-6" />} name="GitHub" status="planned" desc="Create issues, review PRs, manage repositories via GitHub API." />
          </div>
        </div>

        <div className="rounded-2xl bg-neutral-900 border border-white/5 p-8 sm:p-10">
          <h3 className="text-xl font-bold text-white mb-3">Want to build an integration?</h3>
          <p className="text-neutral-400 leading-relaxed mb-6 max-w-xl">
            Every integration runs as a worker service. Create an Express app, define tool endpoints, register costs in the payment config,
            and your integration earns fees every time it&apos;s used.
          </p>
          <Link href="/learn/architecture" className="inline-flex items-center gap-2 text-sm font-bold text-red-400 hover:text-red-300 transition-colors">
            Read the Architecture Guide <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="flex flex-wrap gap-3 pt-8 mt-12 border-t border-white/10">
          <NavPill href="/explore/agents" label="← Agents" />
          <NavPill href="/explore/workflows" label="Workflows →" />
          <NavPill href="/explore/treasury" label="Treasury →" />
        </div>
      </section>

      <PageFooter />
    </div>
  );
}

function IntegrationCard({ icon, name, status, desc }: { icon: React.ReactNode; name: string; status: 'live' | 'infra' | 'planned'; desc: string }) {
  const statusColors = {
    live: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    infra: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
    planned: 'text-neutral-400 bg-neutral-500/10 border-neutral-500/30',
  };
  const statusLabel = { live: 'Live', infra: 'Infrastructure', planned: 'Planned' };

  return (
    <div className={`rounded-xl border p-6 transition-colors ${status === 'live' ? 'border-white/5 bg-neutral-900/50 hover:border-emerald-500/20' : status === 'infra' ? 'border-white/5 bg-neutral-900/50 hover:border-blue-500/20' : 'border-white/5 bg-neutral-900/30 hover:border-white/10'}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="h-10 w-10 rounded-xl bg-neutral-800 flex items-center justify-center text-neutral-400">{icon}</div>
        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider border ${statusColors[status]}`}>{statusLabel[status]}</span>
      </div>
      <h3 className="text-base font-bold text-white mb-1">{name}</h3>
      <p className="text-xs text-neutral-400 leading-relaxed">{desc}</p>
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
          <Link href="/learn/documentation" className="hover:text-white transition-colors hidden sm:block">Learn</Link>
          <Link href="/explore/agents" className="text-white">Explore</Link>
          <Link href="/dashboard" className="hover:text-white transition-colors">Dashboard</Link>
        </div>
      </div>
    </nav>
  );
}

function PageFooter() {
  return (
    <footer className="border-t border-white/5 mt-auto">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
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

function NavPill({ href, label }: { href: any; label: string }) {
  return (
    <Link href={href} className="px-4 py-2 rounded-full border border-white/10 text-sm text-neutral-300 hover:text-white hover:border-red-500/30 transition-colors">
      {label}
    </Link>
  );
}
