import { FastifyInstance } from 'fastify';

export async function receiptsRoutes(fastify: FastifyInstance) {
  fastify.post('/', async (request, reply) => {
    const body = request.body as {
      sessionId: string;
      receiptType: string;
      agentName: string;
      taskId?: string;
      inputHash: string;
      outputHash: string;
      executionTimeMs?: number;
      costUnits?: number;
      metadata?: Record<string, unknown>;
    };

    if (
      !body.sessionId ||
      !body.receiptType ||
      !body.agentName ||
      !body.inputHash ||
      !body.outputHash
    ) {
      return reply.status(400).send({
        error: 'sessionId, receiptType, agentName, inputHash, and outputHash are required',
      });
    }

    const id = crypto.randomUUID();
    const db = fastify.db;

    await db.query(
      `INSERT INTO receipts (id, session_id, receipt_type, agent_name, task_id, input_hash, output_hash, execution_time_ms, cost_units, status, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())`,
      [
        id,
        body.sessionId,
        body.receiptType,
        body.agentName,
        body.taskId || null,
        body.inputHash,
        body.outputHash,
        body.executionTimeMs || null,
        body.costUnits || null,
        'pending',
        JSON.stringify(body.metadata || {}),
      ]
    );

    return reply.status(201).send({ id, ...body });
  });

  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const db = fastify.db;
    const receipt = await db.queryOne(
      'SELECT * FROM receipts WHERE id = $1',
      [id]
    );

    if (!receipt) {
      return reply.status(404).send({ error: 'Receipt not found' });
    }

    return receipt;
  });

  fastify.get('/session/:sessionId', async (request) => {
    const { sessionId } = request.params as { sessionId: string };

    const db = fastify.db;
    const receipts = await db.query(
      'SELECT * FROM receipts WHERE session_id = $1 ORDER BY created_at DESC',
      [sessionId]
    );

    return receipts;
  });

  fastify.patch('/:id/confirm', async (request) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      onChainTxid?: string;
      signature?: string;
    };

    const db = fastify.db;

    const updates: string[] = ['status = $1'];
    const values: unknown[] = ['confirmed'];
    let paramIndex = 2;

    if (body.onChainTxid) {
      updates.push(`on_chain_txid = $${paramIndex++}`);
      values.push(body.onChainTxid);
    }

    if (body.signature) {
      updates.push(`signature = $${paramIndex++}`);
      values.push(body.signature);
    }

    values.push(id);

    await db.query(
      `UPDATE receipts SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
      values
    );

    const receipt = await db.queryOne(
      'SELECT * FROM receipts WHERE id = $1',
      [id]
    );

    return receipt;
  });

  fastify.get('/:id/verify', async (request, reply) => {
    const { id } = request.params as { id: string };

    const db = fastify.db;
    const receipt = await db.queryOne<{ on_chain_txid?: string }>(
      'SELECT on_chain_txid FROM receipts WHERE id = $1',
      [id]
    );

    if (!receipt) {
      return reply.status(404).send({ error: 'Receipt not found' });
    }

    if (!receipt.on_chain_txid) {
      return reply.status(400).send({ error: 'Receipt has no on-chain txid' });
    }

    const result = await fastify.receipts.verifyOnChain(receipt.on_chain_txid);
    return result;
  });
}
