import { ElevenLabsClient, type ElevenLabsClientEvent } from './client';

export type { ElevenLabsClientEvent };
export { ElevenLabsClient };

export function mapElevenLabsEventToAppEvent(event: ElevenLabsClientEvent): {
  type: string;
  payload: Record<string, unknown>;
} {
  switch (event.type) {
    case 'connected':
      return { type: 'voice.connected', payload: {} };
    case 'disconnected':
      return { type: 'voice.disconnected', payload: {} };
    case 'transcript':
      return { type: 'voice.transcript', payload: { text: event.text, isFinal: event.isFinal } };
    case 'agent_response':
      return { type: 'voice.agent_response', payload: { text: event.text } };
    case 'audio':
      return { type: 'voice.audio', payload: { base64: event.base64 } };
    case 'interruption':
      return { type: 'voice.interruption', payload: {} };
    case 'error':
      return { type: 'voice.error', payload: { message: event.message } };
  }
}
