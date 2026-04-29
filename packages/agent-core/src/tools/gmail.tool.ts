import { StructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

const GmailToolInput = z.object({
  action: z.enum(['read', 'draft', 'send', 'list']),
  messageId: z.string().optional(),
  to: z.string().email().optional(),
  subject: z.string().optional(),
  body: z.string().optional(),
  threadId: z.string().optional(),
  sessionId: z.string(),
  requestId: z.string(),
});

export class GmailTool extends StructuredTool<typeof GmailToolInput> {
  name = 'gmail';
  description = 'Interact with Gmail: read messages, draft new emails, send emails, or list recent messages. Requires action type and appropriate parameters.';
  schema = GmailToolInput;

  async _call(input: z.infer<typeof GmailToolInput>): Promise<unknown> {
    const validated = GmailToolInput.parse(input);
    const startTime = Date.now();

    try {
      const baseUrl = process.env.WORKER_GOOGLE_URL || 'http://localhost:3003';

      const response = await fetch(`${baseUrl}/gmail`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: validated.action,
          messageId: validated.messageId,
          to: validated.to,
          subject: validated.subject,
          body: validated.body,
          threadId: validated.threadId,
          sessionId: validated.sessionId,
          requestId: validated.requestId,
        }),
      });

      if (!response.ok) {
        throw new Error(`Gmail worker error: ${response.statusText}`);
      }

      const result = await response.json();

      return {
        success: true,
        data: result,
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTimeMs: Date.now() - startTime,
      };
    }
  }
}

export const gmailTool = new GmailTool();
