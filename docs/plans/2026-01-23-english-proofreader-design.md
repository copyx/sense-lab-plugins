# English Proofreader Plugin Design

**Date:** 2026-01-23
**Status:** Implemented

## Overview

A Claude Code plugin that proofreads English prompts before execution, providing educational feedback to help non-native speakers improve their English.

## Requirements

| Requirement | Solution |
|-------------|----------|
| Proofread before execution | `UserPromptSubmit` hook |
| Show feedback to user | `reason` field (when blocking) / `systemMessage` (when clean) |
| Don't consume main context | `decision: "block"` erases prompt; `suppressOutput: true` for clean prompts |
| Educational feedback | Detailed explanations with grammar rules |
| Handle mixed content | Proofread English parts only, skip pure Korean |
| Always show feedback | "No issues" or corrections shown every time |
| Auto dependency install | `SessionStart` hook checks and installs if needed |
| Bun requirement check | Shell wrapper checks for Bun before running TypeScript |

## Architecture

```
SessionStart
    ↓
ensure-deps.sh
    ↓
Bun installed? ─No──→ Block with install instructions
    ↓ Yes
node_modules exists? ─No──→ Run `bun install`
    ↓ Yes
Ready

UserPromptSubmit
    ↓
proofread.sh
    ↓
Bun installed? ─No──→ Block with install instructions
    ↓ Yes
proofread.ts
    ↓
Contains English? ─No──→ Allow (silent)
    ↓ Yes
Call Claude Haiku via Agent SDK
    ↓
Issues found? ─No──→ Allow + "✓ No issues"
    ↓ Yes
Block + educational feedback
```

## Plugin Structure

```
english-proofreader/
├── .claude-plugin/
│   └── plugin.json          # Plugin metadata
├── hooks/
│   ├── hooks.json           # Hook configuration
│   ├── ensure-deps.sh       # Bun check + dependency installation
│   ├── proofread.sh         # Bun check wrapper
│   ├── proofread.ts         # Proofreading logic (TypeScript)
│   └── proofread.test.ts    # Tests
├── package.json             # Dependencies
├── tsconfig.json            # TypeScript config
└── README.md
```

## File Specifications

### .claude-plugin/plugin.json

```json
{
  "name": "english-proofreader",
  "description": "Proofreads English prompts before execution with educational feedback",
  "version": "1.0.0",
  "author": {
    "name": "jingi.kim"
  },
  "license": "MIT",
  "keywords": ["english", "proofreading", "grammar", "learning"]
}
```

### hooks/hooks.json

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "${CLAUDE_PLUGIN_ROOT}/hooks/ensure-deps.sh",
            "timeout": 120
          }
        ]
      }
    ],
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "${CLAUDE_PLUGIN_ROOT}/hooks/proofread.sh",
            "timeout": 60
          }
        ]
      }
    ]
  }
}
```

### hooks/ensure-deps.sh

```bash
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
```

### hooks/proofread.sh

```bash
#!/bin/bash

# Check if bun is installed
if ! command -v bun &> /dev/null; then
  echo '{"decision":"block","reason":"❌ Bun is not installed.\n\nThe english-proofreader plugin requires Bun to run.\n\nInstall Bun:\n  curl -fsSL https://bun.sh/install | bash\n\nThen restart your terminal and Claude Code."}'
  exit 0
fi

# Run the actual proofreader
exec bun run "${CLAUDE_PLUGIN_ROOT}/hooks/proofread.ts"
```

### hooks/proofread.ts

```typescript
#!/usr/bin/env bun

import { query } from "@anthropic-ai/claude-agent-sdk";

interface HookInput {
  prompt?: string;
}

interface HookOutputBlock {
  decision?: "block";
  reason?: string;
  suppressOutput?: boolean;
  systemMessage?: string;
}

interface ProofreadResult {
  hasIssues: boolean;
  feedback: string;
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString("utf-8");
}

export function containsEnglish(text: string): boolean {
  return /[a-zA-Z]/.test(text);
}

export function buildProofreadPrompt(text: string): string {
  return `You are an English proofreading assistant...`; // truncated
}

export function parseProofreadResult(result: string): ProofreadResult {
  const trimmed = result.trim();
  if (trimmed === "NO_ISSUES" || trimmed.startsWith("NO_ISSUES")) {
    return { hasIssues: false, feedback: "" };
  }
  return { hasIssues: true, feedback: trimmed };
}

async function main(): Promise<void> {
  try {
    const inputJson = await readStdin();
    const input: HookInput = JSON.parse(inputJson);
    const prompt = input.prompt || "";

    if (!containsEnglish(prompt)) {
      console.log(JSON.stringify({}));
      process.exit(0);
    }

    let result = "";
    for await (const message of query({
      prompt: buildProofreadPrompt(prompt),
      options: {
        allowedTools: [],
        maxTurns: 1,
        model: "haiku",
      },
    })) {
      if (message.type === "result" && "result" in message && message.result) {
        result = message.result;
      }
    }

    const parsed = parseProofreadResult(result);

    if (parsed.hasIssues) {
      const output: HookOutputBlock = {
        decision: "block",
        reason: `📝 English Proofreading:\n\n${parsed.feedback}\n\nPlease revise your prompt and re-submit.`,
      };
      console.log(JSON.stringify(output));
    } else {
      const output: HookOutputBlock = {
        suppressOutput: true,
        systemMessage: "✓ No English issues found",
      };
      console.log(JSON.stringify(output));
    }
  } catch (error) {
    console.error(`Proofreading error: ${(error as Error).message}`);
    console.log(JSON.stringify({}));
  }

  process.exit(0);
}

const isMainModule = import.meta.main;
if (isMainModule) {
  main();
}
```

### package.json

```json
{
  "name": "english-proofreader",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "test": "bun test"
  },
  "dependencies": {
    "@anthropic-ai/claude-agent-sdk": "^0.1.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "bun-types": "^1.2.0",
    "typescript": "^5.7.0"
  }
}
```

## Technical Decisions

| Decision | Rationale |
|----------|-----------|
| Bun runtime | Native TypeScript support without build step |
| Shell wrappers | Check Bun availability before running TypeScript |
| SessionStart hook | Auto-install dependencies on first session |
| Local SDK dependency | No global npm install required |
| Claude Haiku model | Fast, cheap, sufficient for grammar checking |
| Fail-open on errors | Don't block user workflow if proofreading fails |
| `maxTurns: 1` | Single response, no agentic loops needed |
| `suppressOutput: true` | Prevents "no issues" message from polluting context |

## Test Coverage

- Unit tests for `containsEnglish`, `buildProofreadPrompt`, `parseProofreadResult`
- Integration tests calling real Claude API
- Tests for Korean-only, English-only, mixed content, malformed input
- 24 tests total, all passing

## User Flow

1. User installs Bun (one-time)
2. User installs plugin via `/plugin install english-proofreader@sense-lab-plugins`
3. On first session start, SessionStart hook runs `bun install` automatically
4. Plugin is ready - all English prompts are proofreaded automatically
