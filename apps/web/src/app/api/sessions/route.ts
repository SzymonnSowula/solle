import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createSession, listRecentSessions } from '@/lib/db/sessions';
import { checkEnv } from '@/lib/utils/env';

const CreateSessionSchema = z.object({
  input: z.string().min(1),
  userId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

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

export async function POST(request: NextRequest) {
  const badEnv = envCheck();
  if (badEnv) return badEnv;

  try {
    const body = await request.json();
    const parsed = CreateSessionSchema.parse(body);

    const session = await createSession({
      userId: parsed.userId,
      input: parsed.input,
      metadata: parsed.metadata,
    });

    return NextResponse.json({
      id: session.id,
      input: session.input,
      status: session.status,
      estimatedCostSol: session.estimated_cost_sol,
      actualCostSol: session.actual_cost_sol,
      createdAt: session.created_at,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 });
    }
    console.error('[POST /api/sessions]', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

export async function GET() {
  const badEnv = envCheck();
  if (badEnv) return badEnv;

  try {
    const sessions = await listRecentSessions(20);
    return NextResponse.json(
      sessions.map((s) => ({
        id: s.id,
        input: s.input,
        status: s.status,
        intent: s.intent,
        summary: s.summary,
        estimatedCostSol: s.estimated_cost_sol,
        actualCostSol: s.actual_cost_sol,
        createdAt: s.created_at,
      }))
    );
  } catch (error) {
    console.error('[GET /api/sessions]', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
