import type { SessionStore } from '@/lib/db/session-store';
import { browserSearchTool } from '@/lib/tools/browser-search.tool';
import { getToolCost, formatCost } from '@/lib/x402';
import { logger } from '@/lib/utils/logger';

const log = logger('research-agent');
const SEARCH_COST = getToolCost('browser_search');

export interface ResearchResult {
  title: string;
  organization?: string;
  location?: string;
  url?: string;
  reason?: string;
}

export async function researchAgent(
  sessionId: string,
  query: string,
  store: SessionStore
): Promise<ResearchResult[]> {
  await store.addEvent({
    sessionId,
    agentName: 'research',
    eventType: 'started',
    content: `Starting research for: "${query}"`,
  });

  await store.addTask({
    sessionId,
    agentName: 'research',
    toolName: 'browser_search',
    inputJson: { query },
    status: 'running',
  });

  let results: ResearchResult[] = [];

  try {
    const output = await browserSearchTool({ query, limit: 5, sessionId });
    results = output.results;

    await store.addEvent({
      sessionId,
      agentName: 'research',
      eventType: 'tool_result',
      content: `Found ${results.length} results · Cost: ${formatCost(SEARCH_COST)}`,
      metadata: { results, costSol: SEARCH_COST },
    });

    await store.addTask({
      sessionId,
      agentName: 'research',
      toolName: 'browser_search',
      outputJson: { results },
      status: 'completed',
      costSol: SEARCH_COST,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    log.error('Research failed', msg);

    await store.addEvent({
      sessionId,
      agentName: 'research',
      eventType: 'failed',
      content: `Search failed: ${msg}`,
    });

    await store.addTask({
      sessionId,
      agentName: 'research',
      toolName: 'browser_search',
      status: 'failed',
      errorMessage: msg,
      costSol: SEARCH_COST,
    });

    results = getFallbackResults(query);
    await store.addEvent({
      sessionId,
      agentName: 'research',
      eventType: 'thinking',
      content: 'Using fallback results for demo purposes',
    });
  }

  await store.addEvent({
    sessionId,
    agentName: 'research',
    eventType: 'completed',
    content: `Research completed with ${results.length} results`,
  });

  return results;
}

function getFallbackResults(query: string): ResearchResult[] {
  const q = query.toLowerCase();
  if (q.includes('internship') && q.includes('poland')) {
    return [
      {
        title: 'AI Research Intern - XYZ Labs',
        organization: 'XYZ Labs',
        location: 'Warsaw, Poland',
        url: 'https://example.com/xyz-ai-intern',
        reason: 'Top AI research lab in Poland with strong mentorship program',
      },
      {
        title: 'Machine Learning Intern - TechCorp Poland',
        organization: 'TechCorp Poland',
        location: 'Krakow, Poland (Hybrid)',
        url: 'https://example.com/techcorp-ml-intern',
        reason: 'Well-funded startup working on NLP and computer vision',
      },
      {
        title: 'Data Science Intern - Global Analytics',
        organization: 'Global Analytics',
        location: 'Remote (Poland)',
        url: 'https://example.com/global-analytics-ds-intern',
        reason: 'Remote-friendly with focus on real-world data science projects',
      },
    ];
  }
  return [
    { title: `Result 1 for: ${query}`, organization: 'Example Org', location: 'Poland', url: 'https://example.com/1', reason: 'Relevant result' },
    { title: `Result 2 for: ${query}`, organization: 'Another Org', location: 'Poland', url: 'https://example.com/2', reason: 'Relevant result' },
    { title: `Result 3 for: ${query}`, organization: 'Third Org', location: 'Poland', url: 'https://example.com/3', reason: 'Relevant result' },
  ];
}
