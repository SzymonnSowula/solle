import { getPool } from '@/lib/db/postgres';
import { logger } from '@/lib/utils/logger';

const log = logger('accounts-db');

export interface ConnectedAccount {
  id: string;
  userId: string;
  provider: string;
  providerAccountId: string | null;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
  scope: string | null;
  createdAt: Date;
  updatedAt: Date;
  metadata: Record<string, unknown>;
}

export async function getConnectedAccounts(userId: string): Promise<ConnectedAccount[]> {
  const pool = getPool();
  const res = await pool.query(
    `SELECT id, user_id, provider, provider_account_id, access_token, refresh_token,
            expires_at, scope, created_at, updated_at, metadata
     FROM connected_accounts WHERE user_id = $1`,
    [userId]
  );
  return res.rows.map(row => ({
    id: row.id,
    userId: row.user_id,
    provider: row.provider,
    providerAccountId: row.provider_account_id,
    accessToken: row.access_token,
    refreshToken: row.refresh_token,
    expiresAt: row.expires_at,
    scope: row.scope,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    metadata: row.metadata || {},
  }));
}

export async function getConnectedAccount(userId: string, provider: string): Promise<ConnectedAccount | null> {
  const pool = getPool();
  const res = await pool.query(
    `SELECT id, user_id, provider, provider_account_id, access_token, refresh_token,
            expires_at, scope, created_at, updated_at, metadata
     FROM connected_accounts WHERE user_id = $1 AND provider = $2`,
    [userId, provider]
  );
  if (res.rows.length === 0) return null;
  const row = res.rows[0];
  return {
    id: row.id,
    userId: row.user_id,
    provider: row.provider,
    providerAccountId: row.provider_account_id,
    accessToken: row.access_token,
    refreshToken: row.refresh_token,
    expiresAt: row.expires_at,
    scope: row.scope,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    metadata: row.metadata || {},
  };
}

export async function upsertConnectedAccount(account: Omit<ConnectedAccount, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<ConnectedAccount> {
  const pool = getPool();
  const res = await pool.query(
    `INSERT INTO connected_accounts (user_id, provider, provider_account_id, access_token, refresh_token, expires_at, scope, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (user_id, provider)
     DO UPDATE SET
       provider_account_id = EXCLUDED.provider_account_id,
       access_token = EXCLUDED.access_token,
       refresh_token = EXCLUDED.refresh_token,
       expires_at = EXCLUDED.expires_at,
       scope = EXCLUDED.scope,
       metadata = EXCLUDED.metadata,
       updated_at = NOW()
     RETURNING id, user_id, provider, provider_account_id, access_token, refresh_token,
               expires_at, scope, created_at, updated_at, metadata`,
    [
      account.userId,
      account.provider,
      account.providerAccountId,
      account.accessToken,
      account.refreshToken,
      account.expiresAt,
      account.scope,
      JSON.stringify(account.metadata),
    ]
  );
  const row = res.rows[0];
  return {
    id: row.id,
    userId: row.user_id,
    provider: row.provider,
    providerAccountId: row.provider_account_id,
    accessToken: row.access_token,
    refreshToken: row.refresh_token,
    expiresAt: row.expires_at,
    scope: row.scope,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    metadata: row.metadata || {},
  };
}

export async function deleteConnectedAccount(userId: string, provider: string): Promise<void> {
  const pool = getPool();
  await pool.query(
    'DELETE FROM connected_accounts WHERE user_id = $1 AND provider = $2',
    [userId, provider]
  );
  log.info(`Deleted ${provider} account for user ${userId}`);
}
