import { BlockchainReceiptService, hashData } from '@solli/blockchain';

export class ReceiptService {
  private blockchainService: BlockchainReceiptService;

  constructor() {
    this.blockchainService = new BlockchainReceiptService();
  }

  async createReceipt(
    data: {
      sessionId: string;
      agentName: string;
      taskId?: string;
      inputData: Record<string, unknown>;
      outputData: Record<string, unknown>;
      executionTimeMs: number;
      costUnits: number;
    }
  ): Promise<{ id: string; success: boolean; onChainTxid?: string }> {
    const receipt = await this.blockchainService.createExecutionReceipt({
      ...data,
      createdAt: new Date(),
    });

    return {
      id: receipt.id,
      success: true,
      onChainTxid: receipt.onChainTxid,
    };
  }

  async getReceiptById(_id: string): Promise<unknown> {
    return null;
  }

  async getReceiptsBySession(_sessionId: string): Promise<unknown[]> {
    return [];
  }

  async confirmReceipt(
    id: string,
    onChainTxid: string,
    _signature: string
  ): Promise<void> {
    console.log('Receipt confirmed:', { id, onChainTxid });
  }

  async getStats(): Promise<{
    totalReceipts: number;
    pendingReceipts: number;
    confirmedReceipts: number;
  }> {
    return {
      totalReceipts: 0,
      pendingReceipts: 0,
      confirmedReceipts: 0,
    };
  }

  async verifyOnChain(onChainTxid: string): Promise<{ verified: boolean; memo?: string }> {
    return this.blockchainService.verifyReceiptOnChain(onChainTxid);
  }
}

export const receiptService = new ReceiptService();
