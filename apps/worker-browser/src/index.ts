import express, { Express } from 'express';
import { handleTask } from './tasks';

const app: Express = express();
app.use(express.json());

app.post('/tasks', handleTask);

app.get('/health', (_, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const PORT = parseInt(process.env.PORT || '3002', 10);

app.listen(PORT, () => {
  console.log(`Browser worker running on port ${PORT}`);
});

export default app;
