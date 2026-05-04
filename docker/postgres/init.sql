-- Solli Database Initialization
-- =============================
-- This schema supports the Solli voice-native AI agent platform.
-- Tables:
--   sessions       - User research sessions with intent, status, and results
--   tasks          - Individual agent tool executions within a session
--   agent_events   - Timeline events for real-time agent activity tracking
--   receipts       - Execution receipts for agent task payments (x402)
--
-- Apps: api (Fastify), desktop (Tauri/React), worker-browser (Playwright),
--       worker-google (Gmail/Calendar)
-- Packages: agent-core (LangGraph), shared (types/schemas), blockchain (Solana stubs)

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Sessions table
-- Stores user sessions created via the desktop or API.
-- Lifecycle: created -> running -> completed/failed
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL DEFAULT 'anonymous',
    input TEXT,
    intent TEXT,
    status TEXT NOT NULL DEFAULT 'created',
    summary TEXT,
    intent_classification TEXT,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    estimated_cost_sol REAL DEFAULT 0,
    actual_cost_sol REAL DEFAULT 0,
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_status ON sessions(status);
CREATE INDEX idx_sessions_started_at ON sessions(started_at DESC);

-- Tasks table
-- Tracks individual agent tool calls (e.g. browser_search) and their outputs
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    agent_name TEXT NOT NULL,
    tool_name TEXT,
    input_json JSONB NOT NULL DEFAULT '{}',
    output_json JSONB,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    cost_sol REAL DEFAULT 0,
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_tasks_session_id ON tasks(session_id);
CREATE INDEX idx_tasks_agent_name ON tasks(agent_name);
CREATE INDEX idx_tasks_status ON tasks(status);

-- Agent events table
-- Real-time timeline events displayed in the desktop app's Agent Activity panel
CREATE TABLE IF NOT EXISTS agent_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    agent_name TEXT NOT NULL,
    event_type TEXT NOT NULL,
    step_name TEXT,
    content TEXT,
    input_payload JSONB DEFAULT '{}',
    output_payload JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_agent_events_session_id ON agent_events(session_id);
CREATE INDEX idx_agent_events_created_at ON agent_events(created_at DESC);

-- Receipts table
-- Execution receipts for agent task payments (x402 protocol integration)
CREATE TABLE IF NOT EXISTS receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    receipt_type TEXT NOT NULL,
    agent_name TEXT NOT NULL,
    task_id UUID REFERENCES tasks(id),
    input_hash TEXT NOT NULL,
    output_hash TEXT NOT NULL,
    execution_time_ms INTEGER,
    cost_units REAL,
    signature TEXT,
    on_chain_txid TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_receipts_session_id ON receipts(session_id);
CREATE INDEX idx_receipts_status ON receipts(status);
CREATE INDEX idx_receipts_created_at ON receipts(created_at DESC);

-- pgvector index for semantic search
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS embedding vector(1536);
CREATE INDEX IF NOT EXISTS idx_sessions_embedding ON sessions USING ivfflat (embedding vector_cosine_ops);

-- Checkpoints table (LangGraph persistence)
-- Stores graph state snapshots for session resumption and follow-ups
CREATE TABLE IF NOT EXISTS checkpoints (
    thread_id TEXT NOT NULL,
    checkpoint_ns TEXT NOT NULL DEFAULT '',
    checkpoint_id TEXT NOT NULL,
    parent_checkpoint_id TEXT,
    type TEXT,
    checkpoint JSONB NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}',
    PRIMARY KEY (thread_id, checkpoint_ns, checkpoint_id)
);

CREATE INDEX idx_checkpoints_thread_id ON checkpoints(thread_id);
CREATE INDEX idx_checkpoints_parent ON checkpoints(parent_checkpoint_id);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_sessions_updated_at
    BEFORE UPDATE ON sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
