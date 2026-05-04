import { hashData } from '@/lib/utils/hash';

export interface ReceiptInput {
  sessionId: string;
  input: string;
  summary: string;
  wallet: string;
}

export async function computeReceiptHash(data: ReceiptInput): Promise<string> {
  const timestamp = new Date().toISOString();
  return hashData({
    sessionId: data.sessionId,
    input: data.input,
    summary: data.summary,
    timestamp,
  });
}
