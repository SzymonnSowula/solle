import express, { Express, Request, Response, NextFunction } from 'express';
import { handleTask } from './tasks';

const app: Express = express();
app.use(express.json());

// SECURITY: Authenticate inter-service requests with shared secret
function requireWorkerAuth(req: Request, res: Response, next: NextFunction): void {
  const secret = process.env.WORKER_AUTH_SECRET;
  if (!secret) {
    // In development without secret configured, allow requests with a warning
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[BrowserWorker] WORKER_AUTH_SECRET not set — allowing request in dev mode');
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

// Protected task endpoint
app.post('/tasks', requireWorkerAuth, handleTask);

// Health check (public)
app.get('/health', (_, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const PORT = parseInt(process.env.PORT || '3002', 10);

app.listen(PORT, () => {
  console.log(`Browser worker running on port ${PORT}`);
});

export default app;
