import {
  StateGraph,
  START,
  END,
  MemorySaver,
  Annotation,
} from '@langchain/langgraph';
import { Pool } from 'pg';
import { AgentName as CoreAgentName } from '../types';
import { SessionStore, NoOpSessionStore, PostgresSaver } from '../store';
import { coordinatorNode } from './nodes/coordinator';
import { researchNode } from './nodes/research';
import { inboxNode } from './nodes/inbox';
import { planningNode } from './nodes/planning';
import { summaryNode } from './nodes/summary';

export type AgentName = CoreAgentName;

export interface SessionState {
  sessionId: string;
  userIntent: string;
  agentHistory: AgentHistoryEntry[];
  toolResults: Map<string, unknown>;
  pendingApprovals: ApprovalRequest[];
  summary: string;
  currentAgent: AgentName;
  requiresApproval: boolean;
  lastError: string | null;
  researchResults?: Array<{
    title: string;
    organization?: string;
    location?: string;
    url?: string;
    reason?: string;
    snippet?: string;
  }>;
}

export interface AgentHistoryEntry {
  agentName: string;
  eventType: string;
  content: string;
  timestamp: Date;
}

export interface ApprovalRequest {
  id: string;
  agentName: string;
  taskId: string;
  message: string;
  toolName: string;
  args: Record<string, unknown>;
  createdAt: Date;
  status: 'pending' | 'approved' | 'denied';
}

export type IntentClassification =
  | 'RESEARCH'
  | 'INBOX'
  | 'PLANNING'
  | 'APPLICATION'
  | 'GENERAL';

export type RouterOutput = IntentClassification | 'APPROVAL_WAIT' | 'ERROR';

const StateAnnotation = Annotation.Root({
  sessionId: Annotation<string>,
  userIntent: Annotation<string>,
  agentHistory: Annotation<AgentHistoryEntry[]>({
    reducer: (left, right) => [...left, ...(Array.isArray(right) ? right : [right])],
    default: () => [],
  }),
  toolResults: Annotation<Map<string, unknown>>({
    reducer: (left, right) => new Map([...left, ...right]),
    default: () => new Map(),
  }),
  pendingApprovals: Annotation<ApprovalRequest[]>({
    reducer: (left, right) => [...left, ...(Array.isArray(right) ? right : [right])],
    default: () => [],
  }),
  summary: Annotation<string>,
  currentAgent: Annotation<AgentName>,
  requiresApproval: Annotation<boolean>,
  lastError: Annotation<string | null>,
  researchResults: Annotation<Array<{ title: string; organization?: string; location?: string; url?: string; reason?: string; snippet?: string }>>({
    reducer: (left, right) => [...left, ...(Array.isArray(right) ? right : [right])],
    default: () => [],
  }),
});

function routeFromCoordinator(state: typeof StateAnnotation.State): string {
  const intent = state.currentAgent;
  console.log(`[Graph] Routing from coordinator to: ${intent}`);

  if (intent === 'research') return 'research';
  if (intent === 'inbox') return 'inbox';
  if (intent === 'planning') return 'planning';
  return 'summary';
}

export interface RunSessionOptions {
  store?: SessionStore;
  pool?: Pool;
  resumeConfig?: {
    approved?: boolean;
    approvalId?: string;
    additionalArgs?: Record<string, unknown>;
  };
}

export async function runSession(
  sessionId: string,
  userIntent: string,
  options: RunSessionOptions = {}
): Promise<SessionState> {
  const { store, pool, resumeConfig } = options;
  const sessionStore = store || new NoOpSessionStore();

  const workflow = new StateGraph(StateAnnotation)
    .addNode('coordinator', (state) => coordinatorNode(state as SessionState, sessionStore))
    .addNode('research', (state) => researchNode(state as SessionState, sessionStore))
    .addNode('inbox', (state) => inboxNode(state as SessionState, sessionStore))
    .addNode('planning', (state) => planningNode(state as SessionState, sessionStore))
    .addNode('summary', (state) => summaryNode(state as SessionState, sessionStore))
    .addEdge(START, 'coordinator')
    .addConditionalEdges('coordinator', routeFromCoordinator as any)
    .addEdge('research', 'summary')
    .addEdge('inbox', 'summary')
    .addEdge('planning', 'summary')
    .addEdge('summary', END);

  const checkpointer = pool
    ? new PostgresSaver(pool)
    : new MemorySaver();

  const graph = workflow.compile({
    checkpointer,
    interruptAfter: ['inbox', 'planning'],
  });

  const config = {
    configurable: { thread_id: sessionId },
  };

  // Check if there's an existing checkpoint (resuming session)
  const existing = await checkpointer.getTuple(config);

  let state: typeof StateAnnotation.State;

  if (existing) {
    // Resume: merge new intent / approval into existing state
    state = {
      ...existing.checkpoint.channel_values,
      userIntent,
      // If resuming from approval, update the approval status
      pendingApprovals: resumeConfig?.approvalId
        ? (existing.checkpoint.channel_values.pendingApprovals || []).map((a: ApprovalRequest) =>
            a.id === resumeConfig.approvalId
              ? { ...a, status: resumeConfig.approved ? 'approved' : 'denied' }
              : a
          )
        : existing.checkpoint.channel_values.pendingApprovals || [],
      requiresApproval: false,
      lastError: null,
    } as typeof StateAnnotation.State;
    console.log(`[Graph] Resuming session ${sessionId} with intent: "${userIntent}"`);
  } else {
    // Fresh session
    state = {
      sessionId,
      userIntent,
      agentHistory: [],
      toolResults: new Map(),
      pendingApprovals: [],
      summary: '',
      currentAgent: 'coordinator',
      requiresApproval: false,
      lastError: null,
      researchResults: [],
    };
    console.log(`[Graph] Starting session ${sessionId} with intent: "${userIntent}"`);
  }

  const result = await graph.invoke(state, config);
  console.log(`[Graph] Session ${sessionId} completed`);

  return result as unknown as SessionState;
}
