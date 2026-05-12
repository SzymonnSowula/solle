'use client';

import { useState, useEffect } from 'react';
import { Mic, User, Bot, Coins, Wallet, X, Play, ArrowRight, Loader2 } from 'lucide-react';

interface ConversationTurn {
  id: number;
  speaker: 'user' | 'agent';
  text: string;
  delay: number;
  cost?: number;
  toolCall?: string;
}

const CONVERSATION: ConversationTurn[] = [
  { id: 1, speaker: 'user', text: 'Help me apply to 3 AI internships in Warsaw.', delay: 500 },
  { id: 2, speaker: 'agent', text: 'Sure! What kind of roles are you looking for? Machine learning, research, or data science?', delay: 1500 },
  { id: 3, speaker: 'user', text: 'Machine learning and research.', delay: 3000 },
  { id: 4, speaker: 'agent', text: 'Got it. Remote, hybrid, or on-site in Warsaw?', delay: 4200 },
  { id: 5, speaker: 'user', text: 'Warsaw or remote is fine.', delay: 5500 },
  { id: 6, speaker: 'agent', text: 'Searching for openings now...', delay: 6500, cost: 0.001, toolCall: 'browser_search' },
  { id: 7, speaker: 'agent', text: 'I found 5 strong matches. Top three:\n\n1. AI Research Intern at XYZ Labs - Warsaw, published NeurIPS papers, strong mentorship.\n2. ML Intern at TechCorp Poland - hybrid, NLP and CV focus, $12M Series A.\n3. Data Science Intern at Global Analytics - remote, Fortune 500 projects.\n\nWhich ones should I prepare applications for?', delay: 8000 },
  { id: 8, speaker: 'user', text: 'The first two.', delay: 10000 },
  { id: 9, speaker: 'agent', text: 'Drafting tailored cover letters and updating your CV...', delay: 11000, cost: 0.0015, toolCall: 'generate_documents' },
  { id: 10, speaker: 'agent', text: 'Done. For XYZ Labs I highlighted your Rust and Solana experience. For TechCorp I emphasized your NLP projects. Want to review before I send?', delay: 13000 },
  { id: 11, speaker: 'user', text: 'In the TechCorp one add that I also know PyTorch.', delay: 15000 },
  { id: 12, speaker: 'agent', text: 'Updated. Added PyTorch to the TechCorp letter. Sending both applications now...', delay: 16000, cost: 0.002, toolCall: 'send_emails' },
  { id: 13, speaker: 'agent', text: 'Sent! You will receive confirmations within minutes. Session cost: 0.0045 SOL. Should I save an on-chain receipt for this session?', delay: 18500 },
  { id: 14, speaker: 'user', text: 'Yes, save it.', delay: 20500 },
  { id: 15, speaker: 'agent', text: 'Receipt saved on Solana devnet. Hash: 0x7a3f...9e2d. You can verify it anytime. Summary: applied to 2 internships, spent 0.0045 SOL, 3 tool calls. Good luck!', delay: 22000, cost: 0.0005, toolCall: 'create_receipt' },
];

const TOTAL_COST = 0.0045;

interface SimulationPanelProps {
  query: string;
  onClose: () => void;
}

