import { coordinatorAgent, type IntentClassification } from '../agents/coordinator';
import { researchAgent, type ResearchResult } from '../agents/research-agent';
import { inboxAgent, type InboxResult } from '../agents/inbox-agent';
import { planningAgent, type PlanningResult } from '../agents/planning-agent';
import { applicationAgent, type ApplicationResult } from '../agents/application-agent';
import { desktopAgent } from '../agents/desktop-agent';
import { summaryAgent } from '../agents/summary-agent';
import {
  analyzeIntentAndNeeds,
  buildConversationHistory,
  appendToHistory,
  type ConversationMessage,
} from '../agents/conversation-loop';
import type { SessionStore } from '@/lib/db/session-store';
import { getPool } from '@/lib/db/postgres';
import { logger } from '@/lib/utils/logger';

const log = logger('session-graph');

export interface SessionGraphState {
  sessionId: string;
  input: string;
  intent?: IntentClassification;
  status: string;
  researchResults: ResearchResult[];
  inboxResults?: InboxResult;
  planningResults?: PlanningResult;
  applicationResults?: ApplicationResult;
  desktopPlan?: import('@solli/shared').FileOperationPlan;
  summary?: string;
  error?: string;
  conversationHistory: ConversationMessage[];
  pendingQuestions?: string[];
}

export async function runSessionGraph(
  sessionId: string,
  input: string,
  store: SessionStore,
  existingState?: Partial<SessionGraphState>
): Promise<SessionGraphState> {
  // Load session metadata to get conversation history
  const pool = getPool();
  const sessionRow = await pool.query('SELECT metadata, actual_cost_sol FROM sessions WHERE id = $1', [sessionId]);
  const metadata: Record<string, unknown> = sessionRow.rows[0]?.metadata || {};
  const priorActualCost: number = sessionRow.rows[0]?.actual_cost_sol || 0;

  const state: SessionGraphState = {
    sessionId,
    input,
    status: 'running',
    researchResults: [],
    conversationHistory: buildConversationHistory(metadata),
    pendingQuestions: undefined,
    ...existingState,
  };

  log.info(`Starting graph for session ${sessionId}`);

  try {
    // --- Conversation Loop ---
    // If we have pending questions, we should not proceed until user responds
    if (state.pendingQuestions && state.pendingQuestions.length > 0) {
      log.info(`Session ${sessionId} is waiting for clarification`);
      state.status = 'clarifying';
      await store.updateSession(sessionId, { status: 'clarifying' });
      return state;
    }

    // Analyze if we need clarification (use state.input to respect existingState overrides)
    const currentInput = state.input || input;
    const analysis = await analyzeIntentAndNeeds(sessionId, currentInput, state.conversationHistory, store);

    if (analysis.status === 'clarifying' && analysis.questions && analysis.questions.length > 0) {
      state.status = 'clarifying';
      state.pendingQuestions = analysis.questions;

      // Only append agent clarifications to metadata; caller already appended user input
      const updatedMetadata = appendToHistory(metadata, 'agent', `Clarifying: ${analysis.questions.join('; ')}`);
      await store.updateSession(sessionId, {
        status: 'clarifying',
        metadata: updatedMetadata,
      });

      // Add events for each question
      for (const q of analysis.questions) {
        await store.addEvent({
          sessionId,
          agentName: 'coordinator',
          eventType: 'thinking',
          content: `Clarifying question: ${q}`,
          metadata: { question: q },
        });
      }

      return state;
    }

    // Request is clear - use refined input if available
    const refinedInput = analysis.refinedInput || currentInput;
    state.input = refinedInput;

    // Only append to history if this input isn't already the last user message
    const lastUserMsg = state.conversationHistory.slice().reverse().find((m) => m.role === 'user');
    if (!lastUserMsg || lastUserMsg.content !== currentInput) {
      let updatedMetadata = appendToHistory(metadata, 'user', currentInput);
      updatedMetadata = appendToHistory(updatedMetadata, 'agent', `Understood: ${refinedInput}`);
      await pool.query('UPDATE sessions SET metadata = $1 WHERE id = $2', [JSON.stringify(updatedMetadata), sessionId]);
    }

    // --- Intent Classification ---
    const intent = await coordinatorAgent(sessionId, refinedInput, store);
    state.intent = intent;

    // --- Agent Execution ---
    let sessionActualCost = priorActualCost;
    if (intent === 'RESEARCH') {
      state.researchResults = await researchAgent(sessionId, refinedInput, store);
    } else if (intent === 'INBOX') {
      state.inboxResults = await inboxAgent(sessionId, refinedInput, store);
    } else if (intent === 'PLANNING') {
      state.planningResults = await planningAgent(sessionId, refinedInput, store);
    } else if (intent === 'APPLICATION') {
      state.applicationResults = await applicationAgent(sessionId, refinedInput, store);
    } else if (intent === 'DESKTOP') {
      state.desktopPlan = await desktopAgent(sessionId, refinedInput, store);
    } else {
      log.info(`Intent ${intent} routed directly to summary`);
      await store.addEvent({
        sessionId,
        agentName: 'coordinator',
        eventType: 'thinking',
        content: `Intent ${intent} has no specialized agent execution, proceeding to summary`,
      });
    }

    // Re-read actual cost from tasks to account for agent execution costs
    const costResult = await pool.query(
      'SELECT COALESCE(SUM(cost_sol), 0) as total FROM tasks WHERE session_id = $1',
      [sessionId]
    );
    sessionActualCost = parseFloat(costResult.rows[0]?.total || '0');

    // --- Summary ---
    state.summary = await summaryAgent(
      sessionId,
      refinedInput,
      state.researchResults,
      store,
      state.inboxResults,
      state.planningResults,
      state.applicationResults
    );
    state.status = 'completed';

    // Summary cost was added by summaryAgent to tasks; re-read total
    const finalCostResult = await pool.query(
      'SELECT COALESCE(SUM(cost_sol), 0) as total FROM tasks WHERE session_id = $1',
      [sessionId]
    );
    const finalActualCost = parseFloat(finalCostResult.rows[0]?.total || '0');

    await store.updateSession(sessionId, { status: 'completed', summary: state.summary, actualCostSol: finalActualCost });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    log.error(`Graph failed for ${sessionId}`, msg);
    state.error = msg;
    state.status = 'failed';

    // Record partial costs even on failure
    const costResult = await pool.query(
      'SELECT COALESCE(SUM(cost_sol), 0) as total FROM tasks WHERE session_id = $1',
      [sessionId]
    );
    const partialCost = parseFloat(costResult.rows[0]?.total || '0');

    await store.updateSession(sessionId, { status: 'failed', actualCostSol: partialCost });
  }

  return state;
}

