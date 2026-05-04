#!/usr/bin/env bash
set -e

# Solli Anchor Devnet Deploy Script
# ================================
# Run this from the repo root after building the program.
#
# Prerequisites:
# 1. Solana CLI installed: solana --version
# 2. Anchor CLI installed: anchor --version
# 3. Devnet wallet with SOL for rent exemption
#
# Usage:
#   chmod +x programs/solli/scripts/deploy-devnet.sh
#   ./programs/solli/scripts/deploy-devnet.sh

echo "🚀 Solli Anchor Devnet Deploy"
echo "=============================="

# Step 1: Ensure wallet exists
echo "📋 Step 1/5: Checking wallet..."
if [ ! -f ~/.config/solana/id.json ]; then
    echo "❌ No wallet found at ~/.config/solana/id.json"
    echo "   Run: solana-keygen new --outfile ~/.config/solana/id.json"
    exit 1
fi

# Step 2: Switch to devnet
echo "📋 Step 2/5: Switching to devnet..."
solana config set --url https://api.devnet.solana.com

# Step 3: Check balance
echo "📋 Step 3/5: Checking devnet balance..."
BALANCE=$(solana balance | awk '{print $1}')
echo "   Current balance: $BALANCE SOL"

if (( $(echo "$BALANCE < 2.0" | bc -l) )); then
    echo "   Balance low. Requesting airdrop..."
    solana airdrop 2
    BALANCE=$(solana balance | awk '{print $1}')
    echo "   New balance: $BALANCE SOL"
fi

# Step 4: Build program
echo "📋 Step 4/5: Building program..."
cd programs/solli
anchor build

# Step 5: Deploy
echo "📋 Step 5/5: Deploying to devnet..."
anchor deploy --provider.cluster devnet

echo ""
echo "✅ Deploy complete!"
echo ""
echo "Next steps:"
echo "  1. Copy the deployed Program ID from the output above"
echo "  2. Update .env.local: ANCHOR_PROGRAM_ID=<new_program_id>"
echo "  3. Update Anchor.toml [programs.devnet] section"
echo "  4. Update lib/solana/anchor-client.ts PROGRAM_ID constant"
echo ""
