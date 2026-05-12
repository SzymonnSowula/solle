'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Mic, MicOff, Loader2, Volume2 } from 'lucide-react';
import { VoiceOrb } from './VoiceOrb';
import { TranscriptPanel } from './TranscriptPanel';

interface VoiceConversationPanelProps {
  sessionId?: string;
}

export function VoiceConversationPanel({ sessionId: initialSessionId }: VoiceConversationPanelProps) {
  const [isActive, setIsActive] = useState(false);
  const [status, setStatus] = useState<string>('idle');
  const [transcript, setTranscript] = useState('');
  const [agentResponse, setAgentResponse] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(initialSessionId || null);
  const [sessionStatus, setSessionStatus] = useState<string | null>(null);
  const [sessionSummary, setSessionSummary] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const esRef = useRef<EventSource | null>(null);

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

  const [storedAgentId, setStoredAgentId] = useState<string | null>(null);

  const start = useCallback(async () => {
    setError(null);
    setTranscript('');
    setAgentResponse('');
    setStatus('connecting');

    try {
      // 1. Re-use existing agentId from localStorage if available
      const cachedAgentId = storedAgentId || localStorage.getItem('solli-elevenlabs-agent-id');

      const res = await fetch('/api/voice/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: initialSessionId || activeSessionId || crypto.randomUUID(),
          agentId: cachedAgentId,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || errData.details || 'Voice session not available');
      }

      const config = await res.json();
      const { apiKey, agentId, wsUrl } = config;

      if (!apiKey || !agentId) {
        throw new Error('ElevenLabs not configured');
      }

      // Cache agentId so we don't recreate it every time
      if (agentId !== cachedAgentId) {
        localStorage.setItem('solli-elevenlabs-agent-id', agentId);
        setStoredAgentId(agentId);
      }

      // 2. Open WebSocket to ElevenLabs ConvAI
      const url = new URL(wsUrl || 'wss://api.elevenlabs.io/v1/convai/conversation');
      url.searchParams.set('agent_id', agentId);
      // WebSocket in browser cannot carry custom headers, so pass API key as query param
      url.searchParams.set('xi-api-key', apiKey);

      const ws = new WebSocket(url.toString());
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus('connected');
        setIsActive(true);
        ws.send(JSON.stringify({
          type: 'conversation_initiation_client_data',
          conversation_config_override: {
            agent: {
              prompt: `You are Volle, a voice-native process operator. Your job is to help users accomplish real work through natural conversation.

How you behave:
- Ask clarifying questions before taking action
- Speak concisely and naturally
- Confirm important actions before executing them
- Summarize what you did at the end

You have access to the following tools:
- create_session: When user wants to start a new task, create a session and tell them the session ID.
- send_message: If a session is clarifying (waiting for answers), use this to send the user's answer.
- get_session_status: Check if a session is done and what the results are.
- get_session_events: Get the latest activity timeline for a session.

When a user asks for something vague, ask 1-2 clarifying questions before proceeding.
Always confirm the session ID with the user after creating it.`,
              first_message: "Hey, I'm Volle. What are we working on today?",
              language: 'en',
            },
            asr: {
              quality: 'high',
            },
            turn: {
              turn_timeout: 8,
            },
            tts: {
              voice_id: '21m00Tcm4TlvDq8ikWAM',
            },
            // Tool definitions for ElevenLabs (simplified for ConvAI websocket)
            client_tools: [
              {
                name: 'create_session',
                description: 'Create a new Volle work session for the user request',
                parameters: {
                  type: 'object',
                  properties: {
                    input: { type: 'string', description: 'What the user wants to do' },
                  },
                  required: ['input'],
                },
              },
              {
                name: 'send_message',
                description: 'Send a clarifying message or continuation to an existing session',
                parameters: {
                  type: 'object',
                  properties: {
                    sessionId: { type: 'string', description: 'The session ID' },
                    message: { type: 'string', description: 'The message to send' },
                  },
                  required: ['sessionId', 'message'],
                },
              },
              {
                name: 'get_session_status',
                description: 'Check the current status and summary of a session',
                parameters: {
                  type: 'object',
                  properties: {
                    sessionId: { type: 'string', description: 'The session ID' },
                  },
                  required: ['sessionId'],
                },
              },
              {
                name: 'get_session_events',
                description: 'Get recent events from a session timeline',
                parameters: {
                  type: 'object',
                  properties: {
                    sessionId: { type: 'string', description: 'The session ID' },
                  },
                  required: ['sessionId'],
                },
              },
            ],
          },
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
          else if (data.type === 'client_tool_call') {
            // ElevenLabs wants us to execute a tool
            const toolName = data.tool_name;
            const toolParams = data.parameters || {};
            const toolCallId = data.tool_call_id;

            try {
              const res = await fetch('/api/voice/tool-call', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  toolName,
                  parameters: toolParams,
                }),
              });

              const toolResult = await res.json();

              // If a session was created/used, track it locally
              if (toolResult.sessionId && !activeSessionId) {
                setActiveSessionId(toolResult.sessionId);
              }

              // Send result back to ElevenLabs
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                  type: 'client_tool_result',
                  tool_call_id: toolCallId,
                  result: toolResult,
                }));
              }
            } catch (toolErr) {
              console.error('[Voice Tool Call] failed:', toolErr);
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                  type: 'client_tool_result',
                  tool_call_id: toolCallId,
                  result: { error: 'Tool execution failed' },
                }));
              }
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
  }, [initialSessionId, activeSessionId]);

  // --- Real-time session sync ---
  useEffect(() => {
    if (!activeSessionId || !isActive) return;

    // 1. SSE subscription for live events
    const es = new EventSource(`/api/sessions/${activeSessionId}/stream`);
    esRef.current = es;

    es.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data);
        if (data.type === 'event' && data.event) {
          const ev = data.event;
          // Show key events in transcript
          if (['tool_result', 'completed', 'failed'].includes(ev.event_type || ev.eventType)) {
            const text = ev.content || ev.eventType || '';
            setAgentResponse((prev) =>
              prev + `\n[${ev.agent_name || ev.agentName}] ${text}`
            );
          }
        }
      } catch {
        // ignore malformed
      }
    };

    // 2. Polling fallback every 5s
    const poll = async () => {
      try {
        const res = await fetch(`/api/sessions/${activeSessionId}`);
        if (res.ok) {
          const data = await res.json();
          setSessionStatus(data.status);
          if (data.summary) setSessionSummary(data.summary);
        }
      } catch {
        // ignore
      }
    };

    poll();
    const interval = setInterval(poll, 5000);

    return () => {
      es.close();
      clearInterval(interval);
    };
  }, [activeSessionId, isActive]);

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return (
    <div className="rounded-xl border border-white/10 bg-neutral-950 overflow-hidden">
      <div className="border-b border-white/5 px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mic className="h-4 w-4 text-red-400" />
          <h3 className="text-sm font-semibold text-neutral-200">Live Voice</h3>
        </div>
        <button
          onClick={isActive ? stop : start}
          disabled={status === 'connecting'}
          className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all duration-200 ${
            isActive
              ? 'bg-red-500 text-white hover:bg-red-400'
              : 'bg-red-600 text-white hover:bg-red-700'
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
              status === 'idle' ? 'bg-neutral-500' :
              status === 'connecting' ? 'bg-amber-400 animate-pulse' :
              status === 'connected' ? 'bg-red-500' :
              status === 'listening' ? 'bg-red-500 animate-pulse' :
              status === 'speaking' ? 'bg-red-600' :
              'bg-red-500'
            }`} />
            <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider">{status}</span>
            {status === 'speaking' && (
              <Volume2 className="h-3 w-3 text-red-400 animate-pulse" />
            )}
          </div>
          {activeSessionId && sessionStatus && (
            <div className="flex flex-col items-center gap-1">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${
                sessionStatus === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' :
                sessionStatus === 'failed' ? 'bg-red-500/10 text-red-400 border border-red-500/30' :
                sessionStatus === 'clarifying' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' :
                'bg-neutral-900 text-neutral-400 border border-white/5'
              }`}>
                Session {sessionStatus}
              </span>
              {sessionSummary && (
                <span className="text-[10px] text-neutral-400 max-w-xs text-center truncate">
                  {sessionSummary}
                </span>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="mt-4 rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-center">
            <p className="text-xs text-red-400 font-medium">{error}</p>
          </div>
        )}

        <TranscriptPanel transcript={transcript} agentResponse={agentResponse} />
      </div>
    </div>
  );
}
