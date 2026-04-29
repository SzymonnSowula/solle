import { FastifyInstance } from 'fastify';
import { runSession } from '@solli/agent-core';
import { postgresSessionStore } from '../services/session-store';

export async function agentsRoutes(fastify: FastifyInstance) {
  fastify.post('/trigger', async (request, reply) => {
    const body = request.body as {
      sessionId: string;
      userIntent: string;
    };

    if (!body.sessionId || !body.userIntent) {
      return reply.status(400).send({
        error: 'sessionId and userIntent are required',
      });
    }

    try {
      const db = fastify.db;
      const result = await runSession(body.sessionId, body.userIntent, {
        store: postgresSessionStore,
        pool: db.getPool(),
      });

      return {
        success: true,
        result,
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Agent execution failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  fastify.post('/approve', async (request, reply) => {
    const body = request.body as {
      sessionId: string;
      approvalId: string;
      approved: boolean;
      notes?: string;
    };

    if (!body.sessionId || !body.approvalId) {
      return reply.status(400).send({
        error: 'sessionId and approvalId are required',
      });
    }

    try {
      const db = fastify.db;
      const result = await runSession(body.sessionId, '', {
        store: postgresSessionStore,
        pool: db.getPool(),
        resumeConfig: {
          approvalId: body.approvalId,
          approved: body.approved,
          additionalArgs: body.notes ? { notes: body.notes } : undefined,
        },
      });

      return { success: true, result };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Approval handling failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  fastify.get('/state/:sessionId', async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };

    try {
      const db = fastify.db;
      // Get latest checkpoint for the session
      const checkpoint = await db.queryOne(
        'SELECT checkpoint FROM checkpoints WHERE thread_id = $1 ORDER BY checkpoint_id DESC LIMIT 1',
        [sessionId]
      );

      if (!checkpoint) {
        return reply.status(404).send({ error: 'Session state not found' });
      }

      return {
        sessionId,
        checkpoint: checkpoint.checkpoint,
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Failed to get session state',
      });
    }
  });
}
