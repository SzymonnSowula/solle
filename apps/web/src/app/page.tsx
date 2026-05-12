'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletConnectButton } from '@/components/wallet/WalletConnectButton';
import { ArrowRight, Lock, Zap, Layers, Mail, Calendar, Globe, Mic, Shield } from 'lucide-react';
import { VolleLogo } from '@/components/VolleLogo';

export default function LandingPage() {
  const { connected } = useWallet();
  const router = useRouter();

  useEffect(() => {
    if (connected) {
      router.push('/dashboard');
    }
  }, [connected, router]);

  return (
    <div className="min-h-screen flex flex-col font-sans selection:bg-red-500/30">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-neutral-950/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <VolleLogo className="h-10 w-10 text-white" />
            
          </div>
          <div className="flex items-center gap-6 text-sm font-medium text-neutral-300">
            <a href="#why" className="hover:text-white transition-colors hidden md:block">Why Volle</a>
            <a href="#build" className="hover:text-white transition-colors hidden md:block">Build</a>
            <a href="/download" className="hover:text-white transition-colors hidden md:block">Desktop App</a>
            <WalletConnectButton />
          </div>
        </div>
      </nav>

      {/* Hero Section (Dark) — Full Viewport */}
      <section className="relative min-h-screen overflow-hidden bg-neutral-950 text-white flex flex-col justify-center">
        {/* Massive Red/Orange Glow Background */}
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
          <div className="absolute -right-[10%] sm:-right-[20%] -top-[10%] w-[100%] sm:w-[80%] h-[120%] bg-gradient-to-bl from-red-600/40 via-red-600/20 to-transparent blur-[100px] sm:blur-[140px] transform -rotate-12 rounded-full" />
          <div className="absolute -bottom-[20%] left-[0%] sm:left-[10%] w-[80%] sm:w-[60%] h-[60%] bg-gradient-to-tr from-red-600/30 via-red-500/20 to-transparent blur-[100px] sm:blur-[120px] rounded-full" />
          <div className="absolute right-[5%] sm:right-[10%] bottom-[5%] sm:bottom-[10%] w-[50%] sm:w-[40%] h-[40%] bg-red-500/20 blur-[100px] sm:blur-[120px] rounded-full" />
        </div>

        <div className="mx-auto max-w-7xl px-6 relative z-10 w-full pt-32 sm:pt-40 pb-24 sm:pb-32">
          <div className="max-w-3xl">
            <h1 className="text-4xl sm:text-7xl lg:text-8xl font-bold tracking-tight text-white leading-[1.05]">
              Automate your workflows <br className="hidden sm:block" />
              <span className="text-red-500">with Voice Agents</span>
            </h1>
            <p className="mt-6 sm:mt-8 text-lg sm:text-2xl text-neutral-300 max-w-2xl font-light leading-relaxed">
              Use and build apps that leverage Volle as a secure base layer for autonomous execution.
            </p>
            <div className="mt-10 sm:mt-12">
              <a href="#build" className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white font-bold text-sm tracking-wide uppercase transition-all shadow-[0_0_40px_rgba(220,38,38,0.4)]">
                Start Workflow <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>

        {/* Massive Watermark Text */}
        <div className="absolute bottom-0 sm:-bottom-4 right-0 sm:-right-4 lg:-right-8 z-0 pointer-events-none select-none opacity-90 overflow-hidden max-w-full">
          <span className="text-[5rem] sm:text-[14rem] lg:text-[20rem] font-black text-white tracking-tighter leading-none whitespace-nowrap">
            VOLLE
          </span>
        </div>
      </section>

      {/* Latest Pills (Light) */}
      <section className="bg-neutral-100 py-12 border-b border-neutral-200">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex flex-col items-center mb-8">
            <h2 className="text-xl font-bold text-neutral-900">Platform Capabilities</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <PillCard title="x402 Micropayments" date="On-Chain Settlement" icon={<Zap className="h-5 w-5 text-red-500" />} />
            <PillCard title="ElevenLabs Voice" date="Real-time ConvAI" icon={<Mic className="h-5 w-5 text-red-500" />} />
            <PillCard title="Verifiable Execution" date="Solana Receipts" icon={<Shield className="h-5 w-5 text-red-500" />} />
            <PillCard title="Multi-Agent Routing" date="LangGraph Core" icon={<Layers className="h-5 w-5 text-red-500" />} />
          </div>
        </div>
      </section>

      {/* Why Volle? (Dark Timeline) */}
      <section id="why" className="bg-neutral-950 py-24 sm:py-32 text-white relative overflow-hidden">
        {/* Subtle red/orange background glow */}
        <div className="absolute top-0 right-0 w-[600px] sm:w-[800px] h-[600px] sm:h-[800px] bg-gradient-to-bl from-red-600/10 to-red-500/5 blur-[100px] sm:blur-[150px] rounded-full pointer-events-none" />

        <div className="mx-auto max-w-7xl px-6 relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-12 sm:gap-16">
          <div>
            <h2 className="text-4xl sm:text-5xl font-bold tracking-tight">Why Volle?</h2>
            <p className="mt-6 text-lg text-neutral-400 leading-relaxed max-w-md">
              Volle is a voice-native process operator that fully unlocks the potential of autonomous agents. A decentralized way to move intents from voice to verifiable actions.
            </p>
            <div className="mt-8">
              <a href="#build" className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-red-500/50 text-red-400 hover:bg-red-500/10 font-bold text-sm tracking-wide uppercase transition-all">
                Learn More <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Timeline */}
          <div className="relative pl-8 border-l border-neutral-800 space-y-12 ml-4 sm:ml-0">
            {/* Timeline nodes */}
            <TimelineNode
              number="1"
              title="Speak"
              description="Tell Volle what you need using natural language. It understands context, asks clarifying questions, and ensures it has all the details before proceeding."
            />
            <TimelineNode
              number="2"
              title="Route"
              description="The Coordinator picks the right specialized agent for the job-whether it's web research, inbox management, or calendar scheduling."
            />
            <TimelineNode
              number="3"
              title="Execute"
              description="You review and approve before anything ships. Every session is recorded on Solana, giving you cryptographic proof of work."
              isLast
            />
          </div>
        </div>
      </section>

      {/* Build on Volle (Light Bento Grid) */}
      <section id="build" className="bg-neutral-50 py-16 sm:py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mb-10 sm:mb-16">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-neutral-900 max-w-2xl leading-tight">
              Run any process, the most secure base layer
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            {/* Large Card */}
            <div className="md:col-span-2 rounded-2xl sm:rounded-3xl bg-white p-6 sm:p-10 border border-neutral-200 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-40 sm:w-64 h-40 sm:h-64 bg-gradient-to-bl from-red-100 to-transparent opacity-50 rounded-bl-full pointer-events-none" />
              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl sm:rounded-2xl bg-red-500 text-white flex items-center justify-center mb-5 sm:mb-8 shadow-lg shadow-red-500/30">
                <Globe className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-neutral-900">Apply to Jobs</h3>
              <p className="mt-3 sm:mt-4 text-neutral-600 text-base sm:text-lg leading-relaxed max-w-md">
                Research openings, generate tailored CVs and cover letters, and send applications automatically.
              </p>
            </div>

            {/* Square Cards */}
            <div className="rounded-2xl sm:rounded-3xl bg-white p-6 sm:p-8 border border-neutral-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="h-10 w-10 rounded-xl bg-neutral-900 text-white flex items-center justify-center mb-4 sm:mb-6">
                <Mail className="h-5 w-5" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-neutral-900">Manage Inbox</h3>
              <p className="mt-2 sm:mt-3 text-neutral-600 leading-relaxed text-sm sm:text-base">
                Sort unread emails, draft replies in your tone, and send with your single approval.
              </p>
            </div>

            <div className="rounded-2xl sm:rounded-3xl bg-white p-6 sm:p-8 border border-neutral-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="h-10 w-10 rounded-xl bg-neutral-900 text-white flex items-center justify-center mb-4 sm:mb-6">
                <Calendar className="h-5 w-5" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-neutral-900">Plan Your Day</h3>
              <p className="mt-2 sm:mt-3 text-neutral-600 leading-relaxed text-sm sm:text-base">
                Gather tasks, build a schedule, add calendar events, and set reminders seamlessly.
              </p>
            </div>

            {/* Wide Red Card */}
            <div className="md:col-span-2 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-red-500 to-red-600 p-6 sm:p-10 text-white shadow-xl shadow-red-500/20">
              <h3 className="text-2xl sm:text-3xl font-bold mb-3 sm:mb-4">Programmable Workflows</h3>
              <p className="text-red-100 text-base sm:text-lg max-w-xl leading-relaxed mb-6 sm:mb-8">
                Welcome to Volle. An AI-backed asset that fully unlocks the capital of human attention. A decentralized way to move intents from voice to action.
              </p>
              <div className="flex gap-4">
                <a href="#build" className="px-5 sm:px-6 py-2 rounded-full bg-white text-red-600 font-bold text-sm uppercase tracking-wide hover:bg-neutral-100 transition-colors">
                  Explore
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Business Model */}
      <section className="bg-neutral-950 py-16 sm:py-24 lg:py-32 text-white relative overflow-hidden border-t border-neutral-900">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] sm:w-[600px] lg:w-[800px] h-[400px] sm:h-[600px] lg:h-[800px] bg-red-600/10 blur-[150px] rounded-full pointer-events-none" />
        
        <div className="mx-auto max-w-7xl px-4 sm:px-6 relative z-10">
          <div className="text-center mb-10 sm:mb-16">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white mb-4 sm:mb-6">Business Model</h2>
            <p className="text-base sm:text-xl text-neutral-400 max-w-2xl mx-auto">
              Pay for execution, not for existence. Volle uses x402 micropayments to charge fractions of a cent only when an agent actively performs work.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
            <div className="rounded-2xl sm:rounded-3xl border border-neutral-800 bg-neutral-900/50 p-6 sm:p-8 hover:border-red-500/30 transition-colors">
              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl sm:rounded-2xl bg-red-500/10 flex items-center justify-center mb-4 sm:mb-6">
                <Shield className="h-5 w-5 sm:h-6 sm:w-6 text-red-500" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-white mb-2 sm:mb-3">Premium Desktop</h3>
              <p className="text-neutral-400 leading-relaxed text-sm sm:text-base">
                While web execution is strictly pay-per-use, unlocking the full 24/7 background agent on macOS and Windows requires a flat monthly subscription.
              </p>
            </div>
            
            <div className="rounded-2xl sm:rounded-3xl border border-red-500/30 bg-gradient-to-b from-red-600/10 to-transparent p-6 sm:p-8 relative overflow-hidden shadow-[0_0_30px_rgba(220,38,38,0.05)] sm:col-span-2 md:col-span-1">
              <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/20 blur-3xl" />
              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl sm:rounded-2xl bg-red-500 flex items-center justify-center mb-4 sm:mb-6 relative z-10 shadow-lg shadow-red-500/20">
                <Zap className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-white mb-2 sm:mb-3 relative z-10">x402 Micropayments</h3>
              <p className="text-red-100/70 leading-relaxed relative z-10 text-sm sm:text-base">
                Every tool execution is priced dynamically. Costs are aggregated and settled on-chain in a single Solana transaction.
              </p>
            </div>

            <div className="rounded-2xl sm:rounded-3xl border border-neutral-800 bg-neutral-900/50 p-6 sm:p-8 hover:border-red-500/30 transition-colors">
              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl sm:rounded-2xl bg-red-500/10 flex items-center justify-center mb-4 sm:mb-6">
                <Layers className="h-5 w-5 sm:h-6 sm:w-6 text-red-500" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-white mb-2 sm:mb-3">Open Ecosystem</h3>
              <p className="text-neutral-400 leading-relaxed text-sm sm:text-base">
                Developers can build specialized agents and earn a percentage fee every time their logic is utilized by the network.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative bg-neutral-950 pt-24 pb-8 overflow-hidden border-t border-neutral-900 text-white">
        {/* Sweeping glow in the footer */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[120%] h-[300px] bg-gradient-to-t from-red-600/30 to-transparent blur-[100px] pointer-events-none" />
        <div className="absolute -bottom-[200px] -left-[100px] w-[600px] h-[400px] bg-orange-600/20 blur-[150px] pointer-events-none rounded-full" />
        
        <div className="mx-auto max-w-7xl px-4 sm:px-6 relative z-10">
          <div className="flex flex-col lg:flex-row justify-between gap-10 sm:gap-16 mb-16 sm:mb-24">
            {/* Left Section */}
            <div className="lg:w-1/3">
              <div className="flex items-center gap-3 mb-10">
                <VolleLogo className="h-8 w-8 text-white" />
                <span className="text-2xl font-black tracking-tight text-white">VOLLE</span>
              </div>
              
              <div className="mb-6 text-sm text-neutral-400 font-medium">
                Dive deeper into Volle:
              </div>
              <a href="#build" className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border border-red-500/30 bg-gradient-to-r from-red-600/80 to-orange-500/80 hover:from-red-500 hover:to-orange-400 text-white font-bold text-xs tracking-wide uppercase transition-all shadow-[0_0_20px_rgba(220,38,38,0.3)] backdrop-blur-md">
                Explore the Ecosystem <ArrowRight className="h-4 w-4" />
              </a>
            </div>

            {/* Right Section (Links Grid) */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-12 lg:gap-24 w-full lg:w-auto">
              <div>
                <h4 className="font-bold text-xs text-white uppercase tracking-wider mb-6">Explore</h4>
                <ul className="space-y-4 text-xs font-bold text-neutral-500 uppercase tracking-wide">
                  <li><a href="#" className="hover:text-white transition-colors">Agents</a></li>
                  <li><a href="#" className="hover:text-white transition-colors">Integrations</a></li>
                  <li><a href="#" className="hover:text-white transition-colors">Workflows</a></li>
                  <li><a href="#" className="hover:text-white transition-colors">Treasury</a></li>
                </ul>
              </div>
              <div>
                <h4 className="font-bold text-xs text-white uppercase tracking-wider mb-6">Learn</h4>
                <ul className="space-y-4 text-xs font-bold text-neutral-500 uppercase tracking-wide">
                  <li><a href="#" className="hover:text-white transition-colors">Documentation</a></li>
                  <li><a href="#" className="hover:text-white transition-colors">Architecture</a></li>
                  <li><a href="#" className="hover:text-white transition-colors">Solana Setup</a></li>
                  <li><a href="#" className="hover:text-white transition-colors">Voice Commands</a></li>
                </ul>
              </div>
              <div>
                <h4 className="font-bold text-xs text-white uppercase tracking-wider mb-6">More</h4>
                <ul className="space-y-4 text-xs font-bold text-neutral-500 uppercase tracking-wide">
                  <li><a href="#" className="hover:text-white transition-colors">GitHub</a></li>
                  <li><a href="#" className="hover:text-white transition-colors">Twitter</a></li>
                  <li><a href="#" className="hover:text-white transition-colors">Colosseum</a></li>
                  <li><a href="#" className="hover:text-white transition-colors">Privacy Policy</a></li>
                </ul>
              </div>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 pt-8 border-t border-neutral-800 text-[10px] font-bold text-neutral-600 uppercase tracking-wider">
            <div>Suggestions or edits for Volle?</div>
            <div className="flex gap-6">
              <a href="#" className="hover:text-neutral-400 transition-colors">Terms and Conditions</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function PillCard({ title, date, icon }: { title: string; date: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 sm:gap-4 px-4 sm:px-6 py-3 sm:py-4 rounded-2xl sm:rounded-full bg-white border border-neutral-200 shadow-sm hover:shadow-md transition-shadow cursor-default">
      <div className="flex-shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <h4 className="text-sm font-bold text-neutral-900 truncate">{title}</h4>
        <p className="text-xs text-neutral-500 truncate">{date}</p>
      </div>
    </div>
  );
}

function TimelineNode({ number, title, description, isLast }: { number: string; title: string; description: string; isLast?: boolean }) {
  return (
    <div className="relative">
      <div className="absolute -left-[49px] top-1 h-8 w-8 rounded-full bg-red-600/20 border border-red-500 flex items-center justify-center text-red-400 font-bold text-sm shadow-[0_0_15px_rgba(220,38,38,0.5)]">
        {number}
      </div>
      <h3 className="text-xl font-bold text-white">{title}</h3>
      <p className="mt-3 text-neutral-400 leading-relaxed max-w-md">
        {description}
      </p>
      {!isLast && (
        <div className="absolute -left-[33px] top-10 bottom-[-48px] w-px bg-gradient-to-b from-red-500 to-red-500/20 shadow-[0_0_10px_rgba(220,38,38,0.5)]" />
      )}
    </div>
  );
}
