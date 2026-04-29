import { FastifyInstance } from 'fastify';
import { voiceProxyService } from '../services/voice';

export async function voiceRoutes(fastify: FastifyInstance) {
  fastify.get('/voice/:sessionId', { websocket: true }, (connection, req) => {
    const { sessionId } = req.params as { sessionId: string };
    const apiKey = process.env.ELEVENLABS_API_KEY || '';
    const agentId = process.env.ELEVENLABS_AGENT_ID || '';

    if (!apiKey || !agentId) {
      connection.socket.send(
        JSON.stringify({
          type: 'error',
          message: 'ELEVENLABS_API_KEY or ELEVENLABS_AGENT_ID not configured',
        })
      );
      connection.socket.close();
      return;
    }

    voiceProxyService.createConnection(sessionId, connection.socket, apiKey, agentId);
  });
}
