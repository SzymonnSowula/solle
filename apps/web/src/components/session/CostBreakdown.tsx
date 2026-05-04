'use client';

import { useEffect, useState } from 'react';
import { Coins, TrendingUp, TrendingDown, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { formatCost } from '@/lib/x402';

interface TaskCost {
  id: string;
  agent_name: string;
  tool_name: string;
  status: string;
  cost_sol: number;
  created_at: string;
}

interface CostBreakdownProps {
  sessionId: string;
  estimatedCostSol?: number;
  actualCostSol?: number;
}

export function CostBreakdown({ sessionId, estimatedCostSol = 0, actualCostSol = 0 }: CostBreakdownProps) {
  const [tasks, setTasks] = useState<TaskCost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/sessions/${sessionId}/tasks`);
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setTasks(data);
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [sessionId]);

  const totalTaskCost = tasks.reduce((sum, t) => sum + (t.cost_sol || 0), 0);

  return (
    <div className="rounded-xl border border-cream-300 bg-white overflow-hidden">
      <div className="border-b border-cream-200 px-5 py-3 flex items-center gap-2">
        <Coins className="h-4 w-4 text-teal-600" />
        <h3 className="text-sm font-semibold text-ink-700">Cost Breakdown</h3>
      </div>
      <div className="px-5 py-5 space-y-4">
        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-cream-50 border border-cream-200 px-4 py-3">
            <div className="flex items-center gap-1.5 text-xs text-ink-400 mb-1">
              <TrendingUp className="h-3 w-3" />
              Estimated
            </div>
            <p className="text-base font-semibold text-ink-800">{formatCost(estimatedCostSol)}</p>
          </div>
          <div className="rounded-lg bg-cream-50 border border-cream-200 px-4 py-3">
            <div className="flex items-center gap-1.5 text-xs text-ink-400 mb-1">
              <TrendingDown className="h-3 w-3" />
              Actual
            </div>
            <p className="text-base font-semibold text-ink-800">{formatCost(actualCostSol || totalTaskCost)}</p>
          </div>
        </div>

        {/* Task list */}
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-ink-300" />
          </div>
        ) : tasks.length === 0 ? (
          <p className="text-xs text-ink-400 text-center py-2">No tool calls recorded yet.</p>
        ) : (
          <div className="space-y-2">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between rounded-lg border border-cream-200 px-3 py-2 bg-cream-50/50"
              >
                <div className="flex items-center gap-2">
                  {task.status === 'completed' ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  ) : task.status === 'failed' ? (
                    <XCircle className="h-3.5 w-3.5 text-red-500" />
                  ) : (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-ink-300" />
                  )}
                  <div>
                    <p className="text-xs font-medium text-ink-700">
                      {task.tool_name || task.agent_name}
                    </p>
                    <p className="text-[10px] text-ink-400 capitalize">{task.status}</p>
                  </div>
                </div>
                <span className="text-xs font-semibold text-ink-600 font-mono">
                  {formatCost(task.cost_sol || 0)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
