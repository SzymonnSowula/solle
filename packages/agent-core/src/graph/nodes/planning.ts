import { SessionState, AgentName } from '../index';
import { SessionStore } from '../../store';
import { createChatModel } from '../../llm';

interface CalendarAction {
  action: 'list' | 'create' | 'update' | 'delete';
  eventId?: string;
  summary?: string;
  description?: string;
  startTime?: string;
  endTime?: string;
  attendees?: string[];
}

function getGoogleWorkerUrl(): string {
  return process.env.WORKER_GOOGLE_URL || 'http://localhost:3003';
}

export async function planningNode(
  state: SessionState,
  store: SessionStore
): Promise<Partial<SessionState>> {
  const agentHistory = [...state.agentHistory];

  agentHistory.push({
    agentName: 'planning',
    eventType: 'started',
    content: `Starting planning agent for: "${state.userIntent}"`,
    timestamp: new Date(),
  });

  await store.addEvent({
    sessionId: state.sessionId,
    agentName: 'planning',
    eventType: 'started',
    content: `Starting planning agent for: "${state.userIntent}"`,
  });

  // Use LLM to extract Calendar action and parameters
  let extractedAction: CalendarAction;
  try {
    const model = createChatModel({ temperature: 0.2 });
    const prompt = `Extract the Calendar action and parameters from the user request.

Available actions: list, create, update, delete.

User request: "${state.userIntent}"

Respond with a JSON object containing:
- action: one of [list, create, update, delete]
- eventId: string (for update/delete, if mentioned)
- summary: string (event title, for create/update)
- description: string (event description, for create/update)
- startTime: ISO string (for create/update)
- endTime: ISO string (for create/update)
- attendees: array of email strings (optional)

Use current date/time if not specified. Respond with JSON only.`;

    const response = await model.invoke(prompt);
    const text = String(response.content).trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    extractedAction = JSON.parse(jsonMatch ? jsonMatch[0] : text);
  } catch (error) {
    console.error('[Planning] Failed to extract action via LLM:', error);
    extractedAction = { action: 'list' };
  }

  const toolResults = new Map(state.toolResults);
  let pendingApprovals = [...state.pendingApprovals];

  // Mutating actions require approval
  if (extractedAction.action === 'create' || extractedAction.action === 'update' || extractedAction.action === 'delete') {
    const approvalId = crypto.randomUUID();
    const actionDesc = extractedAction.action === 'create'
      ? `create event "${extractedAction.summary}"`
      : extractedAction.action === 'update'
        ? `update event ${extractedAction.eventId || ''}`
        : `delete event ${extractedAction.eventId || ''}`;

    pendingApprovals.push({
      id: approvalId,
      agentName: 'planning',
      taskId: `planning_${Date.now()}`,
      message: `Approve ${actionDesc}?`,
      toolName: `calendar_${extractedAction.action}`,
      args: extractedAction as unknown as Record<string, unknown>,
      createdAt: new Date(),
      status: 'pending',
    });

    agentHistory.push({
      agentName: 'planning',
      eventType: 'approval_required',
      content: `Approval required for ${actionDesc}`,
      timestamp: new Date(),
    });

    await store.addEvent({
      sessionId: state.sessionId,
      agentName: 'planning',
      eventType: 'approval_required',
      content: `Approval required for ${actionDesc}`,
    });

    return {
      agentHistory,
      toolResults,
      currentAgent: 'summary' as AgentName,
      requiresApproval: true,
      pendingApprovals,
    };
  }

  // Non-mutating: list - execute immediately
  try {
    agentHistory.push({
      agentName: 'planning',
      eventType: 'tool_call',
      content: `Calling Calendar ${extractedAction.action}`,
      timestamp: new Date(),
    });

    await store.addEvent({
      sessionId: state.sessionId,
      agentName: 'planning',
      eventType: 'tool_call',
      content: `Calling Calendar ${extractedAction.action}`,
    });

    const response = await fetch(`${getGoogleWorkerUrl()}/calendar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: extractedAction.action,
        eventId: extractedAction.eventId,
        summary: extractedAction.summary,
        description: extractedAction.description,
        startTime: extractedAction.startTime,
        endTime: extractedAction.endTime,
        attendees: extractedAction.attendees,
        requestId: crypto.randomUUID(),
      }),
    });

    if (!response.ok) {
      throw new Error(`Calendar worker error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json() as { data?: unknown; success?: boolean };
    console.log('[Planning] Calendar result:', JSON.stringify(result, null, 2));

    toolResults.set('planning_' + Date.now(), {
      action: extractedAction.action,
      status: 'completed',
      result: result.data,
      timestamp: new Date(),
    });

    agentHistory.push({
      agentName: 'planning',
      eventType: 'tool_result',
      content: `Calendar ${extractedAction.action} completed`,
      timestamp: new Date(),
    });

    await store.addEvent({
      sessionId: state.sessionId,
      agentName: 'planning',
      eventType: 'tool_result',
      content: `Calendar ${extractedAction.action} completed`,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Planning] Calendar action failed:', errorMessage);

    toolResults.set('planning_' + Date.now(), {
      action: extractedAction.action,
      status: 'failed',
      error: errorMessage,
      timestamp: new Date(),
    });

    agentHistory.push({
      agentName: 'planning',
      eventType: 'failed',
      content: `Calendar ${extractedAction.action} failed: ${errorMessage}`,
      timestamp: new Date(),
    });

    await store.addEvent({
      sessionId: state.sessionId,
      agentName: 'planning',
      eventType: 'failed',
      content: `Calendar ${extractedAction.action} failed: ${errorMessage}`,
    });
  }

  agentHistory.push({
    agentName: 'planning',
    eventType: 'completed',
    content: 'Planning completed successfully',
    timestamp: new Date(),
  });

  await store.addEvent({
    sessionId: state.sessionId,
    agentName: 'planning',
    eventType: 'completed',
    content: 'Planning completed successfully',
  });

  return {
    agentHistory,
    toolResults,
    currentAgent: 'summary' as AgentName,
    requiresApproval: false,
    pendingApprovals,
  };
}
