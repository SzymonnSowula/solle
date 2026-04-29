import { SessionState, AgentName } from '../index';
import { createChatModel } from '../../llm';
import { SessionStore } from '../../store';

export async function summaryNode(
  state: SessionState,
  store: SessionStore
): Promise<Partial<SessionState>> {
  const agentHistory = [...state.agentHistory];

  agentHistory.push({
    agentName: 'summary',
    eventType: 'started',
    content: 'Generating session summary...',
    timestamp: new Date(),
  });

  await store.addEvent({
    sessionId: state.sessionId,
    agentName: 'summary',
    eventType: 'started',
    content: 'Generating session summary...',
  });

  let summary = '';
  try {
    const model = createChatModel({ temperature: 0.5, maxTokens: 500 });

    // Build context from all tool results
    const toolResultsArray = Array.from(state.toolResults.entries()).map(([key, value]) => {
      const v = value as any;
      return `Tool: ${key}\nAction: ${v.action || v.query || 'unknown'}\nStatus: ${v.status}\nResult: ${JSON.stringify(v.result || v.results || v).substring(0, 300)}`;
    });

    const agentList = [...new Set(state.agentHistory.map((e) => e.agentName))].filter((n) => n !== 'summary').join(', ');

    const prompt = `Generate a concise 2-4 sentence summary of the session.

User request: "${state.userIntent}"

Agents involved: ${agentList || 'coordinator'}

Actions executed:
${toolResultsArray.join('\n---\n') || 'No tools executed'}

Summary:`;

    const response = await model.invoke(prompt);
    summary = String(response.content).trim();
    console.log('[Summary] Generated summary:', summary);
  } catch (error) {
    console.error('[Summary] LLM summary generation failed:', error);
    summary = generateFallbackSummary(state);
  }

  agentHistory.push({
    agentName: 'summary',
    eventType: 'completed',
    content: `Summary generated: ${summary.substring(0, 80)}...`,
    timestamp: new Date(),
  });

  await store.addEvent({
    sessionId: state.sessionId,
    agentName: 'summary',
    eventType: 'completed',
    content: `Summary generated: ${summary.substring(0, 80)}...`,
  });

  await store.updateSession(state.sessionId, {
    status: 'completed',
    summary,
  });

  return {
    agentHistory,
    summary,
    currentAgent: 'summary' as AgentName,
  };
}

function generateFallbackSummary(state: SessionState): string {
  const agentNames = state.agentHistory.map((e) => e.agentName);
  const uniqueAgents = [...new Set(agentNames)];
  const toolCount = state.toolResults.size;
  const resultCount = state.researchResults?.length || 0;

  const parts: string[] = [];
  parts.push(`Session completed successfully.`);
  parts.push(`User request: "${state.userIntent}"`);
  parts.push(`Agents involved: ${uniqueAgents.join(', ')}`);
  parts.push(`Tools executed: ${toolCount}`);
  if (resultCount > 0) {
    parts.push(`Results found: ${resultCount}`);
  }

  return parts.join('\n');
}
