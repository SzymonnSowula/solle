'use client';

import { useState, useEffect } from 'react';
import { Bot, Search, CheckCircle, Loader2, Sparkles, ArrowRight, X, Mic, Wallet, Coins } from 'lucide-react';

interface SimEvent {
  id: number;
  agent: string;
  type: string;
  content: string;
  delay: number;
  cost?: number;
}

interface SimResult {
  title: string;
  organization: string;
  location: string;
  reason: string;
}

interface SimData {
  events: SimEvent[];
  results: SimResult[];
  summary: string;
  totalCost: number;
}

const SIMULATION_DATA: Record<string, SimData> = {
  "Find me 3 AI internship opportunities in Poland": {
    events: [
      { id: 1, agent: 'coordinator', type: 'thinking', content: 'Analyzing user intent: "Find me 3 AI internship opportunities in Poland"', delay: 800 },
      { id: 2, agent: 'coordinator', type: 'completed', content: 'Classified intent as: RESEARCH', delay: 1200 },
      { id: 3, agent: 'research', type: 'started', content: 'Starting research for: "Find me 3 AI internship opportunities in Poland"', delay: 1800 },
      { id: 4, agent: 'research', type: 'tool_call', content: 'Calling browser search tool with query: "AI internship opportunities Poland 2024"', delay: 2500, cost: 0.001 },
      { id: 5, agent: 'research', type: 'tool_result', content: 'Found 3 results from Google Jobs, No Fluff Jobs, and LinkedIn', delay: 4000, cost: 0.002 },
      { id: 6, agent: 'research', type: 'completed', content: 'Research completed with 3 results', delay: 4500 },
      { id: 7, agent: 'summary', type: 'started', content: 'Generating session summary...', delay: 5200 },
      { id: 8, agent: 'summary', type: 'completed', content: 'Summary generated', delay: 6500 },
    ],
    results: [
      { title: 'AI Research Intern', organization: 'XYZ Labs', location: 'Warsaw, Poland', reason: 'Top AI research lab with strong mentorship program and published papers in NeurIPS' },
      { title: 'Machine Learning Intern', organization: 'TechCorp Poland', location: 'Krakow, Poland (Hybrid)', reason: 'Well-funded startup working on NLP and computer vision, recently raised $12M Series A' },
      { title: 'Data Science Intern', organization: 'Global Analytics', location: 'Remote (Poland)', reason: 'Remote-friendly with focus on real-world data science projects for Fortune 500 clients' },
    ],
    summary: 'I found 3 promising AI internship opportunities in Poland. XYZ Labs in Warsaw offers a research-focused role with strong mentorship. TechCorp Poland in Krakow is a well-funded startup working on cutting-edge NLP and CV. Global Analytics provides a remote-friendly option with real-world data science projects. All three accept applications through their career pages.',
    totalCost: 0.003,
  },
  "Research Solana DeFi yields for next week": {
    events: [
      { id: 1, agent: 'coordinator', type: 'thinking', content: 'Analyzing user intent: "Research Solana DeFi yields for next week"', delay: 800 },
      { id: 2, agent: 'coordinator', type: 'completed', content: 'Classified intent as: RESEARCH', delay: 1200 },
      { id: 3, agent: 'research', type: 'started', content: 'Starting research for: "Solana DeFi yields next week 2024"', delay: 1800 },
      { id: 4, agent: 'research', type: 'tool_call', content: 'Calling browser search tool with query: "Solana DeFi yields comparison Marinade Jito Solend"', delay: 2500, cost: 0.001 },
      { id: 5, agent: 'research', type: 'tool_result', content: 'Found data from DeFiLlama, SolanaFM, and protocol dashboards', delay: 4000, cost: 0.002 },
      { id: 6, agent: 'research', type: 'completed', content: 'Research completed with 3 protocols analyzed', delay: 4500 },
      { id: 7, agent: 'summary', type: 'started', content: 'Generating session summary...', delay: 5200 },
      { id: 8, agent: 'summary', type: 'completed', content: 'Summary generated', delay: 6500 },
    ],
    results: [
      { title: 'Marinade Finance mSOL', organization: 'Marinade', location: 'Solana', reason: 'Liquid staking with 6.8% APY, no lockup period, used by 130K+ wallets' },
      { title: 'JitoSOL Staking', organization: 'Jito Labs', location: 'Solana', reason: 'MEV-enhanced staking at 7.2% APY, includes MEV rewards on top of base yield' },
      { title: 'Solend Lending', organization: 'Solend', location: 'Solana', reason: 'Supply USDC for 8.1% APY, auto-compounding, $200M+ TVL, battle-tested protocol' },
    ],
    summary: 'I analyzed 3 top Solana DeFi yield opportunities for next week. Marinade Finance offers 6.8% APY on mSOL with no lockup. JitoSOL provides 7.2% APY including MEV rewards. Solend lending yields 8.1% APY on USDC with auto-compounding. All protocols have strong TVL and security track records.',
    totalCost: 0.003,
  },
};

