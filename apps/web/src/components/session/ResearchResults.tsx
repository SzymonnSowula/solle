import { ExternalLink, Building2, MapPin, Lightbulb } from 'lucide-react';

interface ResearchResult {
  title: string;
  organization?: string;
  location?: string;
  url?: string;
  reason?: string;
}

interface ResearchResultsProps {
  results: ResearchResult[];
}

export function ResearchResults({ results }: ResearchResultsProps) {
  if (!results || results.length === 0) return null;

  return (
    <div className="rounded-xl border border-white/10 bg-neutral-950 overflow-hidden animate-fade-in">
      <div className="border-b border-white/5 px-5 py-3 flex items-center gap-2">
        <Lightbulb className="h-4 w-4 text-amber-600" />
        <h3 className="text-sm font-semibold text-neutral-200">Research Results</h3>
        <span className="ml-auto text-xs text-neutral-500 font-medium">{results.length} found</span>
      </div>
      <div className="divide-y divide-cream-100">
        {results.map((r, i) => (
          <div key={i} className="px-5 py-4 hover:bg-neutral-900/50 transition-colors">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-neutral-950 text-[10px] font-bold text-neutral-400">
                    {i + 1}
                  </span>
                  <h4 className="text-sm font-semibold text-white">{r.title}</h4>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-neutral-500">
                  {r.organization && (
                    <span className="inline-flex items-center gap-1">
                      <Building2 className="h-3 w-3" />
                      {r.organization}
                    </span>
                  )}
                  {r.location && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {r.location}
                    </span>
                  )}
                </div>
                {r.reason && (
                  <p className="mt-2 text-xs text-neutral-400 leading-relaxed">{r.reason}</p>
                )}
              </div>
              {r.url && (
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-neutral-950 px-2.5 py-1.5 text-xs font-medium text-neutral-400 transition-colors hover:bg-red-500/10 hover:text-red-300"
                >
                  <ExternalLink className="h-3 w-3" />
                  Visit
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
