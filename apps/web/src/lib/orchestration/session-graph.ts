import { coordinatorAgent, type IntentClassification } from '../agents/coordinator';
import { researchAgent, type ResearchResult } from '../agents/research-agent';
import { summaryAgent } from '../agents/summary-agent';
import type { SessionStore } from '@/lib/db/session-store';
import { logger } from '@/lib/utils/logger';

const log = logger('session-graph');

export interface SessionGraphState {
  sessionId: string;
  input: string;
  intent?: IntentClassification;
  status: string;
  researchResults: ResearchResult[];
  summary?: string;
  error?: string;
}

export async function runSessionGraph(
  sessionId: string,
  input: string,
  store: SessionStore
): Promise<SessionGraphState> {
  const state: SessionGraphState = {
    sessionId,
    input,
    status: 'running',
    researchResults: [],
  };

  log.info(`Starting graph for session ${sessionId}`);

  try {
    const intent = await coordinatorAgent(sessionId, input, store);
    state.intent = intent;

    if (intent === 'RESEARCH') {
      state.researchResults = await researchAgent(sessionId, input, store);
    } else {
      log.info(`Intent ${intent} routed directly to summary`);
      await store.addEvent({
        sessionId,
        agentName: 'coordinator',
        eventType: 'thinking',
        content: `Intent ${intent} not implemented for MVP, routing to summary`,
      });
    }

    state.summary = await summaryAgent(sessionId, input, state.researchResults, store);
    state.status = 'completed';
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    log.error(`Graph failed for ${sessionId}`, msg);
    state.error = msg;
    state.status = 'failed';
    await store.updateSession(sessionId, { status: 'failed' });
  }

  return state;
}
