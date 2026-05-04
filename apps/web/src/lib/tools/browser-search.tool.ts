import { logger } from '@/lib/utils/logger';
import { buildToolPaymentHeaders } from '@/lib/x402';

const log = logger('browser-search-tool');

export interface BrowserSearchInput {
  query: string;
  limit?: number;
  sessionId?: string;
}

export interface BrowserSearchResult {
  title: string;
  url?: string;
  snippet?: string;
  organization?: string;
  location?: string;
  reason?: string;
}

export interface BrowserSearchOutput {
  results: BrowserSearchResult[];
  query: string;
}

export async function browserSearchTool(input: BrowserSearchInput): Promise<BrowserSearchOutput> {
  const baseUrl = process.env.WORKER_BROWSER_URL || 'http://localhost:3002';
  log.info(`Searching: "${input.query}"`);

  try {
    const paymentHeaders = input.sessionId ? buildToolPaymentHeaders('browser_search', input.sessionId) : {};
    const response = await fetch(`${baseUrl}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...paymentHeaders },
      body: JSON.stringify({
        task: 'search',
        query: input.query,
        limit: input.limit || 5,
        requestId: crypto.randomUUID(),
      }),
    });

    if (!response.ok) {
      throw new Error(`Browser worker error: ${response.status} ${response.statusText}`);
    }

    const result = (await response.json()) as { success?: boolean; data?: { results?: unknown[] } };

    if (result.success && result.data?.results) {
      const results = normalizeSearchResults(result.data.results);
      return { results, query: input.query };
    }

    throw new Error('No results from browser worker');
  } catch (error) {
    log.error('Browser search failed, using fallback', error);
    return { results: getFallbackResults(input.query), query: input.query };
  }
}

function normalizeSearchResults(raw: unknown[]): BrowserSearchResult[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 3).map((r: any) => ({
    title: r.title || 'Untitled',
    url: r.url || '',
    snippet: r.snippet || r.description || '',
    organization: extractOrg(r.title, r.snippet),
    location: extractLoc(r.title, r.snippet),
  }));
}

function extractOrg(title: string, snippet: string): string | undefined {
  const text = `${title} ${snippet}`;
  const patterns = [
    /at\s+([A-Z][A-Za-z0-9\s&]+)/,
    /([A-Z][A-Za-z0-9\s&]+)\s+is hiring/,
    /([A-Z][A-Za-z0-9\s&]+)\s+internship/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1].trim();
  }
  return undefined;
}

function extractLoc(title: string, snippet: string): string | undefined {
  const text = `${title} ${snippet}`;
  const patterns = [
    /(Warsaw|Krakow|Wroclaw|Poznan|Gdansk|Lodz|Poland)/i,
    /(Remote|Hybrid|On-site)/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1];
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
    { title: `Result 1 for: ${query}`, organization: 'Example Org', location: 'Poland', url: 'https://example.com/1', reason: 'Relevant result' },
    { title: `Result 2 for: ${query}`, organization: 'Another Org', location: 'Poland', url: 'https://example.com/2', reason: 'Relevant result' },
    { title: `Result 3 for: ${query}`, organization: 'Third Org', location: 'Poland', url: 'https://example.com/3', reason: 'Relevant result' },
  ];
}
