'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Mic, MicOff, Loader2, Volume2 } from 'lucide-react';
import { VoiceOrb } from './VoiceOrb';
import { TranscriptPanel } from './TranscriptPanel';

interface VoiceConversationPanelProps {
  sessionId?: string;
}

export function VoiceConversationPanel({ sessionId }: VoiceConversationPanelProps) {
  const [isActive, setIsActive] = useState(false);
  const [status, setStatus] = useState<string>('idle');
  const [transcript, setTranscript] = useState('');
  const [agentResponse, setAgentResponse] = useState('');
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const stop = useCallback(() => {
    setStatus('disconnecting');
    mediaRecorderRef.current?.stop();
    audioStreamRef.current?.getTracks().forEach((t) => t.stop());
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    mediaRecorderRef.current = null;
    audioStreamRef.current = null;
    audioChunksRef.current = [];
    setIsActive(false);
    setStatus('idle');
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setTranscript('');
    setAgentResponse('');
    setStatus('connecting');

    try {
      // 1. Get voice config from backend
      const res = await fetch('/api/voice/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sessionId || crypto.randomUUID() }),
      });

      if (!res.ok) {
        throw new Error('Voice session not available');
      }

      const config = await res.json();
      const { apiKey, agentId, wsUrl } = config;

      if (!apiKey || !agentId) {
        throw new Error('ElevenLabs not configured');
      }

      // 2. Open WebSocket to ElevenLabs
      const url = new URL(wsUrl || 'wss://api.elevenlabs.io/v1/convai/conversation');
      url.searchParams.set('agent_id', agentId);

      const ws = new WebSocket(url.toString());
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus('connected');
        setIsActive(true);
        ws.send(JSON.stringify({
          type: 'conversation_initiation_client_data',
          conversation_config_override: {},
        }));
      };

      ws.onmessage = async (msg) => {
        try {
          const data = JSON.parse(msg.data);

          if (data.type === 'user_transcript') {
            setTranscript((prev) => prev + ' ' + (data.text || ''));
            setStatus('listening');
          }
          else if (data.type === 'agent_response') {
            setAgentResponse((prev) => prev + ' ' + (data.text || ''));
            setStatus('speaking');
          }
          else if (data.type === 'audio') {
            // Play audio
            if (data.audio) {
              const audio = new Audio(`data:audio/mp3;base64,${data.audio}`);
              audio.play();
            }
          }
          else if (data.type === 'interruption') {
            setStatus('listening');
          }
          else if (data.type === 'error') {
            setError(data.message || 'Voice error');
          }
        } catch {
          // binary audio - ignore for now
        }
      };

      ws.onerror = () => {
        setError('WebSocket error');
        setStatus('error');
      };

      ws.onclose = () => {
        setIsActive(false);
        setStatus('idle');
      };

      // 3. Start microphone
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) {
          audioChunksRef.current.push(e.data);

          // Convert to base64 and send
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64 = (reader.result as string).split(',')[1];
            ws.send(JSON.stringify({ type: 'audio', audio: base64 }));
          };
          reader.readAsDataURL(e.data);
        }
      };

      mediaRecorder.start(100); // 100ms chunks
      setStatus('listening');

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start voice');
      setStatus('error');
      setIsActive(false);
    }
  }, [sessionId]);

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return (
    <div className="rounded-xl border border-cream-300 bg-white overflow-hidden">
      <div className="border-b border-cream-200 px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mic className="h-4 w-4 text-teal-600" />
          <h3 className="text-sm font-semibold text-ink-700">Live Voice</h3>
        </div>
        <button
          onClick={isActive ? stop : start}
          disabled={status === 'connecting'}
          className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all duration-200 ${
            isActive
              ? 'bg-ink-800 text-white hover:bg-ink-700'
              : 'bg-teal-600 text-white hover:bg-teal-700'
          } disabled:opacity-50`}
        >
          {status === 'connecting' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : isActive ? (
            <MicOff className="h-3.5 w-3.5" />
          ) : (
            <Mic className="h-3.5 w-3.5" />
          )}
          {status === 'connecting' ? 'Connecting...' : isActive ? 'Stop Voice' : 'Start Voice'}
        </button>
      </div>

      <div className="px-5 py-8">
        <div className="flex flex-col items-center gap-4">
          <VoiceOrb status={status as any} />
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${
              status === 'idle' ? 'bg-cream-400' :
              status === 'connecting' ? 'bg-amber-400 animate-pulse' :
              status === 'connected' ? 'bg-teal-500' :
              status === 'listening' ? 'bg-teal-500 animate-pulse' :
              status === 'speaking' ? 'bg-teal-600' :
              'bg-red-500'
            }`} />
            <span className="text-xs font-medium text-ink-400 uppercase tracking-wider">{status}</span>
            {status === 'speaking' && (
              <Volume2 className="h-3 w-3 text-teal-600 animate-pulse" />
            )}
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-center">
            <p className="text-xs text-red-600 font-medium">{error}</p>
          </div>
        )}

        <TranscriptPanel transcript={transcript} agentResponse={agentResponse} />
      </div>
    </div>
  );
}
