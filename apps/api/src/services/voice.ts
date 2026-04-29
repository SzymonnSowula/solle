import WebSocket from 'ws';

interface ToolCallMessage {
  type: 'client_tool_call';
  tool_call_id: string;
  tool_name: string;
  parameters: Record<string, unknown>;
}

export class VoiceProxyService {
  private connections = new Map<string, { client: WebSocket; elevenLabs: WebSocket }>();

  async createConnection(
    sessionId: string,
    clientSocket: WebSocket,
    apiKey: string,
    agentId: string
  ): Promise<void> {
    const elevenLabsUrl = `wss://api.elevenlabs.io/v1/convai/conversation?agent_id=${agentId}`;
    const elevenLabsSocket = new WebSocket(elevenLabsUrl, {
      headers: {
        'xi-api-key': apiKey,
      },
    });

    this.connections.set(sessionId, { client: clientSocket, elevenLabs: elevenLabsSocket });

    // Forward ElevenLabs -> Client
    elevenLabsSocket.on('open', () => {
      console.log(`[Voice] ElevenLabs connected for session ${sessionId}`);
      clientSocket.send(JSON.stringify({ type: 'connected', sessionId }));
    });

    elevenLabsSocket.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString()) as ToolCallMessage | Record<string, unknown>;

        if (message.type === 'client_tool_call') {
          const toolCall = message as ToolCallMessage;
          console.log(`[Voice] Tool call intercepted: ${toolCall.tool_name}`);

          try {
            const result = await this.handleToolCall(sessionId, toolCall);
            elevenLabsSocket.send(
              JSON.stringify({
                type: 'client_tool_result',
                tool_call_id: toolCall.tool_call_id,
                result,
              })
            );
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            elevenLabsSocket.send(
              JSON.stringify({
                type: 'client_tool_result',
                tool_call_id: toolCall.tool_call_id,
                error: errorMessage,
              })
            );
          }
          return;
        }

        // Forward all other messages to client
        if (clientSocket.readyState === WebSocket.OPEN) {
          clientSocket.send(data);
        }
      } catch {
        // Binary audio or non-JSON — forward as-is
        if (clientSocket.readyState === WebSocket.OPEN) {
          clientSocket.send(data);
        }
      }
    });

    elevenLabsSocket.on('error', (error) => {
      console.error(`[Voice] ElevenLabs error for session ${sessionId}:`, error.message);
      if (clientSocket.readyState === WebSocket.OPEN) {
        clientSocket.send(JSON.stringify({ type: 'error', message: error.message }));
      }
    });

    elevenLabsSocket.on('close', () => {
      console.log(`[Voice] ElevenLabs disconnected for session ${sessionId}`);
      this.connections.delete(sessionId);
      if (clientSocket.readyState === WebSocket.OPEN) {
        clientSocket.close();
      }
    });

    // Forward Client -> ElevenLabs
    clientSocket.on('message', (data) => {
      if (elevenLabsSocket.readyState === WebSocket.OPEN) {
        elevenLabsSocket.send(data);
      }
    });

    clientSocket.on('close', () => {
      console.log(`[Voice] Client disconnected for session ${sessionId}`);
      this.connections.delete(sessionId);
      if (elevenLabsSocket.readyState === WebSocket.OPEN) {
        elevenLabsSocket.close();
      }
    });
  }

  disconnect(sessionId: string): void {
    const conn = this.connections.get(sessionId);
    if (conn) {
      conn.elevenLabs.close();
      conn.client.close();
      this.connections.delete(sessionId);
    }
  }

  private async handleToolCall(
    sessionId: string,
    toolCall: ToolCallMessage
  ): Promise<unknown> {
    const { tool_name, parameters } = toolCall;
    const baseUrl = `http://localhost:${process.env.API_PORT || '3001'}`;

    switch (tool_name) {
      case 'start_session': {
        const intent = (parameters.intent as string) || 'general';
        const res = await fetch(`${baseUrl}/api/sessions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ input: intent, userId: 'voice-user' }),
        });
        const data = (await res.json()) as { sessionId: string };
        await fetch(`${baseUrl}/api/sessions/${data.sessionId}/run`, { method: 'POST' });
        return { sessionId: data.sessionId, status: 'started' };
      }

      case 'get_session_status': {
        const targetSessionId = (parameters.sessionId as string) || sessionId;
        const res = await fetch(`${baseUrl}/api/sessions/${targetSessionId}`);
        return await res.json();
      }

      case 'get_session_events': {
        const targetSessionId = (parameters.sessionId as string) || sessionId;
        const res = await fetch(`${baseUrl}/api/sessions/${targetSessionId}/events`);
        return await res.json();
      }

      case 'send_message': {
        const targetSessionId = (parameters.sessionId as string) || sessionId;
        const message = parameters.message as string;
        const res = await fetch(`${baseUrl}/api/sessions/${targetSessionId}/message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message }),
        });
        return await res.json();
      }

      case 'approve_action': {
        const res = await fetch(`${baseUrl}/api/agents/approve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: parameters.sessionId || sessionId,
            approvalId: parameters.approvalId,
            approved: parameters.approved,
          }),
        });
        return await res.json();
      }

      default:
        return { error: `Unknown tool: ${tool_name}` };
    }
  }
}

export const voiceProxyService = new VoiceProxyService();
