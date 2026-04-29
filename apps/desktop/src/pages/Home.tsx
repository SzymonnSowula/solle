import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

function Home() {
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleStartSession = async () => {
    if (!input.trim()) return;
    setLoading(true);

    try {
      const response = await api.createSessionWithInput(input.trim());
      const { sessionId } = response;

      await api.runSession(sessionId);

      navigate(`/session/${sessionId}`);
    } catch (error) {
      console.error('Failed to start session:', error);
      alert('Failed to start session. Check console for details.');
    } finally {
      setLoading(false);
    }
  };

  const sampleQueries = [
    'Find me 3 AI internship opportunities in Poland',
    'Research remote React developer jobs',
    'Find top AI conferences in Europe 2025',
  ];

  return (
    <div className="home">
      <h1>What would you like to research?</h1>
      <p className="home-subtitle">
        Ask anything and let AI agents handle the research for you.
      </p>

      <div className="home-input-wrap">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. Find me AI internships in Poland..."
          rows={3}
          className="home-textarea"
        />
        <button
          className="start-button"
          onClick={handleStartSession}
          disabled={loading || !input.trim()}
        >
          {loading ? 'Starting...' : 'Start Session'}
        </button>
      </div>

      <div className="home-samples">
        <p className="home-samples-title">Try one of these:</p>
        <div className="home-samples-list">
          {sampleQueries.map((q) => (
            <button
              key={q}
              onClick={() => setInput(q)}
              className="sample-chip"
            >
              {q}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Home;
