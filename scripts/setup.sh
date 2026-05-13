#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "=== Setting up Volle ==="

# Python backend
echo "-> Python venv for agent-worker"
cd apps/agent-worker
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
cd ../..

# Desktop client
echo "-> npm install for desktop client"
cd apps/client-desktop
npm install
cd ../..

# Generate mock data
echo "-> Generating mock sales data"
python3 data/mock/generate_sales.py

echo "=== Setup complete ==="
echo ""
echo "Next steps:"
echo "  1. Start backend:   bash scripts/dev-backend.sh"
echo "  2. Start client:    bash scripts/dev-client.sh"
