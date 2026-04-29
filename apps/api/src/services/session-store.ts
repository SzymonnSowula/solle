import { postgresDb } from '../db/postgres';
import { SessionStore, SessionStoreEvent, SessionStoreTask } from '@solli/agent-core';
import { receiptService } from './receipt.service';

export class PostgresSessionStore implements SessionStore {
  async updateSession(
    sessionId: string,
    updates: { intent?: string; status?: string; summary?: string; researchResults?: unknown[] }
  ): Promise<void> {
    const sets: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (updates.intent !== undefined) {
      sets.push(`intent = $${idx++}`);
      values.push(updates.intent);
    }
    if (updates.status !== undefined) {
      sets.push(`status = $${idx++}`);
      values.push(updates.status);
    }
    if (updates.summary !== undefined) {
      sets.push(`summary = $${idx++}`);
      values.push(updates.summary);
    }
    if (updates.researchResults !== undefined) {
      sets.push(`metadata = COALESCE(metadata, '{}'::jsonb) || $${idx++}`);
      values.push(JSON.stringify({ researchResults: updates.researchResults }));
    }

    if (sets.length === 0) return;

    values.push(sessionId);
    await postgresDb.query(
      `UPDATE sessions SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${idx}`,
      values
    );
  }

  async addEvent(event: SessionStoreEvent): Promise<void> {
    await postgresDb.query(
      `INSERT INTO agent_events (id, session_id, agent_name, event_type, content, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [
        crypto.randomUUID(),
        event.sessionId,
        event.agentName,
        event.eventType,
        event.content,
        JSON.stringify(event.metadata || {}),
      ]
    );
  }

  async addTask(task: SessionStoreTask): Promise<void> {
    const taskId = crypto.randomUUID();
    await postgresDb.query(
      `INSERT INTO tasks (id, session_id, agent_name, tool_name, input_json, output_json, status, error_message, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
      [
        taskId,
        task.sessionId,
        task.agentName,
        task.toolName || null,
        JSON.stringify(task.inputJson || {}),
        JSON.stringify(task.outputJson || {}),
        task.status,
        task.errorMessage || null,
      ]
    );

    // Create blockchain receipt for completed or failed tasks (non-blocking)
    if (task.status === 'completed' || task.status === 'failed') {
      receiptService.createReceipt({
        sessionId: task.sessionId,
        agentName: task.agentName,
        taskId,
        inputData: task.inputJson || {},
        outputData: task.outputJson || { error: task.errorMessage },
        executionTimeMs: 0,
        costUnits: 0,
      }).catch((err) => {
        console.error('[SessionStore] Receipt creation failed:', err);
      });
    }
  }
}

export const postgresSessionStore = new PostgresSessionStore();
