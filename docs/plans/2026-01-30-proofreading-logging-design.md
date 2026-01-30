# Design: Proofreading Response Logging

## Overview

Log all proofreading results (both pass and block) as JSONL files at `~/.english-proofreader/logs/YYYY-MM-DD.jsonl`. Restructure the proofreading prompt to return JSON for reliable parsing.

## Log Entry Schema

```jsonl
{"timestamp":"2026-01-30T14:30:00.000Z","prompt":"user text","feedback":[{"original":"phrase","corrected":"fix","explanation":"why..."}],"decision":"block"}
{"timestamp":"2026-01-30T14:31:00.000Z","prompt":"looks good","feedback":[],"decision":"pass"}
```

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | string | ISO 8601 timestamp |
| `prompt` | string | Original user prompt |
| `feedback` | array | Array of correction items (empty for pass) |
| `feedback[].original` | string | The problematic phrase |
| `feedback[].corrected` | string | The corrected phrase |
| `feedback[].explanation` | string | Educational explanation |
| `feedback[].raw` | string | Fallback: unparsed text if JSON parsing fails |
| `decision` | string | `"block"` or `"pass"` |

## Changes to `proofread.ts`

### 1. Restructure prompt (`buildProofreadPrompt`)

Change the issue response format from human-readable `💡` format to JSON:

- `NO_ISSUES` response stays the same
- For issues: request a JSON array of `{original, corrected, explanation}` objects

### 2. New type: `FeedbackItem`

```ts
interface FeedbackItem {
  original?: string;
  corrected?: string;
  explanation?: string;
  raw?: string; // fallback when JSON parsing fails
}
```

### 3. New function: `parseFeedbackItems(text: string): FeedbackItem[]`

- Attempts `JSON.parse()` on the feedback text
- On success: returns the parsed array
- On failure: returns `[{ raw: text }]` as fallback

### 4. Update `parseProofreadResult()`

Change return type from `{hasIssues, feedback: string}` to `{hasIssues, items: FeedbackItem[]}`.

- `NO_ISSUES` → `{hasIssues: false, items: []}`
- Otherwise → `{hasIssues: true, items: parseFeedbackItems(text)}`

### 5. New function: `formatFeedbackForUser(items: FeedbackItem[]): string`

Converts structured items back to human-readable format for the hook's block `reason`:

```
💡 "[original]" → "[corrected]"
Explanation: [explanation]

---
```

Falls back to displaying `raw` field if structured fields are missing.

### 6. New function: `appendLog(entry: LogEntry): Promise<void>`

- Ensures `~/.english-proofreader/logs/` directory exists
- Appends one JSONL line to `YYYY-MM-DD.jsonl`
- Uses existing `mkdir` and `appendFile` imports (already present)
- Errors are caught and logged to stderr (fail-open, never blocks the hook)

### 7. Update `main()`

- Call `appendLog()` after parsing, before outputting hook JSON
- Use `formatFeedbackForUser()` to build the block reason

## Non-goals

- No log rotation or cleanup
- No log size limits
- No log reading/analysis tooling
