import { z } from 'zod';
import { logger } from '@/lib/utils/logger';
import { getGoogleTokensForSession } from '@/lib/google/tokens';

const log = logger('calendar-tool');

export const CalendarToolInputSchema = z.object({
  action: z.enum(['list', 'create', 'update', 'delete']),
  eventId: z.string().optional(),
  summary: z.string().optional(),
  description: z.string().optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  attendees: z.array(z.string().email()).optional(),
});

export type CalendarToolInput = z.infer<typeof CalendarToolInputSchema>;

export async function calendarTool(
  input: CalendarToolInput,
  sessionId?: string
): Promise<{ success: boolean; message: string; data?: unknown }> {
  const baseUrl = process.env.WORKER_GOOGLE_URL || 'http://localhost:3003';
  log.info(`Calendar action: ${input.action}`);

  // Payment enforcement
  if (sessionId) {
    const { requireToolPayment } = await import('@/lib/payments/tool-payment');
    await requireToolPayment(sessionId, 'calendar_list');
  }

  // Get Google tokens for this session's user
  let tokens: { accessToken: string; refreshToken: string | null } | null = null;
  if (sessionId) {
    tokens = await getGoogleTokensForSession(sessionId);
  }

  if (!tokens) {
    return {
      success: false,
      message: 'Google account not connected. Please connect your Google account in Settings > Connected Accounts.',
    };
  }

  try {
    const workerSecret = process.env.WORKER_AUTH_SECRET;
    const response = await fetch(`${baseUrl}/calendar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(workerSecret ? { 'x-worker-secret': workerSecret } : {}),
      },
      body: JSON.stringify({
        action: input.action,
        eventId: input.eventId,
        summary: input.summary,
        description: input.description,
        startTime: input.startTime,
        endTime: input.endTime,
        attendees: input.attendees,
        requestId: crypto.randomUUID(),
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Google worker error: ${response.status} ${text}`);
    }

    const result = (await response.json()) as { success: boolean; data?: unknown; error?: string };

    if (result.success) {
      return { success: true, message: `Calendar ${input.action} completed`, data: result.data };
    }

    throw new Error(result.error || 'Calendar action failed');
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    log.error('Calendar tool failed', msg);
    return { success: false, message: msg };
  }
}
