# English Proofreader Plugin Design

**Date:** 2026-01-23
**Status:** Ready for implementation

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

## Architecture

```
User submits English prompt
         ↓
UserPromptSubmit hook triggers
         ↓
proofread.mjs executes
         ↓
Contains English? ─No──→ Allow (silent)
         ↓ Yes
Call Claude Haiku via Agent SDK
         ↓
Issues found? ─No──→ Allow + systemMessage "✓ No issues"
         ↓ Yes
Block + reason "[educational feedback]"
         ↓
User revises and re-submits
```

## Plugin Structure

```
english-proofreader/
├── .claude-plugin/
│   └── plugin.json
├── hooks/
│   ├── hooks.json
│   └── proofread.mjs
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
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node ${CLAUDE_PLUGIN_ROOT}/hooks/proofread.mjs",
            "timeout": 60
          }
        ]
      }
    ]
  }
}
```

### hooks/proofread.mjs

```javascript
#!/usr/bin/env node

import { query } from "@anthropic-ai/claude-agent-sdk";

// Read stdin
async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf-8");
}

// Check if text contains English letters
function containsEnglish(text) {
  return /[a-zA-Z]/.test(text);
}

// Build proofreading prompt
function buildProofreadPrompt(text) {
  return `You are an English proofreading assistant for a non-native speaker who wants to learn.

Analyze the following text for:
1. Grammar errors
2. Wrong word usage
3. Unnatural expressions (from a native speaker's perspective)

Focus ONLY on the English parts. Ignore any Korean or other non-English text.

Text to proofread:
"""
${text}
"""

If there are NO issues, respond with exactly:
NO_ISSUES

If there ARE issues, respond in this format for EACH issue:

✗ "[original phrase]" → "[corrected phrase]"
Explanation: [Detailed educational explanation of why this is wrong and how to remember the correct usage. Include grammar rules, common patterns, or helpful tips.]

---

Be thorough but focus on actual errors, not style preferences. If the English is grammatically correct and natural-sounding, respond with NO_ISSUES.`;
}

// Parse proofreading result
function parseProofreadResult(result) {
  const trimmed = result.trim();

  if (trimmed === "NO_ISSUES" || trimmed.startsWith("NO_ISSUES")) {
    return { hasIssues: false, feedback: "" };
  }

  return { hasIssues: true, feedback: trimmed };
}

// Main function
async function main() {
  try {
    // 1. Read input from stdin
    const inputJson = await readStdin();
    const input = JSON.parse(inputJson);
    const prompt = input.prompt || "";

    // 2. Skip if no English content
    if (!containsEnglish(prompt)) {
      console.log(JSON.stringify({}));
      process.exit(0);
    }

    // 3. Call Claude for proofreading
    let result = "";
    for await (const message of query({
      prompt: buildProofreadPrompt(prompt),
      options: {
        allowedTools: [],
        maxTurns: 1,
        model: "claude-haiku"
      }
    })) {
      if (message.type === "result" && message.result) {
        result = message.result;
      }
    }

    // 4. Parse response and output appropriate JSON
    const parsed = parseProofreadResult(result);

    if (parsed.hasIssues) {
      // Block with educational feedback
      console.log(JSON.stringify({
        decision: "block",
        reason: `📝 English Proofreading:\n\n${parsed.feedback}\n\nPlease revise your prompt and re-submit.`
      }));
    } else {
      // Allow with suppressed output
      console.log(JSON.stringify({
        suppressOutput: true,
        systemMessage: "✓ No English issues found"
      }));
    }

  } catch (error) {
    // On error, allow prompt to proceed (fail-open)
    console.error(`Proofreading error: ${error.message}`);
    console.log(JSON.stringify({}));
  }

  process.exit(0);
}

main();
```

### README.md

```markdown
# English Proofreader Plugin

Proofreads your English prompts before Claude Code executes them, providing educational feedback to help you improve your English.

## Features

- Automatic proofreading of all English prompts
- Educational feedback with grammar explanations
- Handles mixed Korean/English content (proofreads English parts only)
- Does not consume conversation context

## Prerequisites

Install the Claude Agent SDK globally:

```bash
npm install -g @anthropic-ai/claude-agent-sdk
```

## Installation

```bash
# Add the marketplace (if not already added)
/plugin marketplace add jingi-kim/sense-lab-plugins

# Install the plugin
/plugin install english-proofreader@sense-lab-plugins
```

## Usage

Once installed, the plugin automatically proofreads every English prompt you submit.

**If issues are found:**
- Your prompt is blocked (not executed)
- You see educational feedback explaining the errors
- Revise your prompt and re-submit

**If no issues:**
- You see "✓ No English issues found"
- Your prompt executes normally

## Example

**Your prompt:**
```
Help me to understand this code
```

**Feedback:**
```
📝 English Proofreading:

✗ "Help me to understand" → "Help me understand"
Explanation: After "help + object", use the bare infinitive without "to".
This is called the "bare infinitive" pattern. Compare: "help me do" (correct)
vs "help me to do" (less natural in American English).

Please revise your prompt and re-submit.
```

## License

MIT
```

## Technical Decisions

| Decision | Rationale |
|----------|-----------|
| Claude Haiku model | Fast, cheap, sufficient for grammar checking |
| Fail-open on errors | Don't block user workflow if proofreading fails |
| `maxTurns: 1` | Single response, no agentic loops needed |
| Global SDK install | Avoids npm dependency issues in plugin caching |
| `suppressOutput: true` | Prevents "no issues" message from polluting context |

## Documentation References

- [Claude Code Hooks](https://code.claude.com/docs/en/hooks)
- [Claude Code Plugins](https://code.claude.com/docs/en/plugins)
- [Claude Agent SDK - TypeScript](https://platform.claude.com/docs/en/agent-sdk/typescript)
