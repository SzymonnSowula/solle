import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { runSession } from '@solli/agent-core';
import { postgresSessionStore } from '../services/session-store';

const CreateSessionSchema = z.object({
  input: z.string().min(1),
  userId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export async function sessionsRoutes(fastify: FastifyInstance) {
  // GET /sessions - list recent sessions
  fastify.get('/', async (_request) => {
    const db = fastify.db;
    const sessions = await db.query(
      'SELECT id, user_id, input, status, summary, created_at, updated_at FROM sessions ORDER BY created_at DESC LIMIT 50'
    );
    return sessions;
  });

  // POST /sessions - create a new session with user input
  fastify.post('/', async (request, reply) => {
    const parseResult = CreateSessionSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: 'Invalid input', details: parseResult.error.format() });
    }

    const { input, userId, metadata } = parseResult.data;
    const sessionId = crypto.randomUUID();

    const db = fastify.db;
    await db.query(
      `INSERT INTO sessions (id, user_id, input, status, metadata, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
      [sessionId, userId || 'anonymous', input, 'created', JSON.stringify(metadata || {})]
    );

    return reply.status(201).send({
      sessionId,
      status: 'created',
    });
  });

  // GET /sessions/:id
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const db = fastify.db;
    const session = await db.queryOne(
      'SELECT * FROM sessions WHERE id = $1',
      [id]
    );

    if (!session) {
      return reply.status(404).send({ error: 'Session not found' });
    }

    // Parse metadata to extract researchResults if present
    let researchResults = undefined;
    try {
      const meta = typeof session.metadata === 'string' ? JSON.parse(session.metadata) : session.metadata;
      researchResults = meta?.researchResults;
    } catch {
      // ignore
    }

    return {
      ...session,
      researchResults,
    };
  });

  // POST /sessions/:id/run - run or resume the agent orchestration
  fastify.post('/:id/run', async (request, reply) => {
    const { id } = request.params as { id: string };

    const db = fastify.db;
    const session = await db.queryOne<{ id: string; input: string; status: string }>(
      'SELECT id, input, status FROM sessions WHERE id = $1',
      [id]
    );

    if (!session) {
      return reply.status(404).send({ error: 'Session not found' });
    }

    if (session.status === 'running') {
      return reply.status(409).send({ error: 'Session is already running' });
    }

    // Update status to running
    await db.query(
      `UPDATE sessions SET status = 'running', updated_at = NOW() WHERE id = $1`,
      [id]
    );

    // Check if checkpoint exists to determine if this is a resume
    const checkpoint = await db.queryOne(
      'SELECT 1 FROM checkpoints WHERE thread_id = $1 LIMIT 1',
      [id]
    );
    const isResume = !!checkpoint;

    // Fire and forget the graph execution
    runSession(id, session.input, {
      store: postgresSessionStore,
      pool: db.getPool(),
    }).then((result) => {
      console.log(`[API] Session ${id} ${isResume ? 'resumed' : 'completed'}:`, result.summary?.substring(0, 50));
    }).catch((error) => {
      console.error(`[API] Session ${id} failed:`, error);
      db.query(
        `UPDATE sessions SET status = 'failed', updated_at = NOW() WHERE id = $1`,
        [id]
      ).catch((_e: unknown) => console.error('Failed to update session status:', _e));
    });

    return {
      sessionId: id,
      status: 'running',
      resumed: isResume,
    };
  });

  // POST /sessions/:id/message - send a follow-up message within an existing session
  fastify.post('/:id/message', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { message?: string };

    if (!body?.message?.trim()) {
      return reply.status(400).send({ error: 'message is required' });
    }

    const db = fastify.db;
    const session = await db.queryOne<{ id: string; input: string; status: string }>(
      'SELECT id, input, status FROM sessions WHERE id = $1',
      [id]
    );

    if (!session) {
      return reply.status(404).send({ error: 'Session not found' });
    }

    // Append message to session input history (for record keeping)
    const updatedInput = `${session.input}\n[User]: ${body.message}`;
    await db.query(
      `UPDATE sessions SET input = $1, status = 'running', updated_at = NOW() WHERE id = $2`,
      [updatedInput, id]
    );

    // Resume graph with new message as intent
    runSession(id, body.message, {
      store: postgresSessionStore,
      pool: db.getPool(),
    }).then((result) => {
      console.log(`[API] Session ${id} message handled:`, result.summary?.substring(0, 50));
    }).catch((error) => {
      console.error(`[API] Session ${id} message failed:`, error);
      db.query(
        `UPDATE sessions SET status = 'failed', updated_at = NOW() WHERE id = $1`,
        [id]
      ).catch((_e: unknown) => console.error('Failed to update session status:', _e));
    });

    return {
      sessionId: id,
      status: 'running',
    };
  });

  // GET /sessions/:id/events
  fastify.get('/:id/events', async (request) => {
    const { id } = request.params as { id: string };

    const db = fastify.db;
    const events = await db.query(
      'SELECT * FROM agent_events WHERE session_id = $1 ORDER BY created_at ASC',
      [id]
    );

    return events;
  });

  // PATCH /sessions/:id
  fastify.patch('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Record<string, unknown>;

    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (body.status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(body.status);
    }

    if (body.intent !== undefined) {
      updates.push(`intent = $${paramIndex++}`);
      values.push(body.intent);
    }

    if (body.summary !== undefined) {
      updates.push(`summary = $${paramIndex++}`);
      values.push(body.summary);
    }

    if (body.metadata !== undefined) {
      updates.push(`metadata = $${paramIndex++}`);
      values.push(JSON.stringify(body.metadata));
    }

    if (updates.length === 0) {
      return reply.status(400).send({ error: 'No updates provided' });
    }

    values.push(id);

    const db = fastify.db;
    await db.query(
      `UPDATE sessions SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${paramIndex}`,
      values
    );

    const session = await db.queryOne(
      'SELECT * FROM sessions WHERE id = $1',
      [id]
    );

    return session;
  });

  // POST /sessions/:id/complete
  fastify.post('/:id/complete', async (request) => {
    const { id } = request.params as { id: string };

    const db = fastify.db;
    await db.query(
      `UPDATE sessions SET status = 'completed', ended_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [id]
    );

    const session = await db.queryOne(
      'SELECT * FROM sessions WHERE id = $1',
      [id]
    );

    return session;
  });
}
