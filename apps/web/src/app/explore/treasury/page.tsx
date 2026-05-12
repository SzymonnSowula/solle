'use client';

import Link from 'next/link';
import { ArrowLeft, Wallet, Shield, Zap, ArrowRight, CheckCircle2, History, Database } from 'lucide-react';
import { VolleLogo } from '@/components/VolleLogo';

export default function TreasuryPage() {
  return (
    <div className="min-h-screen flex flex-col bg-neutral-950 text-white">
      <Nav />

      <section className="relative px-4 sm:px-6 pt-28 sm:pt-32 pb-16 sm:pb-20 overflow-hidden border-b border-white/5">
        <div className="absolute top-[-10%] left-[10%] w-[40%] h-[100%] bg-gradient-to-br from-red-600/15 to-transparent blur-[140px] pointer-events-none rounded-full" />
        <div className="mx-auto max-w-5xl relative z-10">
          <Link href="/explore/agents" className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors mb-8">
            <ArrowLeft className="h-4 w-4" /> Explore
          </Link>
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-xl bg-red-500/10 flex items-center justify-center">
              <Wallet className="h-5 w-5 text-red-500" />
            </div>
            <span className="text-xs font-bold text-red-400 uppercase tracking-wider">Explore</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">Treasury & Payments</h1>
          <p className="mt-4 text-lg text-neutral-400 max-w-2xl leading-relaxed">
            The x402 payment protocol powering Volle. Pay for execution, not existence.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 sm:px-6 py-16 sm:py-20 space-y-16">

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="rounded-2xl border border-white/5 bg-neutral-900/50 p-8">
            <Shield className="h-8 w-8 text-red-500 mb-6" />
            <h3 className="text-xl font-bold text-white mb-3">On-Chain PDA</h3>
            <p className="text-sm text-neutral-400 leading-relaxed">
              Your funds are held in a Program Derived Address (PDA) on Solana. Only you can withdraw funds or authorize agent execution. Volle has no access to your private keys.
            </p>
          </div>
          <div className="rounded-2xl border border-white/5 bg-neutral-900/50 p-8">
            <Zap className="h-8 w-8 text-red-500 mb-6" />
            <h3 className="text-xl font-bold text-white mb-3">Micro-Settlement</h3>
            <p className="text-sm text-neutral-400 leading-relaxed">
              Every tool call costs a fraction of a cent. At the end of a session, the total cost is aggregated and settled in a single transaction, minimizing gas fees.
            </p>
          </div>
          <div className="rounded-2xl border border-white/5 bg-neutral-900/50 p-8">
            <History className="h-8 w-8 text-red-500 mb-6" />
            <h3 className="text-xl font-bold text-white mb-3">Verifiable Receipts</h3>
            <p className="text-sm text-neutral-400 leading-relaxed">
              When a session completes, an on-chain receipt is generated. It includes a cryptographic hash of the execution log, proving exactly what was done for the cost.
            </p>
          </div>
        </div>

        <div>
          <h2 className="text-2xl font-bold tracking-tight mb-8">How x402 Works</h2>
          <div className="rounded-2xl border border-white/5 bg-neutral-900/30 overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-2">
              <div className="p-8 sm:p-10 border-b md:border-b-0 md:border-r border-white/5">
                <h3 className="text-lg font-bold text-white mb-6">1. Deposit & Verification</h3>
                <ul className="space-y-4">
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-neutral-300">You deposit SOL into your Treasury PDA via the smart contract.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-neutral-300">When you request an agent, the server verifies your Treasury balance on-chain.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-neutral-300">If funds are sufficient, the execution pipeline begins.</span>
                  </li>
                </ul>
              </div>
              <div className="p-8 sm:p-10 bg-neutral-900/50">
                <h3 className="text-lg font-bold text-white mb-6">2. Execution & Settlement</h3>
                <ul className="space-y-4">
                  <li className="flex items-start gap-3">
                    <Database className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-neutral-300">The agent executes tools. Each tool logs a cost task in the PostgreSQL database.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Database className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-neutral-300">The session finishes. The server sums the tasks to calculate the final cost.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Database className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-neutral-300">The frontend calls the Anchor <code className="text-neutral-400 font-mono text-xs">record_session_cost</code> instruction to debit the Treasury.</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-red-500/20 bg-gradient-to-r from-red-600/5 to-transparent p-8 sm:p-10">
          <h3 className="text-xl font-bold text-white mb-3">View your Treasury</h3>
          <p className="text-neutral-400 leading-relaxed mb-6 max-w-xl">
            Head over to the Dashboard to initialize your Treasury, deposit SOL, and track your session history and receipts in real-time.
          </p>
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-bold text-red-400 hover:text-red-300 transition-colors">
            Go to Dashboard <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="flex flex-wrap gap-3 pt-8 border-t border-white/10">
          <NavPill href="/explore/agents" label="← Agents" />
          <NavPill href="/explore/integrations" label="Integrations →" />
          <NavPill href="/explore/workflows" label="Workflows →" />
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
