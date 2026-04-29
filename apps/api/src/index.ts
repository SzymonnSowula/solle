import Fastify from 'fastify';
import { sessionsRoutes } from './routes/sessions';
import { agentsRoutes } from './routes/agents';
import { receiptsRoutes } from './routes/receipts';
import { voiceRoutes } from './routes/voice';
import { orchestratorService } from './services/orchestrator';
import { voiceService } from './services/voice';
import { receiptService } from './services/receipt.service';
import { postgresDb } from './db/postgres';
import { redisDb } from './db/redis';

export async function buildApp() {
  const fastify = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
      transport: {
        target: 'pino-pretty',
        options: {
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      },
    },
  });

  await fastify.register(import('@fastify/cors'), {
    origin: process.env.NODE_ENV === 'production' ? false : true,
    credentials: true,
  });

  await fastify.register(import('@fastify/websocket'));

  await postgresDb.initialize();
  await redisDb.initialize();

  await fastify.decorate('orchestrator', orchestratorService);
  await fastify.decorate('voice', voiceService);
  await fastify.decorate('receipts', receiptService);
  await fastify.decorate('db', postgresDb);
  await fastify.decorate('redis', redisDb);

  fastify.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  await fastify.register(sessionsRoutes, { prefix: '/api/sessions' });
  await fastify.register(agentsRoutes, { prefix: '/api/agents' });
  await fastify.register(receiptsRoutes, { prefix: '/api/receipts' });
  await fastify.register(voiceRoutes, { prefix: '/api' });

  return fastify;
}

export type App = Awaited<ReturnType<typeof buildApp>>;