export function SimulationPanel({ query, onClose }: SimulationPanelProps) {
  const [visibleTurns, setVisibleTurns] = useState<ConversationTurn[]>([]);
  const [phase, setPhase] = useState<'running' | 'completed'>('running');
  const [spentSoFar, setSpentSoFar] = useState(0);

  useEffect(() => {
    setVisibleTurns([]);
    setPhase('running');
    setSpentSoFar(0);

    const timeouts: NodeJS.Timeout[] = [];

    CONVERSATION.forEach((turn) => {
      const cost = turn.cost;
      const t = setTimeout(() => {
        setVisibleTurns((prev) => [...prev, turn]);
        if (cost) {
          setSpentSoFar((prev) => prev + cost);
        }
      }, turn.delay);
      timeouts.push(t);
    });

    const completeT = setTimeout(() => {
      setPhase('completed');
    }, 24000);
    timeouts.push(completeT);

    return () => timeouts.forEach(clearTimeout);
  }, [query]);

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="mx-4 w-full max-w-xl max-h-[85vh] overflow-y-auto rounded-2xl border border-white/10 bg-neutral-950 shadow-xl">
        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-white/5 bg-neutral-950/80 backdrop-blur-sm px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Play className="h-5 w-5 text-red-400" />
              Live Conversation Demo
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">Watch how Volle talks you through a full workflow</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-950 text-neutral-500 hover:bg-cream-200 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Budget */}
          <div className="rounded-xl border border-white/5 bg-neutral-900 px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-xs font-medium text-neutral-400">
                <Wallet className="h-3.5 w-3.5 text-red-400" />
                Agent Treasury
              </div>
              <div className="text-xs text-neutral-500">
                Spent: <span className="font-semibold text-red-300">{spentSoFar.toFixed(4)} SOL</span>
                {phase === 'completed' && (
                  <span className="ml-2 text-emerald-600">Total: {TOTAL_COST.toFixed(4)} SOL</span>
                )}
              </div>
            </div>
            <div className="h-2 rounded-full bg-cream-200 overflow-hidden">
              <div
                className="h-full rounded-full bg-red-500 transition-all duration-500 ease-out"
                style={{ width: `${Math.min((spentSoFar / 0.01) * 100, 100)}%` }}
              />
            </div>
            <p className="mt-1.5 text-[10px] text-neutral-500">
              Each tool call deducts a micropayment from your treasury via x402. Real payments settle on Solana.
            </p>
          </div>

          {/* Conversation */}
          <div className="space-y-3">
            {visibleTurns.map((turn) => (
              <div
                key={turn.id}
                className={`flex gap-3 animate-slide-up ${turn.speaker === 'user' ? 'flex-row-reverse' : ''}`}
              >
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${turn.speaker === 'user' ? 'bg-red-500 text-white' : 'bg-red-500/10 text-red-300 border border-red-500/30'
                  }`}>
                  {turn.speaker === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                </div>
                <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${turn.speaker === 'user'
                    ? 'bg-red-500 text-white rounded-tr-sm'
                    : 'bg-neutral-950 text-white rounded-tl-sm border border-white/5'
                  }`}>
                  <p className="text-sm leading-relaxed whitespace-pre-line">{turn.text}</p>
                  {turn.toolCall && (
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 rounded-full bg-neutral-950/60 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                        <Coins className="h-2.5 w-2.5" />
                        {(turn.cost ?? 0).toFixed(4)} SOL · {turn.toolCall}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {phase === 'running' && (
              <div className="flex items-center gap-2 text-xs text-neutral-500 pl-11">
                <Loader2 className="h-3 w-3 animate-spin" />
                Listening...
              </div>
            )}
          </div>

          {/* Summary when done */}
          {phase === 'completed' && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 animate-fade-in">
              <h3 className="text-sm font-semibold text-red-200 mb-2 flex items-center gap-2">
                <Mic className="h-4 w-4" />
                Session Complete
              </h3>
              <ul className="space-y-1 text-xs text-neutral-200">
                <li className="flex items-start gap-2">
                  <span className="text-red-400 mt-0.5">&#10003;</span>
                  <span>Applied to <strong>2 internships</strong> (XYZ Labs, TechCorp Poland)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-400 mt-0.5">&#10003;</span>
                  <span>Generated <strong>tailored CV + cover letters</strong></span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-400 mt-0.5">&#10003;</span>
                  <span>Sent <strong>2 emails</strong> with your approval</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-400 mt-0.5">&#10003;</span>
                  <span>Saved <strong>on-chain receipt</strong> on Solana</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-400 mt-0.5">&#10003;</span>
                  <span>Total cost: <strong>{TOTAL_COST.toFixed(4)} SOL</strong> (3 tool calls)</span>
                </li>
              </ul>
              <div className="mt-3 pt-3 border-t border-red-500/30">
                <button
                  onClick={onClose}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-red-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-400 transition-colors"
                >
                  <ArrowRight className="h-4 w-4" />
                  Start a Real Session
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
