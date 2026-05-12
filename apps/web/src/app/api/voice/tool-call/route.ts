import { NextRequest, NextResponse } from 'next/server';
import { createSession, getSessionById, updateSession } from '@/lib/db/sessions';
import { addEvent } from '@/lib/db/events';
import { executeSession, continueSession } from '@/lib/orchestration/session-runner';
import { desktopAgent } from '@/lib/agents/desktop-agent';
import { logger } from '@/lib/utils/logger';

const log = logger('voice-tool-call');

function makeStore() {
  return {
    updateSession,
    addEvent: async (event: { sessionId: string; agentName: string; eventType: string; content?: string; metadata?: Record<string, unknown> }) => {
      await addEvent({
        sessionId: event.sessionId,
        agentName: event.agentName,
        eventType: event.eventType,
        content: event.content,
        metadata: event.metadata,
      });
    },
    addTask: async () => {},
  };
}

interface ToolCallBody {
  toolName: string;
  parameters: Record<string, unknown>;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ToolCallBody;
    const { toolName, parameters } = body;

    log.info(`Voice tool call: ${toolName}`, parameters);

    switch (toolName) {
      case 'create_session': {
        const userInput = parameters.input as string;
        if (!userInput || typeof userInput !== 'string') {
          return NextResponse.json({ error: 'input is required' }, { status: 400 });
        }

        const session = await createSession({ input: userInput });

        // Start execution in background
        executeSession(session.id, userInput).catch((err) => {
          log.error(`Voice-initiated session ${session.id} failed`, err);
        });

        return NextResponse.json({
          success: true,
          sessionId: session.id,
          status: session.status,
          message: `Session created. ID: ${session.id.slice(0, 8)}`,
        });
      }

      case 'send_message': {
        const sessionId = parameters.sessionId as string;
        const message = parameters.message as string;

        if (!sessionId || typeof sessionId !== 'string') {
          return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
        }
        if (!message || typeof message !== 'string') {
          return NextResponse.json({ error: 'message is required' }, { status: 400 });
        }

        const session = await getSessionById(sessionId);
        if (!session) {
          return NextResponse.json({ error: 'Session not found' }, { status: 404 });
        }

        if (!['clarifying', 'created', 'running'].includes(session.status)) {
          return NextResponse.json(
            { error: `Session is ${session.status}` },
            { status: 409 }
          );
        }

        continueSession(sessionId, message).catch((err) => {
          log.error(`Voice continuation for ${sessionId} failed`, err);
        });

        return NextResponse.json({
          success: true,
          sessionId,
          status: 'running',
          message: 'Message sent. Processing...',
        });
      }

      case 'get_session_status': {
        const sessionId = parameters.sessionId as string;
        if (!sessionId) {
          return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
        }

        const session = await getSessionById(sessionId);
        if (!session) {
          return NextResponse.json({ error: 'Session not found' }, { status: 404 });
        }

        return NextResponse.json({
          success: true,
          sessionId: session.id,
          status: session.status,
          intent: session.intent,
          summary: session.summary,
          estimatedCostSol: session.estimated_cost_sol,
          actualCostSol: session.actual_cost_sol,
        });
      }

      case 'get_session_events': {
        const sessionId = parameters.sessionId as string;
        if (!sessionId) {
          return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
        }

        const { getEventsForSession } = await import('@/lib/db/events');
        const events = await getEventsForSession(sessionId);

        // Return simplified timeline for voice
        const timeline = events.slice(-10).map((e) => ({
          agent: e.agent_name,
          type: e.event_type,
          content: e.content,
        }));

        return NextResponse.json({
          success: true,
          sessionId,
          events: timeline,
        });
      }

      case 'execute_desktop_plan': {
        const userInput = parameters.input as string;
        if (!userInput || typeof userInput !== 'string') {
          return NextResponse.json({ error: 'input is required' }, { status: 400 });
        }

        const session = await createSession({ input: userInput });
        const store = makeStore();

        // Generate desktop plan synchronously for voice UX
        const plan = await desktopAgent(session.id, userInput, store);

        return NextResponse.json({
          success: true,
          sessionId: session.id,
          plan,
          message: `I prepared a plan to organize your desktop: ${plan.summary}`,
        });
      }

      default:
        return NextResponse.json({ error: `Unknown tool: ${toolName}` }, { status: 400 });
    }
  } catch (error) {
    console.error('[POST /api/voice/tool-call]', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
