'use client';

import Link from 'next/link';
import { ArrowLeft, Shield, Terminal, Wallet, Key, Server, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { VolleLogo } from '@/components/VolleLogo';

export default function SolanaSetupPage() {
  return (
    <div className="min-h-screen flex flex-col bg-neutral-950 text-white">
      <Nav />

      <section className="relative px-4 sm:px-6 pt-28 sm:pt-32 pb-16 sm:pb-20 overflow-hidden border-b border-white/5">
        <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[100%] bg-gradient-to-bl from-red-600/15 to-transparent blur-[140px] pointer-events-none rounded-full" />
        <div className="mx-auto max-w-4xl relative z-10">
          <Link href="/learn/documentation" className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors mb-8">
            <ArrowLeft className="h-4 w-4" /> Documentation
          </Link>
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-xl bg-red-500/10 flex items-center justify-center">
              <Shield className="h-5 w-5 text-red-500" />
            </div>
            <span className="text-xs font-bold text-red-400 uppercase tracking-wider">Learn</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">Solana Setup</h1>
          <p className="mt-4 text-lg text-neutral-400 max-w-2xl leading-relaxed">
            Configure wallets, deploy the Anchor program, and connect your treasury to Volle.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 sm:px-6 py-16 sm:py-20 space-y-16">

        {/* Prerequisites */}
        <div>
          <SectionTitle icon={<Terminal className="h-5 w-5 text-red-500" />} title="Prerequisites" />
          <div className="sm:pl-[52px] space-y-4">
            <div className="rounded-xl bg-neutral-900 border border-white/5 p-6 font-mono text-sm text-neutral-300 space-y-3 overflow-x-auto">
              <div className="text-neutral-500"># Install Solana CLI</div>
              <div>sh -c &quot;$(curl -sSfL https://release.anza.xyz/stable/install)&quot;</div>
              <div className="text-neutral-500"># Install Anchor CLI</div>
              <div>cargo install --git https://github.com/coral-xyz/anchor anchor-cli</div>
              <div className="text-neutral-500"># Verify</div>
              <div>solana --version</div>
              <div>anchor --version</div>
            </div>
            <div className="rounded-xl bg-amber-500/5 border border-amber-500/20 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-amber-200/80">
                  Volle targets <strong className="text-amber-100">Solana Devnet</strong> by default. Never deploy to mainnet without a full security audit.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Wallet */}
        <div>
          <SectionTitle icon={<Wallet className="h-5 w-5 text-red-500" />} title="Wallet Setup" />
          <div className="sm:pl-[52px] space-y-4">
            <p className="text-neutral-300 leading-relaxed">
              Generate a new filesystem wallet or use an existing one. The keypair is used for deploying the program and signing transactions during development.
            </p>
            <CodeBlock lines={[
              '# Generate a new keypair',
              'solana-keygen new --outfile ~/.config/solana/id.json',
              '',
              '# Configure for devnet',
              'solana config set --url devnet',
              '',
              '# Airdrop SOL for deployment',
              'solana airdrop 2',
              'solana balance',
            ]} />
            <p className="text-neutral-300 leading-relaxed">
              For browser wallet connection, Volle supports <strong className="text-white">Phantom</strong> and <strong className="text-white">Solflare</strong> via <code className="text-neutral-200">@solana/wallet-adapter</code>.
            </p>
          </div>
        </div>

        {/* Deploy */}
        <div>
          <SectionTitle icon={<Server className="h-5 w-5 text-red-500" />} title="Deploy the Program" />
          <div className="sm:pl-[52px] space-y-4">
            <CodeBlock lines={[
              '# Navigate to Anchor program directory',
              'cd programs/solli',
              '',
              '# Build the program',
              'anchor build',
              '',
              '# Get the program ID',
              'anchor keys list',
              '',
              '# Deploy to devnet',
              'anchor deploy --provider.cluster devnet',
            ]} />
            <p className="text-neutral-300 leading-relaxed">
              After deployment, update the program ID in <code className="text-neutral-200">Anchor.toml</code>,{' '}
              <code className="text-neutral-200">lib.rs</code> (declare_id!), and the frontend IDL at{' '}
              <code className="text-neutral-200">apps/web/src/lib/solana/idl.json</code>.
            </p>
          </div>
        </div>

        {/* Environment */}
        <div>
          <SectionTitle icon={<Key className="h-5 w-5 text-red-500" />} title="Environment Variables" />
          <div className="sm:pl-[52px] space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left text-neutral-400">
                    <th className="pb-3 pr-4 font-medium">Variable</th>
                    <th className="pb-3 font-medium">Description</th>
                  </tr>
                </thead>
                <tbody className="text-neutral-300">
                  <EnvRow name="NEXT_PUBLIC_SOLANA_RPC_URL" desc="Solana RPC endpoint (defaults to devnet)" />
                  <EnvRow name="NEXT_PUBLIC_PROGRAM_ID" desc="Deployed Anchor program ID" />
                  <EnvRow name="SOLANA_PRIVATE_KEY" desc="Server-side keypair for balance checks (base58)" />
                  <EnvRow name="NEXT_PUBLIC_SOLANA_NETWORK" desc="Network identifier: devnet | mainnet-beta" />
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Treasury Flow */}
        <div>
          <SectionTitle icon={<Shield className="h-5 w-5 text-red-500" />} title="Treasury Flow" />
          <div className="sm:pl-[52px] space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <StepCard n={1} title="Initialize Treasury" desc="User connects wallet → initialize_treasury creates a PDA seeded with [&quot;treasury&quot;, owner_pubkey]." />
              <StepCard n={2} title="Fund Treasury" desc="User deposits SOL → fund_agent transfers lamports from signer to treasury PDA." />
              <StepCard n={3} title="Execute Session" desc="Agent runs tools → each tool&apos;s cost is recorded as a task in PostgreSQL." />
              <StepCard n={4} title="Settle" desc="POST /api/sessions/:id/settle → record_session_cost debits treasury, creates on-chain receipt." />
            </div>
          </div>
        </div>

        {/* Verification */}
        <div>
          <SectionTitle icon={<CheckCircle2 className="h-5 w-5 text-red-500" />} title="Verify Deployment" />
          <div className="sm:pl-[52px] space-y-4">
            <CodeBlock lines={[
              '# Run the Anchor tests',
              'cd programs/solli',
              'anchor test',
              '',
              '# Check the program on-chain',
              'solana program show <PROGRAM_ID>',
              '',
              '# View recent transactions',
              'solana confirm -v <TX_SIGNATURE>',
            ]} />
          </div>
        </div>

        <div className="flex flex-wrap gap-3 pt-8 border-t border-white/10">
          <NavPill href="/learn/architecture" label="← Architecture" />
          <NavPill href="/learn/voice-commands" label="Voice Commands →" />
          <NavPill href="/learn/documentation" label="Documentation →" />
        </div>
      </section>

      <PageFooter />
    </div>
  );
}

