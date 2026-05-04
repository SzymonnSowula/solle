import { NextRequest, NextResponse } from 'next/server';
import { getSessionById, updateSession } from '@/lib/db/sessions';
import { executeSession } from '@/lib/orchestration/session-runner';
import { logger } from '@/lib/utils/logger';
import { checkEnv } from '@/lib/utils/env';

const log = logger('run-route');

function envCheck(): NextResponse | null {
  const env = checkEnv();
  if (!env.ok) {
    return NextResponse.json(
      { error: 'Server not configured', missing: env.missing },
      { status: 503 }
    );
  }
  return null;
}

export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  const badEnv = envCheck();
  if (badEnv) return badEnv;

  try {
    const { id } = params;
    const session = await getSessionById(id);

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (!session.input) {
      return NextResponse.json({ error: 'Session has no input' }, { status: 400 });
    }

    // Run asynchronously so the client can poll / stream
    executeSession(id, session.input).catch((err) => {
      log.error(`Background execution failed for ${id}`, err);
      updateSession(id, { status: 'failed' }).catch(() => {});
    });

    return NextResponse.json({ success: true, sessionId: id, status: 'running' });
  } catch (error) {
    console.error('[POST /api/sessions/[id]/run]', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
