import { google } from 'googleapis';

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  attendees?: string[];
  location?: string;
  status: 'confirmed' | 'tentative' | 'cancelled';
}

export interface CreateEventInput {
  summary: string;
  description?: string;
  startTime: string;
  endTime: string;
  attendees?: string[];
  location?: string;
}

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

export class CalendarWorker {
  private calendar: ReturnType<typeof google.calendar>;
  private initialized = false;

  constructor() {
    this.calendar = google.calendar({ version: 'v3', auth: oauth2Client });
  }

  async listEvents(
    timeMin?: string,
    maxResults: number = 10
  ): Promise<CalendarEvent[]> {
    if (!this.initialized) {
      throw new Error('Calendar worker not initialized');
    }

    const response = await this.calendar.events.list({
      calendarId: 'primary',
      timeMin: timeMin || new Date().toISOString(),
      maxResults,
      singleEvents: true,
      orderBy: 'startTime',
    });

    return (response.data.items || []).map((event) => ({
      id: event.id!,
      summary: event.summary || 'Untitled',
      description: event.description || '',
      startTime: new Date(event.start?.dateTime || event.start?.date || ''),
      endTime: new Date(event.end?.dateTime || event.end?.date || ''),
      attendees: event.attendees?.map((a: { email?: string | null }) => a.email || '') || [],
      location: event.location || '',
      status: (event.status as 'confirmed' | 'tentative' | 'cancelled') || 'confirmed',
    }));
  }

  async createEvent(input: CreateEventInput): Promise<CalendarEvent> {
    if (!this.initialized) {
      throw new Error('Calendar worker not initialized');
    }

    const response = await this.calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary: input.summary,
        description: input.description,
        location: input.location,
        start: {
          dateTime: input.startTime,
        },
        end: {
          dateTime: input.endTime,
        },
        attendees: input.attendees?.map((email) => ({ email })),
      },
    });

    const event = response.data;
    return {
      id: event.id!,
      summary: event.summary || 'Untitled',
      description: event.description || '',
      startTime: new Date(event.start?.dateTime || event.start?.date || ''),
      endTime: new Date(event.end?.dateTime || event.end?.date || ''),
      attendees: event.attendees?.map((a: { email?: string | null }) => a.email || '') || [],
      location: event.location || '',
      status: (event.status as 'confirmed' | 'tentative' | 'cancelled') || 'confirmed',
    };
  }

  async updateEvent(
    eventId: string,
    updates: Partial<CreateEventInput>
  ): Promise<CalendarEvent> {
    if (!this.initialized) {
      throw new Error('Calendar worker not initialized');
    }

    const requestBody: Record<string, unknown> = {};
    if (updates.summary !== undefined) requestBody.summary = updates.summary;
    if (updates.description !== undefined) requestBody.description = updates.description;
    if (updates.startTime !== undefined) requestBody.start = { dateTime: updates.startTime };
    if (updates.endTime !== undefined) requestBody.end = { dateTime: updates.endTime };
    if (updates.location !== undefined) requestBody.location = updates.location;
    if (updates.attendees !== undefined) requestBody.attendees = updates.attendees.map((email: string) => ({ email }));

    const response = await this.calendar.events.patch({
      calendarId: 'primary',
      eventId,
      requestBody,
    });

    const event = response.data;
    return {
      id: event.id!,
      summary: event.summary || 'Untitled',
      description: event.description || '',
      startTime: new Date(event.start?.dateTime || event.start?.date || ''),
      endTime: new Date(event.end?.dateTime || event.end?.date || ''),
      attendees: event.attendees?.map((a: { email?: string | null }) => a.email || '') || [],
      location: event.location || '',
      status: (event.status as 'confirmed' | 'tentative' | 'cancelled') || 'confirmed',
    };
  }

  async deleteEvent(eventId: string): Promise<void> {
    if (!this.initialized) {
      throw new Error('Calendar worker not initialized');
    }

    await this.calendar.events.delete({
      calendarId: 'primary',
      eventId,
    });
  }

  setCredentials(accessToken: string, refreshToken?: string): void {
    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    this.initialized = true;
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}

export const calendarWorker = new CalendarWorker();
