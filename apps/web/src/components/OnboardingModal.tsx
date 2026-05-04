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
      icon: <Zap className="h-8 w-8 text-teal-600" />,
      title: 'Welcome to Solli',
      description: 'Your voice-native onchain research operator. Speak, research, and save proof on Solana.',
      action: (
        <button
          onClick={() => setStep(1)}
          className="inline-flex items-center gap-2 rounded-lg bg-ink-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-ink-700 transition-colors"
        >
          Get Started
          <ArrowRight className="h-4 w-4" />
        </button>
      ),
    },
    {
      icon: <Wallet className="h-8 w-8 text-teal-600" />,
      title: 'Connect Your Wallet',
      description: 'Solli uses Solana to create verifiable session receipts. Connect your Phantom or Solflare wallet to get started.',
      action: (
        <ClientOnly>
          <WalletMultiButton 
            className="!bg-teal-600 !text-white !rounded-lg !px-5 !py-2.5 !text-sm !font-semibold !border-0 hover:!bg-teal-700 transition-colors !h-auto" 
          />
        </ClientOnly>
      ),
    },
    {
      icon: <Mic className="h-8 w-8 text-teal-600" />,
      title: 'Speak to Research',
      description: 'Press the mic button and say something like "Find me AI internships in Poland". Solli will research and respond by voice.',
      action: (
        <button
          onClick={() => setStep(3)}
          className="inline-flex items-center gap-2 rounded-lg bg-ink-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-ink-700 transition-colors"
        >
          Try It
          <ArrowRight className="h-4 w-4" />
        </button>
      ),
    },
    {
      icon: <Shield className="h-8 w-8 text-teal-600" />,
      title: 'Save Onchain Receipts',
      description: 'Every research session can be saved as a verifiable receipt on Solana. Proof that the research happened, signed by you.',
      action: (
        <button
          onClick={onClose}
          className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 transition-colors"
        >
          <Check className="h-4 w-4" />
          Start Using Solli
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink-800/40 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-md rounded-2xl border border-cream-300 bg-white p-8 shadow-xl">
        {/* Progress */}
        <div className="mb-6 flex items-center gap-2">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i <= step ? 'bg-teal-500' : 'bg-cream-200'
              }`}
            />
          ))}
        </div>

        {/* Content */}
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-50">
            {current.icon}
          </div>
          <h2 className="text-xl font-semibold text-ink-800">{current.title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-400">{current.description}</p>

          <div className="mt-6">{current.action}</div>
        </div>

        {/* Skip */}
        <button
          onClick={onClose}
          className="mt-6 flex w-full items-center justify-center gap-1 text-xs text-ink-300 hover:text-ink-500 transition-colors"
        >
          <X className="h-3 w-3" />
          Skip onboarding
        </button>
      </div>
    </div>
  );
}


