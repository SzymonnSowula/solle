#!/usr/bin/env bash
set -euo pipefail

REPO="/home/szymon/volle"
VAULT="/mnt/c/Users/szymo/Documents/Obsidian Vault/Projects/Volle"
CODEBASE_NOTE="$VAULT/10 - Codebase.md"
LOG_NOTE="$VAULT/20 - Daily Log.md"

cd "$REPO"

echo "=== Syncing Volle to Obsidian ==="

# ----------------------------------------
# 1. Update Codebase State
# ----------------------------------------
TREE=$(git ls-files | grep -vE '^(\.git|node_modules|\.venv|target|dist)/' | tree --fromfile --dirsfirst 2>/dev/null || git ls-files | grep -vE '^(\.git|node_modules|\.venv|target|dist)/')

README=$(cat README.md 2>/dev/null || echo "No README")

LAST_COMMIT=$(git log -1 --format="%h %s (%ci)")
COMMIT_COUNT=$(git rev-list --count HEAD)

cat > "$CODEBASE_NOTE" << 'EOF'
# Current Codebase State

> Auto-generated. Run sync to update.

## Repository
- **Path**: `/home/szymon/volle`
- **Monorepo**: apps, packages, mcp-servers, data, infra, scripts

## Latest Commit
EOF

echo "- \`$LAST_COMMIT\`" >> "$CODEBASE_NOTE"
echo "- **Total commits**: $COMMIT_COUNT" >> "$CODEBASE_NOTE"
echo "" >> "$CODEBASE_NOTE"
echo "## File Tree" >> "$CODEBASE_NOTE"
echo "\`\`\`" >> "$CODEBASE_NOTE"
echo "$TREE" >> "$CODEBASE_NOTE"
echo "\`\`\`" >> "$CODEBASE_NOTE"
echo "" >> "$CODEBASE_NOTE"
echo "## README" >> "$CODEBASE_NOTE"
echo "\`\`\`markdown" >> "$CODEBASE_NOTE"
echo "$README" >> "$CODEBASE_NOTE"
echo "\`\`\`" >> "$CODEBASE_NOTE"

# ----------------------------------------
# 2. Update Daily Log (append new commits)
# ----------------------------------------
TODAY=$(date "+%Y-%m-%d %H:%M:%S")
NEW_COMMITS=$(git log --since="24 hours ago" --format="- \`%h\` %s — %an, %ar" || echo "")

if [ -n "$NEW_COMMITS" ]; then
  {
    echo ""
    echo "## $TODAY"
    echo "$NEW_COMMITS"
  } >> "$LOG_NOTE"
fi

echo "=== Sync complete ==="
echo "Updated: $CODEBASE_NOTE"
echo "Updated: $LOG_NOTE"
