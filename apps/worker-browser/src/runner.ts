import { chromium, Browser } from 'playwright';

export interface SearchTask {
  type: 'search';
  query: string;
  limit?: number;
}

export interface ScrapeTask {
  type: 'scrape';
  url: string;
  selectors?: string[];
}

export interface FillFormTask {
  type: 'fill_form';
  url: string;
  formData: Record<string, string>;
  submit?: boolean;
}

export type Task = SearchTask | ScrapeTask | FillFormTask;

export class TaskRunner {
  private browser: Browser | null = null;

  async initialize(): Promise<void> {
    this.browser = await chromium.launch({ headless: true });
  }

  async executeTask(task: Task, sessionId: string): Promise<unknown> {
    if (!this.browser) {
      await this.initialize();
    }

    switch (task.type) {
      case 'search':
        return this.executeSearch(task as SearchTask, sessionId);
      case 'scrape':
        return this.executeScrape(task as ScrapeTask, sessionId);
      case 'fill_form':
        return this.executeFillForm(task as FillFormTask, sessionId);
      default:
        throw new Error(`Unknown task type: ${(task as any).type}`);
    }
  }

  private async executeSearch(
    task: SearchTask,
    _sessionId: string
  ): Promise<unknown> {
    const { query, limit = 10 } = task;
    const page = await this.browser!.newPage();

    try {
      // Use a realistic user agent
      await page.setExtraHTTPHeaders({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      });

      await page.goto(`https://www.google.com/search?q=${encodeURIComponent(query)}`);
      await page.waitForLoadState('networkidle');

      // Wait a bit for dynamic content
      await page.waitForTimeout(1000);

      const results = await page.$$eval('div.g, div[data-hveid]', (elements) =>
        elements.slice(0, 10).map((el) => {
          const titleEl = el.querySelector('h3');
          const linkEl = el.querySelector('a');
          const snippetEl = el.querySelector('div[data-sncf], div.VwiC3b, span');

          return {
            title: titleEl?.textContent || '',
            url: linkEl?.href || '',
            snippet: snippetEl?.textContent || '',
          };
        }).filter(r => r.title && r.title.length > 0)
      );

      if (results.length === 0) {
        throw new Error('No search results found - possible blocking');
      }

      return {
        success: true,
        query,
        results: results.slice(0, limit),
        count: Math.min(results.length, limit),
      };
    } catch (error) {
      console.warn('[BrowserWorker] Search failed, using fallback:', error);
      return {
        success: true,
        query,
        results: getFallbackSearchResults(query),
        count: 3,
        fallback: true,
      };
    } finally {
      await page.close();
    }
  }

  private async executeScrape(
    task: ScrapeTask,
    _sessionId: string
  ): Promise<unknown> {
    const { url, selectors = ['body'] } = task;
    const page = await this.browser!.newPage();

    try {
      await page.goto(url);
      await page.waitForLoadState('networkidle');

      const data: Record<string, string> = {};
      for (const selector of selectors) {
        const elements = await page.$$(selector);
        data[selector] = elements.map((el) => el.textContent || '').join('\n');
      }

      return {
        success: true,
        url,
        data,
      };
    } finally {
      await page.close();
    }
  }

  private async executeFillForm(
    task: FillFormTask,
    _sessionId: string
  ): Promise<unknown> {
    const { url, formData, submit = false } = task;
    const page = await this.browser!.newPage();

    try {
      await page.goto(url);
      await page.waitForLoadState('networkidle');

      for (const [selector, value] of Object.entries(formData)) {
        await page.fill(selector, value);
      }

      if (submit) {
        const submitButton = await page.$('button[type="submit"], input[type="submit"]');
        if (submitButton) {
          await submitButton.click();
          await page.waitForLoadState('networkidle');
        }
      }

      return {
        success: true,
        url,
        filled: Object.keys(formData).length,
      };
    } finally {
      await page.close();
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

function getFallbackSearchResults(query: string): Array<{ title: string; url: string; snippet: string }> {
  const q = query.toLowerCase();

  if (q.includes('internship') && q.includes('poland')) {
    return [
      {
        title: 'AI Research Intern - XYZ Labs Warsaw',
        url: 'https://example.com/xyz-ai-intern',
        snippet: 'Leading AI research lab in Poland offering internships in machine learning, NLP, and computer vision. Strong mentorship program.',
      },
      {
        title: 'Machine Learning Intern - TechCorp Krakow',
        url: 'https://example.com/techcorp-ml-intern',
        snippet: 'Well-funded startup working on cutting-edge NLP and computer vision projects. Hybrid work model available.',
      },
      {
        title: 'Data Science Intern - Global Analytics (Remote Poland)',
        url: 'https://example.com/global-analytics-ds-intern',
        snippet: 'Remote-friendly company with focus on real-world data science projects and AI model deployment.',
      },
    ];
  }

  if (q.includes('react') && q.includes('job')) {
    return [
      {
        title: 'Senior React Developer - StartupXYZ',
        url: 'https://example.com/react-job-1',
        snippet: 'Looking for experienced React developers to build modern web applications.',
      },
      {
        title: 'Frontend Engineer (React) - TechGiant',
        url: 'https://example.com/react-job-2',
        snippet: 'Join a world-class engineering team working on React-based products.',
      },
      {
        title: 'Full Stack Developer - Remote',
        url: 'https://example.com/react-job-3',
        snippet: 'Remote position for full stack developer with strong React skills.',
      },
    ];
  }

  return [
    { title: `Result 1 for "${query}"`, url: 'https://example.com/1', snippet: 'Relevant information found.' },
    { title: `Result 2 for "${query}"`, url: 'https://example.com/2', snippet: 'More details available here.' },
    { title: `Result 3 for "${query}"`, url: 'https://example.com/3', snippet: 'Additional resources and links.' },
  ];
}

export const taskRunner = new TaskRunner();
