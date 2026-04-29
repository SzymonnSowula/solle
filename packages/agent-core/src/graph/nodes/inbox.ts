import { SessionState, AgentName } from '../index';
import { SessionStore } from '../../store';
import { createChatModel } from '../../llm';

interface GmailAction {
  action: 'list' | 'read' | 'draft' | 'send';
  messageId?: string;
  to?: string;
  subject?: string;
  body?: string;
  threadId?: string;
}

function getGoogleWorkerUrl(): string {
  return process.env.WORKER_GOOGLE_URL || 'http://localhost:3003';
}

export async function inboxNode(
  state: SessionState,
  store: SessionStore
): Promise<Partial<SessionState>> {
  const agentHistory = [...state.agentHistory];

  agentHistory.push({
    agentName: 'inbox',
    eventType: 'started',
    content: `Starting inbox agent for: "${state.userIntent}"`,
    timestamp: new Date(),
  });

  await store.addEvent({
    sessionId: state.sessionId,
    agentName: 'inbox',
    eventType: 'started',
    content: `Starting inbox agent for: "${state.userIntent}"`,
  });

  // Use LLM to extract Gmail action and parameters from user intent
  let extractedAction: GmailAction;
  try {
    const model = createChatModel({ temperature: 0.2 });
    const prompt = `Extract the Gmail action and parameters from the user request.

Available actions: list, read, draft, send.

User request: "${state.userIntent}"

Respond with a JSON object containing:
- action: one of [list, read, draft, send]
- messageId: string (for read action, if mentioned)
- to: string (recipient email, for draft/send)
- subject: string (email subject, for draft/send)
- body: string (email body, for draft/send)
- threadId: string (optional thread ID)

If information is missing, include null for that field. Respond with JSON only.`;

    const response = await model.invoke(prompt);
    const text = String(response.content).trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    extractedAction = JSON.parse(jsonMatch ? jsonMatch[0] : text);
  } catch (error) {
    console.error('[Inbox] Failed to extract action via LLM:', error);
    // Fallback: assume list if no clear action
    extractedAction = { action: 'list' };
  }

  const toolResults = new Map(state.toolResults);
  let pendingApprovals = [...state.pendingApprovals];
  let requiresApproval = false;

  // Actions that modify state require approval
  if (extractedAction.action === 'send' || extractedAction.action === 'draft') {
    if (!extractedAction.to || !extractedAction.subject) {
      // Missing critical info — ask for approval (which will include a clarifying question)
      const approvalId = crypto.randomUUID();
      pendingApprovals.push({
        id: approvalId,
        agentName: 'inbox',
        taskId: `inbox_${Date.now()}`,
        message: `I need more info to ${extractedAction.action} an email. Recipient: ${extractedAction.to || 'missing'}, Subject: ${extractedAction.subject || 'missing'}. Please provide the missing details.`,
        toolName: `gmail_${extractedAction.action}`,
        args: extractedAction,
        createdAt: new Date(),
        status: 'pending',
      });

      agentHistory.push({
        agentName: 'inbox',
        eventType: 'approval_required',
        content: `Missing info for ${extractedAction.action} email`,
        timestamp: new Date(),
      });

      await store.addEvent({
        sessionId: state.sessionId,
        agentName: 'inbox',
        eventType: 'approval_required',
        content: `Missing info for ${extractedAction.action} email`,
      });

      return {
        agentHistory,
        toolResults,
        currentAgent: 'summary' as AgentName,
        requiresApproval: true,
        pendingApprovals,
      };
    }

    // Has all info, but send/draft still requires explicit approval
    const approvalId = crypto.randomUUID();
    pendingApprovals.push({
      id: approvalId,
      agentName: 'inbox',
      taskId: `inbox_${Date.now()}`,
      message: `Approve ${extractedAction.action} email to ${extractedAction.to} with subject "${extractedAction.subject}"?`,
      toolName: `gmail_${extractedAction.action}`,
      args: extractedAction,
      createdAt: new Date(),
      status: 'pending',
    });

    agentHistory.push({
      agentName: 'inbox',
      eventType: 'approval_required',
      content: `Approval required for ${extractedAction.action} email to ${extractedAction.to}`,
      timestamp: new Date(),
    });

    await store.addEvent({
      sessionId: state.sessionId,
      agentName: 'inbox',
      eventType: 'approval_required',
      content: `Approval required for ${extractedAction.action} email to ${extractedAction.to}`,
    });

    return {
      agentHistory,
      toolResults,
      currentAgent: 'summary' as AgentName,
      requiresApproval: true,
      pendingApprovals,
    };
  }

  // Non-mutating actions: list, read — execute immediately
  try {
    agentHistory.push({
      agentName: 'inbox',
      eventType: 'tool_call',
      content: `Calling Gmail ${extractedAction.action}`,
      timestamp: new Date(),
    });

    await store.addEvent({
      sessionId: state.sessionId,
      agentName: 'inbox',
      eventType: 'tool_call',
      content: `Calling Gmail ${extractedAction.action}`,
    });

    const response = await fetch(`${getGoogleWorkerUrl()}/gmail`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: extractedAction.action,
        messageId: extractedAction.messageId,
        to: extractedAction.to,
        subject: extractedAction.subject,
        body: extractedAction.body,
        threadId: extractedAction.threadId,
        requestId: crypto.randomUUID(),
      }),
    });

    if (!response.ok) {
      throw new Error(`Gmail worker error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    console.log('[Inbox] Gmail result:', JSON.stringify(result, null, 2));

    toolResults.set('inbox_' + Date.now(), {
      action: extractedAction.action,
      status: 'completed',
      result: result.data,
      timestamp: new Date(),
    });

    agentHistory.push({
      agentName: 'inbox',
      eventType: 'tool_result',
      content: `Gmail ${extractedAction.action} completed`,
      timestamp: new Date(),
    });

    await store.addEvent({
      sessionId: state.sessionId,
      agentName: 'inbox',
      eventType: 'tool_result',
      content: `Gmail ${extractedAction.action} completed`,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Inbox] Gmail action failed:', errorMessage);

    toolResults.set('inbox_' + Date.now(), {
      action: extractedAction.action,
      status: 'failed',
      error: errorMessage,
      timestamp: new Date(),
    });

    agentHistory.push({
      agentName: 'inbox',
      eventType: 'failed',
      content: `Gmail ${extractedAction.action} failed: ${errorMessage}`,
      timestamp: new Date(),
    });

    await store.addEvent({
      sessionId: state.sessionId,
      agentName: 'inbox',
      eventType: 'failed',
      content: `Gmail ${extractedAction.action} failed: ${errorMessage}`,
    });
  }

  agentHistory.push({
    agentName: 'inbox',
    eventType: 'completed',
    content: 'Inbox processing completed',
    timestamp: new Date(),
  });

  await store.addEvent({
    sessionId: state.sessionId,
    agentName: 'inbox',
    eventType: 'completed',
    content: 'Inbox processing completed',
  });

  return {
    agentHistory,
    toolResults,
    currentAgent: 'summary' as AgentName,
    requiresApproval,
    pendingApprovals,
  };
}
