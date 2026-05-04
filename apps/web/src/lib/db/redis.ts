import Redis from 'ioredis';
import { getEnv } from '@/lib/utils/env';
import { logger } from '@/lib/utils/logger';

const log = logger('redis');

let redis: Redis | null = null;

export function getRedis(): Redis {
  if (!redis) {
    const url = getEnv('REDIS_URL');
    redis = new Redis(url, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
    });
    redis.on('error', (err) => {
      log.error('Redis error', err);
    });
    redis.on('connect', () => {
      log.info('Redis connected');
    });
  }
  return redis;
}

export async function publishEvent(channel: string, message: unknown): Promise<void> {
  try {
    await getRedis().publish(channel, JSON.stringify(message));
  } catch (err) {
    log.error('Failed to publish event', err);
  }
}
