'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { SessionTimeline } from '@/components/session/SessionTimeline';
import { SessionSummary } from '@/components/session/SessionSummary';
import { ResearchResults } from '@/components/session/ResearchResults';
import { CostBreakdown } from '@/components/session/CostBreakdown';
import { VoiceConversationPanel } from '@/components/session/VoiceConversationPanel';
import { WalletConnectButton } from '@/components/wallet/WalletConnectButton';
import { Loader2, ArrowLeft, Receipt, Zap, Tag, Clock, AlertCircle, Radio } from 'lucide-react';
import Link from 'next/link';
import { getVolleProgram, createOnchainReceipt, updateOnchainSessionStatus, recordSessionCost } from '@/lib/solana/anchor-client';

interface SessionData {
  id: string;
  input: string | null;
  intent: string | null;
  status: string;
  summary: string | null;
  estimatedCostSol: number;
  actualCostSol: number;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

interface EventData {
  id: string;
  agent_name: string;
  event_type: string;
  content: string | null;
  created_at: string;
}

interface ResearchResultData {
  title: string;
  organization?: string;
  location?: string;
  url?: string;
  reason?: string;
}

const statusConfig: Record<string, { icon: React.ReactNode; color: string; bg: string; label: string }> = {
  created: { icon: <Clock className="h-3.5 w-3.5" />, color: 'text-neutral-400', bg: 'bg-neutral-950', label: 'Created' },
  running: { icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />, color: 'text-red-300', bg: 'bg-red-500/10', label: 'Running' },
  completed: { icon: <Zap className="h-3.5 w-3.5" />, color: 'text-emerald-400', bg: 'bg-emerald-500/10', label: 'Completed' },
  failed: { icon: <AlertCircle className="h-3.5 w-3.5" />, color: 'text-red-400', bg: 'bg-red-500/10', label: 'Failed' },
};

export default function SessionPage() {
  const { id } = useParams() as { id: string };
  const { publicKey, connected, wallet } = useWallet();
  const { connection } = useConnection();
  const [session, setSession] = useState<SessionData | null>(null);
  const [events, setEvents] = useState<EventData[]>([]);
  const [results, setResults] = useState<ResearchResultData[]>([]);
  const [savingReceipt, setSavingReceipt] = useState(false);
  const [receiptHash, setReceiptHash] = useState<string | null>(null);
  const [receiptTx, setReceiptTx] = useState<string | null>(null);
  const [settleTx, setSettleTx] = useState<string | null>(null);
  const [settling, setSettling] = useState(false);
  const [sseConnected, setSseConnected] = useState(false);
  const [clarifyInput, setClarifyInput] = useState('');
  const [sendingClarification, setSendingClarification] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  const load = useCallback(async () => {
    try {
      const [sRes, eRes] = await Promise.all([
        fetch(`/api/sessions/${id}`),
        fetch(`/api/sessions/${id}/events`),
      ]);
      if (sRes.ok) {
        const sData = await sRes.json();
        setSession(sData);
      }
      if (eRes.ok) {
        const eData = await eRes.json();
        setEvents(eData);
        const toolResultEvent = eData.find(
          (e: any) => e.agent_name === 'research' && e.event_type === 'tool_result'
        );
        if (toolResultEvent?.metadata?.results) {
          setResults(toolResultEvent.metadata.results);
        } else if (toolResultEvent?.output_payload?.results) {
          setResults(toolResultEvent.output_payload.results);
        }
      }
    } catch {
      // ignore
    }
  }, [id]);

  // SSE: live stream
  useEffect(() => {
    load();

    const es = new EventSource(`/api/sessions/${id}/stream`);
    esRef.current = es;

    es.onopen = () => setSseConnected(true);
    es.onerror = () => setSseConnected(false);

    es.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data);
        if (data.type === 'event' && data.event) {
          const ev = data.event;
          setEvents((prev) => {
            if (prev.find((p) => p.id === ev.id)) return prev;
            const next = [...prev, {
              id: ev.id,
              agent_name: ev.agent_name || ev.agentName,
              event_type: ev.event_type || ev.eventType,
              content: ev.content || null,
              created_at: ev.created_at || ev.createdAt || new Date().toISOString(),
            }];
            // Sort by time
            next.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
            return next;
          });
          // Extract research results from tool_result events
          if ((ev.agent_name === 'research' || ev.agentName === 'research') && (ev.event_type === 'tool_result' || ev.eventType === 'tool_result')) {
            const res = ev.metadata?.results || ev.output_payload?.results;
            if (res) setResults(res);
          }
        }
        if (data.type === 'connected') setSseConnected(true);
        if (data.type === 'ping') setSseConnected(true);
      } catch {
        // ignore malformed
      }
    };

