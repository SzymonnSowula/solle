import { runSessionGraph } from './session-graph';
import { WebSessionStore } from '@/lib/db/web-session-store';
import { logger } from '@/lib/utils/logger';

const log = logger('session-runner');

export async function executeSession(sessionId: string, userIntent: string) {
  log.info(`Starting session ${sessionId}: "${userIntent}"`);

  const store = new WebSessionStore();

  try {
    const result = await runSessionGraph(sessionId, userIntent, store);
    log.info(`Session ${sessionId} completed with status: ${result.status}`);
    return result;
  } catch (error) {
    log.error(`Session ${sessionId} failed`, error);
    await store.updateSession(sessionId, { status: 'failed' });
    throw error;
  }
}
