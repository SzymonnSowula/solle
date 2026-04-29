import { useEffect, useRef, useState, useCallback } from 'react';

interface VoiceOrbProps {
  sessionId?: string;
}

type VoiceStatus = 'idle' | 'connecting' | 'listening' | 'thinking' | 'speaking' | 'error';

function VoiceOrb({ sessionId }: VoiceOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<Blob[]>([]);
  const isPlayingRef = useRef(false);

  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let phase = 0;

    const draw = () => {
      const width = canvas.width;
      const height = canvas.height;
      const centerX = width / 2;
      const centerY = height / 2;
      const baseRadius = Math.min(width, height) / 3;

      ctx.clearRect(0, 0, width, height);

      const colors = ['#6366f1', '#a855f7', '#8b5cf6'];
      const layers = 3;

      for (let i = 0; i < layers; i++) {
        const offset = (i / layers) * Math.PI * 2;
        const activityBoost = status === 'listening' || status === 'speaking' ? 15 : 5;
        const radius = baseRadius + Math.sin(phase + offset) * activityBoost;

        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.strokeStyle = colors[i];
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.3 + (i / layers) * 0.4;
        ctx.stroke();
      }

      if (status === 'listening' || status === 'speaking') {
        ctx.beginPath();
        ctx.arc(centerX, centerY, baseRadius * 0.3, 0, Math.PI * 2);
        ctx.fillStyle = status === 'listening' ? '#22c55e' : '#6366f1';
        ctx.globalAlpha = 0.5 + Math.sin(phase * 2) * 0.3;
        ctx.fill();
      }

      ctx.globalAlpha = 1;
      phase += 0.05;
      animationId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [status]);

  // Play audio from ElevenLabs
  const playNextAudio = useCallback(async () => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0) return;
    isPlayingRef.current = true;

    const blob = audioQueueRef.current.shift()!;
    const arrayBuffer = await blob.arrayBuffer();

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    const ctx = audioContextRef.current;

    try {
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.onended = () => {
        isPlayingRef.current = false;
        playNextAudio();
      };
      source.start();
    } catch {
      isPlayingRef.current = false;
      playNextAudio();
    }
  }, []);

  const connect = useCallback(async () => {
    if (!sessionId) {
      setError('No session ID');
      return;
    }

    setStatus('connecting');
    setError(null);

    const ws = new WebSocket(`ws://localhost:3001/api/voice/${sessionId}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('listening');
      // Start recording
      navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
        const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (event) => {
          if (event.data.size > 0 && ws.readyState === WebSocket.OPEN) {
            ws.send(event.data);
          }
        };

        recorder.start(100); // 100ms chunks
      }).catch((err) => {
        console.error('Microphone error:', err);
        setError('Microphone access denied');
        setStatus('error');
      });
    };

    ws.onmessage = async (event) => {
      try {
        // Try JSON first
        const text = await event.data.text();
        const message = JSON.parse(text);

        if (message.type === 'user_transcript') {
          setTranscript((prev) => prev + ' ' + (message.user_transcript || ''));
          setStatus('thinking');
        } else if (message.type === 'agent_response') {
          setTranscript((prev) => prev + '\n[Solli]: ' + (message.agent_response || ''));
          setStatus('speaking');
        } else if (message.type === 'connected') {
          setStatus('listening');
        } else if (message.type === 'error') {
          setError(message.message || 'Voice error');
          setStatus('error');
        }
      } catch {
        // Binary audio data
        audioQueueRef.current.push(event.data as Blob);
        playNextAudio();
      }
    };

    ws.onerror = () => {
      setError('WebSocket error');
      setStatus('error');
    };

    ws.onclose = () => {
      setStatus('idle');
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
      }
    };
  }, [sessionId, playNextAudio]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
    }
    setStatus('idle');
  }, []);

  const toggle = useCallback(() => {
    if (status === 'idle' || status === 'error') {
      connect();
    } else {
      disconnect();
    }
  }, [status, connect, disconnect]);

  const statusLabels: Record<VoiceStatus, string> = {
    idle: 'Tap to speak',
    connecting: 'Connecting...',
    listening: 'Listening...',
    thinking: 'Thinking...',
    speaking: 'Speaking...',
    error: 'Error',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>
      <div style={{ position: 'relative' }}>
        <canvas
          ref={canvasRef}
          width={200}
          height={200}
          style={{
            display: 'block',
            borderRadius: '50%',
            background: 'radial-gradient(circle, #1a1a1a 0%, #0f0f0f 100%)',
            boxShadow:
              status === 'listening' || status === 'speaking'
                ? '0 0 40px rgba(99, 102, 241, 0.4)'
                : '0 0 20px rgba(0, 0, 0, 0.3)',
            cursor: 'pointer',
          }}
          onClick={toggle}
        />
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>
            {status === 'listening' ? '🎤' : status === 'speaking' ? '🔊' : status === 'error' ? '⚠️' : '🔇'}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#a1a1a1' }}>{statusLabels[status]}</div>
        </div>
      </div>

      {error && (
        <div
          style={{
            maxWidth: '400px',
            padding: '0.75rem',
            background: '#2a0a0a',
            borderRadius: '0.5rem',
            border: '1px solid #ff4444',
            textAlign: 'center',
            fontSize: '0.875rem',
            color: '#ff8888',
          }}
        >
          {error}
        </div>
      )}

      {transcript && (
        <div
          style={{
            maxWidth: '400px',
            padding: '1rem',
            background: '#1a1a1a',
            borderRadius: '0.75rem',
            border: '1px solid #333',
            textAlign: 'left',
            fontSize: '0.875rem',
            color: '#a1a1a1',
            maxHeight: '200px',
            overflowY: 'auto',
            whiteSpace: 'pre-wrap',
          }}
        >
          {transcript}
        </div>
      )}
    </div>
  );
}

export default VoiceOrb;
