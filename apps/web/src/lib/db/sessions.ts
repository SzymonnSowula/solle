import { getPool, withClient } from './postgres';
import type { SessionStatus, IntentClassification } from '@/lib/types/session';

export interface SessionRow {
  id: string;
  user_id: string;
  input: string | null;
  intent: string | null;
  status: string;
  summary: string | null;
  estimated_cost_sol: number;
  actual_cost_sol: number;
  started_at: Date | null;
  ended_at: Date | null;
  created_at: Date;
  updated_at: Date;
  metadata: Record<string, unknown>;
}

export async function createSession(input: { userId?: string; input: string; metadata?: Record<string, unknown> }): Promise<SessionRow> {
  return withClient(async (client) => {
    const result = await client.query(
      `INSERT INTO sessions (user_id, input, status, metadata)
       VALUES ($1, $2, 'created', $3)
       RETURNING *`,
      [input.userId || 'anonymous', input.input, JSON.stringify(input.metadata || {})]
    );
    return result.rows[0] as SessionRow;
  });
}

export async function getSessionById(id: string): Promise<SessionRow | null> {
  const result = await getPool().query('SELECT * FROM sessions WHERE id = $1', [id]);
  return (result.rows[0] as SessionRow) || null;
}

export async function updateSession(
  id: string,
  updates: {
    status?: SessionStatus;
    intent?: IntentClassification | string;
    summary?: string;
    estimatedCostSol?: number;
    actualCostSol?: number;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (updates.status) {
    fields.push(`status = $${idx++}`);
    values.push(updates.status);
  }
  if (updates.intent) {
    fields.push(`intent = $${idx++}`);
    values.push(updates.intent);
  }
  if (updates.summary !== undefined) {
    fields.push(`summary = $${idx++}`);
    values.push(updates.summary);
  }
  if (updates.estimatedCostSol !== undefined) {
    fields.push(`estimated_cost_sol = $${idx++}`);
    values.push(updates.estimatedCostSol);
  }
  if (updates.actualCostSol !== undefined) {
    fields.push(`actual_cost_sol = $${idx++}`);
    values.push(updates.actualCostSol);
  }
  if (updates.metadata) {
    fields.push(`metadata = $${idx++}`);
    values.push(JSON.stringify(updates.metadata));
  }

  if (fields.length === 0) return;

  values.push(id);
  await getPool().query(`UPDATE sessions SET ${fields.join(', ')} WHERE id = $${idx}`, values);
}

export async function listRecentSessions(limit = 10): Promise<SessionRow[]> {
  const result = await getPool().query(
    'SELECT * FROM sessions ORDER BY created_at DESC LIMIT $1',
    [limit]
  );
  return result.rows as SessionRow[];
}
