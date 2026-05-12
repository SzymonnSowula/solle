import { AnchorProvider, Program, BN, Idl } from '@coral-xyz/anchor';
import { Connection, PublicKey, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import idl from './idl.json';

const PROGRAM_ID = new PublicKey('CnrBFrZP2kwZWYbev3xzTJsDJGK6bTe1HBaNtQ55JSxx');

export function getVolleProgram(connection: Connection, wallet: any) {
  const provider = new AnchorProvider(connection, wallet, {
    commitment: 'confirmed',
  });
  return new Program(idl as Idl, provider);
}

export function findTreasuryPDA(owner: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('treasury'), owner.toBuffer()],
    PROGRAM_ID
  );
}

export function findSessionPDA(owner: PublicKey, sessionId: BN) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('session'), owner.toBuffer(), sessionId.toArrayLike(Buffer, 'le', 8)],
    PROGRAM_ID
  );
}

export function findReceiptPDA(session: PublicKey, hash: string) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('receipt'), session.toBuffer(), Buffer.from(hash)],
    PROGRAM_ID
  );
}

// --- Treasury ---

export async function initializeTreasury(program: Program, owner: PublicKey) {
  const [treasuryPDA] = findTreasuryPDA(owner);
  const tx = await program.methods
    .initializeTreasury()
    .accounts({
      owner,
      treasury: treasuryPDA,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
  return { tx, treasuryPDA };
}

export async function fundAgent(
  program: Program,
  owner: PublicKey,
  amountSol: number
) {
  const [treasuryPDA] = findTreasuryPDA(owner);
  const lamports = new BN(amountSol * LAMPORTS_PER_SOL);

  const tx = await program.methods
    .fundAgent(lamports)
    .accounts({
      owner,
      treasury: treasuryPDA,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  return { tx, treasuryPDA };
}

export async function getTreasuryBalance(
  program: Program,
  owner: PublicKey
): Promise<{ balance: number; totalDeposited: number; totalSpent: number; sessionCount: number } | null> {
  try {
    const [treasuryPDA] = findTreasuryPDA(owner);
    const account: any = await (program.account as any).agentTreasury.fetch(treasuryPDA);
    return {
      balance: account.balance.toNumber() / LAMPORTS_PER_SOL,
      totalDeposited: account.totalDeposited.toNumber() / LAMPORTS_PER_SOL,
      totalSpent: account.totalSpent.toNumber() / LAMPORTS_PER_SOL,
      sessionCount: account.sessionCount.toNumber(),
    };
  } catch {
    return null;
  }
}

export async function withdrawFromTreasury(
  program: Program,
  owner: PublicKey,
  amountSol: number
) {
  const [treasuryPDA] = findTreasuryPDA(owner);
  const lamports = new BN(amountSol * LAMPORTS_PER_SOL);

  const tx = await program.methods
    .withdraw(lamports)
    .accounts({
      owner,
      treasury: treasuryPDA,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  return { tx, treasuryPDA };
}

// --- Session ---

export async function createOnchainSession(
  program: Program,
  owner: PublicKey,
  sessionId: number,
  query: string,
  intent: string
) {
  const [sessionPDA] = findSessionPDA(owner, new BN(sessionId));

  const tx = await program.methods
    .createSession(new BN(sessionId), query, intent)
    .accounts({
      owner,
      session: sessionPDA,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  return { tx, sessionPDA };
}

export async function updateOnchainSessionStatus(
  program: Program,
  owner: PublicKey,
  sessionId: number,
  newStatus: string,
  actualCost: number = 0
) {
  const [sessionPDA] = findSessionPDA(owner, new BN(sessionId));

  const tx = await program.methods
    .updateSessionStatus(newStatus, new BN(actualCost * LAMPORTS_PER_SOL))
    .accounts({
      owner,
      session: sessionPDA,
    })
    .rpc();

  return { tx, sessionPDA };
}

// --- Receipt ---

export async function createOnchainReceipt(
  program: Program,
  owner: PublicKey,
  sessionId: number,
  hash: string
) {
  const [sessionPDA] = findSessionPDA(owner, new BN(sessionId));
  const [receiptPDA] = findReceiptPDA(sessionPDA, hash);

  const tx = await program.methods
    .createReceipt(hash)
    .accounts({
      owner,
      session: sessionPDA,
      receipt: receiptPDA,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  return { tx, sessionPDA, receiptPDA };
}

// --- x402 Payment ---

export async function recordSessionCost(
  program: Program,
  owner: PublicKey,
  sessionId: number,
  costSol: number
) {
  const [treasuryPDA] = findTreasuryPDA(owner);
  const lamports = new BN(costSol * LAMPORTS_PER_SOL);

  const tx = await program.methods
    .recordSessionCost(lamports, new BN(sessionId))
    .accounts({
      owner,
      treasury: treasuryPDA,
    })
    .rpc();

  return { tx, treasuryPDA };
}

export function createX402Headers(amountSol: number, recipient: string): Record<string, string> {
  return {
    'X-Payment-Amount': (amountSol * LAMPORTS_PER_SOL).toString(),
    'X-Payment-Recipient': recipient,
    'X-Payment-Currency': 'SOL',
    'X-Payment-Network': 'solana:devnet',
  };
}
