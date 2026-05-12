'use client';

import { useState, useRef, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { Wallet, Copy, Check, ChevronDown, LogOut } from 'lucide-react';
import { ClientOnly } from '../ClientOnly';

export function WalletConnectButton({ direction = 'down' }: { direction?: 'up' | 'down' }) {
  const { publicKey, connected, connecting, wallet, connect, disconnect } = useWallet();
  const { setVisible } = useWalletModal();
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleCopy = async () => {
    if (!publicKey) return;
    await navigator.clipboard.writeText(publicKey.toBase58());
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleClick = () => {
    if (connected) {
      setMenuOpen((v) => !v);
    } else if (wallet) {
      connect().catch(() => {});
    } else {
      setVisible(true);
    }
  };

  const buttonText = connecting
    ? 'Connecting...'
    : connected && publicKey
      ? `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}`
      : wallet
        ? 'Connect'
        : 'Connect Wallet';

  return (
    <ClientOnly fallback={
      <button className="rounded-lg bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-600 border border-neutral-200">
        Connect Wallet
      </button>
    }>
      <div className="relative" ref={menuRef}>
        <button
          onClick={handleClick}
          className="inline-flex w-full justify-center items-center gap-2 rounded-xl bg-neutral-900 border border-neutral-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-800 hover:border-neutral-700 transition-colors h-auto"
        >
          <Wallet className="h-4 w-4 text-neutral-400" />
          <span>{buttonText}</span>
          {connected && <ChevronDown className={`h-3 w-3 text-neutral-500 transition-transform ${menuOpen ? (direction === 'down' ? 'rotate-180' : 'rotate-180') : (direction === 'up' ? 'rotate-180' : '')}`} />}
        </button>

        {connected && menuOpen && (
          <div className={`absolute ${direction === 'up' ? 'bottom-full mb-2' : 'top-full mt-2'} right-0 sm:left-0 w-[calc(100%)] min-w-[200px] rounded-xl border border-neutral-800 bg-neutral-900 shadow-xl shadow-black/50 z-50 py-1.5`}>
            <div className="px-3 py-2 border-b border-neutral-800">
              <p className="text-[10px] uppercase tracking-wider text-neutral-500 font-medium">Connected</p>
              <p className="text-xs font-mono text-white mt-0.5 truncate">
                {publicKey?.toBase58()}
              </p>
            </div>
            <button
              onClick={handleCopy}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copied' : 'Copy address'}
            </button>
            <button
              onClick={() => { setVisible(true); setMenuOpen(false); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors"
            >
              <Wallet className="h-3.5 w-3.5" />
              Change wallet
            </button>
            <button
              onClick={() => { disconnect().catch(() => {}); setMenuOpen(false); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-neutral-800 hover:text-red-400 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              Disconnect
            </button>
          </div>
        )}
      </div>
    </ClientOnly>
  );
}
