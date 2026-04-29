import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  clusterApiUrl,
} from '@solana/web3.js';

export interface ExecutionReceipt {
  id: string;
  sessionId: string;
  agentName: string;
  taskId?: string;
  inputHash: string;
  outputHash: string;
  executionTimeMs: number;
  costUnits: number;
  signature: string;
  onChainTxid?: string;
  createdAt: Date;
}

export interface ReceiptData {
  sessionId: string;
  agentName: string;
  taskId?: string;
  inputData: Record<string, unknown>;
  outputData: Record<string, unknown>;
  executionTimeMs: number;
  costUnits: number;
  createdAt: Date;
}

export class BlockchainReceiptService {
  private connection: Connection;
  private keypair: Keypair;
  private readonly memoProgramId = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

  constructor() {
    const network = process.env.SOLANA_NETWORK || 'devnet';
    const rpcUrl = process.env.SOLANA_RPC_URL || clusterApiUrl(network as 'devnet' | 'mainnet-beta');
    this.connection = new Connection(rpcUrl, 'confirmed');

    const privateKeyBase64 = process.env.AGENT_PRIVATE_KEY;
    if (privateKeyBase64) {
      const secretKey = Buffer.from(privateKeyBase64, 'base64');
      this.keypair = Keypair.fromSecretKey(secretKey);
    } else {
      console.warn('[Blockchain] AGENT_PRIVATE_KEY not set, generating ephemeral keypair for devnet');
      this.keypair = Keypair.generate();
    }
  }

  getPublicKey(): string {
    return this.keypair.publicKey.toBase58();
  }

  async createExecutionReceipt(data: ReceiptData): Promise<ExecutionReceipt> {
    const inputHash = await hashData(data.inputData);
    const outputHash = await hashData(data.outputData);
    const id = crypto.randomUUID();

    // Build on-chain memo payload
    const memoPayload = JSON.stringify({
      v: 1,
      id,
      sessionId: data.sessionId,
      taskId: data.taskId,
      agent: data.agentName,
      inputHash,
      outputHash,
      ts: data.createdAt.toISOString(),
    });

    let onChainTxid: string | undefined;
    try {
      const memoInstruction = new TransactionInstruction({
        keys: [],
        programId: this.memoProgramId,
        data: Buffer.from(memoPayload, 'utf-8'),
      });

      const transaction = new Transaction().add(memoInstruction);
      transaction.feePayer = this.keypair.publicKey;

      const { blockhash } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;

      transaction.sign(this.keypair);
      const signature = await this.connection.sendRawTransaction(transaction.serialize());
      await this.connection.confirmTransaction(signature, 'confirmed');

      onChainTxid = signature;
      console.log(`[Blockchain] Receipt ${id} recorded on-chain: ${signature}`);
    } catch (error) {
      console.error('[Blockchain] Failed to write receipt on-chain:', error);
      // Continue without on-chain txid — receipt is still valid locally
    }

    return {
      id,
      sessionId: data.sessionId,
      agentName: data.agentName,
      taskId: data.taskId,
      inputHash,
      outputHash,
      executionTimeMs: data.executionTimeMs,
      costUnits: data.costUnits,
      signature: '', // Cryptographic signature of the receipt data (separate from tx signature)
      onChainTxid,
      createdAt: data.createdAt,
    };
  }

  async verifyReceiptOnChain(onChainTxid: string): Promise<{ verified: boolean; memo?: string }> {
    try {
      const tx = await this.connection.getTransaction(onChainTxid, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0,
      });

      if (!tx) {
        return { verified: false };
      }

      const memoLog = tx.meta?.logMessages?.find((log) => log.includes('Memo'));
      return { verified: true, memo: memoLog };
    } catch (error) {
      console.error('[Blockchain] Verification failed:', error);
      return { verified: false };
    }
  }
}

export async function hashData(data: Record<string, unknown>): Promise<string> {
  const jsonString = JSON.stringify(data);
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(jsonString);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyReceipt(
  inputData: Record<string, unknown>,
  outputData: Record<string, unknown>,
  inputHash: string,
  outputHash: string
): Promise<boolean> {
  try {
    const expectedInputHash = await hashData(inputData);
    const expectedOutputHash = await hashData(outputData);
    return inputHash === expectedInputHash && outputHash === expectedOutputHash;
  } catch {
    return false;
  }
}
