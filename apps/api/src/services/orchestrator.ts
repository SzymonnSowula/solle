import { runSession, type SessionState, type RunSessionOptions } from '@solli/agent-core';

export class OrchestratorService {
  async runSession(
    sessionId: string,
    userIntent: string,
    options?: RunSessionOptions
  ): Promise<SessionState> {
    return runSession(sessionId, userIntent, options);
  }

  async sendMessage(
    sessionId: string,
    message: string,
    options?: RunSessionOptions
  ): Promise<SessionState> {
    // A follow-up message is treated as a session resume with new user intent
    return runSession(sessionId, message, options);
  }

  async handleApproval(
    sessionId: string,
    approvalId: string,
    approved: boolean,
    options?: RunSessionOptions
  ): Promise<SessionState> {
    return runSession(sessionId, '', {
      ...options,
      resumeConfig: {
        approvalId,
        approved,
      },
    });
  }
}

export const orchestratorService = new OrchestratorService();
