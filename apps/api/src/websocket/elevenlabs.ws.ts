import WebSocket from 'ws';

export interface ElevenLabsMessage {
  type: string;
  [key: string]: unknown;
}

export type EventHandler = (event: Record<string, unknown>) => void;

export class ElevenLabsWebSocket {
  private ws: WebSocket | null = null;
  private eventHandlers: Map<string, EventHandler[]> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private sessionId: string | null = null;

  constructor(
    private apiKey: string,
    private agentId: string,
    private wsUrl: string = 'wss://api.elevenlabs.io/v1/agent/stream'
  ) {}

  async connect(sessionId: string): Promise<void> {
    this.sessionId = sessionId;

    return new Promise((resolve, reject) => {
      const url = new URL(this.wsUrl);
      url.searchParams.set('agent_id', this.agentId);

      this.ws = new WebSocket(url.toString(), {
        headers: {
          'xi-api-key': this.apiKey,
          'Content-Type': 'application/json',
        },
      });

      this.ws.on('open', () => {
        this.reconnectAttempts = 0;
        this.emit('session_start', { type: 'session_start', sessionId });
        resolve();
      });

      this.ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString()) as ElevenLabsMessage;
          this.handleMessage(message);
        } catch (error) {
          console.error('Failed to parse ElevenLabs message:', error);
        }
      });

      this.ws.on('error', (error) => {
        this.emit('error', { type: 'error', error: error.message });
        reject(error);
      });

      this.ws.on('close', () => {
        this.emit('session_end', { type: 'session_end', sessionId });
        this.attemptReconnect();
      });
    });
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.sessionId = null;
    }
  }

  sendAudio(audioData: Buffer): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(audioData);
    }
  }

  sendText(text: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      const message: ElevenLabsMessage = {
        type: 'text_input',
        text,
        session_id: this.sessionId,
      };
      this.ws.send(JSON.stringify(message));
    }
  }

  on(eventType: string, handler: EventHandler): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }
    this.eventHandlers.get(eventType)!.push(handler);
  }

  off(eventType: string, handler: EventHandler): void {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  private handleMessage(message: ElevenLabsMessage): void {
    const eventType = message.type as string;

    switch (eventType) {
      case 'transcript':
        this.emit('transcript', message);
        break;

      case 'tool_call':
        this.emit('tool_call', message);
        break;

      case 'agent_response':
        this.emit('agent_response', message);
        break;

      case 'session_end':
        this.emit('session_end', message);
        break;

      default:
        this.emit('unknown', message);
    }
  }

  private emit(eventType: string, data: Record<string, unknown>): void {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      handlers.forEach((handler) => handler(data));
    }
  }

  private attemptReconnect(): void {
    if (
      this.reconnectAttempts < this.maxReconnectAttempts &&
      this.sessionId
    ) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

      setTimeout(() => {
        this.connect(this.sessionId!).catch((error) => {
          console.error('Reconnection failed:', error);
        });
      }, delay);
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

export function createElevenLabsWebSocket(
  apiKey: string,
  agentId: string
): ElevenLabsWebSocket {
  return new ElevenLabsWebSocket(apiKey, agentId);
}
