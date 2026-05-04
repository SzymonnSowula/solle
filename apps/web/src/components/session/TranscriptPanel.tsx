import { User, Bot } from 'lucide-react';

interface TranscriptPanelProps {
  transcript: string;
  agentResponse: string;
}

export function TranscriptPanel({ transcript, agentResponse }: TranscriptPanelProps) {
  return (
    <div className="mt-4 space-y-3">
      {transcript && (
        <div className="flex gap-3">
          <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cream-100">
            <User className="h-3 w-3 text-ink-400" />
          </div>
          <div className="flex-1 rounded-xl rounded-tl-sm bg-cream-100 px-4 py-2.5">
            <p className="text-sm text-ink-700">{transcript.trim()}</p>
          </div>
        </div>
      )}
      {agentResponse && (
        <div className="flex gap-3">
          <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-50">
            <Bot className="h-3 w-3 text-teal-600" />
          </div>
          <div className="flex-1 rounded-xl rounded-tl-sm bg-teal-50 px-4 py-2.5 border border-teal-100">
            <p className="text-sm text-ink-700">{agentResponse.trim()}</p>
          </div>
        </div>
      )}
    </div>
  );
}
