import { useState, useEffect, useCallback, useRef } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { useElectron } from '../hooks/useElectron';

export function VoicePanel() {
  const [isActive, setIsActive] = useState(false);
  const [status, setStatus] = useState<string>('idle');
  const [transcript, setTranscript] = useState('');
  const [agentResponse, setAgentResponse] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [apiBaseUrl, setApiBaseUrl] = useState<string>('http://localhost:3000');

  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const { ipcInvoke } = useElectron();

  useEffect(() => {
    ipcInvoke<{ apiBaseUrl: string }>('desktop:config:get')
      .then((cfg) => setApiBaseUrl(cfg.apiBaseUrl))
      .catch(() => setApiBaseUrl('http://localhost:3000'));
  }, [ipcInvoke]);

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
    setIsActive(false);
    setStatus('idle');
    ipcInvoke('desktop:window:setOverlayState', 'idle').catch(() => {});
  }, [ipcInvoke]);

  const start = useCallback(async () => {
    setError(null);
    setTranscript('');
    setAgentResponse('');
    setStatus('connecting');
    ipcInvoke('desktop:window:setOverlayState', 'listening').catch(() => {});

    try {
      const res = await fetch(`${apiBaseUrl}/api/voice/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: activeSessionId || crypto.randomUUID(),
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Voice session not available. Is the backend running?');
      }

      const config = await res.json();
      const { apiKey, agentId, wsUrl } = config;

      if (!apiKey || !agentId) {
        throw new Error('ElevenLabs not configured on backend');
      }

      const url = new URL(wsUrl || 'wss://api.elevenlabs.io/v1/convai/conversation');
      url.searchParams.set('agent_id', agentId);
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
              prompt: `You are Solli Desktop, a voice-native desktop agent for Windows. You help users organize files, manage their desktop, and execute tasks.

How you behave:
- Ask clarifying questions before taking action
- Speak concisely and naturally
- Confirm important actions before executing them
- Summarize what you did at the end

You have access to the following tools:
- create_session: When user wants to start a new task, create a session and tell them the session ID.
- send_message: If a session is clarifying, use this to send the user's answer.
- get_session_status: Check if a session is done and what the results are.
- execute_desktop_plan: When the user wants to organize files on their desktop, generate a plan and show it for confirmation.

When a user asks for something vague, ask 1-2 clarifying questions before proceeding.`,
              first_message: "Hey, I'm Solli Desktop. What should we organize today?",
              language: 'en',
            },
            asr: { quality: 'high' },
            turn: { turn_timeout: 8 },
            tts: { voice_id: '21m00Tcm4TlvDq8ikWAM' },
            client_tools: [
              {
                name: 'create_session',
                description: 'Create a new Solli work session',
                parameters: {
                  type: 'object',
                  properties: { input: { type: 'string' } },
                  required: ['input'],
                },
              },
              {
                name: 'send_message',
                description: 'Send a message to an existing session',
                parameters: {
                  type: 'object',
                  properties: {
                    sessionId: { type: 'string' },
                    message: { type: 'string' },
                  },
                  required: ['sessionId', 'message'],
                },
              },
              {
                name: 'get_session_status',
                description: 'Check session status',
                parameters: {
                  type: 'object',
                  properties: { sessionId: { type: 'string' } },
                  required: ['sessionId'],
                },
              },
              {
                name: 'execute_desktop_plan',
                description: 'Generate and show a desktop file organization plan for user confirmation',
                parameters: {
                  type: 'object',
                  properties: { input: { type: 'string' } },
                  required: ['input'],
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
            ipcInvoke('desktop:window:setOverlayState', 'listening').catch(() => {});
          } else if (data.type === 'agent_response') {
            setAgentResponse((prev) => prev + ' ' + (data.text || ''));
            setStatus('speaking');
          } else if (data.type === 'audio') {
            if (data.audio) {
              const audio = new Audio(`data:audio/mp3;base64,${data.audio}`);
              audio.play();
            }
          } else if (data.type === 'client_tool_call') {
            const toolName = data.tool_name;
            const toolParams = data.parameters || {};
            const toolCallId = data.tool_call_id;

            try {
              const res = await fetch(`${apiBaseUrl}/api/voice/tool-call`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ toolName, parameters: toolParams }),
              });

              const toolResult = await res.json();

              if (toolResult.sessionId && !activeSessionId) {
                setActiveSessionId(toolResult.sessionId);
              }

              if (toolName === 'execute_desktop_plan' && toolResult.plan) {
                window.dispatchEvent(new CustomEvent('desktop-plan', { detail: toolResult.plan }));
                ipcInvoke('desktop:window:setOverlayState', 'working').catch(() => {});
              }

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
          } else if (data.type === 'interruption') {
            setStatus('listening');
          } else if (data.type === 'error') {
            setError(data.message || 'Voice error');
          }
        } catch {
          // binary audio - ignore
        }
      };

      ws.onerror = () => {
        setError('WebSocket error');
        setStatus('error');
        ipcInvoke('desktop:window:setOverlayState', 'error').catch(() => {});
      };

      ws.onclose = () => {
        setIsActive(false);
        setStatus('idle');
        ipcInvoke('desktop:window:setOverlayState', 'idle').catch(() => {});
      };

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) {
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64 = (reader.result as string).split(',')[1];
            ws.send(JSON.stringify({ type: 'audio', audio: base64 }));
          };
          reader.readAsDataURL(e.data);
        }
      };

      mediaRecorder.start(100);
      setStatus('listening');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start voice');
      setStatus('error');
      setIsActive(false);
      ipcInvoke('desktop:window:setOverlayState', 'error').catch(() => {});
    }
  }, [activeSessionId, ipcInvoke, apiBaseUrl]);

  useEffect(() => {
    const handleToggle = () => {
      if (isActive) stop();
      else start();
    };
    window.addEventListener('toggle-voice', handleToggle);
    return () => window.removeEventListener('toggle-voice', handleToggle);
  }, [isActive, start, stop]);

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return (
    <div className="flex flex-col items-center gap-6 py-8">
      <button
        onClick={isActive ? stop : start}
        disabled={status === 'connecting'}
        className={`inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition-all duration-200 ${
          isActive
            ? 'bg-red-600 text-white hover:bg-red-700'
            : 'bg-teal-600 text-white hover:bg-teal-700'
        } disabled:opacity-50`}
      >
        {status === 'connecting' ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isActive ? (
          <MicOff className="h-4 w-4" />
        ) : (
          <Mic className="h-4 w-4" />
        )}
        {status === 'connecting' ? 'Connecting...' : isActive ? 'Stop Voice' : 'Start Voice'}
      </button>

      <div className="flex items-center gap-2">
        <div
          className={`h-2.5 w-2.5 rounded-full ${
            status === 'idle'
              ? 'bg-neutral-600'
              : status === 'connecting'
              ? 'bg-amber-400 animate-pulse'
              : status === 'listening'
              ? 'bg-teal-500 animate-pulse'
              : status === 'speaking'
              ? 'bg-teal-400'
              : 'bg-red-500'
          }`}
        />
        <span className="text-xs font-medium text-neutral-400 uppercase tracking-wider">{status}</span>
      </div>

      {transcript && (
        <div className="w-full max-w-md rounded-lg bg-neutral-900 border border-neutral-800 p-4">
          <p className="text-xs text-neutral-500 font-semibold uppercase mb-1">You</p>
          <p className="text-sm text-neutral-200">{transcript}</p>
        </div>
      )}

      {agentResponse && (
        <div className="w-full max-w-md rounded-lg bg-neutral-900 border border-neutral-800 p-4">
          <p className="text-xs text-neutral-500 font-semibold uppercase mb-1">Solli</p>
          <p className="text-sm text-neutral-200">{agentResponse}</p>
        </div>
      )}

      {error && (
        <div className="w-full max-w-md rounded-lg bg-red-950/50 border border-red-900/50 px-4 py-3 text-center">
          <p className="text-xs text-red-400 font-medium">{error}</p>
        </div>
      )}
    </div>
  );
}
