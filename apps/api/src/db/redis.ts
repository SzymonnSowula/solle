import Redis from 'ioredis';

export class RedisDatabase {
  private client: Redis;
  private subscriber: Redis;

  constructor() {
    const redisUrl = process.env.REDIS_URL || 'redis://default:solli_dev_password@localhost:6379';
    this.client = new Redis(redisUrl, { maxRetriesPerRequest: 3 });
    this.subscriber = new Redis(redisUrl, { maxRetriesPerRequest: 3 });
  }

  async initialize(): Promise<void> {
    try {
      await this.client.ping();
      await this.subscriber.ping();
      console.log('Redis connected successfully');
    } catch (error) {
      console.error('Redis connection failed:', error);
      throw error;
    }
  }

  getClient(): Redis {
    return this.client;
  }

  getSubscriber(): Redis {
    return this.subscriber;
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.client.setex(key, ttlSeconds, value);
    } else {
      await this.client.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async publish(channel: string, message: string): Promise<void> {
    await this.client.publish(channel, message);
  }

  async subscribe(
    channel: string,
    callback: (message: string) => void
  ): Promise<void> {
    await this.subscriber.subscribe(channel);
    this.subscriber.on('message', (ch, msg) => {
      if (ch === channel) {
        callback(msg);
      }
    });
  }

  async close(): Promise<void> {
    await this.client.quit();
    await this.subscriber.quit();
  }
}

export const redisDb = new RedisDatabase();
