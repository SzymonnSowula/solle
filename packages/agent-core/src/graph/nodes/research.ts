import { SessionState, AgentName } from '../index';
import { SessionStore } from '../../store';

interface BrowserSearchResult {
  title: string;
  url?: string;
  snippet?: string;
  organization?: string;
  location?: string;
  reason?: string;
}

export async function researchNode(
  state: SessionState,
  store: SessionStore
): Promise<Partial<SessionState>> {
  const agentHistory = [...state.agentHistory];

  agentHistory.push({
    agentName: 'research',
    eventType: 'started',
    content: `Starting research agent for: "${state.userIntent}"`,
    timestamp: new Date(),
  });

  await store.addEvent({
    sessionId: state.sessionId,
    agentName: 'research',
    eventType: 'started',
    content: `Starting research agent for: "${state.userIntent}"`,
  });

  agentHistory.push({
    agentName: 'research',
    eventType: 'tool_call',
    content: `Calling browser search tool with query: "${state.userIntent}"`,
    timestamp: new Date(),
  });

  await store.addEvent({
    sessionId: state.sessionId,
    agentName: 'research',
    eventType: 'tool_call',
    content: `Calling browser search tool with query: "${state.userIntent}"`,
  });

  await store.addTask({
    sessionId: state.sessionId,
    agentName: 'research',
    toolName: 'browser_search',
    inputJson: { query: state.userIntent },
    status: 'running',
  });

  const toolResults = new Map(state.toolResults);
  let searchResults: BrowserSearchResult[] = [];
  let errorMessage: string | null = null;

  try {
    const baseUrl = process.env.WORKER_BROWSER_URL || 'http://localhost:3002';
    const response = await fetch(`${baseUrl}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        task: 'search',
        query: state.userIntent,
        limit: 5,
        sessionId: state.sessionId,
        requestId: crypto.randomUUID(),
      }),
    });

    if (!response.ok) {
      throw new Error(`Browser worker error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json() as { success?: boolean; data?: { results?: unknown[] } };
    console.log('[Research] Browser search result:', JSON.stringify(result, null, 2));

    if (result.success && result.data?.results) {
      searchResults = normalizeSearchResults(result.data.results, state.userIntent);
    } else {
      throw new Error('No results from browser worker');
    }

    toolResults.set('research_' + Date.now(), {
      query: state.userIntent,
      status: 'completed',
      results: searchResults,
      timestamp: new Date(),
    });

    agentHistory.push({
      agentName: 'research',
      eventType: 'tool_result',
      content: `Found ${searchResults.length} results`,
      timestamp: new Date(),
    });

    await store.addEvent({
      sessionId: state.sessionId,
      agentName: 'research',
      eventType: 'tool_result',
      content: `Found ${searchResults.length} results`,
    });

    await store.addTask({
      sessionId: state.sessionId,
      agentName: 'research',
      toolName: 'browser_search',
      outputJson: { results: searchResults },
      status: 'completed',
    });
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Research] Browser search failed:', errorMessage);

    toolResults.set('research_' + Date.now(), {
      query: state.userIntent,
      status: 'failed',
      error: errorMessage,
      timestamp: new Date(),
    });

    agentHistory.push({
      agentName: 'research',
      eventType: 'failed',
      content: `Search failed: ${errorMessage}`,
      timestamp: new Date(),
    });

    await store.addEvent({
      sessionId: state.sessionId,
      agentName: 'research',
      eventType: 'failed',
      content: `Search failed: ${errorMessage}`,
    });

    await store.addTask({
      sessionId: state.sessionId,
      agentName: 'research',
      toolName: 'browser_search',
      status: 'failed',
      errorMessage,
    });

    // Fallback to demo results for MVP if search fails
    searchResults = getFallbackResults(state.userIntent);

    agentHistory.push({
      agentName: 'research',
      eventType: 'thinking',
      content: 'Using fallback results for demo purposes',
      timestamp: new Date(),
    });

    await store.addEvent({
      sessionId: state.sessionId,
      agentName: 'research',
      eventType: 'thinking',
      content: 'Using fallback results for demo purposes',
    });
  }

  agentHistory.push({
    agentName: 'research',
    eventType: 'completed',
    content: `Research completed with ${searchResults.length} results`,
    timestamp: new Date(),
  });

  await store.addEvent({
    sessionId: state.sessionId,
    agentName: 'research',
    eventType: 'completed',
    content: `Research completed with ${searchResults.length} results`,
  });

  return {
    agentHistory,
    toolResults,
    currentAgent: 'summary' as AgentName,
    requiresApproval: false,
    researchResults: searchResults,
  };
}

function normalizeSearchResults(rawResults: unknown[], _query: string): BrowserSearchResult[] {
  if (!Array.isArray(rawResults)) return [];

  return rawResults.slice(0, 3).map((r: any) => ({
    title: r.title || 'Untitled',
    url: r.url || '',
    snippet: r.snippet || r.description || '',
    organization: extractOrganization(r.title, r.snippet),
    location: extractLocation(r.title, r.snippet),
  }));
}

function extractOrganization(title: string, snippet: string): string | undefined {
  const text = `${title} ${snippet}`;
  const orgPatterns = [
    /at\s+([A-Z][A-Za-z0-9\s&]+)/,
    /([A-Z][A-Za-z0-9\s&]+)\s+is hiring/,
    /([A-Z][A-Za-z0-9\s&]+)\s+internship/i,
  ];
  for (const pattern of orgPatterns) {
    const match = text.match(pattern);
    if (match) return match[1].trim();
  }
  return undefined;
}

function extractLocation(title: string, snippet: string): string | undefined {
  const text = `${title} ${snippet}`;
  const locPatterns = [
    /(Warsaw|Krakow|Wroclaw|Poznan|Gdansk|Lodz|Poland)/i,
    /(Remote|Hybrid|On-site)/i,
  ];
  for (const pattern of locPatterns) {
    const match = text.match(pattern);
    if (match) return match[1];
  }
  return 'Poland';
}

function getFallbackResults(query: string): BrowserSearchResult[] {
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
    {
      title: 'Result 1 for: ' + query,
      organization: 'Example Org',
      location: 'Poland',
      url: 'https://example.com/1',
      reason: 'Relevant result',
    },
    {
      title: 'Result 2 for: ' + query,
      organization: 'Another Org',
      location: 'Poland',
      url: 'https://example.com/2',
      reason: 'Relevant result',
    },
    {
      title: 'Result 3 for: ' + query,
      organization: 'Third Org',
      location: 'Poland',
      url: 'https://example.com/3',
      reason: 'Relevant result',
    },
  ];
}
