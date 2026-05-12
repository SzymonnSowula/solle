import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { exchangeGoogleCode } from '@/lib/google/oauth';
import { upsertConnectedAccount } from '@/lib/db/accounts';
import { logger } from '@/lib/utils/logger';

const log = logger('auth-google-callback');

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const stateParam = searchParams.get('state');

    if (error) {
      log.warn(`Google OAuth error: ${error}`);
      return NextResponse.redirect(new URL('/settings/accounts?error=' + encodeURIComponent(error), request.url));
    }

    if (!code || !stateParam) {
      return NextResponse.redirect(new URL('/settings/accounts?error=missing_code_or_state', request.url));
    }

    let state: { userId: string; nonce: string };
    try {
      state = JSON.parse(Buffer.from(stateParam, 'base64url').toString('utf-8'));
    } catch {
      return NextResponse.redirect(new URL('/settings/accounts?error=invalid_state', request.url));
    }

    const { accessToken, refreshToken, expiryDate, scope } = await exchangeGoogleCode(code);

    await upsertConnectedAccount({
      userId: state.userId,
      provider: 'google',
      providerAccountId: null,
      accessToken,
      refreshToken,
      expiresAt: expiryDate ? new Date(expiryDate) : null,
      scope,
      metadata: {},
    });

    log.info(`Connected Google account for user ${state.userId}`);
    return NextResponse.redirect(new URL('/settings/accounts?success=google_connected', request.url));
  } catch (error) {
    log.error('Google callback failed', error);
    const msg = error instanceof Error ? error.message : 'unknown';
    return NextResponse.redirect(new URL('/settings/accounts?error=' + encodeURIComponent(msg), request.url));
  }
}
