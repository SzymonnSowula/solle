'use client';

import Link from 'next/link';
import { ArrowLeft, Mic, MessageSquare, Search, Mail, Calendar, FileText, Monitor, HelpCircle } from 'lucide-react';
import { VolleLogo } from '@/components/VolleLogo';

export default function VoiceCommandsPage() {
  return (
    <div className="min-h-screen flex flex-col bg-neutral-950 text-white">
      <Nav />

      <section className="relative px-4 sm:px-6 pt-28 sm:pt-32 pb-16 sm:pb-20 overflow-hidden border-b border-white/5">
        <div className="absolute top-[-20%] left-[20%] w-[40%] h-[100%] bg-gradient-to-br from-red-600/15 to-transparent blur-[140px] pointer-events-none rounded-full" />
        <div className="mx-auto max-w-4xl relative z-10">
          <Link href="/learn/documentation" className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors mb-8">
            <ArrowLeft className="h-4 w-4" /> Documentation
          </Link>
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-xl bg-red-500/10 flex items-center justify-center">
              <Mic className="h-5 w-5 text-red-500" />
            </div>
            <span className="text-xs font-bold text-red-400 uppercase tracking-wider">Learn</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">Voice Commands</h1>
          <p className="mt-4 text-lg text-neutral-400 max-w-2xl leading-relaxed">
            Natural language examples for every Volle agent. Speak or type — both work the same way.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 sm:px-6 py-16 sm:py-20 space-y-16">

        {/* How it works */}
        <div>
          <SectionTitle icon={<MessageSquare className="h-5 w-5 text-red-500" />} title="How Voice Works" />
          <div className="sm:pl-[52px] text-neutral-300 leading-relaxed space-y-4">
            <p>
              Volle uses <strong className="text-white">ElevenLabs Conversational AI</strong> for real-time voice interaction.
              Click the voice orb in the dashboard to start. Volle will listen, process your request,
              and respond with a natural voice while executing your intent.
            </p>
            <p>
              If your request is ambiguous, Volle will ask 1-2 clarifying questions before proceeding.
              You can always type instead of speaking — the routing is identical.
            </p>
          </div>
        </div>

        {/* Research */}
        <CommandCategory
          icon={<Search className="h-5 w-5 text-red-500" />}
          title="Research Commands"
          intent="RESEARCH"
          commands={[
            { phrase: '"Find AI internships in Poland for summer 2026"', desc: 'Searches the web for matching opportunities, returns structured results.' },
            { phrase: '"Research the latest Solana DeFi protocols"', desc: 'Browser worker navigates Google, scrapes results, returns summaries.' },
            { phrase: '"Look up remote React developer jobs in Europe"', desc: 'Multi-query search with result aggregation.' },
            { phrase: '"What are the top 5 YC-backed AI startups this batch?"', desc: 'Research agent with summary generation.' },
          ]}
        />

        {/* Inbox */}
        <CommandCategory
          icon={<Mail className="h-5 w-5 text-red-500" />}
          title="Inbox Commands"
          intent="INBOX"
          commands={[
            { phrase: '"Check my inbox for unread emails"', desc: 'Lists recent unread emails from your connected Gmail account.' },
            { phrase: '"Draft a reply to the email from John about the meeting"', desc: 'AI drafts a response in your tone, waits for approval.' },
            { phrase: '"Show me emails from this week"', desc: 'Filters by date range, returns subject/sender/preview.' },
            { phrase: '"Reply to the latest email from HR saying I accept"', desc: 'Drafts and stages a reply for your confirmation.' },
          ]}
        />

        {/* Planning */}
        <CommandCategory
          icon={<Calendar className="h-5 w-5 text-red-500" />}
          title="Planning Commands"
          intent="PLANNING"
          commands={[
            { phrase: '"What do I have scheduled for tomorrow?"', desc: 'Lists all Google Calendar events for the specified day.' },
            { phrase: '"Schedule a meeting with the team at 3 PM on Friday"', desc: 'Creates a calendar event with title, time, and default duration.' },
            { phrase: '"Block 2 hours for deep work every morning this week"', desc: 'Creates recurring time blocks on your calendar.' },
            { phrase: '"Show me my free slots on Wednesday"', desc: 'Analyzes calendar and returns available windows.' },
          ]}
        />

        {/* Application */}
        <CommandCategory
          icon={<FileText className="h-5 w-5 text-red-500" />}
          title="Application Commands"
          intent="APPLICATION"
          commands={[
            { phrase: '"Write a cover letter for a Frontend Developer role at Stripe"', desc: 'Generates a tailored cover letter based on the role and your profile.' },
            { phrase: '"Create a CV summary highlighting my React and Solana experience"', desc: 'AI-generated professional summary optimized for the target role.' },
            { phrase: '"Help me apply to this job posting"', desc: 'Combined research + application generation flow.' },
          ]}
        />

        {/* Desktop */}
        <CommandCategory
          icon={<Monitor className="h-5 w-5 text-red-500" />}
          title="Desktop Commands"
          intent="DESKTOP"
          commands={[
            { phrase: '"Organize my desktop"', desc: 'Scans files on Desktop and generates a FileOperationPlan (move *.png → Screenshots, etc.).' },
            { phrase: '"Sort my Downloads folder by type"', desc: 'Groups files by extension into categorized subdirectories.' },
            { phrase: '"Clean up old screenshots from my Pictures folder"', desc: 'Identifies and proposes moving/organizing image files.' },
          ]}
        />

        {/* Tips */}
        <div>
          <SectionTitle icon={<HelpCircle className="h-5 w-5 text-red-500" />} title="Tips" />
          <div className="sm:pl-[52px] space-y-3">
            <Tip text="Be specific about dates, names, and quantities — Volle works best with clear context." />
            <Tip text="If Volle asks a clarifying question, answer naturally. The conversation loop supports multi-turn refinement." />
            <Tip text="You can combine intents: 'Check my inbox and then schedule a reply meeting' triggers multiple agents." />
            <Tip text="Every session is recorded on-chain. You can view receipts and costs in the dashboard." />
            <Tip text="Desktop commands only work in the Electron app, not the browser beta." />
          </div>
        </div>

        <div className="flex flex-wrap gap-3 pt-8 border-t border-white/10">
          <NavPill href="/learn/solana-setup" label="← Solana Setup" />
          <NavPill href="/learn/architecture" label="Architecture →" />
          <NavPill href="/learn/documentation" label="Documentation →" />
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

function CommandCategory({ icon, title, intent, commands }: { icon: React.ReactNode; title: string; intent: string; commands: { phrase: string; desc: string }[] }) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 rounded-xl bg-neutral-900 border border-white/5 flex items-center justify-center">{icon}</div>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
          <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider">{intent}</span>
        </div>
      </div>
      <div className="sm:pl-[52px] space-y-3">
        {commands.map((cmd, i) => (
          <div key={i} className="rounded-xl bg-neutral-900 border border-white/5 p-5 hover:border-red-500/20 transition-colors">
            <p className="text-sm font-medium text-white italic mb-1">{cmd.phrase}</p>
            <p className="text-xs text-neutral-400">{cmd.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function Tip({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-neutral-900/50 border border-white/5 px-4 py-3">
      <span className="text-red-400 text-sm mt-0.5">💡</span>
      <p className="text-sm text-neutral-300">{text}</p>
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
