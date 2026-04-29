import { useState, useEffect, useCallback } from 'react';


interface VoiceSessionState {
  isConnected: boolean;
  transcript: string;
  error: string | null;
}

export function useVoiceSession(sessionId: string) {
  const [state, setState] = useState<VoiceSessionState>({
    isConnected: false,
    transcript: '',
    error: null,
  });

  const wsRef = useCallback(() => {
    const wsUrl = import.meta.env.VITE_ELEVENLABS_WS_URL || 'wss://api.elevenlabs.io/v1/agent/stream';
    const ws = new WebSocket(`${wsUrl}?session_id=${sessionId}`);

    ws.onopen = () => {
      setState((prev) => ({ ...prev, isConnected: true, error: null }));
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        if (message.type === 'transcript') {
          setState((prev) => ({
            ...prev,
            transcript: message.text || prev.transcript,
          }));
        }
      } catch {
        console.error('Failed to parse WebSocket message');
      }
    };

    ws.onerror = () => {
      setState((prev) => ({
        ...prev,
        error: 'WebSocket connection error',
        isConnected: false,
      }));
    };

    ws.onclose = () => {
      setState((prev) => ({ ...prev, isConnected: false }));
    };

    return ws;
  }, [sessionId]);

  useEffect(() => {
    const ws = wsRef();
    return () => {
      ws.close();
    };
  }, [wsRef]);

  const sendText = useCallback(
    (text: string) => {
      setState((prev) => ({ ...prev, transcript: text }));
    },
    []
  );

  return {
    isConnected: state.isConnected,
    transcript: state.transcript,
    error: state.error,
    sendText,
  };
}
