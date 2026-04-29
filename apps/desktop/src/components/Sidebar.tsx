import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../lib/api';

interface SessionItem {
  id: string;
  input?: string;
  status: string;
  created_at: string;
}

export default function Sidebar() {
  const location = useLocation();
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await api.getSessions();
        setSessions(data);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const isActive = (path: string) => location.pathname === path;

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <Link to="/" className="sidebar-logo">
          <span className="logo-icon">◈</span>
          <span className="logo-text">Solli</span>
        </Link>
      </div>

      <nav className="sidebar-nav">
        <Link
          to="/"
          className={`nav-link ${isActive('/') ? 'active' : ''}`}
        >
          <span className="nav-icon">+</span>
          <span>New Session</span>
        </Link>
      </nav>

      <div className="sidebar-section">
        <h3 className="sidebar-title">Recent Sessions</h3>
        {loading ? (
          <div className="sidebar-loading">Loading...</div>
        ) : sessions.length === 0 ? (
          <div className="sidebar-empty">No sessions yet</div>
        ) : (
          <ul className="session-list">
            {sessions.map((session) => (
              <li key={session.id}>
                <Link
                  to={`/session/${session.id}`}
                  className={`session-link ${location.pathname === `/session/${session.id}` ? 'active' : ''}`}
                >
                  <div className="session-link-input">
                    {session.input || 'Untitled session'}
                  </div>
                  <div className="session-link-meta">
                    <span className={`status-badge ${session.status}`}>
                      {session.status}
                    </span>
                    <span className="session-date">
                      {new Date(session.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
