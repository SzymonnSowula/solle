export interface VoiceSessionConfig {
  sessionId: string;
  apiKey?: string;
  agentId?: string;
  wsUrl?: string;
}

export interface VoiceEvent {
  type: 'connected' | 'disconnected' | 'transcript' | 'error' | 'audio';
  data: Record<string, unknown>;
}

export interface VoiceSessionProvider {
  connect(config: VoiceSessionConfig): Promise<void>;
  disconnect(): Promise<void>;
  sendText(text: string): void;
  onEvent(callback: (event: VoiceEvent) => void): () => void;
  isConnected(): boolean;
}

export class ElevenLabsVoiceProvider implements VoiceSessionProvider {
  private ws: WebSocket | null = null;
  private listeners: Array<(event: VoiceEvent) => void> = [];

  async connect(config: VoiceSessionConfig): Promise<void> {
    // TODO: Implement actual ElevenLabs WebSocket connection
    // This is a stub for future voice integration
    console.log('[ElevenLabsVoiceProvider] Connect stub called for session:', config.sessionId);
    this.emit({ type: 'connected', data: { sessionId: config.sessionId } });
  }

  async disconnect(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.emit({ type: 'disconnected', data: {} });
  }

  sendText(text: string): void {
    console.log('[ElevenLabsVoiceProvider] Send text stub:', text);
    // TODO: Send text to ElevenLabs WebSocket
  }

  onEvent(callback: (event: VoiceEvent) => void): () => void {
    this.listeners.push(callback);
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  isConnected(): boolean {
    if (typeof WebSocket === 'undefined') return false;
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  private emit(event: VoiceEvent): void {
    this.listeners.forEach((cb) => cb(event));
  }
}

export class MockVoiceProvider implements VoiceSessionProvider {
  private connected = false;
  private listeners: Array<(event: VoiceEvent) => void> = [];

  async connect(config: VoiceSessionConfig): Promise<void> {
    this.connected = true;
    console.log('[MockVoiceProvider] Connected for session:', config.sessionId);
    this.emit({ type: 'connected', data: { sessionId: config.sessionId } });
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.emit({ type: 'disconnected', data: {} });
  }

  sendText(_text: string): void {
    // No-op for mock
  }

  onEvent(callback: (event: VoiceEvent) => void): () => void {
    this.listeners.push(callback);
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  isConnected(): boolean {
    return this.connected;
  }

  private emit(event: VoiceEvent): void {
    this.listeners.forEach((cb) => cb(event));
  }
}
