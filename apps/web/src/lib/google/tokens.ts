import { getPool } from '@/lib/db/postgres';
import { logger } from '@/lib/utils/logger';

const log = logger('google-tokens');

export interface GoogleTokens {
  accessToken: string;
  refreshToken: string | null;
}

export async function getGoogleTokensForSession(sessionId: string): Promise<GoogleTokens | null> {
  try {
    const pool = getPool();

    // Find the user for this session
    const sessionRes = await pool.query(
      'SELECT user_id FROM sessions WHERE id = $1',
      [sessionId]
    );
    const userId = sessionRes.rows[0]?.user_id;

    if (!userId || userId === 'anonymous') {
      log.info(`Session ${sessionId} has no user, skipping Google token lookup`);
      return null;
    }

    // Find connected Google account
    const accountRes = await pool.query(
      'SELECT access_token, refresh_token FROM connected_accounts WHERE user_id = $1 AND provider = $2',
      [userId, 'google']
    );

    if (accountRes.rows.length === 0) {
      log.info(`No Google account connected for user ${userId}`);
      return null;
    }

    return {
      accessToken: accountRes.rows[0].access_token,
      refreshToken: accountRes.rows[0].refresh_token,
    };
  } catch (error) {
    log.error('Failed to get Google tokens', error);
    return null;
  }
}
