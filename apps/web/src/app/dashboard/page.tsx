'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { SessionInput } from '@/components/session/SessionInput';
import { WalletConnectButton } from '@/components/wallet/WalletConnectButton';
import { VoiceConversationPanel } from '@/components/session/VoiceConversationPanel';
import { SimulationPanel } from '@/components/SimulationPanel';
import { AgentTreasuryCard } from '@/components/AgentTreasuryCard';
import { getVolleProgram, createOnchainSession } from '@/lib/solana/anchor-client';
import { Loader2, Search, Clock, ArrowRight, Play, Zap, Settings, Monitor, Database, Layers } from 'lucide-react';
import { VolleLogo } from '@/components/VolleLogo';

interface RecentSession {
  id: string;
  input: string | null;
  status: string;
  intent: string | null;
  createdAt: string;
}

const SUGGESTIONS = [
  "Help me apply to 3 AI internships in Warsaw",
  "Sort my unread emails and draft replies",
  "Research this company before my interview",
  "Plan my workday: project, gym, and calls",
  "Summarize what we did in yesterday's session",
];

export default function DashboardPage() {
  const router = useRouter();
  const { connected, publicKey, wallet } = useWallet();
  const { connection } = useConnection();
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState<RecentSession[]>([]);
  const [showVoice, setShowVoice] = useState(true);
  const [simulationQuery, setSimulationQuery] = useState<string | null>(null);

  // Auth guard
  useEffect(() => {
    if (!connected) {
      router.push('/');
    }
  }, [connected, router]);

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
    if (connected) {
      loadRecent();
    }
  }, [connected, loadRecent]);

  const handleStartSession = async (input: string) => {
    setLoading(true);
    try {
      let onchainSessionId: number | undefined;
      if (publicKey && wallet?.adapter) {
        try {
          const program = getVolleProgram(connection, wallet.adapter);
          onchainSessionId = Date.now();
          await createOnchainSession(program, publicKey, onchainSessionId, input, 'pending');
        } catch (err) {
          console.error('[Onchain session]', err);
        }
      }

      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input,
          userId: publicKey?.toBase58(),
          metadata: onchainSessionId ? { onchainSessionId } : undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.id) {
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

  if (!connected) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-950">
        <div className="text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-neutral-400" />
          <p className="mt-3 text-sm text-neutral-400">Redirecting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-neutral-950 relative selection:bg-red-500/30">
      {/* Background glow */}
      <div className="fixed top-[-20%] left-[10%] w-[50%] h-[50%] bg-red-600/10 blur-[150px] pointer-events-none rounded-full" />
      
      {/* Sidebar */}
      <aside className="w-64 border-r border-white/5 bg-neutral-950/80 backdrop-blur-sm flex flex-col z-50 sticky top-0 h-screen hidden md:flex">
        <div className="p-6">
          <button onClick={() => router.push('/dashboard')} className="flex items-center gap-3">
            <VolleLogo className="h-8 w-8 text-white" />
            <span className="text-xl font-bold tracking-tight text-white">VOLLE</span>
          </button>
        </div>
        
        <nav className="flex-1 px-4 py-4 space-y-8 overflow-y-auto">
          <div>
            <h4 className="px-2 text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">Platform</h4>
            <div className="space-y-1">
              <button onClick={() => router.push('/dashboard')} className="w-full flex items-center gap-3 px-2 py-2 text-sm font-medium text-white bg-white/5 rounded-lg">
                <Search className="h-4 w-4" />
                Workspace
              </button>
              <button onClick={() => router.push('/download')} className="w-full flex items-center gap-3 px-2 py-2 text-sm font-medium text-neutral-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
                <Monitor className="h-4 w-4" />
                Desktop App
              </button>
              <button onClick={() => router.push('/settings/accounts')} className="w-full flex items-center gap-3 px-2 py-2 text-sm font-medium text-neutral-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
                <Settings className="h-4 w-4" />
                Accounts
              </button>
            </div>
          </div>
          
          <div>
            <h4 className="px-2 text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">Coming Soon</h4>
            <div className="space-y-1">
              <div className="flex items-center justify-between px-2 py-2 opacity-50 cursor-not-allowed">
                <div className="flex items-center gap-3 text-sm font-medium text-neutral-400">
                  <Play className="h-4 w-4" />
                  Automations
                </div>
                <span className="text-[9px] font-bold bg-neutral-800 text-neutral-400 px-1.5 py-0.5 rounded-sm uppercase tracking-wide">Soon</span>
              </div>
              <div className="flex items-center justify-between px-2 py-2 opacity-50 cursor-not-allowed">
                <div className="flex items-center gap-3 text-sm font-medium text-neutral-400">
                  <Layers className="h-4 w-4" />
                  Integrations
                </div>
                <span className="text-[9px] font-bold bg-neutral-800 text-neutral-400 px-1.5 py-0.5 rounded-sm uppercase tracking-wide">Soon</span>
              </div>
              <div className="flex items-center justify-between px-2 py-2 opacity-50 cursor-not-allowed">
                <div className="flex items-center gap-3 text-sm font-medium text-neutral-400">
                  <Database className="h-4 w-4" />
                  Memory
                </div>
                <span className="text-[9px] font-bold bg-neutral-800 text-neutral-400 px-1.5 py-0.5 rounded-sm uppercase tracking-wide">Soon</span>
              </div>
            </div>
          </div>
        </nav>
        
        <div className="p-4 border-t border-white/5 flex flex-col gap-4">
          <WalletConnectButton direction="up" />
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto h-screen relative">
        <div className="md:hidden p-4 border-b border-white/5 flex justify-between items-center bg-neutral-950/80 backdrop-blur-sm sticky top-0 z-50">
          <VolleLogo className="h-6 w-6 text-white" />
          <WalletConnectButton direction="down" />
        </div>
        <section className="mx-auto flex max-w-3xl flex-col items-center px-6 pt-16 pb-8">
          <h1 className="text-center text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            What are we working on?
          </h1>
          <p className="mt-3 text-center text-sm text-neutral-400 max-w-md">
            Type or speak. Volle will ask questions, run tools, and close the loop.
          </p>

          <div className="mt-8 w-full max-w-2xl">
            <SessionInput
              onStartSession={handleStartSession}
              onStartVoice={() => setShowVoice((v) => !v)}
              disabled={loading}
              size="lg"
            />
          </div>

          {loading && (
            <div className="mt-6 flex items-center gap-2 text-sm text-neutral-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Creating your session...
            </div>
          )}

          {/* Suggestions + Demo */}
          {!loading && !showVoice && (
            <div className="mt-5 space-y-3">
              <div className="flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => handleStartSession(s)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-neutral-950 px-3.5 py-1.5 text-sm text-neutral-300 transition-all hover:border-red-400 hover:text-white"
                  >
                    <Search className="h-3 w-3" />
                    {s}
                  </button>
                ))}
              </div>
              <div className="flex justify-center">
                <button
                  onClick={() => setSimulationQuery("Help me apply to 3 AI internships in Warsaw")}
                  className="inline-flex items-center gap-2 rounded-full border border-dashed border-white/20 bg-neutral-900 px-5 py-2 text-sm font-medium text-neutral-300 transition-all hover:border-neutral-400 hover:text-white"
                >
                  <Play className="h-3.5 w-3.5" />
                  Watch Demo
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

        {/* Treasury + Recent */}
        {!showVoice && (
          <section className="mx-auto max-w-3xl px-6 py-12 space-y-8">
            <AgentTreasuryCard />

            {recent.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Clock className="h-4 w-4 text-neutral-400" />
                  <h2 className="text-sm font-medium text-neutral-400 uppercase tracking-wider">Recent Sessions</h2>
                </div>
                <div className="space-y-2">
                  {recent.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => router.push(`/session/${s.id}`)}
                      className="w-full text-left rounded-2xl border border-neutral-800 bg-neutral-900/40 px-6 py-5 transition-all hover:border-red-500/30 hover:bg-neutral-900 hover:shadow-[0_0_20px_rgba(220,38,38,0.1)] group relative overflow-hidden"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">{s.input || 'No input'}</p>
                          <div className="mt-1 flex items-center gap-3 text-xs text-neutral-400">
                            <span className="inline-flex items-center rounded-full bg-neutral-800 px-2 py-0.5 font-medium uppercase tracking-wide">
                              {s.status}
                            </span>
                            {s.intent && <span>{s.intent}</span>}
                            <span>{new Date(s.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-neutral-300 group-hover:text-white transition-colors shrink-0" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}
      </main>

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