    // Fallback polling every 5s if SSE not working
    const interval = setInterval(() => {
      if (!sseConnected) load();
    }, 5000);

    return () => {
      es.close();
      clearInterval(interval);
    };
  }, [id, load, sseConnected]);

  // Stop polling when session completed/failed
  useEffect(() => {
    if (session?.status === 'completed' || session?.status === 'failed') {
      if (esRef.current) esRef.current.close();
    }
  }, [session?.status]);

  const handleSettleAndPay = async () => {
    if (!connected || !publicKey || !session) {
      alert('Wallet not connected');
      return;
    }
    setSettling(true);
    try {
      // 1. Backend settlement - compute final cost
      const settleRes = await fetch(`/api/sessions/${id}/settle`, { method: 'POST' });
      const settleData = await settleRes.json();
      if (!settleRes.ok) {
        alert(settleData.error || 'Settlement failed');
        setSettling(false);
        return;
      }

      const actualCostSol = settleData.actualCostSol as number;
      if (actualCostSol <= 0) {
        alert('Nothing to settle - session cost is zero');
        setSettling(false);
        return;
      }

      // 2. On-chain payment via record_session_cost
      const walletAdapter = (wallet as any)?.adapter;
      if (!walletAdapter) {
        throw new Error('Wallet adapter not available');
      }
      const program = getVolleProgram(connection, walletAdapter);
      const sessionIdNum = (session.metadata?.onchainSessionId as number)
        || new Date(session.createdAt).getTime();

      const { tx } = await recordSessionCost(
        program,
        publicKey,
        sessionIdNum,
        actualCostSol
      );

      setSettleTx(tx);

      // 3. Update on-chain session status
      try {
        await updateOnchainSessionStatus(
          program,
          publicKey,
          sessionIdNum,
          'completed',
          actualCostSol
        );
      } catch {
        // non-critical
      }

      alert(`Settled! Paid ${actualCostSol.toFixed(4)} SOL`);
    } catch (err) {
      console.error('[Settle]', err);
      alert(err instanceof Error ? err.message : 'Settlement failed');
    } finally {
      setSettling(false);
    }
  };

  const handleSendClarification = async () => {
    if (!clarifyInput.trim()) return;
    setSendingClarification(true);
    try {
      const res = await fetch(`/api/sessions/${id}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: clarifyInput.trim() }),
      });
      if (res.ok) {
        setClarifyInput('');
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Failed to send message');
      }
    } catch {
      alert('Failed to send message');
    } finally {
      setSendingClarification(false);
    }
  };

  const handleSaveReceipt = async () => {
    if (!connected || !publicKey || !session) {
      alert('Wallet not connected');
      return;
    }
    setSavingReceipt(true);
    try {
      // 1. Get receipt data from backend
      const res = await fetch('/api/receipts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: id,
          wallet: publicKey.toBase58(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to create receipt');
        setSavingReceipt(false);
        return;
      }
      setReceiptHash(data.hash);

      // 2. Create receipt PDA onchain via Anchor
      const walletAdapter = (wallet as any)?.adapter;
      if (!walletAdapter) {
        throw new Error('Wallet adapter not available');
      }
      const program = getVolleProgram(connection, walletAdapter);
      // Use stored onchain session ID, fallback to createdAt timestamp for consistency
      const sessionIdNum = (session.metadata?.onchainSessionId as number)
        || new Date(session.createdAt).getTime();

      const { tx, receiptPDA } = await createOnchainReceipt(
        program,
        publicKey,
        sessionIdNum,
        data.hash
      );

      setReceiptTx(tx);

      // 3. Store signature in DB
      await fetch('/api/receipts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: id,
          signature: tx,
          hash: data.hash,
        }),
      });
    } catch (err) {
      console.error('[Receipt]', err);
      alert(err instanceof Error ? err.message : 'Failed to save receipt on-chain');
    } finally {
      setSavingReceipt(false);
    }
  };

  const status = statusConfig[session?.status || 'created'];

  return (
    <div className="min-h-screen flex flex-col bg-neutral-950">
      {/* Header */}
      <header className="w-full border-b border-white/10 bg-neutral-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-950 text-neutral-400 transition-colors hover:bg-cream-200 hover:text-neutral-200"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="text-sm font-semibold text-white">Session</h1>
              <div className="flex items-center gap-2">
                <p className="text-[10px] text-neutral-500 font-mono">{id.slice(0, 8)}...</p>
                {sseConnected && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-400 uppercase tracking-wider">
                    <Radio className="h-2 w-2" />
                    Live
                  </span>
                )}
              </div>
            </div>
          </div>
          <WalletConnectButton />
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 mx-auto w-full max-w-3xl px-6 py-8">
        {/* Status Banner */}
        {session?.status === 'running' && (
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-3">
            <Loader2 className="h-4 w-4 animate-spin text-red-400" />
            <span className="text-sm font-medium text-red-200">Session is running...</span>
          </div>
        )}

        {session?.status === 'clarifying' && (
          <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-5 py-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-2 w-2 rounded-full bg-amber-500/100 animate-pulse" />
              <span className="text-sm font-semibold text-amber-400">Waiting for your answer</span>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={clarifyInput}
                onChange={(e) => setClarifyInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSendClarification();
                }}
                placeholder="Type your answer..."
                className="flex-1 rounded-lg border border-amber-500/30 bg-neutral-950 px-3 py-2 text-sm text-white outline-none focus:border-amber-500"
              />
              <button
                onClick={handleSendClarification}
                disabled={sendingClarification || !clarifyInput.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 transition-colors disabled:opacity-50"
              >
                {sendingClarification ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Send
              </button>
            </div>
          </div>
        )}

        <div className="space-y-5">
          {/* Request Card */}
          <div className="rounded-xl border border-white/10 bg-neutral-950 overflow-hidden">
            <div className="border-b border-white/5 px-5 py-3 flex items-center gap-2">
              <Tag className="h-4 w-4 text-neutral-500" />
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Request</span>
            </div>
            <div className="px-5 py-4">
              <p className="text-base text-white font-medium">{session?.input || '...'}</p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                {status && (
                  <span className={`inline-flex items-center gap-1.5 rounded-full ${status.bg} px-3 py-1 text-xs font-semibold ${status.color}`}>
                    {status.icon}
                    {status.label}
                  </span>
                )}
                {session?.intent && (
                  <span className="inline-flex items-center rounded-full bg-neutral-950 px-3 py-1 text-xs font-medium text-neutral-400">
                    Intent: {session.intent}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Voice Panel */}
          <VoiceConversationPanel sessionId={id} />

          {/* Timeline */}
          <SessionTimeline events={events} />

          {/* Cost Breakdown */}
          <CostBreakdown
            sessionId={id}
            estimatedCostSol={session?.estimatedCostSol}
            actualCostSol={session?.actualCostSol}
          />

          {/* Results */}
          <ResearchResults results={results} />

          {/* Summary */}
          <SessionSummary summary={session?.summary || null} />

          {/* Receipt */}
          {session?.status === 'completed' && (
            <div className="rounded-xl border border-white/10 bg-neutral-950 overflow-hidden">
              <div className="border-b border-white/5 px-5 py-3 flex items-center gap-2">
                <Receipt className="h-4 w-4 text-red-400" />
                <h3 className="text-sm font-semibold text-neutral-200">On-Chain Receipt</h3>
              </div>
              <div className="px-5 py-5">
                {!connected && (
                  <div className="flex items-center gap-2 text-sm text-neutral-500 mb-3">
                    <AlertCircle className="h-4 w-4 text-amber-400" />
                    Connect your wallet to save a receipt on-chain.
                  </div>
                )}
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={handleSaveReceipt}
                    disabled={savingReceipt || !connected}
                    className="inline-flex items-center gap-2 rounded-lg bg-red-500 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-red-400 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {savingReceipt ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Receipt className="h-4 w-4" />
                    )}
                    {savingReceipt ? 'Saving...' : 'Save receipt on-chain'}
                  </button>
                  <button
                    onClick={handleSettleAndPay}
                    disabled={settling || !connected}
                    className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {settling ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Zap className="h-4 w-4" />
                    )}
                    {settling ? 'Settling...' : 'Settle & Pay'}
                  </button>
                </div>
                {settleTx && (
                  <div className="mt-3 rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 space-y-1.5">
                    <p className="text-xs text-red-300 font-medium">Payment settled on-chain!</p>
                    <a
                      href={`https://explorer.solana.com/tx/${settleTx}?cluster=devnet`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-400 hover:text-red-300 transition-colors"
                    >
                      View payment on Solscan
                      <ArrowLeft className="h-2.5 w-2.5 rotate-180" />
                    </a>
                  </div>
                )}
                {receiptHash && (
                  <div className="mt-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-4 py-3 space-y-1.5">
                    <p className="text-xs text-emerald-400 font-medium">Receipt saved!</p>
                    <p className="text-[10px] text-emerald-400 font-mono">Hash: {receiptHash}</p>
                    {receiptTx && (
                      <a
                        href={`https://explorer.solana.com/tx/${receiptTx}?cluster=devnet`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-400 hover:text-red-300 transition-colors"
                      >
                        View on Solscan
                        <ArrowLeft className="h-2.5 w-2.5 rotate-180" />
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-neutral-900 mt-8">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <span className="text-xs text-neutral-600">Volle v0.1.0</span>
          <span className="text-xs text-neutral-600">Powered by Solana</span>
        </div>
      </footer>
    </div>
  );
}
