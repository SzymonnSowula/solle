export type ElevenLabsClientEvent =
  | { type: 'connected' }
  | { type: 'disconnected' }
  | { type: 'transcript'; text: string; isFinal: boolean }
  | { type: 'agent_response'; text: string }
  | { type: 'audio'; base64: string }
  | { type: 'interruption' }
  | { type: 'error'; message: string };

export type ElevenLabsEventCallback = (event: ElevenLabsClientEvent) => void;

export class ElevenLabsClient {
  private ws: WebSocket | null = null;
  private listeners: ElevenLabsEventCallback[] = [];
  private audioContext: AudioContext | null = null;

  constructor(
    private config: {
      agentId: string;
      apiKey: string;
      wsUrl: string;
    }
  ) {}

  connect(): void {
    if (this.ws) return;

    const url = new URL(this.config.wsUrl);
    url.searchParams.set('agent_id', this.config.agentId);

    this.ws = new WebSocket(url.toString());

    this.ws.onopen = () => {
      this.emit({ type: 'connected' });
      // Send initial config with API key
      this.sendJson({
        type: 'conversation_initiation_client_data',
        conversation_config_override: {},
      });
    };

    this.ws.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data);
        this.handleMessage(data);
      } catch {
        // binary audio data
        this.emit({ type: 'audio', base64: msg.data as string });
      }
    };

    this.ws.onerror = (err) => {
      this.emit({ type: 'error', message: 'WebSocket error' });
    };

    this.ws.onclose = () => {
      this.emit({ type: 'disconnected' });
      this.ws = null;
    };
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  sendAudio(base64Audio: string): void {
    this.sendJson({
      type: 'audio',
      audio: base64Audio,
    });
  }

  onEvent(callback: ElevenLabsEventCallback): () => void {
    this.listeners.push(callback);
    return () => {
      const idx = this.listeners.indexOf(callback);
      if (idx > -1) this.listeners.splice(idx, 1);
    };
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  private sendJson(data: unknown): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  private handleMessage(data: any): void {
    if (data.type === 'user_transcript') {
      this.emit({ type: 'transcript', text: data.text || '', isFinal: data.is_final ?? true });
    } else if (data.type === 'agent_response') {
      this.emit({ type: 'agent_response', text: data.text || '' });
    } else if (data.type === 'audio') {
      this.emit({ type: 'audio', base64: data.audio || '' });
    } else if (data.type === 'interruption') {
      this.emit({ type: 'interruption' });
    } else if (data.type === 'error') {
      this.emit({ type: 'error', message: data.message || 'Unknown ElevenLabs error' });
    }
  }

  private emit(event: ElevenLabsClientEvent): void {
    this.listeners.forEach((cb) => cb(event));
  }
}
