import { useState } from 'react';
import { Folder, File, ArrowRight, Check, X } from 'lucide-react';
import { useElectron } from '../hooks/useElectron';
import type { FileOperationPlan } from '@desktop/shared/types';

export function FileOperationPreview({ plan, onClose }: { plan: FileOperationPlan; onClose: () => void }) {
  const [executing, setExecuting] = useState(false);
  const [done, setDone] = useState(false);
  const [results, setResults] = useState<{ success: boolean; action: string; error?: string }[] | null>(null);
  const { ipcInvoke } = useElectron();

  const handleConfirm = async () => {
    setExecuting(true);
    try {
      const res = await ipcInvoke<{ success: boolean; action: string; error?: string }[]>('desktop:fs:executePlan', plan);
      setResults(res);
      setDone(true);
    } catch (err) {
      setResults([{ success: false, action: 'executePlan', error: err instanceof Error ? err.message : 'Unknown' }]);
      setDone(true);
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="w-full max-w-lg rounded-xl bg-neutral-900 border border-neutral-800 p-6 shadow-2xl">
      <h3 className="text-sm font-semibold text-white mb-1">Desktop Plan</h3>
      <p className="text-xs text-neutral-400 mb-4">{plan.summary}</p>

      <div className="space-y-2 max-h-60 overflow-y-auto mb-4">
        {plan.actions.map((action, i) => (
          <div key={i} className="flex items-center gap-3 rounded-lg bg-neutral-800/50 border border-neutral-700/50 px-3 py-2">
            {action.type === 'createDir' ? (
              <Folder className="h-4 w-4 text-amber-400 shrink-0" />
            ) : (
              <File className="h-4 w-4 text-blue-400 shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-xs text-neutral-200">
                {action.from && (
                  <>
                    <span className="truncate max-w-[120px]">{action.from.split('\\').pop()}</span>
                    <ArrowRight className="h-3 w-3 text-neutral-500 shrink-0" />
                  </>
                )}
                <span className="truncate max-w-[160px]">{action.to.split('\\').pop()}</span>
              </div>
              <p className="text-[10px] text-neutral-500 mt-0.5">{action.reason}</p>
            </div>
          </div>
        ))}
      </div>

      {!done && (
        <div className="flex items-center gap-3">
          <button
            onClick={handleConfirm}
            disabled={executing}
            className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
          >
            {executing ? (
              <span className="h-3 w-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
            Do it
          </button>
          <button
            onClick={onClose}
            disabled={executing}
            className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-800 px-4 py-2 text-xs font-semibold text-neutral-300 hover:bg-neutral-700 disabled:opacity-50"
          >
            <X className="h-3.5 w-3.5" />
            Cancel
          </button>
        </div>
      )}

      {done && results && (
        <div className="space-y-2">
          {results.map((r, i) => (
            <div
              key={i}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs ${
                r.success ? 'bg-emerald-950/30 text-emerald-400 border border-emerald-900/30' : 'bg-red-950/30 text-red-400 border border-red-900/30'
              }`}
            >
              {r.success ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
              <span>{r.action}</span>
              {r.error && <span className="text-neutral-500 ml-auto">{r.error}</span>}
            </div>
          ))}
          <button
            onClick={onClose}
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-neutral-800 px-4 py-2 text-xs font-semibold text-neutral-300 hover:bg-neutral-700"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}
