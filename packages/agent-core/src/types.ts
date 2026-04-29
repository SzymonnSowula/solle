export interface SessionState {
  sessionId: string;
  userIntent: string;
  agentHistory: AgentHistoryEntry[];
  toolResults: Map<string, unknown>;
  pendingApprovals: ApprovalRequest[];
  summary: string;
  currentAgent: AgentName;
  requiresApproval: boolean;
  lastError: string | null;
}

export interface AgentHistoryEntry {
  agentName: string;
  eventType: string;
  content: string;
  timestamp: Date;
}

export interface ApprovalRequest {
  id: string;
  agentName: string;
  taskId: string;
  message: string;
  toolName: string;
  args: Record<string, unknown>;
  createdAt: Date;
  status: 'pending' | 'approved' | 'denied';
}

export type IntentClassification =
  | 'RESEARCH'
  | 'INBOX'
  | 'PLANNING'
  | 'APPLICATION'
  | 'GENERAL';

export type AgentName =
  | 'coordinator'
  | 'research'
  | 'inbox'
  | 'planning'
  | 'summary';

export type AgentResult = {
  result: unknown;
  nextAction: 'continue' | 'done' | 'error';
  requiresApproval: boolean;
  approvalMessage?: string;
};

export type RouterOutput = IntentClassification | 'APPROVAL_WAIT' | 'ERROR';
