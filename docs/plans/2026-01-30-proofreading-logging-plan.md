# Proofreading Response Logging — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Log all proofreading results as structured JSONL files, restructuring the prompt to return JSON for reliable parsing.

**Architecture:** Replace the human-readable `💡` feedback format with JSON output from the LLM. Add a `FeedbackItem` type, restructure `parseProofreadResult` to return structured items, add `formatFeedbackForUser` to reconstruct the display format, and add `appendLog` to write daily JSONL files to `~/.english-proofreader/logs/`.

**Tech Stack:** Bun, TypeScript, node:fs/promises (mkdir, appendFile already imported)

---

### Task 1: Add `FeedbackItem` type and `parseFeedbackItems` function

**Files:**
- Modify: `english-proofreader/hooks/proofread.ts:21-24` (add type near existing interfaces)
- Test: `english-proofreader/hooks/proofread.test.ts`

**Step 1: Write failing tests**

Add to `proofread.test.ts`, importing `parseFeedbackItems`:

```typescript
describe("parseFeedbackItems", () => {
  it("should parse valid JSON array of feedback items", () => {
    const json = JSON.stringify([
      { original: "I have went", corrected: "I have gone", explanation: "Past participle of go is gone." },
    ]);
    const items = parseFeedbackItems(json);
    expect(items).toEqual([
      { original: "I have went", corrected: "I have gone", explanation: "Past participle of go is gone." },
    ]);
  });

  it("should parse multiple items", () => {
    const json = JSON.stringify([
      { original: "a", corrected: "b", explanation: "reason1" },
      { original: "c", corrected: "d", explanation: "reason2" },
    ]);
    const items = parseFeedbackItems(json);
    expect(items).toHaveLength(2);
  });

  it("should return raw fallback on invalid JSON", () => {
    const items = parseFeedbackItems("not json at all");
    expect(items).toEqual([{ raw: "not json at all" }]);
  });

  it("should return raw fallback when JSON is not an array", () => {
    const items = parseFeedbackItems(JSON.stringify({ original: "a" }));
    expect(items).toEqual([{ raw: JSON.stringify({ original: "a" }) }]);
  });

  it("should handle empty array", () => {
    const items = parseFeedbackItems("[]");
    expect(items).toEqual([]);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd english-proofreader && bun test --filter "parseFeedbackItems"`
Expected: FAIL — `parseFeedbackItems` is not exported / not defined

**Step 3: Implement `FeedbackItem` type and `parseFeedbackItems`**

Add after `ProofreadResult` interface (line 24) in `proofread.ts`:

