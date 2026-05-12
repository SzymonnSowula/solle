import { useEffect, useRef, useState, useCallback } from 'react';

export function useSSE(url: string | null) {
  const [events, setEvents] = useState<unknown[]>([]);
  const [connected, setConnected] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  const connect = useCallback(() => {
    if (!url) return;
    if (esRef.current) {
      esRef.current.close();
    }

    const es = new EventSource(url);
    esRef.current = es;

    es.onopen = () => setConnected(true);
    es.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data);
        setEvents((prev) => [...prev, data]);
      } catch {
        setEvents((prev) => [...prev, msg.data]);
      }
    };
    es.onerror = () => setConnected(false);
  }, [url]);

  const disconnect = useCallback(() => {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
      setConnected(false);
    }
  }, []);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return { events, connected, connect, disconnect };
}