const agentColors: Record<string, string> = {
  coordinator: 'text-teal-700 bg-teal-50 border-teal-200',
  research: 'text-amber-700 bg-amber-50 border-amber-200',
  summary: 'text-emerald-700 bg-emerald-50 border-emerald-200',
};

const agentIcons: Record<string, React.ReactNode> = {
  coordinator: <Bot className="h-3.5 w-3.5" />,
  research: <Search className="h-3.5 w-3.5" />,
  summary: <CheckCircle className="h-3.5 w-3.5" />,
};

interface SimulationPanelProps {
  query: string;
  onClose: () => void;
}

export function SimulationPanel({ query, onClose }: SimulationPanelProps) {
  const [visibleEvents, setVisibleEvents] = useState<SimEvent[]>([]);
  const [phase, setPhase] = useState<'running' | 'completed'>('running');
  const [showResults, setShowResults] = useState(false);
  const [voiceText, setVoiceText] = useState('');
  const [spentSoFar, setSpentSoFar] = useState(0);

  const data = SIMULATION_DATA[query] || SIMULATION_DATA["Find me 3 AI internship opportunities in Poland"];

  useEffect(() => {
    setVisibleEvents([]);
    setPhase('running');
    setShowResults(false);
    setVoiceText('');
    setSpentSoFar(0);

    let timeouts: NodeJS.Timeout[] = [];

    data.events.forEach((event) => {
      const t = setTimeout(() => {
        setVisibleEvents((prev) => [...prev, event]);
        if (event.cost) {
          setSpentSoFar((prev) => prev + event.cost!);
        }
      }, event.delay);
      timeouts.push(t);
    });

    const completeT = setTimeout(() => {
      setPhase('completed');
      setShowResults(true);
    }, 7000);
    timeouts.push(completeT);

    const voiceT = setTimeout(() => {
      const text = data.summary;
      let i = 0;
      const interval = setInterval(() => {
        setVoiceText(text.slice(0, i));
        i++;
        if (i > text.length) clearInterval(interval);
      }, 20);
      timeouts.push(interval as unknown as NodeJS.Timeout);
    }, 7200);
    timeouts.push(voiceT);

    return () => timeouts.forEach(clearTimeout);
  }, [query, data]);

  const progress = Math.min((visibleEvents.length / data.events.length) * 100, 100);

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-ink-800/40 backdrop-blur-sm animate-fade-in">
      <div className="mx-4 w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl border border-cream-300 bg-white shadow-xl">
        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-cream-200 bg-white/80 backdrop-blur-sm px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-ink-800 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-teal-600" />
              Live Simulation
            </h2>
            <p className="text-xs text-ink-400 mt-0.5">{query}</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-cream-100 text-ink-400 hover:bg-cream-200 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Budget Bar */}
          <div className="rounded-xl border border-cream-200 bg-cream-50 px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-xs font-medium text-ink-500">
                <Wallet className="h-3.5 w-3.5 text-teal-600" />
                Agent Budget
              </div>
              <div className="text-xs text-ink-400">
                Spent: <span className="font-semibold text-teal-700">{spentSoFar.toFixed(3)} SOL</span>
                {phase === 'completed' && (
                  <span className="ml-2 text-emerald-600">Total: {data.totalCost.toFixed(3)} SOL</span>
                )}
              </div>
            </div>
            <div className="h-2 rounded-full bg-cream-200 overflow-hidden">
              <div
                className="h-full rounded-full bg-teal-500 transition-all duration-500 ease-out"
                style={{ width: `${Math.min((spentSoFar / 0.01) * 100, 100)}%` }}
              />
            </div>
            <p className="mt-1.5 text-[10px] text-ink-400">
              Each tool call costs micropayments from your agent treasury. This is a simulation — real payments use x402 protocol on Solana.
            </p>
          </div>

          {/* Progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-ink-500">
                {phase === 'running' ? 'Running agent pipeline...' : 'Completed'}
              </span>
              <span className="text-ink-400">{Math.round(progress)}%</span>
            </div>
            <div className="h-2 rounded-full bg-cream-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-ink-800 transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Timeline */}
          <div className="space-y-2">
            {visibleEvents.map((event) => {
              const colorClass = agentColors[event.agent] || 'text-ink-500 bg-cream-100 border-cream-200';
              return (
                <div
                  key={event.id}
                  className={`flex items-start gap-3 rounded-xl border px-4 py-3 animate-slide-up ${colorClass}`}
                >
                  <div className="mt-0.5 shrink-0">
                    {agentIcons[event.agent] || <Bot className="h-3.5 w-3.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide">{event.agent}</span>
                      <span className="text-[10px] opacity-60 uppercase">{event.type}</span>
                      {event.cost && (
                        <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-white/60 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                          <Coins className="h-2.5 w-2.5" />
                          -{event.cost.toFixed(3)} SOL
                        </span>
                      )}
                    </div>
                    <p className="text-sm mt-0.5 leading-relaxed">{event.content}</p>
                  </div>
                  {phase === 'running' && event.id === visibleEvents[visibleEvents.length - 1]?.id && (
                    <Loader2 className="h-4 w-4 animate-spin shrink-0 mt-1" />
                  )}
                </div>
              );
            })}
          </div>

          {/* Voice Response */}
          {voiceText && (
            <div className="rounded-xl border border-teal-200 bg-teal-50 p-4 animate-fade-in">
              <div className="flex items-center gap-2 mb-2">
                <Mic className="h-4 w-4 text-teal-600" />
                <span className="text-xs font-semibold text-teal-700 uppercase tracking-wider">Solli Voice</span>
              </div>
              <p className="text-sm text-ink-700 leading-relaxed">{voiceText}</p>
            </div>
          )}

          {/* Results */}
          {showResults && (
            <div className="space-y-4 animate-slide-up">
              <div className="rounded-xl border border-cream-300 bg-white overflow-hidden">
                <div className="border-b border-cream-200 px-5 py-3 flex items-center gap-2">
                  <Search className="h-4 w-4 text-amber-600" />
                  <h3 className="text-sm font-semibold text-ink-700">Research Results</h3>
                </div>
                <div className="divide-y divide-cream-100">
                  {data.results.map((r, i) => (
                    <div key={i} className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cream-100 text-[10px] font-bold text-ink-500">
                          {i + 1}
                        </span>
                        <h4 className="text-sm font-semibold text-ink-800">{r.title}</h4>
                      </div>
                      <div className="mt-1 text-xs text-ink-400">
                        {r.organization} · {r.location}
                      </div>
                      <p className="mt-1.5 text-xs text-ink-500 leading-relaxed">{r.reason}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-cream-300 bg-white p-5">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="h-4 w-4 text-emerald-600" />
                  <h3 className="text-sm font-semibold text-ink-700">Summary</h3>
                </div>
                <p className="text-sm text-ink-700 leading-relaxed">{data.summary}</p>
              </div>

              {/* Cost Breakdown */}
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Coins className="h-4 w-4 text-amber-600" />
                  <h3 className="text-sm font-semibold text-ink-700">Session Cost Breakdown</h3>
                </div>
                <div className="space-y-1 text-xs text-ink-500">
                  <div className="flex justify-between">
                    <span>Browser search tool call</span>
                    <span className="font-medium">0.001 SOL</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Result processing</span>
                    <span className="font-medium">0.002 SOL</span>
                  </div>
                  <div className="border-t border-amber-200 mt-1 pt-1 flex justify-between font-semibold text-ink-700">
                    <span>Total</span>
                    <span>{data.totalCost.toFixed(3)} SOL</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-ink-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-ink-700 transition-colors"
                >
                  <ArrowRight className="h-4 w-4" />
                  Try For Real
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
