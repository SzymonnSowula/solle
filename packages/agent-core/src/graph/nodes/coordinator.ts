import { SessionState, AgentName } from '../index';
import { createChatModel } from '../../llm';
import { SessionStore } from '../../store';

const intentKeywords: Record<string, string[]> = {
  RESEARCH: ['research', 'search', 'find', 'look up', 'investigate', 'browse'],
  INBOX: ['inbox', 'email', 'gmail', 'message', 'mail', 'send email'],
  PLANNING: ['plan', 'schedule', 'calendar', 'organize', 'meeting', 'event'],
  APPLICATION: ['app', 'application', 'open', 'launch', 'use'],
  GENERAL: ['general', 'help', 'question', 'what', 'how', 'explain'],
};

export async function coordinatorNode(
  state: SessionState,
  store: SessionStore
): Promise<Partial<SessionState>> {
  const userIntent = state.userIntent?.toLowerCase() || '';
  const agentHistory = [...state.agentHistory];
  const isResume = agentHistory.some((e) => e.agentName !== 'coordinator');

  agentHistory.push({
    agentName: 'coordinator',
    eventType: 'thinking',
    content: `Analyzing user intent: "${state.userIntent}"${isResume ? ' (session resume)' : ''}`,
    timestamp: new Date(),
  });

  await store.addEvent({
    sessionId: state.sessionId,
    agentName: 'coordinator',
    eventType: 'thinking',
    content: `Analyzing user intent: "${state.userIntent}"${isResume ? ' (session resume)' : ''}`,
  });

  // Try LLM-based classification first
  let classification: string = 'GENERAL';
  try {
    const model = createChatModel({ temperature: 0.2 });

    const context = isResume
      ? `This is a FOLLOW-UP in an existing session. Previous agents: ${[...new Set(agentHistory.map((e) => e.agentName))].join(', ')}.\n\nClassify whether the user wants to:\n- CONTINUE with the previous workflow (same intent)\n- SWITCH to a new task (new intent)\n\nIf continuing, respond with the SAME category as before. If switching, respond with the new category.`
      : '';

    const prompt = `Classify the user intent into exactly one of these categories: RESEARCH, INBOX, PLANNING, APPLICATION, GENERAL.
${context}

User input: "${state.userIntent}"

Respond with only the category name, nothing else.`;

    const response = await model.invoke(prompt);
    const text = String(response.content).trim().toUpperCase();

    if (['RESEARCH', 'INBOX', 'PLANNING', 'APPLICATION', 'GENERAL'].includes(text)) {
      classification = text;
      console.log(`[Coordinator] LLM classified intent as: ${classification}`);
    } else {
      throw new Error(`Invalid LLM response: ${text}`);
    }
  } catch (error) {
    // Fallback to keyword matching
    console.log('[Coordinator] LLM classification failed, falling back to keywords:', error instanceof Error ? error.message : error);
    let maxMatchCount = 0;
    for (const [intent, keywords] of Object.entries(intentKeywords)) {
      const matchCount = keywords.filter((keyword) =>
        userIntent.includes(keyword.toLowerCase())
      ).length;
      if (matchCount > maxMatchCount) {
        maxMatchCount = matchCount;
        classification = intent;
      }
    }
    if (maxMatchCount === 0) {
      classification = 'RESEARCH'; // Default for MVP
    }
  }

  // If this is a resume and no clear new intent, route to the previous agent
  let targetAgent = classification.toLowerCase() as AgentName;
  if (isResume && targetAgent === 'general') {
    const lastNonCoordinator = [...agentHistory]
      .reverse()
      .find((e) => e.agentName !== 'coordinator' && e.agentName !== 'summary');
    if (lastNonCoordinator) {
      targetAgent = lastNonCoordinator.agentName as AgentName;
      console.log(`[Coordinator] Routing follow-up to previous agent: ${targetAgent}`);
    }
  }

  agentHistory.push({
    agentName: 'coordinator',
    eventType: 'completed',
    content: `Classified intent as: ${classification} → ${targetAgent}`,
    timestamp: new Date(),
  });

  await store.addEvent({
    sessionId: state.sessionId,
    agentName: 'coordinator',
    eventType: 'completed',
    content: `Classified intent as: ${classification} → ${targetAgent}`,
  });

  await store.updateSession(state.sessionId, {
    intent: classification,
    status: 'running',
  });

  let requiresApproval = false;
  if (state.pendingApprovals.length > 0) {
    requiresApproval = state.pendingApprovals.some((a) => a.status === 'pending');
  }

  return {
    agentHistory,
    currentAgent: targetAgent,
    requiresApproval,
    pendingApprovals: state.pendingApprovals,
  };
}
