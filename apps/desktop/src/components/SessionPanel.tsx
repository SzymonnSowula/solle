import AgentTimeline from './AgentTimeline';
import SummaryCard from './SummaryCard';

interface SessionPanelProps {
  session: {
    id: string;
    status: string;
    agentHistory: Array<{
      agentName: string;
      eventType: string;
      content: string;
      timestamp: string;
    }>;
    summary?: string;
    pendingApprovals: Array<{
      id: string;
      agentName: string;
      message: string;
      toolName: string;
    }>;
  };
  onApprove: (approvalId: string, approved: boolean) => void;
}

function SessionPanel({ session, onApprove }: SessionPanelProps) {
  return (
    <div className="session-panel">
      {session.pendingApprovals.length > 0 && (
        <div className="approvals-panel">
          <h3>Pending Approvals</h3>
          {session.pendingApprovals.map((approval) => (
            <div key={approval.id} className="approval-item">
              <div className="approval-content">
                <strong>{approval.agentName}</strong>
                <p>{approval.message}</p>
                <span className="tool-name">Tool: {approval.toolName}</span>
              </div>
              <div className="approval-actions">
                <button
                  className="approve-button"
                  onClick={() => onApprove(approval.id, true)}
                >
                  Approve
                </button>
                <button
                  className="deny-button"
                  onClick={() => onApprove(approval.id, false)}
                >
                  Deny
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="timeline-panel">
        <AgentTimeline
          events={session.agentHistory.map((entry, index) => ({
            id: `event-${index}`,
            agentName: entry.agentName,
            eventType: entry.eventType,
            content: entry.content,
            timestamp: new Date(entry.timestamp),
          }))}
        />
      </div>

      {session.summary && <SummaryCard summary={session.summary} />}
    </div>
  );
}

export default SessionPanel;
