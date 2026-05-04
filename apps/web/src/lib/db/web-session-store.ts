import type { SessionStore, SessionStoreEvent, SessionStoreTask } from './session-store';
import { updateSession } from './sessions';
import { addEvent } from './events';
import { getPool } from './postgres';
import { logger } from '@/lib/utils/logger';

const log = logger('db-store');

export class WebSessionStore implements SessionStore {
  async updateSession(
    sessionId: string,
    updates: {
      intent?: string;
      status?: string;
      summary?: string;
      estimatedCostSol?: number;
      actualCostSol?: number;
      researchResults?: unknown[];
    }
  ): Promise<void> {
    log.debug('updateSession', { sessionId, updates });
    await updateSession(sessionId, {
      intent: updates.intent,
      status: updates.status as any,
      summary: updates.summary,
      estimatedCostSol: updates.estimatedCostSol,
      actualCostSol: updates.actualCostSol,
    });
  }

  async addEvent(event: SessionStoreEvent): Promise<void> {
    log.debug('addEvent', { sessionId: event.sessionId, agent: event.agentName, type: event.eventType });
    await addEvent({
      sessionId: event.sessionId,
      agentName: event.agentName,
      eventType: event.eventType,
      content: event.content,
      metadata: event.metadata,
    });
  }

  async addTask(task: SessionStoreTask): Promise<void> {
    log.debug('addTask', { sessionId: task.sessionId, agent: task.agentName, tool: task.toolName });
    const pool = getPool();
    await pool.query(
      `INSERT INTO tasks (session_id, agent_name, tool_name, input_json, output_json, status, error_message, cost_sol)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        task.sessionId,
        task.agentName,
        task.toolName || null,
        JSON.stringify(task.inputJson || {}),
        task.outputJson ? JSON.stringify(task.outputJson) : null,
        task.status,
        task.errorMessage || null,
        task.costSol ?? 0,
      ]
    );
  }
}
