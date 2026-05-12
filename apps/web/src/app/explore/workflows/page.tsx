'use client';

import Link from 'next/link';
import { ArrowLeft, ArrowRight, Workflow, Search, Mail, Calendar, FileText, Monitor, Zap } from 'lucide-react';
import { VolleLogo } from '@/components/VolleLogo';

export default function WorkflowsPage() {
  return (
    <div className="min-h-screen flex flex-col bg-neutral-950 text-white">
      <Nav />

      <section className="relative px-4 sm:px-6 pt-28 sm:pt-32 pb-16 sm:pb-20 overflow-hidden border-b border-white/5">
        <div className="absolute top-[-10%] right-[10%] w-[40%] h-[100%] bg-gradient-to-bl from-red-600/15 to-transparent blur-[140px] pointer-events-none rounded-full" />
        <div className="mx-auto max-w-5xl relative z-10">
          <Link href="/explore/agents" className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors mb-8">
            <ArrowLeft className="h-4 w-4" /> Explore
          </Link>
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-xl bg-red-500/10 flex items-center justify-center">
              <Workflow className="h-5 w-5 text-red-500" />
            </div>
            <span className="text-xs font-bold text-red-400 uppercase tracking-wider">Explore</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">Workflows</h1>
          <p className="mt-4 text-lg text-neutral-400 max-w-2xl leading-relaxed">
            Pre-built automation flows that combine multiple agents into a single voice command.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 sm:px-6 py-16 sm:py-20 space-y-8">

        <WorkflowCard
          icon={<Search className="h-6 w-6" />}
          title="Job Application Pipeline"
          trigger={'"Help me apply to frontend developer roles in Berlin"'}
          steps={[
            { agent: 'Research', action: 'Search for matching job listings across the web' },
            { agent: 'Application', action: 'Generate tailored CV summary and cover letter for top results' },
            { agent: 'Inbox', action: 'Draft application emails with attachments' },
            { agent: 'Summary', action: 'Report on all applications sent with links and status' },
          ]}
          cost="~0.003 SOL"
        />

        <WorkflowCard
          icon={<Mail className="h-6 w-6" />}
          title="Morning Inbox Review"
          trigger={'"Handle my inbox this morning"'}
          steps={[
            { agent: 'Inbox', action: 'List all unread emails from the last 12 hours' },
            { agent: 'Coordinator', action: 'Classify each email by priority and type' },
            { agent: 'Inbox', action: 'Draft replies for high-priority messages' },
            { agent: 'Summary', action: 'Deliver a spoken summary of your inbox state' },
          ]}
          cost="~0.002 SOL"
        />

        <WorkflowCard
          icon={<Calendar className="h-6 w-6" />}
          title="Weekly Planning"
          trigger={'"Plan my week based on my calendar and inbox"'}
          steps={[
            { agent: 'Planning', action: 'Fetch all calendar events for the upcoming 7 days' },
            { agent: 'Inbox', action: 'Extract action items and deadlines from recent emails' },
            { agent: 'Planning', action: 'Create time blocks for identified tasks' },
            { agent: 'Summary', action: 'Present the weekly plan with priorities' },
          ]}
          cost="~0.003 SOL"
        />

        <WorkflowCard
          icon={<FileText className="h-6 w-6" />}
          title="Research & Report"
          trigger={'"Research the latest trends in AI agents and summarize"'}
          steps={[
            { agent: 'Research', action: 'Multi-query web search with result aggregation' },
            { agent: 'Research', action: 'Deep-dive into top 3 most relevant sources' },
            { agent: 'Summary', action: 'Generate a structured report with key findings' },
          ]}
          cost="~0.002 SOL"
        />

        <WorkflowCard
          icon={<Monitor className="h-6 w-6" />}
          title="Desktop Cleanup"
          trigger={'"Organize my desktop and downloads folder"'}
          steps={[
            { agent: 'Desktop', action: 'Scan Desktop and Downloads for file types' },
            { agent: 'Desktop', action: 'Generate FileOperationPlan with categorization rules' },
            { agent: 'Desktop', action: 'Present plan for user approval before execution' },
            { agent: 'Summary', action: 'Report on files moved and new folder structure' },
          ]}
          cost="~0.001 SOL"
        />

        {/* CTA */}
        <div className="rounded-2xl border border-red-500/20 bg-gradient-to-r from-red-600/5 to-transparent p-8 sm:p-10 mt-12">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-xl bg-red-500/10 flex items-center justify-center flex-shrink-0">
              <Zap className="h-6 w-6 text-red-500" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white mb-2">Every workflow settles on-chain</h3>
              <p className="text-neutral-400 leading-relaxed max-w-xl">
                Each tool call in a workflow accumulates cost. At the end, the total is debited from your treasury PDA
                in a single Solana transaction, and an on-chain receipt is created for verifiable proof of execution.
              </p>
              <Link href="/explore/treasury" className="inline-flex items-center gap-2 text-sm font-bold text-red-400 hover:text-red-300 transition-colors mt-4">
                Learn about Treasury <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 pt-8 border-t border-white/10">
          <NavPill href="/explore/agents" label="← Agents" />
          <NavPill href="/explore/integrations" label="Integrations →" />
          <NavPill href="/explore/treasury" label="Treasury →" />
        </div>
      </section>

      <PageFooter />
    </div>
  );
}

function WorkflowCard({ icon, title, trigger, steps, cost }: { icon: React.ReactNode; title: string; trigger: string; steps: { agent: string; action: string }[]; cost: string }) {
  return (
    <div className="rounded-2xl border border-white/5 bg-neutral-900/50 p-6 sm:p-8 hover:border-white/10 transition-colors">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-neutral-800 flex items-center justify-center text-neutral-400">{icon}</div>
          <h3 className="text-lg font-bold text-white">{title}</h3>
        </div>
        <span className="text-xs font-mono text-red-400 bg-red-500/10 px-3 py-1 rounded-full">{cost}</span>
      </div>

      <div className="rounded-lg bg-neutral-950 border border-white/5 px-4 py-3 mb-6">
        <p className="text-sm text-neutral-300 italic">{trigger}</p>
      </div>

      <div className="space-y-3">
        {steps.map((step, i) => (
          <div key={i} className="flex items-start gap-3">
            <div className="flex-shrink-0 h-6 w-6 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-[10px] font-bold text-red-400 mt-0.5">{i + 1}</div>
            <div>
              <span className="text-xs font-bold text-red-400 uppercase tracking-wider">{step.agent}</span>
              <p className="text-sm text-neutral-300">{step.action}</p>
            </div>
          </div>
        ))}
      </div>
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
