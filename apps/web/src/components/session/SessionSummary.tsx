import { FileText } from 'lucide-react';

interface SessionSummaryProps {
  summary: string | null;
}

export function SessionSummary({ summary }: SessionSummaryProps) {
  if (!summary) return null;

  return (
    <div className="rounded-xl border border-white/10 bg-neutral-950 overflow-hidden animate-fade-in">
      <div className="border-b border-white/5 px-5 py-3 flex items-center gap-2">
        <FileText className="h-4 w-4 text-red-400" />
        <h3 className="text-sm font-semibold text-neutral-200">Summary</h3>
      </div>
      <div className="px-5 py-4">
        <p className="text-sm text-neutral-200 leading-relaxed whitespace-pre-line">{summary}</p>
      </div>
    </div>
  );
}
