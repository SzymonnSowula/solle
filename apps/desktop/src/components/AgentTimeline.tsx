

interface TimelineEvent {
  id: string;
  agentName: string;
  eventType: string;
  content: string;
  timestamp: Date;
}

interface AgentTimelineProps {
  events: TimelineEvent[];
}

function AgentTimeline({ events }: AgentTimelineProps) {
  const getEventIcon = (eventType: string): string => {
    switch (eventType) {
      case 'started':
        return '▶';
      case 'thinking':
        return '💭';
      case 'tool_call':
        return '🔧';
      case 'tool_result':
        return '✓';
      case 'completed':
        return '✓';
      case 'failed':
        return '✗';
      case 'requires_approval':
        return '⚠';
      default:
        return '●';
    }
  }

  const getEventClass = (eventType: string): string => {
    switch (eventType) {
      case 'started':
      case 'tool_result':
      case 'completed':
        return 'completed';
      case 'thinking':
        return 'thinking';
      case 'failed':
      case 'requires_approval':
        return 'error';
      default:
        return 'started';
    }
  }

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  const formatAgentName = (name: string): string => {
    return name.charAt(0).toUpperCase() + name.slice(1);
  }

  if (events.length === 0) {
    return (
      <div
        style={{
          padding: '2rem',
          textAlign: 'center',
          color: '#a1a1a1',
          background: '#1a1a1a',
          borderRadius: '0.75rem',
          border: '1px solid #333',
        }}
      >
        Waiting for agent activity...
      </div>
    );
  }

  return (
    <div className="timeline-events">
      {events.map((event) => (
        <div key={event.id} className="timeline-event">
          <div
            className={`timeline-event-icon ${getEventClass(event.eventType)}`}
            title={event.eventType}
          >
            {getEventIcon(event.eventType)}
          </div>
          <div className="timeline-event-content">
            <strong>{formatAgentName(event.agentName)}</strong>
            <p>{event.content}</p>
          </div>
          <div className="timeline-event-time">{formatTime(event.timestamp)}</div>
        </div>
      ))}
    </div>
  );
}

export default AgentTimeline;
