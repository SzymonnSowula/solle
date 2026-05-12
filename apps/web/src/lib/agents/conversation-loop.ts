import type { SessionStore } from '@/lib/db/session-store';
import { logger } from '@/lib/utils/logger';

const log = logger('conversation-loop');

export interface ConversationMessage {
  role: 'user' | 'agent';
  content: string;
  timestamp: string;
}

export interface ClarificationResult {
  status: 'ready' | 'clarifying';
  refinedInput?: string;
  questions?: string[];
  reasoning?: string;
}

async function callOpenAI(prompt: string, temperature = 0.7, maxTokens = 500): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature,
      max_tokens: maxTokens,
    }),
  });

  if (!res.ok) {
    throw new Error(`OpenAI error: ${res.status}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  return data.choices?.[0]?.message?.content?.trim() || '';
}

export async function analyzeIntentAndNeeds(
  sessionId: string,
  userInput: string,
  history: ConversationMessage[],
  store: SessionStore
): Promise<ClarificationResult> {
  await store.addEvent({
    sessionId,
    agentName: 'coordinator',
    eventType: 'thinking',
    content: 'Analyzing if request needs clarification',
  });

  const historyText = history
    .map((h) => `${h.role === 'user' ? 'User' : 'Agent'}: ${h.content}`)
    .join('\n');

  const prompt = `You are Volle, a voice-native process operator. Your job is to understand what the user wants and ask clarifying questions ONLY when absolutely necessary.

Conversation so far:
${historyText}

Latest user message: "${userInput}"

Determine if you have enough information to proceed with one of these intents: RESEARCH, INBOX, PLANNING, APPLICATION, GENERAL.

Rules:
- If the request is vague (e.g. "help me apply to jobs", "plan my day", "clean my inbox"), ask 1-2 specific clarifying questions.
- If the request is clear and specific, mark it as ready and provide a refined, detailed version of the request.
- Be concise. Questions should be actionable.

Respond ONLY in this exact JSON format (no markdown, no extra text):
{"status":"ready","refinedInput":"detailed request","reasoning":"why"}
or
{"status":"clarifying","questions":["question 1","question 2"],"reasoning":"why"}`;

  try {
    const text = await callOpenAI(prompt, 0.3, 1200);
    // Extract JSON from possible markdown
    const jsonMatch = text.match(/\{[\s\S]*?\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : text;
    const result = JSON.parse(jsonStr) as ClarificationResult;

    log.info(`Conversation analysis: ${result.status}`);

    await store.addEvent({
      sessionId,
      agentName: 'coordinator',
      eventType: 'thinking',
      content: result.status === 'ready'
        ? `Request is clear: ${result.refinedInput}`
        : `Need clarification: ${result.questions?.join('; ')}`,
      metadata: { status: result.status, reasoning: result.reasoning },
    });

    return result;
  } catch (error) {
    log.warn('LLM conversation analysis failed, assuming ready', error);
    return {
      status: 'ready',
      refinedInput: userInput,
      reasoning: 'Fallback: LLM parsing failed, proceeding with original input',
    };
  }
}

export function buildConversationHistory(metadata: Record<string, unknown>): ConversationMessage[] {
  const history = metadata.conversationHistory;
  if (Array.isArray(history)) {
    return history as ConversationMessage[];
  }
  return [];
}

export function appendToHistory(
  metadata: Record<string, unknown>,
  role: 'user' | 'agent',
  content: string
): Record<string, unknown> {
  const history = buildConversationHistory(metadata);
  history.push({
    role,
    content,
    timestamp: new Date().toISOString(),
  });
  return { ...metadata, conversationHistory: history };
}
