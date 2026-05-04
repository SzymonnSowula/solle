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

      const redis = getRedis();
      const channel = `session:${id}:events`;

      const handler = (message: string) => {
        try {
          const parsed = JSON.parse(message);
          send(parsed);
        } catch {
          send({ type: 'event', raw: message });
        }
      };

      redis.subscribe(channel, (err) => {
        if (err) {
          send({ type: 'error', message: 'Failed to subscribe to events' });
        }
      });

      redis.on('message', (receivedChannel, message) => {
        if (receivedChannel === channel) {
          handler(message);
        }
      });

      // Keep alive ping every 15s
      const interval = setInterval(() => {
        send({ type: 'ping' });
      }, 15000);

      // Clean up on close
      const cleanup = () => {
        clearInterval(interval);
        redis.unsubscribe(channel).catch(() => {});
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
