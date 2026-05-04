export interface SessionStoreEvent {
  sessionId: string;
  agentName: string;
  eventType: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface SessionStoreTask {
  sessionId: string;
  agentName: string;
  toolName?: string;
  inputJson?: Record<string, unknown>;
  outputJson?: Record<string, unknown>;
  status: string;
  errorMessage?: string;
  costSol?: number;
}

export interface SessionStore {
  updateSession(sessionId: string, updates: {
    intent?: string;
    status?: string;
    summary?: string;
    estimatedCostSol?: number;
    actualCostSol?: number;
    researchResults?: unknown[];
  }): Promise<void>;
  addEvent(event: SessionStoreEvent): Promise<void>;
  addTask(task: SessionStoreTask): Promise<void>;
}

export class NoOpSessionStore implements SessionStore {
  async updateSession(): Promise<void> {}
  async addEvent(): Promise<void> {}
  async addTask(): Promise<void> {}
}
