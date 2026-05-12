import express, { Application, Request, Response, NextFunction } from 'express';
import { GmailWorker, gmailWorker } from './gmail';
import { CalendarWorker, calendarWorker } from './calendar';

const app: Application = express();
app.use(express.json());

// SECURITY: Authenticate inter-service requests with shared secret
function requireWorkerAuth(req: Request, res: Response, next: NextFunction): void {
  const secret = process.env.WORKER_AUTH_SECRET;
  if (!secret) {
    // In development without secret configured, allow requests with a warning
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[GoogleWorker] WORKER_AUTH_SECRET not set — allowing request in dev mode');
      next();
      return;
    }
    res.status(503).json({ error: 'Worker not configured — WORKER_AUTH_SECRET missing' });
    return;
  }

  const authHeader = req.headers['x-worker-secret'];
  if (authHeader !== secret) {
    res.status(401).json({ error: 'Unauthorized — invalid worker secret' });
    return;
  }
  next();
}

function getGmailWorker(req: express.Request): GmailWorker {
  const { accessToken, refreshToken } = req.body;
  if (accessToken) {
    return GmailWorker.createWithTokens(accessToken, refreshToken);
  }
  return gmailWorker;
}

function getCalendarWorker(req: express.Request): CalendarWorker {
  const { accessToken, refreshToken } = req.body;
  if (accessToken) {
    return CalendarWorker.createWithTokens(accessToken, refreshToken);
  }
  return calendarWorker;
}

// Protected Gmail endpoint
app.post('/gmail', requireWorkerAuth, async (req, res) => {
  const { action, messageId, to, subject, body, threadId, requestId } = req.body;
  const startTime = Date.now();

  try {
    if (!action) {
      res.status(400).json({ error: 'action is required' });
      return;
    }

    const worker = getGmailWorker(req);
    let result;
    switch (action) {
      case 'list':
        result = await worker.listMessages();
        break;
      case 'read':
        if (!messageId) {
          res.status(400).json({ error: 'messageId is required for read action' });
          return;
        }
        result = await worker.readMessage(messageId);
        break;
      case 'draft':
        result = await worker.draftEmail({ to, subject, body, threadId });
        break;
      case 'send':
        result = await worker.sendEmail({ to, subject, body, threadId });
        break;
      default:
        res.status(400).json({ error: `Unknown action: ${action}` });
        return;
    }

    res.json({
      success: true,
      data: result,
      executionTimeMs: Date.now() - startTime,
      requestId,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      executionTimeMs: Date.now() - startTime,
    });
  }
});

// Protected Calendar endpoint
app.post('/calendar', requireWorkerAuth, async (req, res) => {
  const { action, eventId, summary, description, startTime, endTime, attendees, requestId } = req.body;
  const startTimeMs = Date.now();

  try {
    if (!action) {
      res.status(400).json({ error: 'action is required' });
      return;
    }

    const worker = getCalendarWorker(req);
    let result;
    switch (action) {
      case 'list':
        result = await worker.listEvents();
        break;
      case 'create':
        result = await worker.createEvent({ summary, description, startTime, endTime, attendees });
        break;
      case 'update':
        if (!eventId) {
          res.status(400).json({ error: 'eventId is required for update action' });
          return;
        }
        result = await worker.updateEvent(eventId, { summary, description, startTime, endTime, attendees });
        break;
      case 'delete':
        if (!eventId) {
          res.status(400).json({ error: 'eventId is required for delete action' });
          return;
        }
        await worker.deleteEvent(eventId);
        result = { deleted: true };
        break;
      default:
        res.status(400).json({ error: `Unknown action: ${action}` });
        return;
    }

    res.json({
      success: true,
      data: result,
      executionTimeMs: Date.now() - startTimeMs,
      requestId,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      executionTimeMs: Date.now() - startTimeMs,
    });
  }
});

// Health check (public)
app.get('/health', (_, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    gmail: gmailWorker.isInitialized(),
    calendar: calendarWorker.isInitialized(),
  });
});

const PORT = parseInt(process.env.PORT || '3003', 10);

app.listen(PORT, () => {
  console.log(`Google worker running on port ${PORT}`);
});

export default app;
