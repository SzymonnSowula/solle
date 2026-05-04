'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { SessionInput } from '@/components/session/SessionInput';
import { WalletConnectButton } from '@/components/wallet/WalletConnectButton';
import { VoiceConversationPanel } from '@/components/session/VoiceConversationPanel';
import { OnboardingModal } from '@/components/OnboardingModal';
import { SimulationPanel } from '@/components/SimulationPanel';
import { AgentTreasuryCard } from '@/components/AgentTreasuryCard';
import { getSolliProgram, createOnchainSession } from '@/lib/solana/anchor-client';
import { Loader2, Search, Calendar, Mail, Globe, Zap, Shield, Clock, ArrowRight, Play } from 'lucide-react';

interface RecentSession {
  id: string;
  input: string | null;
  status: string;
  intent: string | null;
  createdAt: string;
}

const SUGGESTIONS = [
  "Find me 3 AI internship opportunities in Poland",
  "Schedule a meeting with my team for next Tuesday",
  "Summarize my unread emails from this week",
  "Research the best coworking spaces in Warsaw",
  "Set a reminder to call the dentist tomorrow",
];

export default function HomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState<RecentSession[]>([]);
  const [showVoice, setShowVoice] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [simulationQuery, setSimulationQuery] = useState<string | null>(null);

  useEffect(() => {
    const seen = localStorage.getItem('solli-onboarding-seen');
    if (!seen) {
      setShowOnboarding(true);
    }
  }, []);

  const closeOnboarding = () => {
    localStorage.setItem('solli-onboarding-seen', 'true');
    setShowOnboarding(false);
  };

  const loadRecent = useCallback(async () => {
    try {
      const res = await fetch('/api/sessions');
      if (res.ok) {
        const data = await res.json();
        setRecent(data);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadRecent();
  }, [loadRecent]);

  const { publicKey, wallet } = useWallet();
  const { connection } = useConnection();

  const handleStartSession = async (input: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input }),
      });
      const data = await res.json();
      if (res.ok && data.id) {
        // Create onchain PDA if wallet connected
        if (publicKey && wallet?.adapter) {
          try {
            const program = getSolliProgram(connection, wallet.adapter);
            const sessionId = Date.now(); // Use timestamp as unique ID
            await createOnchainSession(program, publicKey, sessionId, input, 'pending');
          } catch (err) {
            console.error('[Onchain session]', err);
            // Continue even if onchain fails
          }
        }

        fetch(`/api/sessions/${data.id}/run`, { method: 'POST' }).catch(() => {});
        router.push(`/session/${data.id}`);
      } else {
        const msg = data.message || data.error || `Server error (${res.status})`;
        alert(`Failed to create session: ${msg}`);
        setLoading(false);
      }
    } catch (err) {
      alert('Failed to create session. Is the server running? Check /api/health');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="w-full border-b border-cream-300 bg-cream-50/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink-800">
              <Zap className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-semibold tracking-tight text-ink-800">Solli</span>
          </div>
          <WalletConnectButton />
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1">
        <section className="mx-auto flex max-w-3xl flex-col items-center px-6 pt-20 pb-8">
          <h1 className="text-center text-4xl font-semibold tracking-tight text-ink-800 sm:text-5xl">
            What do you want to
            <br />
            <span className="text-teal-600">accomplish today?</span>
          </h1>
          <p className="mt-4 text-center text-base text-ink-400 max-w-lg">
            Your voice-native AI operator. Ask, speak, or type — Solli handles research, scheduling, and tasks.
          </p>

          <div className="mt-10 w-full max-w-2xl">
            <SessionInput
              onStartSession={handleStartSession}
              onStartVoice={() => setShowVoice((v) => !v)}
              disabled={loading}
              size="lg"
            />
          </div>

          {loading && (
            <div className="mt-6 flex items-center gap-2 text-sm text-ink-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Creating your session...
            </div>
          )}

          {/* Suggestions + Demo */}
          {!loading && !showVoice && (
            <div className="mt-6 space-y-3">
              <div className="flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => handleStartSession(s)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-cream-300 bg-white px-3.5 py-1.5 text-sm text-ink-500 transition-all hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700"
                  >
                    <Search className="h-3 w-3" />
                    {s}
                  </button>
                ))}
              </div>
              <div className="flex justify-center">
                <button
                  onClick={() => setSimulationQuery("Find me 3 AI internship opportunities in Poland")}
                  className="inline-flex items-center gap-2 rounded-full border-2 border-dashed border-teal-300 bg-teal-50/50 px-5 py-2 text-sm font-semibold text-teal-700 transition-all hover:bg-teal-50 hover:border-teal-400"
                >
                  <Play className="h-3.5 w-3.5" />
                  Try Demo — See How Solli Works
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Voice Panel */}
        {showVoice && (
          <section className="mx-auto max-w-2xl px-6 pb-12 animate-slide-up">
            <VoiceConversationPanel />
          </section>
        )}

        {/* Features + Treasury */}
        {!showVoice && (
          <section className="mx-auto max-w-4xl px-6 py-16 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <FeatureCard
                icon={<Globe className="h-5 w-5 text-teal-600" />}
                title="Deep Research"
                description="Search, browse, and synthesize information from across the web."
              />
              <FeatureCard
                icon={<Calendar className="h-5 w-5 text-teal-600" />}
                title="Smart Scheduling"
                description="Plan meetings, set reminders, and organize your calendar."
              />
              <FeatureCard
                icon={<Mail className="h-5 w-5 text-teal-600" />}
                title="Inbox Assistant"
                description="Draft, summarize, and manage emails effortlessly."
              />
            </div>
            <AgentTreasuryCard />
          </section>
        )}

        {/* Recent Sessions */}
        {!showVoice && recent.length > 0 && (
          <section className="mx-auto max-w-3xl px-6 pb-20">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="h-4 w-4 text-ink-400" />
              <h2 className="text-sm font-medium text-ink-500 uppercase tracking-wider">Recent Sessions</h2>
            </div>
            <div className="space-y-2">
              {recent.map((s) => (
                <button
                  key={s.id}
                  onClick={() => router.push(`/session/${s.id}`)}
                  className="w-full text-left rounded-xl border border-cream-300 bg-white px-5 py-4 transition-all hover:border-teal-300 hover:shadow-sm group"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ink-700 truncate">{s.input || 'No input'}</p>
                      <div className="mt-1 flex items-center gap-3 text-xs text-ink-400">
                        <span className="inline-flex items-center rounded-full bg-cream-100 px-2 py-0.5 font-medium uppercase tracking-wide">
                          {s.status}
                        </span>
                        {s.intent && <span>{s.intent}</span>}
                        <span>{new Date(s.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-cream-400 group-hover:text-teal-500 transition-colors shrink-0" />
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-cream-300 bg-cream-50">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <Shield className="h-3.5 w-3.5 text-ink-300" />
            <span className="text-xs text-ink-400">Powered by Solana. Private by default.</span>
          </div>
          <span className="text-xs text-ink-300">Solli v0.1.0</span>
        </div>
      </footer>

      {/* Onboarding */}
      {showOnboarding && <OnboardingModal onClose={closeOnboarding} />}

      {/* Simulation */}
      {simulationQuery && (
        <SimulationPanel
          query={simulationQuery}
          onClose={() => setSimulationQuery(null)}
        />
      )}
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="rounded-xl border border-cream-300 bg-white p-5 transition-all hover:border-teal-300 hover:shadow-sm">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-teal-50">
        {icon}
      </div>
      <h3 className="text-sm font-semibold text-ink-700">{title}</h3>
      <p className="mt-1 text-sm text-ink-400 leading-relaxed">{description}</p>
    </div>
  );
}