function Nav() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-neutral-950/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 py-4">
        <Link href="/" className="flex items-center gap-3">
          <VolleLogo className="h-8 w-8 text-white" />
          <span className="text-xl font-bold tracking-tight text-white">VOLLE</span>
        </Link>
        <div className="flex items-center gap-4 sm:gap-6 text-sm font-medium text-neutral-300">
          <Link href="/learn/documentation" className="text-white">Learn</Link>
          <Link href="/explore/agents" className="hover:text-white transition-colors hidden sm:block">Explore</Link>
          <Link href="/dashboard" className="hover:text-white transition-colors">Dashboard</Link>
        </div>
      </div>
    </nav>
  );
}

function PageFooter() {
  return (
    <footer className="border-t border-white/5 mt-auto">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <VolleLogo className="h-5 w-5 text-white" />
          <span className="text-sm font-medium text-white">Volle</span>
        </div>
        <div className="flex items-center gap-6 text-xs text-neutral-400">
          <Link href="/" className="hover:text-white transition-colors">Home</Link>
          <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
        </div>
      </div>
    </footer>
  );
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <div className="h-10 w-10 rounded-xl bg-neutral-900 border border-white/5 flex items-center justify-center">{icon}</div>
      <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
    </div>
  );
}

function CodeBlock({ lines }: { lines: string[] }) {
  return (
    <div className="rounded-xl bg-neutral-900 border border-white/5 p-6 font-mono text-sm text-neutral-300 space-y-1 overflow-x-auto">
      {lines.map((line, i) => (
        <div key={i} className={line.startsWith('#') ? 'text-neutral-500' : line === '' ? 'h-2' : ''}>
          {line}
        </div>
      ))}
    </div>
  );
}

function EnvRow({ name, desc }: { name: string; desc: string }) {
  return (
    <tr className="border-b border-white/5">
      <td className="py-3 pr-4 font-mono text-xs text-red-400">{name}</td>
      <td className="py-3 text-neutral-300 text-sm">{desc}</td>
    </tr>
  );
}

function StepCard({ n, title, desc }: { n: number; title: string; desc: string }) {
  return (
    <div className="rounded-xl bg-neutral-900 border border-white/5 p-5">
      <div className="flex items-center gap-2 mb-2">
        <div className="h-6 w-6 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-xs font-bold text-red-400">{n}</div>
        <h4 className="text-sm font-bold text-white">{title}</h4>
      </div>
      <p className="text-xs text-neutral-400 leading-relaxed">{desc}</p>
    </div>
  );
}

function NavPill({ href, label }: { href: any; label: string }) {
  return (
    <Link href={href} className="px-4 py-2 rounded-full border border-white/10 text-sm text-neutral-300 hover:text-white hover:border-red-500/30 transition-colors">
      {label}
    </Link>
  );
}
