import { useState, useEffect } from 'react';
import { Check, AlertCircle } from 'lucide-react';

type OverlayState = 'idle' | 'listening' | 'working' | 'done' | 'error';

export function OverlayWidget() {
  const [state, setState] = useState<OverlayState>('idle');

  useEffect(() => {
    const handler = (ev: Event) => {
      const custom = ev as CustomEvent;
      setState(custom.detail as OverlayState);
    };
    window.addEventListener('overlay-state-changed', handler);
    return () => window.removeEventListener('overlay-state-changed', handler);
  }, []);

  if (state === 'idle') return null;

  return (
    <div className="flex items-center justify-center w-[140px] h-[140px]">
      {state === 'listening' && (
        <div className="relative flex items-center justify-center">
          <div className="absolute h-20 w-20 rounded-full bg-teal-500/20 animate-ping" />
          <div className="absolute h-14 w-14 rounded-full bg-teal-500/30 animate-pulse" />
          <div className="relative h-8 w-8 rounded-full bg-teal-500 shadow-[0_0_20px_rgba(20,184,166,0.6)]" />
        </div>
      )}

      {state === 'working' && (
        <div className="relative flex items-center justify-center">
          <div className="h-16 w-16 rounded-full border-4 border-blue-500/20 border-t-blue-500 animate-spin" />
          <div className="absolute text-[10px] font-bold text-blue-400 uppercase tracking-wider">Working</div>
        </div>
      )}

      {state === 'done' && (
        <div className="flex items-center justify-center h-12 w-12 rounded-full bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.6)]">
          <Check className="h-6 w-6 text-white" />
        </div>
      )}

      {state === 'error' && (
        <div className="flex items-center justify-center h-12 w-12 rounded-full bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.6)]">
          <AlertCircle className="h-6 w-6 text-white" />
        </div>
      )}
    </div>
  );
}
