#!/bin/bash

# Check if bun is installed
if ! command -v bun &> /dev/null; then
  echo '{"decision":"block","reason":"❌ Bun is not installed.\n\nThe english-proofreader plugin requires Bun to run.\n\nInstall Bun:\n  curl -fsSL https://bun.sh/install | bash\n\nThen restart your terminal and Claude Code."}'
  exit 0
fi

# Run the actual proofreader
exec bun run "${CLAUDE_PLUGIN_ROOT}/hooks/proofread.ts"
