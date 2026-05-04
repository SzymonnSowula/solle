import { NextRequest, NextResponse } from 'next/server';
import { getElevenLabsConfig } from '@/lib/elevenlabs/session-config';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const sessionId = body.sessionId;

    if (!sessionId || typeof sessionId !== 'string') {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }

    const config = getElevenLabsConfig();

    // TODO: Implement signed URL generation for production instead of exposing apiKey
    return NextResponse.json({
      sessionId,
      agentId: config.agentId,
      apiKey: config.apiKey,
      wsUrl: config.wsUrl,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('ElevenLabs configuration missing')) {
      return NextResponse.json({ error: 'Voice not configured' }, { status: 503 });
    }
    console.error('[POST /api/voice/session]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