```typescript
export interface FeedbackItem {
  original?: string;
  corrected?: string;
  explanation?: string;
  raw?: string;
}

export function parseFeedbackItems(text: string): FeedbackItem[] {
  try {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) {
      return [{ raw: text }];
    }
    return parsed;
  } catch {
    return [{ raw: text }];
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `cd english-proofreader && bun test --filter "parseFeedbackItems"`
Expected: PASS

**Step 5: Commit**

```bash
git add english-proofreader/hooks/proofread.ts english-proofreader/hooks/proofread.test.ts
git commit -m "feat(proofreader): add FeedbackItem type and parseFeedbackItems"
```

---

### Task 2: Add `formatFeedbackForUser` function

**Files:**
- Modify: `english-proofreader/hooks/proofread.ts`
- Test: `english-proofreader/hooks/proofread.test.ts`

**Step 1: Write failing tests**

```typescript
describe("formatFeedbackForUser", () => {
  it("should format a single structured item", () => {
    const items: FeedbackItem[] = [
      { original: "I have went", corrected: "I have gone", explanation: "Use past participle." },
    ];
    const result = formatFeedbackForUser(items);
    expect(result).toBe('💡 "I have went" → "I have gone"\nExplanation: Use past participle.');
  });

  it("should format multiple items with separator", () => {
    const items: FeedbackItem[] = [
      { original: "a", corrected: "b", explanation: "reason1" },
      { original: "c", corrected: "d", explanation: "reason2" },
    ];
    const result = formatFeedbackForUser(items);
    expect(result).toContain("---");
    expect(result).toContain('💡 "a" → "b"');
    expect(result).toContain('💡 "c" → "d"');
  });

  it("should display raw fallback when structured fields missing", () => {
    const items: FeedbackItem[] = [{ raw: "some unparsed text" }];
    const result = formatFeedbackForUser(items);
    expect(result).toBe("some unparsed text");
  });

  it("should handle empty array", () => {
    const result = formatFeedbackForUser([]);
    expect(result).toBe("");
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd english-proofreader && bun test --filter "formatFeedbackForUser"`
Expected: FAIL

**Step 3: Implement**

Add in `proofread.ts`:

```typescript
export function formatFeedbackForUser(items: FeedbackItem[]): string {
  if (items.length === 0) return "";

  return items
    .map((item) => {
      if (item.raw) return item.raw;
      return `💡 "${item.original}" → "${item.corrected}"\nExplanation: ${item.explanation}`;
    })
    .join("\n\n---\n\n");
}
```

**Step 4: Run tests to verify they pass**

Run: `cd english-proofreader && bun test --filter "formatFeedbackForUser"`
Expected: PASS

**Step 5: Commit**

```bash
git add english-proofreader/hooks/proofread.ts english-proofreader/hooks/proofread.test.ts
git commit -m "feat(proofreader): add formatFeedbackForUser"
```

---

### Task 3: Restructure prompt to request JSON output

**Files:**
- Modify: `english-proofreader/hooks/proofread.ts` — `buildProofreadPrompt` function (line 179-219)
- Test: `english-proofreader/hooks/proofread.test.ts`

**Step 1: Update tests for new prompt format**

Update the `buildProofreadPrompt` test for feedback format:

```typescript
// Replace the existing "should include feedback format instructions" test:
it("should request JSON array format for issues", () => {
  const prompt = buildProofreadPrompt("test");
  expect(prompt).toContain('"original"');
  expect(prompt).toContain('"corrected"');
  expect(prompt).toContain('"explanation"');
  expect(prompt).toContain("JSON array");
});
```

**Step 2: Run tests to verify they fail**

Run: `cd english-proofreader && bun test --filter "buildProofreadPrompt"`
Expected: FAIL — prompt still has old format

**Step 3: Update `buildProofreadPrompt`**

Replace the response format instructions (lines 208-218) in the prompt template:

```
If there are NO issues, respond with exactly:
NO_ISSUES

If there ARE issues, respond with ONLY a JSON array (no markdown, no explanation outside the JSON):
[{"original": "[original phrase]", "corrected": "[corrected phrase]", "explanation": "[Detailed educational explanation of why this is wrong and how to remember the correct usage. Include grammar rules, common patterns, or helpful tips.]"}]

Each object must have "original", "corrected", and "explanation" fields.
```

Keep the rest of the prompt unchanged.

**Step 4: Run tests to verify they pass**

Run: `cd english-proofreader && bun test --filter "buildProofreadPrompt"`
Expected: PASS

**Step 5: Commit**

```bash
git add english-proofreader/hooks/proofread.ts english-proofreader/hooks/proofread.test.ts
git commit -m "feat(proofreader): restructure prompt to request JSON output"
```

---

### Task 4: Update `parseProofreadResult` to return structured items

**Files:**
- Modify: `english-proofreader/hooks/proofread.ts` — `ProofreadResult` interface (line 21-24), `parseProofreadResult` (line 222-230)
- Test: `english-proofreader/hooks/proofread.test.ts`

**Step 1: Update tests**

Replace the `parseProofreadResult` describe block:

```typescript
describe("parseProofreadResult", () => {
  it("should return hasIssues: false for NO_ISSUES", () => {
    const result = parseProofreadResult("NO_ISSUES");
    expect(result).toEqual({ hasIssues: false, items: [] });
  });

  it("should return hasIssues: false for NO_ISSUES with whitespace", () => {
    const result = parseProofreadResult("  NO_ISSUES  ");
    expect(result).toEqual({ hasIssues: false, items: [] });
  });

  it("should return hasIssues: false for NO_ISSUES with extra text", () => {
    const result = parseProofreadResult("NO_ISSUES - your text is perfect!");
    expect(result).toEqual({ hasIssues: false, items: [] });
  });

  it("should return structured items for valid JSON feedback", () => {
    const json = JSON.stringify([
      { original: "I have went", corrected: "I have gone", explanation: "Past participle." },
    ]);
    const result = parseProofreadResult(json);
    expect(result.hasIssues).toBe(true);
    expect(result.items).toEqual([
      { original: "I have went", corrected: "I have gone", explanation: "Past participle." },
    ]);
  });

  it("should return raw fallback for non-JSON feedback", () => {
    const feedback = 'Some unparsed feedback text';
    const result = parseProofreadResult(feedback);
    expect(result.hasIssues).toBe(true);
    expect(result.items).toEqual([{ raw: feedback }]);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd english-proofreader && bun test --filter "parseProofreadResult"`
Expected: FAIL — still returns `{hasIssues, feedback}` not `{hasIssues, items}`

**Step 3: Update interface and function**

Change `ProofreadResult`:

```typescript
interface ProofreadResult {
  hasIssues: boolean;
  items: FeedbackItem[];
}
```

Change `parseProofreadResult`:

```typescript
export function parseProofreadResult(result: string): ProofreadResult {
  const trimmed = result.trim();

  if (trimmed === "NO_ISSUES" || trimmed.startsWith("NO_ISSUES")) {
    return { hasIssues: false, items: [] };
  }

  return { hasIssues: true, items: parseFeedbackItems(trimmed) };
}
```

**Step 4: Run tests to verify they pass**

Run: `cd english-proofreader && bun test --filter "parseProofreadResult"`
Expected: PASS

**Step 5: Commit**

```bash
git add english-proofreader/hooks/proofread.ts english-proofreader/hooks/proofread.test.ts
git commit -m "feat(proofreader): update parseProofreadResult to return structured items"
```

---

### Task 5: Add `appendLog` function

**Files:**
- Modify: `english-proofreader/hooks/proofread.ts`
- Test: `english-proofreader/hooks/proofread.test.ts`

**Step 1: Write failing tests**

```typescript
import { readFile } from "fs/promises";

describe("appendLog", () => {
  let tempDir: string;
  let originalHome: string | undefined;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "proofread-log-test-"));
    originalHome = process.env.HOME;
    process.env.HOME = tempDir;
  });

  afterEach(async () => {
    process.env.HOME = originalHome;
    await rm(tempDir, { recursive: true, force: true });
  });

  it("should create log directory and write JSONL entry", async () => {
    await appendLog({
      timestamp: "2026-01-30T00:00:00.000Z",
      prompt: "test prompt",
      feedback: [{ original: "a", corrected: "b", explanation: "reason" }],
      decision: "block",
    });

    const logPath = join(tempDir, ".english-proofreader", "logs", "2026-01-30.jsonl");
    const content = await readFile(logPath, "utf-8");
    const entry = JSON.parse(content.trim());
    expect(entry.prompt).toBe("test prompt");
    expect(entry.decision).toBe("block");
    expect(entry.feedback).toHaveLength(1);
  });

  it("should append multiple entries to the same daily file", async () => {
    const base = { timestamp: "2026-01-30T00:00:00.000Z", prompt: "p", feedback: [], decision: "pass" as const };
    await appendLog(base);
    await appendLog({ ...base, prompt: "p2" });

    const logPath = join(tempDir, ".english-proofreader", "logs", "2026-01-30.jsonl");
    const lines = (await readFile(logPath, "utf-8")).trim().split("\n");
    expect(lines).toHaveLength(2);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd english-proofreader && bun test --filter "appendLog"`
Expected: FAIL

**Step 3: Implement**

Add types and function in `proofread.ts`:

```typescript
export interface LogEntry {
  timestamp: string;
  prompt: string;
  feedback: FeedbackItem[];
  decision: "block" | "pass";
}

const LOG_DIR = join(homedir(), ".english-proofreader", "logs");

export async function appendLog(entry: LogEntry): Promise<void> {
  try {
    await mkdir(LOG_DIR, { recursive: true });
    const date = entry.timestamp.slice(0, 10); // YYYY-MM-DD
    const filePath = join(LOG_DIR, `${date}.jsonl`);
    await appendFile(filePath, JSON.stringify(entry) + "\n");
  } catch (err) {
    console.error(`Log write error: ${(err as Error).message}`);
  }
}
```

Note: The test overrides `process.env.HOME`, but `homedir()` caches. To make tests work, extract `LOG_DIR` computation into `appendLog` so it reads `homedir()` at call time:

```typescript
export async function appendLog(entry: LogEntry): Promise<void> {
  try {
    const logDir = join(homedir(), ".english-proofreader", "logs");
    await mkdir(logDir, { recursive: true });
    const date = entry.timestamp.slice(0, 10);
    const filePath = join(logDir, `${date}.jsonl`);
    await appendFile(filePath, JSON.stringify(entry) + "\n");
  } catch (err) {
    console.error(`Log write error: ${(err as Error).message}`);
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `cd english-proofreader && bun test --filter "appendLog"`
Expected: PASS

**Step 5: Commit**

```bash
git add english-proofreader/hooks/proofread.ts english-proofreader/hooks/proofread.test.ts
git commit -m "feat(proofreader): add appendLog function for JSONL logging"
```

---

### Task 6: Wire everything into `main()`

**Files:**
- Modify: `english-proofreader/hooks/proofread.ts` — `main` function (line 233-304)

**Step 1: Update `main()` to use new functions**

Replace the section after `// 5. Parse response and output appropriate JSON` (lines 280-296):

```typescript
    // 5. Parse response and output appropriate JSON
    const parsed = parseProofreadResult(result);

    if (parsed.hasIssues) {
      const feedback = formatFeedbackForUser(parsed.items);
      const output: HookOutputBlock = {
        decision: "block",
        reason: `📝 English Proofreading:\n\n${feedback}\n\nPlease revise your prompt and re-submit.`,
      };
      console.log(JSON.stringify(output));
    } else {
      const output: HookOutputBlock = {
        suppressOutput: true,
        systemMessage: "✅ No English issues found",
      };
      console.log(JSON.stringify(output));
    }

    // 6. Log the result
    await appendLog({
      timestamp: new Date().toISOString(),
      prompt,
      feedback: parsed.items,
      decision: parsed.hasIssues ? "block" : "pass",
    });
```

**Step 2: Run all unit tests**

Run: `cd english-proofreader && bun test --filter "^(?!Integration)"`
Expected: All PASS

**Step 3: Commit**

```bash
git add english-proofreader/hooks/proofread.ts
git commit -m "feat(proofreader): wire structured feedback and logging into main"
```

---

### Task 7: Run integration tests and bump version

**Step 1: Run full test suite**

Run: `cd english-proofreader && bun test`
Expected: All PASS (integration tests will exercise the new JSON prompt format end-to-end)

**Step 2: If integration tests fail**, the LLM may not be returning clean JSON. Check output and adjust prompt wording if needed (e.g. add "Respond with ONLY the JSON array, no other text").

**Step 3: Update version**

In `english-proofreader/.claude-plugin/plugin.json`, bump the version from `1.2.0` to `1.3.0`.

**Step 4: Commit**

```bash
git add english-proofreader/.claude-plugin/plugin.json
git commit -m "chore(proofreader): bump version to 1.3.0"
```
