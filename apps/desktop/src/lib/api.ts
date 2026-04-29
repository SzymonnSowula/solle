const API_BASE = '/api';

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {};
  if (options?.body) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      ...headers,
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    throw new Error(`HTTP ${response.status}: ${text}`);
  }

  return response.json();
}

export const api = {
  async createSessionWithInput(input: string, userId?: string, metadata?: Record<string, unknown>) {
    return fetchJSON<{ sessionId: string; status: string }>(
      `${API_BASE}/sessions`,
      {
        method: 'POST',
        body: JSON.stringify({ input, userId, metadata }),
      }
    );
  },

  async runSession(sessionId: string) {
    return fetchJSON<{ sessionId: string; status: string }>(
      `${API_BASE}/sessions/${sessionId}/run`,
      { method: 'POST' }
    );
  },

  async createSession(userId: string, metadata?: Record<string, unknown>) {
    return fetchJSON<{ id: string; userId: string; status: string }>(
      `${API_BASE}/sessions`,
      {
        method: 'POST',
        body: JSON.stringify({ userId, metadata }),
      }
    );
  },

  async getSessions() {
    return fetchJSON<any[]>(`${API_BASE}/sessions`);
  },

  async getSession(id: string) {
    return fetchJSON<any>(`${API_BASE}/sessions/${id}`);
  },

  async getSessionEvents(id: string) {
    return fetchJSON<any[]>(`${API_BASE}/sessions/${id}/events`);
  },

  async updateSession(id: string, updates: Record<string, unknown>) {
    return fetchJSON<any>(`${API_BASE}/sessions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },

  async completeSession(id: string) {
    return fetchJSON<any>(`${API_BASE}/sessions/${id}/complete`, {
      method: 'POST',
    });
  },

  async triggerAgent(sessionId: string, userIntent: string) {
    return fetchJSON<{ success: boolean; result: any }>(
      `${API_BASE}/agents/trigger`,
      {
        method: 'POST',
        body: JSON.stringify({ sessionId, userIntent }),
      }
    );
  },

  async getSessionState(sessionId: string) {
    try {
      return await fetchJSON<any>(`${API_BASE}/agents/state/${sessionId}`);
    } catch {
      return null;
    }
  },

  async approveTask(
    sessionId: string,
    approvalId: string,
    approved: boolean,
    notes?: string
  ) {
    return fetchJSON<{ success: boolean }>(`${API_BASE}/agents/approve`, {
      method: 'POST',
      body: JSON.stringify({ sessionId, approvalId, approved, notes }),
    });
  },

  async getReceipts(sessionId: string) {
    return fetchJSON<any[]>(`${API_BASE}/receipts/session/${sessionId}`);
  },

  async sendMessage(sessionId: string, message: string) {
    return fetchJSON<{ sessionId: string; status: string }>(
      `${API_BASE}/sessions/${sessionId}/message`,
      {
        method: 'POST',
        body: JSON.stringify({ message }),
      }
    );
  },
};
