'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useRouter } from 'next/navigation';
import { Suspense } from 'react';
import Link from 'next/link';
import {
  Zap,
  Mail,
  Calendar,
  HardDrive,
  MessageSquare,
  FileText,
  Github,
  Trello,
  Headphones,
  Loader2,
  CheckCircle2,
  XCircle,
  Link2,
  Unlink,
  ArrowLeft,
  Settings,
} from 'lucide-react';
import { AccountsToast } from './AccountsToast';

interface IntegrationDef {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  category: string;
  comingSoon?: boolean;
}

interface ConnectedAccount {
  id: string;
  provider: string;
  connected: boolean;
  expiresAt: string | null;
}

const INTEGRATIONS: IntegrationDef[] = [
  {
    id: 'google',
    name: 'Google Workspace',
    description: 'Gmail, Calendar, Drive access',
    icon: <Mail className="h-5 w-5" />,
    category: 'Productivity',
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Read channels, send messages',
    icon: <MessageSquare className="h-5 w-5" />,
    category: 'Communication',
    comingSoon: true,
  },
  {
    id: 'notion',
    name: 'Notion',
    description: 'Read and write pages, databases',
    icon: <FileText className="h-5 w-5" />,
    category: 'Productivity',
    comingSoon: true,
  },
  {
    id: 'github',
    name: 'GitHub',
    description: 'Issues, PRs, code search',
    icon: <Github className="h-5 w-5" />,
    category: 'Development',
    comingSoon: true,
  },
  {
    id: 'linear',
    name: 'Linear',
    description: 'Issues, projects, cycles',
    icon: <Trello className="h-5 w-5" />,
    category: 'Development',
    comingSoon: true,
  },
  {
    id: 'discord',
    name: 'Discord',
    description: 'Bot integration for servers',
    icon: <Headphones className="h-5 w-5" />,
    category: 'Communication',
    comingSoon: true,
  },
];

export default function AccountsSettingsPage() {
  const router = useRouter();
  const { publicKey, connected } = useWallet();
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const userId = publicKey?.toBase58() || null;

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  const loadAccounts = useCallback(async () => {
    if (!userId) {
      setAccounts([]);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`/api/accounts?userId=${encodeURIComponent(userId)}`);
      if (res.ok) {
        const data = await res.json();
        setAccounts(data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const handleConnect = async (provider: string) => {
    if (!userId) return;
    setActionLoading(provider);
    try {
      if (provider === 'google') {
        const res = await fetch(`/api/auth/google?userId=${encodeURIComponent(userId)}`);
        const data = await res.json();
        if (data.url) {
          window.location.href = data.url;
        } else {
          setNotice({ message: 'Failed to start Google auth', type: 'error' });
        }
      }
    } catch {
      setNotice({ message: 'Connection failed', type: 'error' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDisconnect = async (provider: string) => {
    if (!userId) return;
    setActionLoading(provider);
    try {
      const res = await fetch(`/api/accounts?userId=${encodeURIComponent(userId)}&provider=${encodeURIComponent(provider)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setAccounts((prev) => prev.filter((a) => a.provider !== provider));
        setNotice({ message: `${provider} disconnected`, type: 'success' });
      } else {
        setNotice({ message: 'Failed to disconnect', type: 'error' });
      }
    } catch {
      setNotice({ message: 'Disconnect failed', type: 'error' });
    } finally {
      setActionLoading(null);
    }
  };

  const isConnected = (provider: string) => accounts.some((a) => a.provider === provider);

  const grouped = INTEGRATIONS.reduce<Record<string, IntegrationDef[]>>((acc, int) => {
    if (!acc[int.category]) acc[int.category] = [];
    acc[int.category].push(int);
    return acc;
  }, {});

  return (
    <div className="min-h-screen flex flex-col bg-neutral-950">
      {notice && (
        <div className={`fixed top-4 right-4 z-[200] flex items-center gap-2 rounded-xl border px-4 py-3 shadow-lg ${
          notice.type === 'success'
            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
            : 'border-red-500/30 bg-red-500/10 text-red-400'
        }`}>
          {notice.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
          <span className="text-sm font-medium">{notice.message}</span>
        </div>
      )}

      <Suspense fallback={null}>
        <AccountsToast />
      </Suspense>

      {/* Header */}
      <header className="w-full border-b border-white/5 bg-neutral-950/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-2.5">
            <Link href="/dashboard" className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-red-500">
                <Zap className="h- w- text-neutral-950" />
              </div>
              <span className="text-base font-semibold tracking-tight text-white">Volle</span>
            </Link>
          </div>
          <Link
            href="/dashboard"
            className="text-sm font-medium text-neutral-400 hover:text-white transition-colors"
          >
            Dashboard
          </Link>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-6 py-12">
          <div className="mb-8">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 text-sm text-neutral-400 hover:text-white transition-colors mb-4"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to dashboard
            </Link>
            <h1 className="text-2xl font-semibold tracking-tight text-white flex items-center gap-2">
              <Settings className="h-5 w-5 text-neutral-300" />
              Connected Accounts
            </h1>
            <p className="mt-1 text-sm text-neutral-400">
              Link external services so Volle can act on your behalf.
            </p>
          </div>

          {!connected && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-5 py-4 mb-8">
              <p className="text-sm text-amber-400">
                Connect your Solana wallet first to manage integrations.
              </p>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />
            </div>
          ) : (
            <div className="space-y-10">
              {Object.entries(grouped).map(([category, items]) => (
                <div key={category}>
                  <h2 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3">
                    {category}
                  </h2>
                  <div className="space-y-3">
                    {items.map((integration) => {
                      const connected = isConnected(integration.id);
                      return (
                        <div
                          key={integration.id}
                          className="flex items-center justify-between rounded-xl border border-white/10 bg-neutral-950 px-5 py-4 transition-all hover:border-white/20"
                        >
                          <div className="flex items-center gap-4">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-800 text-white shrink-0">
                              {integration.icon}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="text-sm font-semibold text-white">{integration.name}</h3>
                                {integration.comingSoon && (
                                  <span className="inline-flex items-center rounded-full bg-neutral-800 px-2 py-0.5 text-[10px] font-medium text-neutral-400 uppercase tracking-wide">
                                    Coming soon
                                  </span>
                                )}
                                {connected && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                                    <CheckCircle2 className="h-3 w-3" />
                                    Connected
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-neutral-400 mt-0.5">{integration.description}</p>
                            </div>
                          </div>

                          <div className="shrink-0">
                            {integration.comingSoon ? (
                              <button
                                disabled
                                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-neutral-900 px-3 py-1.5 text-xs font-medium text-neutral-400 cursor-not-allowed"
                              >
                                <Link2 className="h-3 w-3" />
                                Connect
                              </button>
                            ) : connected ? (
                              <button
                                onClick={() => handleDisconnect(integration.id)}
                                disabled={actionLoading === integration.id}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-100 transition-colors disabled:opacity-50"
                              >
                                {actionLoading === integration.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Unlink className="h-3 w-3" />
                                )}
                                Disconnect
                              </button>
                            ) : (
                              <button
                                onClick={() => handleConnect(integration.id)}
                                disabled={actionLoading === integration.id || !userId}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-red-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-400 transition-colors disabled:opacity-50"
                              >
                                {actionLoading === integration.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Link2 className="h-3 w-3" />
                                )}
                                Connect
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
