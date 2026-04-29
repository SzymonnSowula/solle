export { BlockchainReceiptService, createExecutionReceipt, hashData, verifyReceipt } from './receipts';
export * from './payments';

export const BLOCKCHAIN_NETWORK = process.env.SOLANA_NETWORK || 'devnet';
export const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
