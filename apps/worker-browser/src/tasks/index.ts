import { Request, Response } from 'express';
import { taskRunner } from '../runner';

export interface TaskRequest {
  task: 'search' | 'scrape' | 'fill_form';
  query?: string;
  limit?: number;
  url?: string;
  formData?: Record<string, string>;
  sessionId: string;
  requestId: string;
}

export async function handleTask(req: Request, res: Response): Promise<void> {
  const body = req.body as TaskRequest;
  const startTime = Date.now();

  try {
    if (!body.task) {
      res.status(400).json({ error: 'task is required' });
      return;
    }

    if (body.task === 'search' && !body.query) {
      res.status(400).json({ error: 'query is required for search task' });
      return;
    }

    if (body.task === 'scrape' && !body.url) {
      res.status(400).json({ error: 'url is required for scrape task' });
      return;
    }

    if (body.task === 'fill_form' && !body.url) {
      res.status(400).json({ error: 'url is required for fill_form task' });
      return;
    }

    let task: any;
    switch (body.task) {
      case 'search':
        task = { type: 'search', query: body.query!, limit: body.limit };
        break;
      case 'scrape':
        task = { type: 'scrape', url: body.url! };
        break;
      case 'fill_form':
        task = { type: 'fill_form', url: body.url!, formData: body.formData! };
        break;
      default:
        res.status(400).json({ error: 'Invalid task type' });
        return;
    }

    const result = await taskRunner.executeTask(task, body.sessionId);

    res.json({
      success: true,
      data: result,
      executionTimeMs: Date.now() - startTime,
      requestId: body.requestId,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      executionTimeMs: Date.now() - startTime,
    });
  }
}
