import { Pool, PoolClient } from 'pg';
import { getEnv, getEnvOptional } from '@/lib/utils/env';
import { logger } from '@/lib/utils/logger';

const log = logger('postgres');

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    const connectionString = getEnv('DATABASE_URL');
    pool = new Pool({ 
      connectionString,
      connectionTimeoutMillis: 5000,
      query_timeout: 10000,
    });
    pool.on('error', (err) => {
      log.error('Unexpected postgres pool error', err);
    });
    log.info('Postgres pool created');
  }
  return pool;
}

export async function checkPostgres(): Promise<{ ok: boolean; error?: string }> {
  try {
    const client = await getPool().connect();
    await client.query('SELECT 1');
    client.release();
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown';
    return { ok: false, error: msg };
  }
}

export async function withClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}
