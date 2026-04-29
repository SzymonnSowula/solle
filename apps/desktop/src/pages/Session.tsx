import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import VoiceOrb from '../components/VoiceOrb';
import AgentTimeline from '../components/AgentTimeline';
import SummaryCard from '../components/SummaryCard';
import { api } from '../lib/api';

interface TimelineEvent {
  id: string;
  agentName: string;
  eventType: string;
  content: string;
  timestamp: Date;
}

interface ResearchResult {
  title: string;
  organization?: string;
  location?: string;
  url?: string;
  reason?: string;
  snippet?: string;
}

function Session() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(null);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [followUp, setFollowUp] = useState('');
  const [sending, setSending] = useState(false);
  const eventsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchAll = async () => {
      try {
        const [sessionData, eventsData] = await Promise.all([
          api.getSession(id!),
          api.getSessionEvents(id!),
        ]);
        if (!isMounted) return;
        setSession(sessionData);
        setEvents(
          eventsData.map((e: any) => ({
            id: e.id,
            agentName: e.agent_name,
            eventType: e.event_type,
            content: e.content,
            timestamp: new Date(e.created_at),
          }))
        );
        setLoading(false);
      } catch (err) {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : 'Failed to load session');
        setLoading(false);
      }
    };

    fetchAll();

    const interval = setInterval(() => {
      fetchAll().catch(() => {});
    }, 2500);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [id]);

  useEffect(() => {
    eventsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events]);

  const handleEndSession = async () => {
    try {
      await api.completeSession(id!);
      navigate('/');
    } catch (error) {
      console.error('Failed to end session:', error);
    }
  };

  const handleSendFollowUp = async () => {
    if (!followUp.trim()) return;
    setSending(true);

    try {
      await api.sendMessage(id!, followUp.trim());
      setFollowUp('');
      // Optimistically add user message to timeline
      setEvents((prev) => [
        ...prev,
        {
          id: `user-${Date.now()}`,
          agentName: 'user',
          eventType: 'message',
          content: followUp.trim(),
          timestamp: new Date(),
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const researchResults: ResearchResult[] = session?.researchResults || session?.metadata?.researchResults || [];
  const isRunning = session?.status === 'running';
  const isCompleted = session?.status === 'completed';

  if (loading) {
    return (
      <div className="session">
        <div className="loading">Loading session...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="session">
        <div className="loading error">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="session">
      <header className="session-header">
        <div className="session-header-info">
          <h2>Session {id?.slice(0, 8)}</h2>
          <p className="session-header-input">{session?.input}</p>
        </div>
        <div className="session-header-actions">
          <span className={`status-indicator ${isRunning ? 'running' : isCompleted ? 'completed' : ''}`}>
            {isRunning ? '● Running' : isCompleted ? '✓ Completed' : session?.status}
          </span>
          <button className="back-button" onClick={handleEndSession}>
            End Session
          </button>
          <button className="back-button" onClick={() => navigate('/')}>
            Back
          </button>
        </div>
      </header>

      <div className="session-content">
        <div className="voice-section">
          <VoiceOrb sessionId={id} />
        </div>

        <div className="agent-timeline">
          <h3 className="timeline-title">Agent Activity</h3>
          <AgentTimeline events={events} />
          <div ref={eventsEndRef} />
        </div>

        {/* Follow-up input */}
        {!isCompleted && (
          <div className="follow-up-input" style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              value={followUp}
              onChange={(e) => setFollowUp(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendFollowUp()}
              placeholder="Type a follow-up message..."
              disabled={sending}
              style={{
                flex: 1,
                padding: '0.75rem',
                borderRadius: '0.5rem',
                border: '1px solid #333',
                background: '#1a1a1a',
                color: '#e1e1e1',
              }}
            />
            <button
              onClick={handleSendFollowUp}
              disabled={sending || !followUp.trim()}
              style={{
                padding: '0.75rem 1.5rem',
                borderRadius: '0.5rem',
                border: 'none',
                background: '#6366f1',
                color: '#fff',
                cursor: 'pointer',
              }}
            >
              {sending ? 'Sending...' : 'Send'}
            </button>
          </div>
        )}

        {researchResults.length > 0 && (
          <div className="research-results">
            <h3 className="timeline-title">Research Results</h3>
            <div className="results-list">
              {researchResults.map((result, index) => (
                <div key={index} className="result-card">
                  <div className="result-header">
                    <h4 className="result-title">{result.title}</h4>
                    <span className="result-number">#{index + 1}</span>
                  </div>
                  <div className="result-tags">
                    {result.organization && (
                      <span className="result-tag">{result.organization}</span>
                    )}
                    {result.location && (
                      <span className="result-tag">{result.location}</span>
                    )}
                  </div>
                  {result.reason && (
                    <p className="result-reason">{result.reason}</p>
                  )}
                  {result.snippet && !result.reason && (
                    <p className="result-snippet">{result.snippet}</p>
                  )}
                  {result.url && (
                    <a
                      href={result.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="result-link"
                    >
                      View source
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {session?.summary && <SummaryCard summary={session.summary} />}
      </div>
    </div>
  );
}

export default Session;
