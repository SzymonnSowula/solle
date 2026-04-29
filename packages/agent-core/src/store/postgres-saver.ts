import { Pool } from 'pg';
import { RunnableConfig } from '@langchain/core/runnables';
import {
  BaseCheckpointSaver,
  Checkpoint,
  CheckpointTuple,
  CheckpointMetadata,
  CheckpointListOptions,
  PendingWrite,
  ChannelVersions,
} from '@langchain/langgraph-checkpoint';

export class PostgresSaver extends BaseCheckpointSaver {
  private pool: Pool;

  constructor(pool: Pool) {
    super();
    this.pool = pool;
  }

  async getTuple(config: RunnableConfig): Promise<CheckpointTuple | undefined> {
    const threadId = config.configurable?.thread_id as string;
    const checkpointNs = (config.configurable?.checkpoint_ns as string) || '';
    const checkpointId = config.configurable?.checkpoint_id as string | undefined;

    if (!threadId) return undefined;

    let query: string;
    let params: unknown[];

    if (checkpointId) {
      query = `SELECT thread_id, checkpoint_ns, checkpoint_id, parent_checkpoint_id, type, checkpoint, metadata 
               FROM checkpoints 
               WHERE thread_id = $1 AND checkpoint_ns = $2 AND checkpoint_id = $3`;
      params = [threadId, checkpointNs, checkpointId];
    } else {
      query = `SELECT thread_id, checkpoint_ns, checkpoint_id, parent_checkpoint_id, type, checkpoint, metadata 
               FROM checkpoints 
               WHERE thread_id = $1 AND checkpoint_ns = $2 
               ORDER BY checkpoint_id DESC LIMIT 1`;
      params = [threadId, checkpointNs];
    }

    const result = await this.pool.query(query, params);
    const row = result.rows[0];
    if (!row) return undefined;

    return {
      config: {
        configurable: {
          thread_id: row.thread_id,
          checkpoint_ns: row.checkpoint_ns,
          checkpoint_id: row.checkpoint_id,
        },
      },
      checkpoint: row.checkpoint as Checkpoint,
      metadata: row.metadata as CheckpointMetadata,
      parentConfig: row.parent_checkpoint_id
        ? {
            configurable: {
              thread_id: row.thread_id,
              checkpoint_ns: row.checkpoint_ns,
              checkpoint_id: row.parent_checkpoint_id,
            },
          }
        : undefined,
    };
  }

  async *list(
    config: RunnableConfig,
    options?: CheckpointListOptions
  ): AsyncGenerator<CheckpointTuple> {
    const threadId = config.configurable?.thread_id as string;
    const checkpointNs = (config.configurable?.checkpoint_ns as string) || '';

    let query = `SELECT thread_id, checkpoint_ns, checkpoint_id, parent_checkpoint_id, type, checkpoint, metadata 
                 FROM checkpoints 
                 WHERE thread_id = $1 AND checkpoint_ns = $2`;
    const params: unknown[] = [threadId, checkpointNs];

    if (options?.before) {
      query += ` AND checkpoint_id < $3`;
      params.push(options.before.configurable?.checkpoint_id as string);
    }

    query += ` ORDER BY checkpoint_id DESC`;

    if (options?.limit) {
      query += ` LIMIT $${params.length + 1}`;
      params.push(options.limit);
    }

    const result = await this.pool.query(query, params);
    for (const row of result.rows) {
      yield {
        config: {
          configurable: {
            thread_id: row.thread_id,
            checkpoint_ns: row.checkpoint_ns,
            checkpoint_id: row.checkpoint_id,
          },
        },
        checkpoint: row.checkpoint as Checkpoint,
        metadata: row.metadata as CheckpointMetadata,
        parentConfig: row.parent_checkpoint_id
          ? {
              configurable: {
                thread_id: row.thread_id,
                checkpoint_ns: row.checkpoint_ns,
                checkpoint_id: row.parent_checkpoint_id,
              },
            }
          : undefined,
      };
    }
  }

  async put(
    config: RunnableConfig,
    checkpoint: Checkpoint,
    metadata: CheckpointMetadata,
    _newVersions: ChannelVersions
  ): Promise<RunnableConfig> {
    const threadId = config.configurable?.thread_id as string;
    const checkpointNs = (config.configurable?.checkpoint_ns as string) || '';
    const parentCheckpointId = config.configurable?.checkpoint_id as string | undefined;

    await this.pool.query(
      `INSERT INTO checkpoints (thread_id, checkpoint_ns, checkpoint_id, parent_checkpoint_id, type, checkpoint, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (thread_id, checkpoint_ns, checkpoint_id) DO UPDATE SET
         parent_checkpoint_id = EXCLUDED.parent_checkpoint_id,
         type = EXCLUDED.type,
         checkpoint = EXCLUDED.checkpoint,
         metadata = EXCLUDED.metadata`,
      [
        threadId,
        checkpointNs,
        checkpoint.id,
        parentCheckpointId || null,
        'checkpoint',
        JSON.stringify(checkpoint),
        JSON.stringify(metadata),
      ]
    );

    return {
      configurable: {
        thread_id: threadId,
        checkpoint_ns: checkpointNs,
        checkpoint_id: checkpoint.id,
      },
    };
  }

  async putWrites(
    config: RunnableConfig,
    writes: PendingWrite[],
    taskId: string
  ): Promise<void> {
    const threadId = config.configurable?.thread_id as string;
    const checkpointNs = (config.configurable?.checkpoint_ns as string) || '';
    const checkpointId = config.configurable?.checkpoint_id as string;

    // Store writes in metadata for now; advanced implementations may use a separate writes table
    if (!checkpointId) return;

    await this.pool.query(
      `UPDATE checkpoints 
       SET metadata = jsonb_set(
         metadata,
         '{writes}',
         COALESCE(metadata->'writes', '{}'::jsonb) || $4::jsonb
       )
       WHERE thread_id = $1 AND checkpoint_ns = $2 AND checkpoint_id = $3`,
      [
        threadId,
        checkpointNs,
        checkpointId,
        JSON.stringify({ [taskId]: writes }),
      ]
    );
  }
}
