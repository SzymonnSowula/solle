import { getPool } from './postgres';
import { publishEvent } from './redis';

export interface EventRow {
  id: string;
  session_id: string;
  agent_name: string;
  event_type: string;
  step_name: string | null;
  content: string | null;
  input_payload: Record<string, unknown>;
  output_payload: Record<string, unknown> | null;
  created_at: Date;
  metadata: Record<string, unknown>;
}

export async function addEvent(event: {
  sessionId: string;
  agentName: string;
  eventType: string;
  content?: string;
  inputPayload?: Record<string, unknown>;
  outputPayload?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}): Promise<EventRow> {
  const result = await getPool().query(
    `INSERT INTO agent_events (session_id, agent_name, event_type, content, input_payload, output_payload, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      event.sessionId,
      event.agentName,
      event.eventType,
      event.content || null,
      JSON.stringify(event.inputPayload || {}),
      event.outputPayload ? JSON.stringify(event.outputPayload) : null,
      JSON.stringify(event.metadata || {}),
    ]
  );
  const row = result.rows[0] as EventRow;

  // Publish to Redis for SSE fanout
  await publishEvent(`session:${event.sessionId}:events`, {
    type: 'event',
    event: row,
  });

  return row;
}

export async function getEventsForSession(sessionId: string): Promise<EventRow[]> {
  const result = await getPool().query(
    `SELECT * FROM agent_events WHERE session_id = $1 ORDER BY created_at ASC`,
    [sessionId]
  );
  return result.rows as EventRow[];
}
