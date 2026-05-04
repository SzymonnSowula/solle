import { NextRequest, NextResponse } from 'next/server';
import { getSessionById } from '@/lib/db/sessions';

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const session = await getSessionById(id);

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: session.id,
      input: session.input,
      intent: session.intent,
      status: session.status,
      summary: session.summary,
      estimatedCostSol: session.estimated_cost_sol,
      actualCostSol: session.actual_cost_sol,
      createdAt: session.created_at,
      updatedAt: session.updated_at,
    });
  } catch (error) {
    console.error('[GET /api/sessions/[id]]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
