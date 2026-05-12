import { NextRequest, NextResponse } from 'next/server';
import { getElevenLabsConfig, createElevenLabsAgent } from '@/lib/elevenlabs/session-config';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const sessionId = body.sessionId;
    const requestedAgentId = body.agentId;

    if (!sessionId || typeof sessionId !== 'string') {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }

    const config = getElevenLabsConfig();

    let agentId = requestedAgentId || config.agentId;

    // If no agentId provided, create one dynamically via ElevenLabs API
    if (!agentId) {
      try {
        agentId = await createElevenLabsAgent(config.apiKey);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        console.error('[POST /api/voice/session] Agent creation failed:', msg);
        return NextResponse.json(
          { error: 'Failed to create voice agent', details: msg },
          { status: 500 }
        );
      }
    }

    // SECURITY: Generate a signed URL instead of exposing the raw API key.
    // The signed URL provides a temporary, scoped access token for the WebSocket connection.
    let signedUrl: string | undefined;
    try {
      const signedUrlRes = await fetch(
        `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${agentId}`,
        {
          method: 'GET',
          headers: { 'xi-api-key': config.apiKey },
        }
      );
      if (signedUrlRes.ok) {
        const signedUrlData = await signedUrlRes.json() as { signed_url: string };
        signedUrl = signedUrlData.signed_url;
      }
    } catch (err) {
      console.warn('[POST /api/voice/session] Signed URL generation failed, falling back:', err);
    }

    return NextResponse.json({
      sessionId,
      agentId,
      // SECURITY: Prefer signed URL over raw API key. Only expose apiKey in dev as last resort.
      ...(signedUrl
        ? { signedUrl }
        : process.env.NODE_ENV === 'development'
          ? { apiKey: config.apiKey, _warning: 'Using raw API key — signed URL failed. Do NOT use in production.' }
          : { error: 'Voice configuration failed — signed URL unavailable' }
      ),
      wsUrl: config.wsUrl,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('ElevenLabs API key missing')) {
      return NextResponse.json({ error: 'Voice not configured. Add ELEVENLABS_API_KEY to .env.local' }, { status: 503 });
    }
    console.error('[POST /api/voice/session]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
