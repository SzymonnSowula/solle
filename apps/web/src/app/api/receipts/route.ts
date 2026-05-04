import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionById } from '@/lib/db/sessions';
import { getPool } from '@/lib/db/postgres';

const ReceiptSchema = z.object({
  sessionId: z.string().uuid(),
  wallet: z.string().min(1),
});

const ReceiptUpdateSchema = z.object({
  sessionId: z.string().uuid(),
  signature: z.string().min(1),
  hash: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = ReceiptSchema.parse(body);

    const session = await getSessionById(parsed.sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const { hashData } = await import('@/lib/utils/hash');
    const timestamp = new Date().toISOString();
    const hash = await hashData({
      sessionId: parsed.sessionId,
      input: session.input || '',
      summary: session.summary || '',
      timestamp,
    });

    return NextResponse.json({
      sessionId: parsed.sessionId,
      hash,
      input: session.input,
      summary: session.summary,
      timestamp,
      wallet: parsed.wallet,
      message: 'Sign this hash on-chain to save the receipt.',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 });
    }
    console.error('[POST /api/receipts]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = ReceiptUpdateSchema.parse(body);

    const pool = getPool();
    await pool.query(
      `UPDATE receipts SET signature = $1, status = 'confirmed', updated_at = NOW()
       WHERE session_id = $2`,
      [parsed.signature, parsed.sessionId]
    );

    return NextResponse.json({ success: true, signature: parsed.signature });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 });
    }
    console.error('[PUT /api/receipts]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
