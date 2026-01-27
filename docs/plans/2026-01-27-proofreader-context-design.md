# English Proofreader Context Enhancement

**Date:** 2026-01-27
**Status:** Approved

## Problem

The english-proofreader plugin proofreads user prompts in isolation, without knowing what Claude said previously. This causes:

1. **False positives** - Short contextual replies like "Yes, the second one" get flagged as incomplete
2. **Worse corrections** - Suggestions don't account for conversation flow

## Solution

Include Claude's last response as context when proofreading.

## Design

### Architecture

```
UserPromptSubmit
    ↓
proofread.ts receives { prompt, transcript_path }
    ↓
Read transcript file (from end) → extract Claude's last response
    ↓
Truncate to 2000 chars (keep end)
    ↓
Build proofreading prompt (user prompt + context)
    ↓
Call Claude Haiku
    ↓
Return result
```

### Transcript Parsing (Efficient)

Read file from end in chunks to avoid loading entire transcript:

```typescript
async function getLastAssistantMessage(
  transcriptPath: string
): Promise<string | null> {
  const file = Bun.file(transcriptPath);
  const fileSize = file.size;

  const CHUNK_SIZE = 4096; // 4KB chunks
  let position = fileSize;
  let buffer = "";

  while (position > 0) {
    const readSize = Math.min(CHUNK_SIZE, position);
    position -= readSize;

    const chunk = await file.slice(position, position + readSize).text();
    buffer = chunk + buffer;

    const lines = buffer.split("\n");
    buffer = lines[0]; // Keep incomplete first line

    for (let i = lines.length - 1; i >= 1; i--) {
      if (!lines[i].trim()) continue;
      const msg = JSON.parse(lines[i]);
      if (msg.type === "assistant") {
        return extractText(msg.content);
      }
    }
  }

  return null;
}
```

### Context Truncation

```typescript
const MAX_CONTEXT_CHARS = 2000;

function truncateContext(text: string): string {
  if (text.length <= MAX_CONTEXT_CHARS) {
    return text;
  }
  return "..." + text.slice(-MAX_CONTEXT_CHARS);
}
```

Keep the **end** of Claude's response (most relevant to user's reply).

### Modified Prompt

```typescript
export function buildProofreadPrompt(
  text: string,
  context?: string | null
): string {
  const contextSection = context
    ? `For context, here is Claude's previous response:
"""
${context}
"""

`
    : "";

  return `You are an English proofreading assistant...

${contextSection}IMPORTANT: Consider the context when evaluating. Short replies like "Yes, do that" are natural when responding to a previous message.

Text to proofread:
"""
${text}
"""
...`;
}
```

### Edge Cases

| Scenario | Behavior |
|----------|----------|
| File doesn't exist | Proofread without context |
| Empty transcript | Proofread without context |
| No assistant messages | Proofread without context |
| Content is array | Extract text blocks only |
| Parse error | Log warning, proofread without context |

## Files Changed

| File | Change |
|------|--------|
| `hooks/proofread.ts` | Add transcript parsing, context truncation, update prompt building |
| `hooks/proofread.test.ts` | Add tests for new functionality |

## Testing

1. Transcript parsing (basic extraction)
2. Reverse reading efficiency
3. Edge cases (missing file, no assistant messages, etc.)
4. Context truncation
5. Prompt building with context
6. Integration: contextual proofreading allows short replies
7. Integration: still catches real errors with context
