// x402 Payment Protocol Stub
// In production, this would create real x402 payment headers
// and verify payments on-chain before executing tools.

export interface X402Payment {
  amount: number; // in SOL
  recipient: string; // pubkey
  purpose: string;
}

export function createX402Headers(payment: X402Payment): Record<string, string> {
  return {
    'X-Payment-Amount': payment.amount.toString(),
    'X-Payment-Recipient': payment.recipient,
    'X-Payment-Currency': 'SOL',
    'X-Payment-Network': 'solana:devnet',
    'X-Payment-Purpose': payment.purpose,
    'X-Payment-Version': 'x402/0.1',
  };
}

export function verifyX402Headers(headers: Record<string, string>): { valid: boolean; amount?: number; recipient?: string } {
  const amount = parseFloat(headers['X-Payment-Amount'] || '0');
  const recipient = headers['X-Payment-Recipient'];
  return {
    valid: amount > 0 && !!recipient,
    amount,
    recipient,
  };
}

// Simulated cost for each tool call (in SOL)
export const TOOL_COSTS: Record<string, number> = {
  'browser_search': 0.001,
  'browser_fetch': 0.0005,
  'gmail_read': 0.002,
  'gmail_send': 0.003,
  'calendar_list': 0.001,
  'calendar_create': 0.002,
  'summary_generate': 0.0005,
  'coordinator_classify': 0.0003,
};

export function getToolCost(toolName: string): number {
  return TOOL_COSTS[toolName] || 0.001;
}

export function formatCost(costSol: number): string {
  if (costSol < 0.001) return `${(costSol * 1000).toFixed(1)}mSOL`;
  return `${costSol.toFixed(3)} SOL`;
}

// Estimate total session cost based on intent and expected steps
export function estimateSessionCost(intent: string, steps = 3): number {
  const baseCosts: Record<string, number> = {
    'RESEARCH': 0.001 + 0.0005, // search + fetch
    'INBOX': 0.002 + 0.003,     // read + send
    'PLANNING': 0.001 + 0.002,  // list + create
    'APPLICATION': 0.001,
    'GENERAL': 0.001,
  };
  const base = baseCosts[intent] || 0.001;
  const coordinator = TOOL_COSTS['coordinator_classify'];
  const summary = TOOL_COSTS['summary_generate'];
  const stepCosts = base * steps;
  return coordinator + stepCosts + summary;
}

// Build x402 payment headers for a specific tool call
export function buildToolPaymentHeaders(toolName: string, sessionId: string): Record<string, string> {
  const cost = getToolCost(toolName);
  return createX402Headers({
    amount: cost,
    recipient: process.env.NEXT_PUBLIC_AGENT_TREASURY_ADDRESS || 'AgentTreasuryPDA',
    purpose: `tool:${toolName}|session:${sessionId}`,
  });
}
