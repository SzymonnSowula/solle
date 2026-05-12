import { useState, useEffect } from 'react';
import { VoicePanel } from './components/VoicePanel';
import { FileOperationPreview } from './components/FileOperationPreview';
import { OverlayWidget } from './components/OverlayWidget';
import { Zap } from 'lucide-react';
import type { FileOperationPlan } from '@desktop/shared/types';

const isOverlay = new URLSearchParams(window.location.search).get('overlay') === 'true';

export function App() {
  const [plan, setPlan] = useState<FileOperationPlan | null>(null);

  useEffect(() => {
    if (isOverlay) return;
    const handler = (ev: Event) => {
      const custom = ev as CustomEvent<FileOperationPlan>;
      setPlan(custom.detail);
    };
    window.addEventListener('desktop-plan', handler);
    return () => window.removeEventListener('desktop-plan', handler);
  }, []);

  // Overlay mode: render only the widget (no shell chrome)
  if (isOverlay) {
    return <OverlayWidget />;
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col">
      <header className="border-b border-neutral-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-neutral-100">
            <Zap className="h-3.5 w-3.5 text-neutral-950" />
          </div>
          <h1 className="text-sm font-semibold tracking-tight">Solli Desktop</h1>
        </div>
        <span className="text-[10px] text-neutral-600 font-medium uppercase tracking-wider">Beta</span>
      </header>

      <main className="flex-1 flex flex-col items-center px-6 py-8">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-semibold tracking-tight text-white">Talk to your desktop</h2>
          <p className="mt-2 text-sm text-neutral-500 max-w-sm">
            Press <kbd className="px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300 text-xs font-mono">Ctrl+Shift+S</kbd> anywhere to start voice mode.
          </p>
        </div>

        {plan ? (
          <FileOperationPreview plan={plan} onClose={() => setPlan(null)} />
        ) : (
          <VoicePanel />
        )}
      </main>

      <footer className="border-t border-neutral-800 px-6 py-3 flex items-center justify-between">
        <span className="text-[10px] text-neutral-600">Connected to localhost:3000</span>
        <span className="text-[10px] text-neutral-600">Solli Desktop v0.1.0</span>
      </footer>
    </div>
  );
}
