import { StructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

const CalendarToolInput = z.object({
  action: z.enum(['list', 'create', 'update', 'delete']),
  eventId: z.string().optional(),
  summary: z.string().optional(),
  description: z.string().optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  attendees: z.array(z.string().email()).optional(),
  sessionId: z.string(),
  requestId: z.string(),
});

export class CalendarTool extends StructuredTool<typeof CalendarToolInput> {
  name = 'calendar';
  description = 'Interact with Google Calendar: list events, create new events, update existing events, or delete events. Requires action type and appropriate parameters.';
  schema = CalendarToolInput;

  async _call(input: z.infer<typeof CalendarToolInput>): Promise<unknown> {
    const validated = CalendarToolInput.parse(input);
    const startTime = Date.now();

    try {
      const baseUrl = process.env.WORKER_GOOGLE_URL || 'http://localhost:3003';

      const response = await fetch(`${baseUrl}/calendar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: validated.action,
          eventId: validated.eventId,
          summary: validated.summary,
          description: validated.description,
          startTime: validated.startTime,
          endTime: validated.endTime,
          attendees: validated.attendees,
          sessionId: validated.sessionId,
          requestId: validated.requestId,
        }),
      });

      if (!response.ok) {
        throw new Error(`Calendar worker error: ${response.statusText}`);
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

export const calendarTool = new CalendarTool();
