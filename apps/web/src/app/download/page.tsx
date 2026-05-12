'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Zap,
  ArrowLeft,
  Monitor,
  Globe,
  Mic,
  Cpu,
  Shield,
  Clock,
  Sparkles,
  Mail,
  CheckCircle2,
  Radio,
  Layers,
  Download,
} from 'lucide-react';
import Link from 'next/link';
import { VolleLogo } from '@/components/VolleLogo';

export default function DownloadPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleNotify = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.includes('@')) {
      setSubmitted(true);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-neutral-950">
      {/* Nav */}
      <nav className="w-full border-b border-white/5">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <Link href="/" className="flex items-center gap-3">
              <VolleLogo className="h-8 w-8 text-white" />
              <span className="text-xl font-bold tracking-tight text-white">VOLLE</span>
            </Link>
          </div>
          <Link
            href="/dashboard"
            className="text-sm font-medium text-neutral-400 hover:text-white transition-colors"
          >
            Launch Beta
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative px-6 pt-32 pb-24 overflow-hidden border-b border-white/5 flex flex-col items-center text-center">
        {/* Background glow */}
        <div className="absolute top-[-20%] right-[-10%] w-[60%] h-[120%] bg-gradient-to-bl from-red-600/30 to-transparent blur-[140px] pointer-events-none rounded-full" />
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[80%] bg-red-500/10 blur-[120px] pointer-events-none rounded-full" />
        
        <div className="mx-auto max-w-4xl relative z-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-red-500/10 border border-red-500/30 px-3 py-1.5 mb-8">
            <Radio className="h-3 w-3 text-red-500" />
            <span className="text-xs font-semibold text-red-400 uppercase tracking-wider">
              Coming soon
            </span>
          </div>
          <h1 className="text-6xl font-bold tracking-tight text-white sm:text-7xl lg:text-8xl leading-[1.05]">
              The future of Volle
              <br />
              <span className="text-red-500">lives on desktop</span>
          </h1>
          <p className="mt-8 mx-auto text-xl text-neutral-300 max-w-2xl leading-relaxed font-light">
            What you see today is a browser beta - a showcase of what is possible.
            The real Volle is a native desktop agent that runs quietly in the background,
            handles your workflows automatically, and only talks to you when it matters.
          </p>
        </div>
      </section>

      {/* Comparison */}
      <section className="mx-auto max-w-6xl px-6 py-20 border-t border-white/5">
        <div className="mb-12">
          <h2 className="text-2xl font-semibold tracking-tight text-white">Where we are vs. where we are going</h2>
          <p className="mt-2 text-neutral-400">The web beta proves the concept. The desktop app delivers the vision.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Current */}
          <div className="rounded-2xl border border-white/10 bg-neutral-900/50 p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-800 text-neutral-400">
                <Globe className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Web Beta</h3>
                <p className="text-xs text-neutral-400">Available now</p>
              </div>
            </div>
            <ul className="space-y-4">
              <FeatureItem icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />} text="Voice-native session operator" />
              <FeatureItem icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />} text="Research, inbox & planning agents" />
              <FeatureItem icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />} text="On-chain receipts & treasury" />
              <FeatureItem icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />} text="x402 micropayments per tool" />
              <FeatureItem icon={<Clock className="h-4 w-4 text-amber-500" />} text="Browser-only (you must keep the tab open)" dim />
              <FeatureItem icon={<Clock className="h-4 w-4 text-amber-500" />} text="Manual session lifecycle" dim />
              <FeatureItem icon={<Clock className="h-4 w-4 text-amber-500" />} text="Requires active interaction" dim />
            </ul>
          </div>

          {/* Future */}
          <div className="rounded-3xl border border-red-500/30 bg-gradient-to-br from-red-600 to-red-500 p-10 text-white shadow-xl shadow-red-500/20 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-400/30 blur-3xl rounded-full" />
            
            <div className="flex items-center gap-4 mb-8 relative z-10">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-white shadow-inner">
                <Monitor className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Desktop Agent</h3>
                <p className="text-xs text-neutral-400">Coming 2026</p>
              </div>
            </div>
            <ul className="space-y-4">
              <FeatureItem icon={<Sparkles className="h-4 w-4 text-red-400" />} text="Everything in the beta, plus:" white />
              <FeatureItem icon={<Cpu className="h-4 w-4 text-red-400" />} text="Runs in the background 24/7" white />
              <FeatureItem icon={<Mic className="h-4 w-4 text-red-400" />} text="Ambient voice mode - wake up anytime" white />
              <FeatureItem icon={<Layers className="h-4 w-4 text-red-400" />} text="Cross-app automation (files, apps, browser)" white />
              <FeatureItem icon={<Shield className="h-4 w-4 text-red-400" />} text="Local-first privacy - your data never leaves" white />
              <FeatureItem icon={<Clock className="h-4 w-4 text-red-400" />} text="Scheduled & recurring workflows" white />
              <FeatureItem icon={<Zap className="h-4 w-4 text-red-400" />} text="Proactive suggestions before you ask" white />
            </ul>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-6 py-20 border-t border-white/5">
        <div className="mb-12">
          <h2 className="text-2xl font-semibold tracking-tight text-white">How the desktop agent works</h2>
          <p className="mt-2 text-neutral-400">Invisible until you need it. Powerful when you do.</p>
        </div>
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
          <StepCard
            number={1}
            title="Install"
            description="One-click installer. Volle lives in your menu bar, using less memory than a browser tab."
            icon={<Download className="h-5 w-5" />}
          />
          <StepCard
            number={2}
            title="Authorize"
            description="Connect your wallet, Google, and any other tools once. Volle remembers everything securely."
            icon={<Shield className="h-5 w-5" />}
          />
          <StepCard
            number={3}
            title="Forget about it"
            description="Say 'handle my inbox every morning at 9' and Volle just does it. You only hear a summary."
            icon={<Mic className="h-5 w-5" />}
          />
        </div>
      </section>

      {/* Pricing */}
      <section className="mx-auto max-w-6xl px-6 py-20 border-t border-white/5">
        <div className="flex flex-col items-center justify-center text-center">
          <div className="mb-12">
            <h2 className="text-3xl font-semibold tracking-tight text-white">Simple, transparent pricing</h2>
            <p className="mt-2 text-neutral-400">One flat fee for unlimited background power.</p>
          </div>
          
          <div className="rounded-3xl border border-red-500/30 bg-gradient-to-b from-red-600/10 to-neutral-950 p-10 relative overflow-hidden shadow-[0_0_30px_rgba(220,38,38,0.05)] max-w-sm w-full text-center hover:border-red-500/50 transition-colors">
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/20 blur-3xl" />
            <h3 className="text-xl font-bold text-white mb-2 relative z-10">Premium Desktop</h3>
            <div className="flex justify-center items-end gap-1 mb-6 relative z-10">
              <span className="text-6xl font-black text-white">$20</span>
              <span className="text-neutral-400 font-medium pb-2">/mo</span>
            </div>
            
            <div className="h-px w-full bg-white/10 mb-6 relative z-10" />
            
            <ul className="space-y-4 text-sm text-neutral-300 text-left mb-8 relative z-10">
              <li className="flex items-center gap-3"><CheckCircle2 className="h-4 w-4 text-red-500" /> Full macOS & Windows App</li>
              <li className="flex items-center gap-3"><CheckCircle2 className="h-4 w-4 text-red-500" /> 24/7 Background Execution</li>
              <li className="flex items-center gap-3"><CheckCircle2 className="h-4 w-4 text-red-500" /> Ambient Voice Commands</li>
              <li className="flex items-center gap-3"><CheckCircle2 className="h-4 w-4 text-red-500" /> Local Context & Filesystem</li>
            </ul>
            <a href="#waitlist" className="block w-full rounded-xl bg-red-500 py-3 text-sm font-bold text-white hover:bg-red-400 transition-colors relative z-10 shadow-lg shadow-red-500/20">
              Reserve your spot
            </a>
          </div>
        </div>
      </section>

      {/* Waitlist */}
      <section id="waitlist" className="mx-auto max-w-6xl px-6 py-20 border-t border-white/5">
        <div className="rounded-2xl bg-neutral-900 border border-white/5 p-12 text-center max-w-2xl mx-auto">
          <h2 className="text-3xl font-semibold tracking-tight text-white">
            Be the first to get the desktop agent
          </h2>
          <p className="mt-3 text-neutral-400 max-w-md mx-auto">
            We are building this right now. Leave your email and we will let you know
            the moment the native app is ready.
          </p>

          {!submitted ? (
            <form onSubmit={handleNotify} className="mt-8 flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
              <div className="relative flex-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full rounded-xl border border-white/10 bg-neutral-950 pl-10 pr-4 py-3 text-sm text-white outline-none focus:border-black transition-colors"
                />
              </div>
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-500/100 text-white px-6 py-3 text-sm font-semibold text-white hover:bg-red-400 transition-colors"
              >
                <Zap className="h-3.5 w-3.5" />
                Notify me
              </button>
            </form>
          ) : (
            <div className="mt-8 inline-flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-6 py-4">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              <span className="text-sm font-medium text-emerald-400">
                You are on the list. We will reach out soon.
              </span>
            </div>
          )}

          <div className="mt-6 flex items-center justify-center gap-6 text-xs text-neutral-400">
            <span className="flex items-center gap-1.5">
              <Monitor className="h-3 w-3" /> macOS & Windows
            </span>
            <span className="flex items-center gap-1.5">
              <Shield className="h-3 w-3" /> Local-first
            </span>
            <span className="flex items-center gap-1.5">
              <Zap className="h-3 w-3" /> Early 2026
            </span>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 mt-auto">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-red-500">
              <Zap className="h- w- text-neutral-950" />
            </div>
            <span className="text-sm font-medium text-white">Volle</span>
          </div>
          <div className="flex items-center gap-6 text-xs text-neutral-400">
            <Link href="/" className="hover:text-white transition-colors">Home</Link>
            <Link href="/dashboard" className="hover:text-white transition-colors">Beta</Link>
            <span>Powered by Solana. Colosseum 2026.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureItem({
  icon,
  text,
  dim,
  white,
}: {
  icon: React.ReactNode;
  text: string;
  dim?: boolean;
  white?: boolean;
}) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span
        className={`text-sm leading-relaxed ${white
            ? 'text-neutral-200'
            : dim
              ? 'text-neutral-400'
              : 'text-neutral-200'
          }`}
      >
        {text}
      </span>
    </li>
  );
}

function StepCard({
  number,
  title,
  description,
  icon,
}: {
  number: number;
  title: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="relative rounded-2xl border border-white/5 bg-neutral-950 p-8 transition-all hover:border-white/10 hover:shadow-sm">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-800 text-white mb-5">
        {icon}
      </div>
      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500/100 text-white text-[10px] font-bold absolute top-6 right-6">
        {number}
      </div>
      <h3 className="text-base font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm text-neutral-400 leading-relaxed">{description}</p>
    </div>
  );
}
