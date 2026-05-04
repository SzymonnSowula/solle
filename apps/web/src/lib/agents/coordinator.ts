import type { SessionStore } from '@/lib/db/session-store';
import { estimateSessionCost } from '@/lib/x402';
import { logger } from '@/lib/utils/logger';

const log = logger('coordinator');

const intentKeywords: Record<string, string[]> = {
  RESEARCH: ['research', 'search', 'find', 'look up', 'investigate', 'browse'],
  INBOX: ['inbox', 'email', 'gmail', 'message', 'mail', 'send email'],
  PLANNING: ['plan', 'schedule', 'calendar', 'organize', 'meeting', 'event'],
  APPLICATION: ['app', 'application', 'open', 'launch', 'use'],
  GENERAL: ['general', 'help', 'question', 'what', 'how', 'explain'],
};

export type IntentClassification = 'RESEARCH' | 'INBOX' | 'PLANNING' | 'APPLICATION' | 'GENERAL';

async function callOpenAI(prompt: string, temperature = 0.7, maxTokens = 2000): Promise<string> {
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

export async function coordinatorAgent(
  sessionId: string,
  userIntent: string,
  store: SessionStore
): Promise<IntentClassification> {
  await store.addEvent({
    sessionId,
    agentName: 'coordinator',
    eventType: 'thinking',
    content: `Analyzing user intent: "${userIntent}"`,
  });

  let classification: IntentClassification = 'GENERAL';

  try {
    const prompt = `Classify the user intent into exactly one of these categories: RESEARCH, INBOX, PLANNING, APPLICATION, GENERAL.

User input: "${userIntent}"

Respond with only the category name, nothing else.`;

    const text = (await callOpenAI(prompt, 0.2)).toUpperCase();

    if (['RESEARCH', 'INBOX', 'PLANNING', 'APPLICATION', 'GENERAL'].includes(text)) {
      classification = text as IntentClassification;
      log.info(`LLM classified intent as: ${classification}`);
    } else {
      throw new Error(`Invalid LLM response: ${text}`);
    }
  } catch (error) {
    log.warn('LLM classification failed, falling back to keywords:', error instanceof Error ? error.message : error);
    const lower = userIntent.toLowerCase();
    let maxMatch = 0;
    for (const [intent, keywords] of Object.entries(intentKeywords)) {
      const matchCount = keywords.filter((k) => lower.includes(k.toLowerCase())).length;
      if (matchCount > maxMatch) {
        maxMatch = matchCount;
        classification = intent as IntentClassification;
      }
    }
    if (maxMatch === 0) {
      classification = 'RESEARCH';
    }
  }

  await store.addEvent({
    sessionId,
    agentName: 'coordinator',
    eventType: 'completed',
    content: `Classified intent as: ${classification}`,
  });

  const estimatedCost = estimateSessionCost(classification);
  await store.addEvent({
    sessionId,
    agentName: 'coordinator',
    eventType: 'thinking',
    content: `Estimated session cost: ${estimatedCost.toFixed(4)} SOL`,
    metadata: { estimatedCostSol: estimatedCost },
  });

  await store.updateSession(sessionId, {
    intent: classification,
    status: 'running',
    estimatedCostSol: estimatedCost,
  });

  return classification;
}
