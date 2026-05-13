#!/usr/bin/env bash
cd "$(dirname "$0")/../apps/agent-worker"
source .venv/bin/activate
exec uvicorn main:app --reload --host 0.0.0.0 --port 8000
