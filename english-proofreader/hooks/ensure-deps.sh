#!/bin/bash

# Check if bun is installed
if ! command -v bun &> /dev/null; then
  echo '{"decision":"block","reason":"❌ Bun is not installed.\n\nThe english-proofreader plugin requires Bun to run.\n\nInstall Bun:\n  curl -fsSL https://bun.sh/install | bash\n\nThen restart your terminal and Claude Code."}'
  exit 0
fi

# Check if node_modules exists, install if not
if [ ! -d "${CLAUDE_PLUGIN_ROOT}/node_modules" ]; then
  echo "Installing english-proofreader dependencies..." >&2
  cd "${CLAUDE_PLUGIN_ROOT}" && bun install >&2
  echo "Dependencies installed successfully." >&2
fi

# Output empty JSON to indicate success
echo '{}'
