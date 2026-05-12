import { NextRequest, NextResponse } from 'next/server';
import { getGoogleAuthUrl } from '@/lib/google/oauth';
import { logger } from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

const log = logger('auth-google');

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    // Encode userId in state so callback knows who this is for
    const state = Buffer.from(JSON.stringify({ userId, nonce: crypto.randomUUID() })).toString('base64url');
    const url = getGoogleAuthUrl(state);

    log.info(`Generated Google auth URL for user ${userId}`);
    return NextResponse.json({ url });
  } catch (error) {
    log.error('Failed to generate auth URL', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
