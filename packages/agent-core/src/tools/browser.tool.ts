import { StructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

const BrowserToolInput = z.object({
  task: z.enum(['search', 'scrape', 'fill_form']),
  query: z.string().optional(),
  url: z.string().url().optional(),
  formData: z.record(z.unknown()).optional(),
  sessionId: z.string(),
  requestId: z.string(),
});

export class BrowserTool extends StructuredTool<typeof BrowserToolInput> {
  name = 'browser';
  description = 'Execute browser tasks: search the web, scrape pages, or fill forms. Requires task type and appropriate parameters.';
  schema = BrowserToolInput;

  async _call(input: z.infer<typeof BrowserToolInput>): Promise<unknown> {
    const validated = BrowserToolInput.parse(input);
    const startTime = Date.now();

    try {
      const baseUrl = process.env.WORKER_BROWSER_URL || 'http://localhost:3002';

      const response = await fetch(`${baseUrl}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task: validated.task,
          query: validated.query,
          url: validated.url,
          formData: validated.formData,
          sessionId: validated.sessionId,
          requestId: validated.requestId,
        }),
      });

      if (!response.ok) {
        throw new Error(`Browser worker error: ${response.statusText}`);
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

export const browserTool = new BrowserTool();
