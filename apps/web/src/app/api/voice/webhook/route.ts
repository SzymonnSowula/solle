import { NextRequest, NextResponse } from 'next/server';
import { createSession, getSessionById } from '@/lib/db/sessions';
import { executeSession, continueSession } from '@/lib/orchestration/session-runner';
import { getEventsForSession } from '@/lib/db/events';
import { logger } from '@/lib/utils/logger';

const log = logger('voice-webhook');

function verifyWebhookSecret(request: NextRequest): boolean {
  const secret = process.env.ELEVENLABS_WEBHOOK_SECRET;
  if (!secret) {
    // SECURITY: Deny all requests when webhook secret is not configured
    console.error('[Voice Webhook] ELEVENLABS_WEBHOOK_SECRET not set — rejecting all webhook requests');
    return false;
  }
  const header = request.headers.get('x-elevenlabs-secret') || request.headers.get('X-ElevenLabs-Secret');
  // SECURITY: Use timing-safe comparison to prevent timing attacks
  if (!header) return false;
  if (header.length !== secret.length) return false;
  let result = 0;
  for (let i = 0; i < header.length; i++) {
    result |= header.charCodeAt(i) ^ secret.charCodeAt(i);
  }
  return result === 0;
}

/**
 * ElevenLabs Dashboard Webhook
 *
 * This endpoint receives tool calls from ElevenLabs when configured
 * as a "server tool" / webhook in the ElevenLabs ConvAI dashboard.
 *
 * Expected payload (flexible):
 * {
 *   tool_name: "create_session" | "send_message" | "get_session_status" | "get_session_events",
 *   parameters: { ... },
 *   tool_call_id?: string
 * }
 *
 * Returns:
 * {
 *   result: { success: boolean, ... }
 * }
 */
export async function POST(request: NextRequest) {
  if (!verifyWebhookSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      tool_name?: string;
      parameters?: Record<string, unknown>;
      tool_call_id?: string;
    };

    const toolName = body.tool_name;
    const params = body.parameters || {};

    log.info(`Webhook tool call: ${toolName}`, params);

    switch (toolName) {
      case 'create_session': {
        const userInput = params.input as string;
        const wallet = params.wallet as string | undefined;

        if (!userInput || typeof userInput !== 'string') {
          return NextResponse.json({ result: { success: false, error: 'input is required' } });
        }

        const session = await createSession({
          input: userInput,
          userId: wallet || 'anonymous',
        });

        executeSession(session.id, userInput).catch((err) => {
          log.error(`Webhook-initiated session ${session.id} failed`, err);
        });

        return NextResponse.json({
          result: {
            success: true,
            sessionId: session.id,
            status: session.status,
            message: `Session created. ID: ${session.id.slice(0, 8)}. Working on it now.`,
          },
        });
      }

      case 'send_message': {
        const sessionId = params.sessionId as string;
        const message = params.message as string;

        if (!sessionId) {
          return NextResponse.json({ result: { success: false, error: 'sessionId is required' } });
        }
        if (!message || typeof message !== 'string') {
          return NextResponse.json({ result: { success: false, error: 'message is required' } });
        }

        const session = await getSessionById(sessionId);
        if (!session) {
          return NextResponse.json({ result: { success: false, error: 'Session not found' } });
        }

        if (!['clarifying', 'created', 'running'].includes(session.status)) {
          return NextResponse.json({
            result: { success: false, error: `Session is already ${session.status}` },
          });
        }

        continueSession(sessionId, message).catch((err) => {
          log.error(`Webhook continuation for ${sessionId} failed`, err);
        });

        return NextResponse.json({
          result: {
            success: true,
            sessionId,
            status: 'running',
            message: 'Message received. Processing...',
          },
        });
      }

      case 'get_session_status': {
        const sessionId = params.sessionId as string;
        if (!sessionId) {
          return NextResponse.json({ result: { success: false, error: 'sessionId is required' } });
        }

        const session = await getSessionById(sessionId);
        if (!session) {
          return NextResponse.json({ result: { success: false, error: 'Session not found' } });
        }

        return NextResponse.json({
          result: {
            success: true,
            sessionId: session.id,
            status: session.status,
            intent: session.intent,
            summary: session.summary,
            estimatedCostSol: session.estimated_cost_sol,
            actualCostSol: session.actual_cost_sol,
            message: session.summary
              ? `Session is ${session.status}. Summary: ${session.summary}`
              : `Session is ${session.status}.`,
          },
        });
      }

      case 'get_session_events': {
        const sessionId = params.sessionId as string;
        if (!sessionId) {
          return NextResponse.json({ result: { success: false, error: 'sessionId is required' } });
        }

        const events = await getEventsForSession(sessionId);
        const timeline = events.slice(-8).map((e) => ({
          agent: e.agent_name,
          type: e.event_type,
          content: e.content,
        }));

        const textSummary = timeline
          .map((e) => `${e.agent}: ${e.content || e.type}`)
          .join('. ');

        return NextResponse.json({
          result: {
            success: true,
            sessionId,
            events: timeline,
            message: textSummary || 'No events yet.',
          },
        });
      }

      default:
        return NextResponse.json({ result: { success: false, error: `Unknown tool: ${toolName}` } });
    }
  } catch (error) {
    console.error('[POST /api/voice/webhook]', error);
    return NextResponse.json(
      { result: { success: false, error: error instanceof Error ? error.message : 'Unknown' } },
      { status: 500 }
    );
  }
}
