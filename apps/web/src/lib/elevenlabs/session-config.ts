import { getEnvOptional } from '@/lib/utils/env';
import { logger } from '@/lib/utils/logger';

const log = logger('elevenlabs-config');

export interface ElevenLabsSessionConfig {
  agentId: string;
  apiKey: string;
  wsUrl: string;
}

export function getElevenLabsConfig(): ElevenLabsSessionConfig {
  const agentId = getEnvOptional('ELEVENLABS_AGENT_ID');
  const apiKey = getEnvOptional('ELEVENLABS_API_KEY');
  const wsUrl = process.env.ELEVENLABS_WS_URL || 'wss://api.elevenlabs.io/v1/convai/conversation';

  if (!agentId || !apiKey) {
    log.error('Missing ElevenLabs configuration. Set ELEVENLABS_AGENT_ID and ELEVENLABS_API_KEY in .env.local');
    throw new Error('ElevenLabs configuration missing');
  }

  return { agentId, apiKey, wsUrl };
}
