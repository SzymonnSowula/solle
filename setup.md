1. Zainstaluj nowe zależności (sieć była wolna, instalacja się nie ukończyła):
      pnpm install --no-frozen-lockfile
   
2. Odbuduj bazę danych (nowa tabela checkpoints):
      docker-compose down -v
   docker-compose up -d
   
3. Skonfiguruj zmienne środowiskowe w .env.local:
      ELEVENLABS_API_KEY=...
   ELEVENLABS_AGENT_ID=...
   # Opcjonalnie, dla blockchain:
   AGENT_PRIVATE_KEY=base64_encoded_solana_keypair
   SOLANA_NETWORK=devnet
   
4. Skonfiguruj ElevenLabs agenta w dashboardzie ElevenLabs:
   - System prompt: "You are Solli, a voice-native session operator..."
   - Dodaj tools (function calling):
     - start_session (intent: string)
     - get_session_status (sessionId: string)
     - get_session_events (sessionId: string)
     - send_message (sessionId: string, message: string)
     - approve_action (sessionId: string, approvalId: string, approved: boolean)
5. Uruchom stack:
      docker-compose up -d
   pnpm --filter @solli/web dev
   pnpm --filter @solli/worker-browser dev
   pnpm --filter @solli/worker-google dev