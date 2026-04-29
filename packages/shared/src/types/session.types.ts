export type IntentClassification =
  | 'RESEARCH'
  | 'INBOX'
  | 'PLANNING'
  | 'APPLICATION'
  | 'GENERAL';

export type SessionStatus = 'created' | 'active' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface SessionUser {
  id: string;
  name?: string;
  email?: string;
}

export interface ResearchResult {
  title: string;
  organization?: string;
  location?: string;
  url?: string;
  reason?: string;
  snippet?: string;
}

export interface SessionEvent {
  id: string;
  sessionId: string;
  agentName: string;
  eventType: string;
  content: string;
  createdAt: Date;
  metadata?: Record<string, unknown>;
}

export interface SessionState {
  id: string;
  userId: string;
  input: string;
  intent?: IntentClassification;
  status: SessionStatus;
  summary?: string;
  researchResults?: ResearchResult[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Session {
  id: string;
  userId: string;
  input?: string;
  intent?: IntentClassification;
  status: SessionStatus;
  summary?: string;
  startedAt: Date;
  endedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  metadata: Record<string, unknown>;
}

export interface SessionCreateInput {
  userId?: string;
  input: string;
  metadata?: Record<string, unknown>;
}

export interface SessionUpdateInput {
  status?: SessionStatus;
  intent?: IntentClassification;
  summary?: string;
  metadata?: Record<string, unknown>;
}
