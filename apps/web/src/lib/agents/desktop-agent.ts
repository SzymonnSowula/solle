import type { SessionStore } from '@/lib/db/session-store';
import { logger } from '@/lib/utils/logger';
import type { FileOperationPlan } from '@solli/shared';

const log = logger('desktop-agent');

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

export async function desktopAgent(
  sessionId: string,
  userIntent: string,
  store: SessionStore
): Promise<FileOperationPlan> {
  await store.addEvent({
    sessionId,
    agentName: 'coordinator',
    eventType: 'thinking',
    content: `Planning desktop organization for: "${userIntent}"`,
  });

  const prompt = `You are a desktop file organization assistant. The user wants: "${userIntent}".

Generate a plan to organize files on the Windows Desktop. Use wildcard patterns for files (e.g., *.png, *.pdf) rather than specific filenames unless the user mentioned them.

Return ONLY a valid JSON object in this exact format (no markdown, no explanation):
{
  "actions": [
    {"type": "createDir", "to": "FolderName", "reason": "Why"},
    {"type": "move", "from": "*.ext", "to": "FolderName/*.ext", "reason": "Why"}
  ],
  "summary": "One sentence describing the plan"
}

Rules:
- Use relative paths (no C:\ or absolute paths)
- Only target Desktop directory
- Do NOT move .exe, .dll, .sys files
- Prefer safe categories: Screenshots, Documents, Archives, Images
- If the request is vague, create a general "by file type" plan`;

  let plan: FileOperationPlan;

  try {
    const text = await callOpenAI(prompt, 0.3, 2000);
    const cleaned = text.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();
    plan = JSON.parse(cleaned) as FileOperationPlan;

    // Validate structure
    if (!plan.actions || !Array.isArray(plan.actions)) {
      throw new Error('Invalid plan structure: missing actions array');
    }

    // Sanitize paths - no absolute paths, no system files
    plan.actions = plan.actions
      .filter((a) => {
        const ext = (a.from || a.to).split('.').pop()?.toLowerCase();
        return !['exe', 'dll', 'sys'].includes(ext || '');
      })
      .map((a) => ({
        ...a,
        from: a.from ? a.from.replace(/^[a-zA-Z]:\\/g, '').replace(/\\/g, '\\') : undefined,
        to: a.to.replace(/^[a-zA-Z]:\\/g, '').replace(/\\/g, '\\'),
      }));

    log.info(`Desktop plan generated for ${sessionId}: ${plan.summary}`);
  } catch (err) {
    log.error(`Desktop agent failed for ${sessionId}`, err instanceof Error ? err.message : err);
    // Fallback plan
    plan = {
      actions: [
        { type: 'createDir', to: 'Screenshots', reason: 'Store image files' },
        { type: 'createDir', to: 'Documents', reason: 'Store document files' },
        { type: 'move', from: '*.png', to: 'Screenshots\\*.png', reason: 'Organize screenshots' },
        { type: 'move', from: '*.jpg', to: 'Screenshots\\*.jpg', reason: 'Organize images' },
        { type: 'move', from: '*.pdf', to: 'Documents\\*.pdf', reason: 'Organize documents' },
      ],
      summary: 'Organize desktop files by type into folders',
    };
  }

  await store.addEvent({
    sessionId,
    agentName: 'coordinator',
    eventType: 'completed',
    content: `Desktop plan ready: ${plan.summary}`,
    metadata: { desktopPlan: plan },
  });

  await store.updateSession(sessionId, {
    status: 'running',
    metadata: { desktopPlan: plan },
  });

  return plan;
}
