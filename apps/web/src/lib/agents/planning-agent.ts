import type { SessionStore } from '@/lib/db/session-store';
import { calendarTool, type CalendarToolInput } from '@/lib/tools/calendar.tool';
import { getToolCost, formatCost } from '@/lib/x402';
import { logger } from '@/lib/utils/logger';

const log = logger('planning-agent');
const CALENDAR_LIST_COST = getToolCost('calendar_list');
const CALENDAR_CREATE_COST = getToolCost('calendar_create');

export interface CalendarEvent {
  id: string;
  summary: string;
  start: string;
  end: string;
}

export interface PlanningResult {
  eventsCreated: CalendarEvent[];
  actionsTaken: string[];
  upcomingEvents: CalendarEvent[];
}

export async function planningAgent(
  sessionId: string,
  query: string,
  store: SessionStore
): Promise<PlanningResult> {
  await store.addEvent({
    sessionId,
    agentName: 'planning',
    eventType: 'started',
    content: `Starting planning for: "${query}"`,
  });

  const result: PlanningResult = {
    eventsCreated: [],
    actionsTaken: [],
    upcomingEvents: [],
  };

  try {
    // Step 1: List existing events
    await store.addTask({
      sessionId,
      agentName: 'planning',
      toolName: 'calendar_list',
      inputJson: { action: 'list' },
      status: 'running',
    });

    const listRes = await calendarTool({ action: 'list' }, sessionId);

    if (listRes.success && Array.isArray(listRes.data)) {
      result.upcomingEvents = listRes.data.slice(0, 5).map((e: any) => ({
        id: e.id || 'unknown',
        summary: e.summary || 'No title',
        start: e.start?.dateTime || e.start?.date || '',
        end: e.end?.dateTime || e.end?.date || '',
      }));

      await store.addEvent({
        sessionId,
        agentName: 'planning',
        eventType: 'tool_result',
        content: `Listed ${result.upcomingEvents.length} upcoming events · Cost: ${formatCost(CALENDAR_LIST_COST)}`,
        metadata: { events: result.upcomingEvents, costSol: CALENDAR_LIST_COST },
      });

      await store.addTask({
        sessionId,
        agentName: 'planning',
        toolName: 'calendar_list',
        outputJson: { count: result.upcomingEvents.length },
        status: 'completed',
        costSol: CALENDAR_LIST_COST,
      });

      result.actionsTaken.push(`Listed ${result.upcomingEvents.length} upcoming events`);
    }

    // Step 2: If query mentions creating an event, create it
    const lowerQuery = query.toLowerCase();
    if (lowerQuery.includes('schedule') || lowerQuery.includes('create') || lowerQuery.includes('add') || lowerQuery.includes('plan')) {
      // Parse a simple date heuristic: tomorrow at 10am for 1 hour
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(10, 0, 0, 0);
      const endTime = new Date(tomorrow.getTime() + 60 * 60 * 1000);

      const createInput: CalendarToolInput = {
        action: 'create',
        summary: query.length > 50 ? 'Scheduled event' : query,
        description: `Created by Volle planning agent for: ${query}`,
        startTime: tomorrow.toISOString(),
        endTime: endTime.toISOString(),
      };

      await store.addTask({
        sessionId,
        agentName: 'planning',
        toolName: 'calendar_create',
        inputJson: createInput,
        status: 'running',
      });

      const createRes = await calendarTool(createInput, sessionId);

      if (createRes.success && createRes.data) {
        const evt = createRes.data as any;
        result.eventsCreated.push({
          id: evt.id || 'unknown',
          summary: evt.summary || createInput.summary || 'Event',
          start: evt.start?.dateTime || createInput.startTime || '',
          end: evt.end?.dateTime || createInput.endTime || '',
        });
        result.actionsTaken.push('Created calendar event');

        await store.addEvent({
          sessionId,
          agentName: 'planning',
          eventType: 'tool_result',
          content: `Event created · Cost: ${formatCost(CALENDAR_CREATE_COST)}`,
          metadata: { event: createRes.data, costSol: CALENDAR_CREATE_COST },
        });

        await store.addTask({
          sessionId,
          agentName: 'planning',
          toolName: 'calendar_create',
          outputJson: createRes.data as Record<string, unknown>,
          status: 'completed',
          costSol: CALENDAR_CREATE_COST,
        });
      }
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    log.error('Planning agent failed', msg);

    await store.addEvent({
      sessionId,
      agentName: 'planning',
      eventType: 'failed',
      content: `Planning failed: ${msg}`,
    });

    await store.addTask({
      sessionId,
      agentName: 'planning',
      toolName: 'calendar_list',
      status: 'failed',
      errorMessage: msg,
      costSol: CALENDAR_LIST_COST,
    });
  }

  await store.addEvent({
    sessionId,
    agentName: 'planning',
    eventType: 'completed',
    content: `Planning completed. ${result.actionsTaken.join('. ')}`,
  });

  return result;
}
