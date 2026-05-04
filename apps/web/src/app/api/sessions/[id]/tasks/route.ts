import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db/postgres';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const result = await getPool().query(
      `SELECT id, agent_name, tool_name, status, cost_sol, created_at
       FROM tasks
       WHERE session_id = $1
       ORDER BY created_at ASC`,
      [id]
    );
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('[GET /api/sessions/[id]/tasks]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