export async function continueSessionWithMessage(
  sessionId: string,
  userMessage: string,
  store: SessionStore
): Promise<SessionGraphState> {
  log.info(`Continuing session ${sessionId} with user message: "${userMessage}"`);

  const pool = getPool();
  const sessionRow = await pool.query('SELECT * FROM sessions WHERE id = $1', [sessionId]);
  const session = sessionRow.rows[0];

  if (!session) {
    throw new Error('Session not found');
  }

  // Guard: only allow continuing sessions that are clarifying or created
  if (!['clarifying', 'created', 'running'].includes(session.status)) {
    throw new Error(`Cannot continue session with status: ${session.status}`);
  }

  const metadata: Record<string, unknown> = session.metadata || {};
  const updatedMetadata = appendToHistory(metadata, 'user', userMessage);
  await pool.query('UPDATE sessions SET metadata = $1, status = $2 WHERE id = $3', [
    JSON.stringify(updatedMetadata),
    'running',
    sessionId,
  ]);

  const existingHistory = buildConversationHistory(updatedMetadata);

  const state: SessionGraphState = {
    sessionId,
    input: userMessage,
    status: 'running',
    researchResults: [],
    conversationHistory: existingHistory,
    pendingQuestions: undefined,
  };

  // Pass userMessage as the new input for analysis; original session.input is preserved in DB
  return runSessionGraph(sessionId, userMessage, store, state);
}
