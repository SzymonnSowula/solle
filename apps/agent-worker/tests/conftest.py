"""pytest config."""

import os

# Use test DB URL
os.environ.setdefault("DATABASE_URL", "postgresql://volle:volle@localhost:5432/volle")
