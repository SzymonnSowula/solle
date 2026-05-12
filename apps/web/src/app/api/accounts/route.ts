import { NextRequest, NextResponse } from 'next/server';
import { getConnectedAccounts, deleteConnectedAccount } from '@/lib/db/accounts';
import { logger } from '@/lib/utils/logger';

const log = logger('accounts-api');

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const accounts = await getConnectedAccounts(userId);

    // Strip sensitive tokens before returning to client
    return NextResponse.json(
      accounts.map((a) => ({
        id: a.id,
        provider: a.provider,
        providerAccountId: a.providerAccountId,
        connected: true,
        expiresAt: a.expiresAt,
        scope: a.scope,
        createdAt: a.createdAt,
      }))
    );
  } catch (error) {
    log.error('Failed to list accounts', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const provider = searchParams.get('provider');

    if (!userId || !provider) {
      return NextResponse.json({ error: 'userId and provider are required' }, { status: 400 });
    }

    await deleteConnectedAccount(userId, provider);
    return NextResponse.json({ success: true });
  } catch (error) {
    log.error('Failed to delete account', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
