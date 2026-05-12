'use client';

import Link from 'next/link';
import { ArrowLeft, ArrowRight, Cpu, Search, Mail, Calendar, FileText, Monitor, MessageSquare, Sparkles } from 'lucide-react';
import { VolleLogo } from '@/components/VolleLogo';

export default function AgentsPage() {
  return (
    <div className="min-h-screen flex flex-col bg-neutral-950 text-white">
      <Nav />

      <section className="relative px-4 sm:px-6 pt-28 sm:pt-32 pb-16 sm:pb-20 overflow-hidden border-b border-white/5">
        <div className="absolute top-[-10%] right-[-5%] w-[50%] h-[100%] bg-gradient-to-bl from-red-600/20 to-transparent blur-[140px] pointer-events-none rounded-full" />
        <div className="mx-auto max-w-5xl relative z-10">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors mb-8">
            <ArrowLeft className="h-4 w-4" /> Home
          </Link>
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-xl bg-red-500/10 flex items-center justify-center">
              <Cpu className="h-5 w-5 text-red-500" />
            </div>
            <span className="text-xs font-bold text-red-400 uppercase tracking-wider">Explore</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">Agents</h1>
          <p className="mt-4 text-lg text-neutral-400 max-w-2xl leading-relaxed">
            Volle&apos;s multi-agent system routes your requests to specialized AI agents, each designed for a specific domain.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 sm:px-6 py-16 sm:py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <AgentCard
            icon={<MessageSquare className="h-6 w-6" />}
            name="Conversation Loop"
            intent="Pre-routing"
            desc="The first agent in the pipeline. Analyzes if your request is clear or needs clarification. Asks 1-2 focused questions before routing to a specialized agent. Supports multi-turn refinement."
            color="neutral"
          />
          <AgentCard
            icon={<Cpu className="h-6 w-6" />}
            name="Coordinator"
            intent="Classification"
            desc="Uses OpenAI + keyword fallback to classify your intent into RESEARCH, INBOX, PLANNING, APPLICATION, DESKTOP, or GENERAL. Routes to the matching specialized agent."
            color="neutral"
          />
          <AgentCard
            icon={<Search className="h-6 w-6" />}
            name="Research Agent"
            intent="RESEARCH"
            desc="Searches the web using the Playwright browser worker. Navigates Google, scrapes results, and returns structured data. Falls back to mock results if blocked."
            color="red"
          />
          <AgentCard
            icon={<Mail className="h-6 w-6" />}
            name="Inbox Agent"
            intent="INBOX"
            desc="Manages your Gmail inbox. Lists unread emails, reads message content, and drafts replies in your writing tone — all via the Google worker service."
            color="red"
          />
          <AgentCard
            icon={<Calendar className="h-6 w-6" />}
            name="Planning Agent"
            intent="PLANNING"
            desc="Interacts with your Google Calendar. Lists upcoming events, finds free slots, and creates new events with proper scheduling and notifications."
            color="red"
          />
          <AgentCard
            icon={<FileText className="h-6 w-6" />}
            name="Application Agent"
            intent="APPLICATION"
            desc="Generates tailored CV summaries and cover letters via OpenAI. Optimized for job applications with role-specific language and formatting."
            color="red"
          />
          <AgentCard
            icon={<Monitor className="h-6 w-6" />}
            name="Desktop Agent"
            intent="DESKTOP"
            desc="Generates file organization plans for your Desktop, Documents, Downloads, and Pictures folders. Returns wildcard-based FileOperationPlan actions."
            color="red"
          />
          <AgentCard
            icon={<Sparkles className="h-6 w-6" />}
            name="Summary Agent"
            intent="Post-execution"
            desc="The final agent in every pipeline. Generates a natural-language closing summary incorporating results from all specialized agents executed during the session."
            color="neutral"
          />
        </div>

        <div className="mt-12 rounded-2xl bg-gradient-to-br from-red-500 to-red-600 p-8 sm:p-10 text-white shadow-xl shadow-red-500/20">
          <h3 className="text-2xl font-bold mb-3">Build Your Own Agent</h3>
          <p className="text-red-100 text-base leading-relaxed mb-6 max-w-xl">
            Volle&apos;s architecture is designed to be extensible. Add a new agent by implementing the standard interface,
            registering it with the coordinator, and defining tool costs for x402 settlement.
          </p>
          <Link href="/learn/architecture" className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-white text-red-600 font-bold text-sm uppercase tracking-wide hover:bg-neutral-100 transition-colors">
            View Architecture <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="flex flex-wrap gap-3 pt-8 mt-12 border-t border-white/10">
          <NavPill href="/explore/integrations" label="Integrations →" />
          <NavPill href="/explore/workflows" label="Workflows →" />
          <NavPill href="/explore/treasury" label="Treasury →" />
        </div>
      </section>

      <PageFooter />
    </div>
  );
}

function AgentCard({ icon, name, intent, desc, color }: { icon: React.ReactNode; name: string; intent: string; desc: string; color: 'red' | 'neutral' }) {
  return (
    <div className={`rounded-2xl border p-6 sm:p-8 transition-colors ${color === 'red' ? 'border-red-500/20 bg-gradient-to-b from-red-600/5 to-transparent hover:border-red-500/40' : 'border-white/5 bg-neutral-900/50 hover:border-white/10'}`}>
      <div className="flex items-center justify-between mb-4">
        <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${color === 'red' ? 'bg-red-500/10 text-red-500' : 'bg-neutral-800 text-neutral-400'}`}>
          {icon}
        </div>
        <span className="text-[10px] font-bold text-red-400 bg-red-500/10 px-2.5 py-1 rounded-full uppercase tracking-wider">{intent}</span>
      </div>
      <h3 className="text-lg font-bold text-white mb-2">{name}</h3>
      <p className="text-sm text-neutral-400 leading-relaxed">{desc}</p>
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
