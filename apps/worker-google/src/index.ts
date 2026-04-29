import express, { Application } from 'express';
import { gmailWorker } from './gmail';
import { calendarWorker } from './calendar';

const app: Application = express();
app.use(express.json());

app.post('/gmail', async (req, res) => {
  const { action, messageId, to, subject, body, threadId, requestId } = req.body;
  const startTime = Date.now();

  try {
    if (!action) {
      res.status(400).json({ error: 'action is required' });
      return;
    }

    let result;
    switch (action) {
      case 'list':
        result = await gmailWorker.listMessages();
        break;
      case 'read':
        if (!messageId) {
          res.status(400).json({ error: 'messageId is required for read action' });
          return;
        }
        result = await gmailWorker.readMessage(messageId);
        break;
      case 'draft':
        result = await gmailWorker.draftEmail({ to, subject, body, threadId });
        break;
      case 'send':
        result = await gmailWorker.sendEmail({ to, subject, body, threadId });
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

app.post('/calendar', async (req, res) => {
  const { action, eventId, summary, description, startTime, endTime, attendees, requestId } = req.body;
  const startTimeMs = Date.now();

  try {
    if (!action) {
      res.status(400).json({ error: 'action is required' });
      return;
    }

    let result;
    switch (action) {
      case 'list':
        result = await calendarWorker.listEvents();
        break;
      case 'create':
        result = await calendarWorker.createEvent({ summary, description, startTime, endTime, attendees });
        break;
      case 'update':
        if (!eventId) {
          res.status(400).json({ error: 'eventId is required for update action' });
          return;
        }
        result = await calendarWorker.updateEvent(eventId, { summary, description, startTime, endTime, attendees });
        break;
      case 'delete':
        if (!eventId) {
          res.status(400).json({ error: 'eventId is required for delete action' });
          return;
        }
        await calendarWorker.deleteEvent(eventId);
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
