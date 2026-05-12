'use client';

import { useState, useEffect } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { Wallet, Coins, Plus, Loader2 } from 'lucide-react';
import { getVolleProgram, initializeTreasury, fundAgent, getTreasuryBalance } from '@/lib/solana/anchor-client';

export function AgentTreasuryCard() {
  const { publicKey, wallet, connected } = useWallet();
  const { connection } = useConnection();
  const [balance, setBalance] = useState<number | null>(null);
  const [totalDeposited, setTotalDeposited] = useState(0);
  const [totalSpent, setTotalSpent] = useState(0);
  const [sessionCount, setSessionCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [fundAmount, setFundAmount] = useState('0.05');
  const [hasTreasury, setHasTreasury] = useState(false);

  const loadTreasury = async () => {
    if (!publicKey || !wallet?.adapter) return;
    try {
      const program = getVolleProgram(connection, wallet.adapter);
      const data = await getTreasuryBalance(program, publicKey);
      if (data) {
        setBalance(data.balance);
        setTotalDeposited(data.totalDeposited);
        setTotalSpent(data.totalSpent);
        setSessionCount(data.sessionCount);
        setHasTreasury(true);
      } else {
        setHasTreasury(false);
      }
    } catch {
      setHasTreasury(false);
    }
  };

  useEffect(() => {
    if (connected) {
      loadTreasury();
    }
  }, [connected, publicKey]);

  const handleInitialize = async () => {
    if (!publicKey || !wallet?.adapter) return;
    setLoading(true);
    try {
      const program = getVolleProgram(connection, wallet.adapter);
      await initializeTreasury(program, publicKey);
      setHasTreasury(true);
      setBalance(0);
    } catch (err) {
      console.error(err);
      alert('Failed to initialize treasury');
    } finally {
      setLoading(false);
    }
  };

  const handleFund = async () => {
    if (!publicKey || !wallet?.adapter) return;
    const amount = parseFloat(fundAmount);
    if (isNaN(amount) || amount <= 0) {
      alert('Invalid amount');
      return;
    }
    setLoading(true);
    try {
      const program = getVolleProgram(connection, wallet.adapter);
      await fundAgent(program, publicKey, amount);
      await loadTreasury();
    } catch (err) {
      console.error(err);
      alert('Failed to fund agent');
    } finally {
      setLoading(false);
    }
  };

  if (!connected) {
    return (
      <div className="rounded-xl border border-white/10 bg-neutral-950 p-5">
        <div className="flex items-center gap-2 mb-3">
          <Wallet className="h-4 w-4 text-neutral-300" />
          <h3 className="text-sm font-semibold text-white">Agent Treasury</h3>
        </div>
        <p className="text-xs text-neutral-400">Connect your wallet to fund your agent and pay for tool calls.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/10 bg-neutral-950 overflow-hidden">
      <div className="border-b border-white/5 px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-neutral-300" />
          <h3 className="text-sm font-semibold text-white">Agent Treasury</h3>
        </div>
        {balance !== null && (
          <span className="text-xs font-semibold text-white">{balance.toFixed(4)} SOL</span>
        )}
      </div>

      <div className="p-5 space-y-4">
        {!hasTreasury ? (
          <div className="text-center space-y-3">
            <p className="text-xs text-neutral-400">Your agent needs a treasury to pay for tool calls.</p>
            <button
              onClick={handleInitialize}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-neutral-950 hover:bg-red-400 transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Initialize Treasury
            </button>
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg bg-neutral-900 p-2.5 text-center">
                <div className="text-[10px] uppercase tracking-wider text-neutral-400">Deposited</div>
                <div className="text-sm font-semibold text-white">{totalDeposited.toFixed(3)}</div>
              </div>
              <div className="rounded-lg bg-neutral-900 p-2.5 text-center">
                <div className="text-[10px] uppercase tracking-wider text-neutral-400">Spent</div>
                <div className="text-sm font-semibold text-white">{totalSpent.toFixed(3)}</div>
              </div>
              <div className="rounded-lg bg-neutral-900 p-2.5 text-center">
                <div className="text-[10px] uppercase tracking-wider text-neutral-400">Sessions</div>
                <div className="text-sm font-semibold text-white">{sessionCount}</div>
              </div>
            </div>

            {/* Fund Input */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="number"
                  value={fundAmount}
                  onChange={(e) => setFundAmount(e.target.value)}
                  min="0.001"
                  step="0.01"
                  className="w-full rounded-lg border border-white/10 bg-neutral-900 px-3 py-2 text-sm text-white outline-none focus:border-black"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-neutral-400">SOL</span>
              </div>
              <button
                onClick={handleFund}
                disabled={loading}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-neutral-950 hover:bg-red-400 transition-colors disabled:opacity-50"
              >
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Coins className="h-3.5 w-3.5" />}
                Fund
              </button>
            </div>

            <p className="text-[10px] text-neutral-400 leading-relaxed">
              Funds are held in a Solana PDA and spent automatically when your agent calls tools.
              Unused funds can be withdrawn anytime.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
