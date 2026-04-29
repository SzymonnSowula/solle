import { FastifyInstance } from 'fastify';
import { PostgresDatabase } from './db/postgres';
import { RedisDatabase } from './db/redis';
import { OrchestratorService } from './services/orchestrator';
import { VoiceService } from './services/voice';
import { ReceiptService } from './services/receipt.service';

declare module 'fastify' {
  interface FastifyInstance {
    db: PostgresDatabase;
    redis: RedisDatabase;
    orchestrator: OrchestratorService;
    voice: VoiceService;
    receipts: ReceiptService;
  }
}
