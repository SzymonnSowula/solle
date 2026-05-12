import { getRedis } from '@/lib/db/redis';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const { id } = params;

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      const send = (data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          // stream closed
        }
      };

      // Send initial connection event
      send({ type: 'connected', sessionId: id });

      // SECURITY: Create a DEDICATED Redis client for subscriptions.
      // A Redis client in subscribe mode cannot execute any other commands.
      // Using the shared global client would break all other Redis operations.
      const redis = getRedis().duplicate();
      const channel = `session:${id}:events`;

      const messageHandler = (receivedChannel: string, message: string) => {
        if (receivedChannel !== channel) return;
        try {
          const parsed = JSON.parse(message);
          send(parsed);
        } catch {
          send({ type: 'event', raw: message });
        }
      };

      // Subscribe and attach listener
      redis.subscribe(channel).then(() => {
        send({ type: 'subscribed', channel });
      }).catch((err: Error) => {
        send({ type: 'error', message: 'Failed to subscribe to events' });
        console.error('[SSE] Redis subscribe error:', err);
      });

      redis.on('message', messageHandler);

      // Keep alive ping every 15s
      const interval = setInterval(() => {
        send({ type: 'ping' });
      }, 15000);

      // Clean up on close — disconnect the duplicate Redis client
      const cleanup = () => {
        clearInterval(interval);
        redis.removeListener('message', messageHandler);
        redis.unsubscribe(channel).catch(() => {});
        redis.disconnect();
      };

      // Close stream after 5 minutes to prevent leaks
      const timeout = setTimeout(() => {
        cleanup();
        controller.close();
      }, 5 * 60 * 1000);

      // Handle abort
      if (_request.signal) {
        _request.signal.addEventListener('abort', () => {
          cleanup();
          clearTimeout(timeout);
          controller.close();
        });
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
