'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Wallet } from 'lucide-react';
import { ClientOnly } from '../ClientOnly';

export function WalletConnectButton() {
  const { publicKey, connected } = useWallet();

  return (
    <ClientOnly fallback={
      <button className="rounded-lg bg-cream-100 px-4 py-2 text-sm font-medium text-ink-400 border border-cream-300">
        Connect Wallet
      </button>
    }>
      <div className="flex items-center gap-3">
        {connected && publicKey && (
          <div className="hidden sm:flex items-center gap-2 rounded-full bg-cream-100 border border-cream-300 px-3 py-1.5">
            <Wallet className="h-3.5 w-3.5 text-teal-600" />
            <span className="text-xs font-medium text-ink-500">
              {publicKey.toBase58().slice(0, 4)}...{publicKey.toBase58().slice(-4)}
            </span>
          </div>
        )}
        <WalletMultiButton 
          className="!bg-ink-800 !text-white !rounded-lg !px-4 !py-2 !text-sm !font-medium !border-0 hover:!bg-ink-700 transition-colors !h-auto" 
        />
      </div>
    </ClientOnly>
  );
}
