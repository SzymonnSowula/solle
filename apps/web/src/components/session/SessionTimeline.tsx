'use client';

import { Bot, Search, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

interface SessionTimelineProps {
  events: Array<{
    id: string;
    agent_name: string;
    event_type: string;
    content: string | null;
    created_at: string;
  }>;
}

const agentConfig: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
  coordinator: {
    icon: <Bot className="h-3.5 w-3.5" />,
    color: 'text-teal-700',
    bg: 'bg-teal-50',
  },
  research: {
    icon: <Search className="h-3.5 w-3.5" />,
    color: 'text-amber-700',
    bg: 'bg-amber-50',
  },
  summary: {
    icon: <CheckCircle className="h-3.5 w-3.5" />,
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
  },
};

const eventTypeConfig: Record<string, { icon: React.ReactNode }> = {
  started: { icon: <Loader2 className="h-3 w-3 animate-spin" /> },
  thinking: { icon: <Bot className="h-3 w-3" /> },
  tool_call: { icon: <Search className="h-3 w-3" /> },
  tool_result: { icon: <CheckCircle className="h-3 w-3" /> },
  completed: { icon: <CheckCircle className="h-3 w-3" /> },
  failed: { icon: <AlertCircle className="h-3 w-3" /> },
};

export function SessionTimeline({ events }: SessionTimelineProps) {
  if (events.length === 0) {
    return (
      <div className="rounded-xl border border-cream-300 bg-white p-8 text-center">
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-cream-100">
          <Bot className="h-5 w-5 text-ink-300" />
        </div>
        <p className="text-sm text-ink-400">No events yet. Session is starting...</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-cream-300 bg-white overflow-hidden">
      <div className="border-b border-cream-200 px-5 py-3">
        <h3 className="text-sm font-semibold text-ink-700">Activity Timeline</h3>
      </div>
      <div className="divide-y divide-cream-100">
        {events.map((event, index) => {
          const config = agentConfig[event.agent_name] || {
            icon: <Bot className="h-3.5 w-3.5" />,
            color: 'text-ink-500',
            bg: 'bg-cream-100',
          };
          const typeConfig = eventTypeConfig[event.event_type] || { icon: null };
          const isLast = index === events.length - 1;

          return (
            <div key={event.id} className="px-5 py-3.5 flex gap-3.5 group hover:bg-cream-50/50 transition-colors">
              <div className="flex flex-col items-center">
                <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${config.bg} ${config.color} shrink-0`}>
                  {config.icon}
                </div>
                {!isLast && (
                  <div className="mt-1 h-full w-px bg-cream-200" />
                )}
              </div>
              <div className="flex-1 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                    {event.agent_name}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-cream-100 px-2 py-0.5 text-[10px] font-medium text-ink-400 uppercase">
                    {typeConfig.icon}
                    {event.event_type}
                  </span>
                  <span className="ml-auto text-[10px] text-ink-300">
                    {new Date(event.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
                {event.content && (
                  <p className="mt-1 text-sm text-ink-600 leading-relaxed">{event.content}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
