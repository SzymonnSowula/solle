import type { SessionStore } from '@/lib/db/session-store';
import { getToolCost, formatCost } from '@/lib/x402';
import { logger } from '@/lib/utils/logger';

const log = logger('application-agent');
const GENERATE_COST = getToolCost('application_generate');

async function callOpenAI(prompt: string, temperature = 0.7, maxTokens = 1500): Promise<string> {
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

export interface ApplicationDocument {
  type: 'cv' | 'cover_letter';
  title: string;
  content: string;
  targetCompany?: string;
  targetRole?: string;
}

export interface ApplicationResult {
  documents: ApplicationDocument[];
  actionsTaken: string[];
}

export async function applicationAgent(
  sessionId: string,
  query: string,
  store: SessionStore
): Promise<ApplicationResult> {
  await store.addEvent({
    sessionId,
    agentName: 'application',
    eventType: 'started',
    content: `Starting application prep for: "${query}"`,
  });

  const result: ApplicationResult = {
    documents: [],
    actionsTaken: [],
  };

  try {
    const lowerQuery = query.toLowerCase();

    // Determine if user wants CV, cover letter, or both
    const wantsCv = lowerQuery.includes('cv') || lowerQuery.includes('resume');
    const wantsCover = lowerQuery.includes('cover') || lowerQuery.includes('letter');
    const wantsBoth = (!wantsCv && !wantsCover) || (wantsCv && wantsCover);

    // Extract role & company if mentioned
    const roleMatch = query.match(/(?:for|as)\s+(?:a\s+)?(.*?)(?:\s+at\s+|\s+in\s+|$)/i);
    const companyMatch = query.match(/(?:at|for)\s+([A-Z][A-Za-z0-9\s&]+)/);
    const targetRole = roleMatch?.[1]?.trim() || 'the position';
    const targetCompany = companyMatch?.[1]?.trim();

    if (wantsCv || wantsBoth) {
      await store.addTask({
        sessionId,
        agentName: 'application',
        toolName: 'application_generate',
        inputJson: { type: 'cv', targetRole, targetCompany },
        status: 'running',
      });

      const cvPrompt = `Write a professional CV summary section (not a full CV, just a compelling professional summary paragraph) for someone applying to ${targetRole}${targetCompany ? ` at ${targetCompany}` : ''}.

The summary should be:
- 3-4 sentences
- Highlight relevant AI/ML skills
- Professional but personable
- Ready to copy-paste into a CV template

Professional Summary:`;

      const cvContent = await callOpenAI(cvPrompt, 0.6, 300);

      result.documents.push({
        type: 'cv',
        title: `CV Summary - ${targetRole}`,
        content: cvContent,
        targetRole,
        targetCompany,
      });

      result.actionsTaken.push(`Generated CV summary for ${targetRole}`);

      await store.addEvent({
        sessionId,
        agentName: 'application',
        eventType: 'tool_result',
        content: `CV summary generated · Cost: ${formatCost(GENERATE_COST)}`,
        metadata: { documentType: 'cv', targetRole, targetCompany, costSol: GENERATE_COST },
      });

      await store.addTask({
        sessionId,
        agentName: 'application',
        toolName: 'application_generate',
        outputJson: { type: 'cv', content: cvContent },
        status: 'completed',
        costSol: GENERATE_COST,
      });
    }

    if (wantsCover || wantsBoth) {
      await store.addTask({
        sessionId,
        agentName: 'application',
        toolName: 'application_generate',
        inputJson: { type: 'cover_letter', targetRole, targetCompany },
        status: 'running',
      });

      const coverPrompt = `Write a compelling cover letter for someone applying to ${targetRole}${targetCompany ? ` at ${targetCompany}` : ''}.

Requirements:
- Opening paragraph: why this role excites them
- Body: 1-2 paragraphs highlighting relevant AI/ML experience and passion
- Closing: call to action and enthusiasm
- Tone: confident but not arrogant, 250-350 words total
- Use placeholders like [Your Name] and [Your University/Company] where personal info would go

Cover Letter:`;

      const coverContent = await callOpenAI(coverPrompt, 0.7, 800);

      result.documents.push({
        type: 'cover_letter',
        title: `Cover Letter - ${targetRole}${targetCompany ? ` @ ${targetCompany}` : ''}`,
        content: coverContent,
        targetRole,
        targetCompany,
      });

      result.actionsTaken.push(`Generated cover letter for ${targetRole}`);

      await store.addEvent({
        sessionId,
        agentName: 'application',
        eventType: 'tool_result',
        content: `Cover letter generated · Cost: ${formatCost(GENERATE_COST)}`,
        metadata: { documentType: 'cover_letter', targetRole, targetCompany, costSol: GENERATE_COST },
      });

      await store.addTask({
        sessionId,
        agentName: 'application',
        toolName: 'application_generate',
        outputJson: { type: 'cover_letter', content: coverContent },
        status: 'completed',
        costSol: GENERATE_COST,
      });
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    log.error('Application agent failed', msg);

    await store.addEvent({
      sessionId,
      agentName: 'application',
      eventType: 'failed',
      content: `Application prep failed: ${msg}`,
    });

    await store.addTask({
      sessionId,
      agentName: 'application',
      toolName: 'application_generate',
      status: 'failed',
      errorMessage: msg,
      costSol: GENERATE_COST,
    });
  }

  await store.addEvent({
    sessionId,
    agentName: 'application',
    eventType: 'completed',
    content: `Application prep completed. ${result.actionsTaken.join('. ')}`,
  });

  return result;
}
