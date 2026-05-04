import { ElevenLabsClient } from './client';
import { logger } from '@/lib/utils/logger';

const log = logger('live-conversation');

export class LiveConversation {
  private client: ElevenLabsClient | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioStream: MediaStream | null = null;
  private onTranscriptCallback?: (text: string) => void;
  private onAgentResponseCallback?: (text: string) => void;
  private onStatusCallback?: (status: string) => void;

  constructor(private config: { agentId: string; apiKey: string; wsUrl: string }) {}

  async start(): Promise<void> {
    log.info('Starting live conversation');

    this.client = new ElevenLabsClient(this.config);

    this.client.onEvent((event) => {
      switch (event.type) {
        case 'connected':
          this.onStatusCallback?.('connected');
          break;
        case 'disconnected':
          this.onStatusCallback?.('disconnected');
          break;
        case 'transcript':
          this.onTranscriptCallback?.(event.text);
          break;
        case 'agent_response':
          this.onAgentResponseCallback?.(event.text);
          break;
        case 'error':
          log.error('Voice error', event.message);
          this.onStatusCallback?.('error');
          break;
      }
    });

    this.client.connect();

    // Start microphone
    this.audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.mediaRecorder = new MediaRecorder(this.audioStream);

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0 && this.client?.isConnected()) {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          this.client?.sendAudio(base64);
        };
        reader.readAsDataURL(e.data);
      }
    };

    this.mediaRecorder.start(100); // 100ms chunks
  }

  stop(): void {
    log.info('Stopping live conversation');
    this.mediaRecorder?.stop();
    this.audioStream?.getTracks().forEach((t) => t.stop());
    this.client?.disconnect();
    this.mediaRecorder = null;
    this.audioStream = null;
  }

  onTranscript(cb: (text: string) => void): void {
    this.onTranscriptCallback = cb;
  }

  onAgentResponse(cb: (text: string) => void): void {
    this.onAgentResponseCallback = cb;
  }

  onStatus(cb: (status: string) => void): void {
    this.onStatusCallback = cb;
  }
}
