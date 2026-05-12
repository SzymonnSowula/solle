'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Mic, ArrowRight, Check, X, Zap, Shield, Globe, Wallet } from 'lucide-react';
import { ClientOnly } from './ClientOnly';

interface OnboardingModalProps {
  onClose: () => void;
}

export function OnboardingModal({ onClose }: OnboardingModalProps) {
  const [step, setStep] = useState(0);
  const { connected } = useWallet();

  const steps = [
    {
      icon: <Zap className="h-8 w-8 text-red-400" />,
      title: 'Welcome to Volle',
      description: 'Your voice-native onchain research operator. Speak, research, and save proof on Solana.',
      action: (
        <button
          onClick={() => setStep(1)}
          className="inline-flex items-center gap-2 rounded-lg bg-red-500/100 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-400 transition-colors"
        >
          Get Started
          <ArrowRight className="h-4 w-4" />
        </button>
      ),
    },
    {
      icon: <Wallet className="h-8 w-8 text-red-400" />,
      title: 'Connect Your Wallet',
      description: 'Volle uses Solana to create verifiable session receipts. Connect your Phantom or Solflare wallet to get started.',
      action: (
        <ClientOnly>
          <WalletMultiButton 
            className="!bg-red-600 !text-white !rounded-lg !px-5 !py-2.5 !text-sm !font-semibold !border-0 hover:!bg-red-700 transition-colors !h-auto" 
          />
        </ClientOnly>
      ),
    },
    {
      icon: <Mic className="h-8 w-8 text-red-400" />,
      title: 'Speak to Research',
      description: 'Press the mic button and say something like "Find me AI internships in Poland". Volle will research and respond by voice.',
      action: (
        <button
          onClick={() => setStep(3)}
          className="inline-flex items-center gap-2 rounded-lg bg-red-500/100 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-400 transition-colors"
        >
          Try It
          <ArrowRight className="h-4 w-4" />
        </button>
      ),
    },
    {
      icon: <Shield className="h-8 w-8 text-red-400" />,
      title: 'Save Onchain Receipts',
      description: 'Every research session can be saved as a verifiable receipt on Solana. Proof that the research happened, signed by you.',
      action: (
        <button
          onClick={onClose}
          className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 transition-colors"
        >
          <Check className="h-4 w-4" />
          Start Using Volle
        </button>
      ),
    },
  ];

  const current = steps[step];

  // Auto-advance when wallet connected
  useEffect(() => {
    if (step === 1 && connected) {
      setStep(2);
    }
  }, [connected, step]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-red-500/100/40 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-md rounded-2xl border border-white/10 bg-neutral-950 p-8 shadow-xl">
        {/* Progress */}
        <div className="mb-6 flex items-center gap-2">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i <= step ? 'bg-red-500/100' : 'bg-cream-200'
              }`}
            />
          ))}
        </div>

        {/* Content */}
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10">
            {current.icon}
          </div>
          <h2 className="text-xl font-semibold text-white">{current.title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-neutral-500">{current.description}</p>

          <div className="mt-6">{current.action}</div>
        </div>

        {/* Skip */}
        <button
          onClick={onClose}
          className="mt-6 flex w-full items-center justify-center gap-1 text-xs text-neutral-600 hover:text-neutral-400 transition-colors"
        >
          <X className="h-3 w-3" />
          Skip onboarding
        </button>
      </div>
    </div>
  );
}


