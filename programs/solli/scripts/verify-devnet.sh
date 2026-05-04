#!/usr/bin/env bash
set -e

# Solli Anchor Devnet Verify Script
# =================================
# Verifies the deployed program on devnet.
#
# Usage:
#   chmod +x programs/solli/scripts/verify-devnet.sh
#   ./programs/solli/scripts/verify-devnet.sh

echo "🔍 Solli Anchor Devnet Verify"
echo "============================="

cd programs/solli

PROGRAM_ID=$(grep -A1 '\[programs.devnet\]' Anchor.toml | grep programs_solli | sed 's/.*= *"\(.*\)".*/\1/')
echo "Program ID: $PROGRAM_ID"

echo ""
echo "Fetching program account..."
solana program show "$PROGRAM_ID" --url https://api.devnet.solana.com

echo ""
echo "Done."
