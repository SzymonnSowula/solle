import { NextResponse } from 'next/server';
import { getEventsForSession } from '@/lib/db/events';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const events = await getEventsForSession(id);
    return NextResponse.json(events);
  } catch (error) {
    console.error('[GET /api/sessions/[id]/events]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
