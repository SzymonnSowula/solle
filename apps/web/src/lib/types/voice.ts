export interface VoiceSessionConfig {
  sessionId: string;
  apiKey?: string;
  agentId?: string;
  wsUrl?: string;
}

export interface VoiceEvent {
  type: 'connected' | 'disconnected' | 'transcript' | 'agent_response' | 'audio' | 'error' | 'interruption' | 'ping';
  data: Record<string, unknown>;
}

export interface VoiceSessionState {
  status: 'idle' | 'connecting' | 'connected' | 'listening' | 'speaking' | 'error';
  transcript: string;
  agentResponse: string;
  error?: string;
}
