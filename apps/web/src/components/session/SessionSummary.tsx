import { FileText } from 'lucide-react';

interface SessionSummaryProps {
  summary: string | null;
}

export function SessionSummary({ summary }: SessionSummaryProps) {
  if (!summary) return null;

  return (
    <div className="rounded-xl border border-cream-300 bg-white overflow-hidden animate-fade-in">
      <div className="border-b border-cream-200 px-5 py-3 flex items-center gap-2">
        <FileText className="h-4 w-4 text-teal-600" />
        <h3 className="text-sm font-semibold text-ink-700">Summary</h3>
      </div>
      <div className="px-5 py-4">
        <p className="text-sm text-ink-700 leading-relaxed whitespace-pre-line">{summary}</p>
      </div>
    </div>
  );
}
