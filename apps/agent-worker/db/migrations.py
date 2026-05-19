"""Raw SQL migration runner. No Alembic."""

import asyncpg
from .connection import get_pool

MIGRATIONS = [
    # 001_initial
    """
    CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        user_name TEXT NOT NULL DEFAULT 'Szef',
        company_type TEXT NOT NULL DEFAULT 'Mała firma e-commerce',
        preferred_tone TEXT NOT NULL DEFAULT 'Bezpośredni, konkretny',
        common_metrics TEXT[] NOT NULL DEFAULT ARRAY['przychód', 'liczba zamówień', 'średnia dzienna'],
        onboarding_complete BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS settings (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        key TEXT NOT NULL,
        value TEXT,
        UNIQUE(user_id, key)
    );

    CREATE TABLE IF NOT EXISTS integrations (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        config JSONB NOT NULL DEFAULT '{}',
        active BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(user_id, name)
    );

    CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        session_id TEXT REFERENCES sessions(id) ON DELETE CASCADE,
        role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
        content TEXT NOT NULL,
        tool_calls JSONB,
        tool_results JSONB,
        visual_card JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_integrations_user ON integrations(user_id, name);
    CREATE INDEX IF NOT EXISTS idx_settings_user ON settings(user_id, key);
    """,
    # 002_add_encryption
    """
    ALTER TABLE integrations ADD COLUMN IF NOT EXISTS encrypted_config BYTEA;
    """,
    # 003_action_log
    """
    CREATE TABLE IF NOT EXISTS action_logs (
        id SERIAL PRIMARY KEY,
        session_id TEXT REFERENCES sessions(id) ON DELETE SET NULL,
        tool_name TEXT NOT NULL,
        args JSONB NOT NULL DEFAULT '{}',
        result JSONB NOT NULL DEFAULT '{}',
        undo_data JSONB,
        status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'failed', 'undone')),
        undoable BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_action_logs_session ON action_logs(session_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_action_logs_undoable ON action_logs(undoable, status) WHERE undoable = TRUE AND status = 'completed';
    """,
    # 004_notifications
    """
    CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        data JSONB NOT NULL DEFAULT '{}',
        read BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read, created_at DESC);
    """,
]


async def run_migrations() -> None:
    pool = get_pool()
    async with pool.acquire() as conn:
        # Create migrations tracking table
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS _migrations (
                id SERIAL PRIMARY KEY,
                applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        """)
        applied = await conn.fetchval("SELECT COUNT(*) FROM _migrations")
        for i, sql in enumerate(MIGRATIONS[applied:], start=applied + 1):
            await conn.execute(sql)
            await conn.execute("INSERT INTO _migrations DEFAULT VALUES")
            print(f"[migration] Applied {i:03d}")
