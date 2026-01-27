# Proofreader Context Enhancement - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Claude's last response as context when proofreading to reduce false positives on contextual replies.

**Architecture:** Read transcript file from end using chunked reverse reading, extract last assistant message, truncate to 2000 chars, pass to proofreading prompt.

**Tech Stack:** Bun, TypeScript, @anthropic-ai/claude-agent-sdk

---

## Task 1: Update HookInput Interface

**Files:**
- Modify: `english-proofreader/hooks/proofread.ts:6-8`

**Step 1: Update HookInput interface**

Add `transcript_path` field to the interface:

```typescript
interface HookInput {
  prompt?: string;
  transcript_path?: string;
}
```

**Step 2: Run tests to verify no regression**

Run: `cd english-proofreader && bun test`
Expected: All 24 tests pass

**Step 3: Commit**

```bash
git add english-proofreader/hooks/proofread.ts
git commit -m "feat(proofreader): add transcript_path to HookInput interface"
```

---

## Task 2: Add truncateContext Function

**Files:**
- Modify: `english-proofreader/hooks/proofread.ts` (add after containsEnglish)
- Modify: `english-proofreader/hooks/proofread.test.ts` (add tests)

**Step 1: Write the failing tests**

Add to `proofread.test.ts` imports:

```typescript
import {
  containsEnglish,
  buildProofreadPrompt,
  parseProofreadResult,
  truncateContext,
} from "./proofread";
```

Add test describe block after `containsEnglish` tests:

```typescript
describe("truncateContext", () => {
  it("should return text unchanged if under limit", () => {
    const text = "Short context";
    expect(truncateContext(text)).toBe(text);
  });

  it("should return text unchanged if exactly at limit", () => {
    const text = "x".repeat(2000);
    expect(truncateContext(text)).toBe(text);
  });

  it("should truncate from start and keep end", () => {
    const text = "START" + "x".repeat(2000) + "END";
    const result = truncateContext(text);
    expect(result.length).toBe(2003); // "..." + 2000 chars
    expect(result.startsWith("...")).toBe(true);
    expect(result.endsWith("END")).toBe(true);
    expect(result).not.toContain("START");
  });

  it("should handle empty string", () => {
    expect(truncateContext("")).toBe("");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd english-proofreader && bun test`
Expected: FAIL with "truncateContext is not exported"

**Step 3: Write minimal implementation**

Add to `proofread.ts` after `containsEnglish` function:

```typescript
// Maximum context size in characters (~500 tokens)
const MAX_CONTEXT_CHARS = 2000;

// Truncate context to limit, keeping the end (most relevant to user's reply)
export function truncateContext(text: string): string {
  if (text.length <= MAX_CONTEXT_CHARS) {
    return text;
  }
  return "..." + text.slice(-MAX_CONTEXT_CHARS);
}
```

**Step 4: Run test to verify it passes**

Run: `cd english-proofreader && bun test`
Expected: All tests pass

**Step 5: Commit**

```bash
git add english-proofreader/hooks/proofread.ts english-proofreader/hooks/proofread.test.ts
git commit -m "feat(proofreader): add truncateContext function"
```

---

## Task 3: Add extractTextContent Helper

**Files:**
- Modify: `english-proofreader/hooks/proofread.ts` (add after truncateContext)
- Modify: `english-proofreader/hooks/proofread.test.ts` (add tests)

**Step 1: Write the failing tests**

Add to imports:

```typescript
import {
  containsEnglish,
  buildProofreadPrompt,
  parseProofreadResult,
  truncateContext,
  extractTextContent,
} from "./proofread";
```

Add test describe block after `truncateContext` tests:

```typescript
describe("extractTextContent", () => {
  it("should return string content as-is", () => {
    expect(extractTextContent("Hello world")).toBe("Hello world");
  });

  it("should extract text from content array", () => {
    const content = [
      { type: "text", text: "First part. " },
      { type: "text", text: "Second part." },
    ];
    expect(extractTextContent(content)).toBe("First part. Second part.");
  });

  it("should skip non-text blocks in array", () => {
    const content = [
      { type: "text", text: "Text here. " },
      { type: "tool_use", id: "123", name: "read", input: {} },
      { type: "text", text: "More text." },
    ];
    expect(extractTextContent(content)).toBe("Text here. More text.");
  });

  it("should handle empty array", () => {
    expect(extractTextContent([])).toBe("");
  });

  it("should handle array with no text blocks", () => {
    const content = [{ type: "tool_use", id: "123", name: "read", input: {} }];
    expect(extractTextContent(content)).toBe("");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd english-proofreader && bun test`
Expected: FAIL with "extractTextContent is not exported"

**Step 3: Write minimal implementation**

Add type and function to `proofread.ts` after `truncateContext`:

```typescript
// Content can be string or array of content blocks
type MessageContent = string | Array<{ type: string; text?: string }>;

// Extract text from message content (handles both string and array formats)
export function extractTextContent(content: MessageContent): string {
  if (typeof content === "string") {
    return content;
  }
  return content
    .filter((block) => block.type === "text" && block.text)
    .map((block) => block.text!)
    .join("");
}
```

**Step 4: Run test to verify it passes**

Run: `cd english-proofreader && bun test`
Expected: All tests pass

**Step 5: Commit**

```bash
git add english-proofreader/hooks/proofread.ts english-proofreader/hooks/proofread.test.ts
git commit -m "feat(proofreader): add extractTextContent helper"
```

---

## Task 4: Add getLastAssistantMessage Function

**Files:**
- Modify: `english-proofreader/hooks/proofread.ts` (add after extractTextContent)
- Modify: `english-proofreader/hooks/proofread.test.ts` (add tests)

**Step 1: Write the failing tests**

Add to imports:

```typescript
import {
  containsEnglish,
  buildProofreadPrompt,
  parseProofreadResult,
  truncateContext,
  extractTextContent,
  getLastAssistantMessage,
} from "./proofread";
```

Add imports at top of test file:

```typescript
import { mkdtemp, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
```

Add test describe block after `extractTextContent` tests:

```typescript
describe("getLastAssistantMessage", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "proofread-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("should return null for non-existent file", async () => {
    const result = await getLastAssistantMessage("/nonexistent/path.jsonl");
    expect(result).toBeNull();
  });

  it("should return null for empty file", async () => {
    const filePath = join(tempDir, "empty.jsonl");
    await writeFile(filePath, "");
    const result = await getLastAssistantMessage(filePath);
    expect(result).toBeNull();
  });

  it("should return null when no assistant messages", async () => {
    const filePath = join(tempDir, "no-assistant.jsonl");
    const content = [
      JSON.stringify({ type: "human", content: "Hello" }),
      JSON.stringify({ type: "system", content: "System message" }),
    ].join("\n");
    await writeFile(filePath, content);
    const result = await getLastAssistantMessage(filePath);
    expect(result).toBeNull();
  });

  it("should extract last assistant message with string content", async () => {
    const filePath = join(tempDir, "string-content.jsonl");
    const content = [
      JSON.stringify({ type: "human", content: "Hello" }),
      JSON.stringify({ type: "assistant", content: "First response" }),
      JSON.stringify({ type: "human", content: "Follow up" }),
      JSON.stringify({ type: "assistant", content: "Last response" }),
    ].join("\n");
    await writeFile(filePath, content);
    const result = await getLastAssistantMessage(filePath);
    expect(result).toBe("Last response");
  });

  it("should extract text from array content", async () => {
    const filePath = join(tempDir, "array-content.jsonl");
    const content = [
      JSON.stringify({ type: "human", content: "Hello" }),
      JSON.stringify({
        type: "assistant",
        content: [
          { type: "text", text: "Part one. " },
          { type: "tool_use", id: "1", name: "test", input: {} },
          { type: "text", text: "Part two." },
        ],
      }),
    ].join("\n");
    await writeFile(filePath, content);
    const result = await getLastAssistantMessage(filePath);
    expect(result).toBe("Part one. Part two.");
  });

  it("should handle file with trailing newline", async () => {
    const filePath = join(tempDir, "trailing-newline.jsonl");
    const content =
      [
        JSON.stringify({ type: "human", content: "Hello" }),
        JSON.stringify({ type: "assistant", content: "Response" }),
      ].join("\n") + "\n";
    await writeFile(filePath, content);
    const result = await getLastAssistantMessage(filePath);
    expect(result).toBe("Response");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd english-proofreader && bun test`
Expected: FAIL with "getLastAssistantMessage is not exported"

**Step 3: Write minimal implementation**

Add to `proofread.ts` after `extractTextContent`:

```typescript
// Transcript message structure
interface TranscriptMessage {
  type: "human" | "assistant" | "system";
  content: MessageContent;
}

// Read transcript from end and extract last assistant message
export async function getLastAssistantMessage(
  transcriptPath: string
): Promise<string | null> {
  try {
    const file = Bun.file(transcriptPath);
    const exists = await file.exists();
    if (!exists) {
      return null;
    }

    const fileSize = file.size;
    if (fileSize === 0) {
      return null;
    }

    const CHUNK_SIZE = 4096;
    let position = fileSize;
    let buffer = "";

    while (position > 0) {
      const readSize = Math.min(CHUNK_SIZE, position);
      position -= readSize;

      const chunk = await file.slice(position, position + readSize).text();
      buffer = chunk + buffer;

      const lines = buffer.split("\n");
      buffer = lines[0]; // Keep incomplete first line

      // Check complete lines from end
      for (let i = lines.length - 1; i >= 1; i--) {
        const line = lines[i].trim();
        if (!line) continue;

        try {
          const msg: TranscriptMessage = JSON.parse(line);
          if (msg.type === "assistant") {
            return extractTextContent(msg.content);
          }
        } catch {
          // Skip malformed lines
          continue;
        }
      }
    }

    // Check remaining buffer
    if (buffer.trim()) {
      try {
        const msg: TranscriptMessage = JSON.parse(buffer.trim());
        if (msg.type === "assistant") {
          return extractTextContent(msg.content);
        }
      } catch {
        // Skip malformed line
      }
    }

    return null;
  } catch {
    return null;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `cd english-proofreader && bun test`
Expected: All tests pass

**Step 5: Commit**

```bash
git add english-proofreader/hooks/proofread.ts english-proofreader/hooks/proofread.test.ts
git commit -m "feat(proofreader): add getLastAssistantMessage with reverse file reading"
```

---

## Task 5: Update buildProofreadPrompt for Context

**Files:**
- Modify: `english-proofreader/hooks/proofread.ts:37-63`
- Modify: `english-proofreader/hooks/proofread.test.ts`

**Step 1: Write the failing tests**

Add new tests to `buildProofreadPrompt` describe block:

```typescript
  it("should include context when provided", () => {
    const prompt = buildProofreadPrompt("Yes, do that", "I can help with option A or option B");
    expect(prompt).toContain("Claude's previous response");
    expect(prompt).toContain("I can help with option A or option B");
  });

  it("should not include context section when null", () => {
    const prompt = buildProofreadPrompt("test", null);
    expect(prompt).not.toContain("Claude's previous response");
  });

  it("should not include context section when undefined", () => {
    const prompt = buildProofreadPrompt("test", undefined);
    expect(prompt).not.toContain("Claude's previous response");
  });

  it("should include instruction about contextual replies", () => {
    const prompt = buildProofreadPrompt("Yes", "Do you want A or B?");
    expect(prompt).toContain("Consider the context");
  });
```

**Step 2: Run test to verify it fails**

Run: `cd english-proofreader && bun test`
Expected: FAIL with test expecting context

**Step 3: Update implementation**

Replace `buildProofreadPrompt` function:

```typescript
// Build proofreading prompt
export function buildProofreadPrompt(
  text: string,
  context?: string | null
): string {
  const contextSection = context
    ? `For context, here is Claude's previous response that the user is replying to:
"""
${context}
"""

`
    : "";

  return `You are an English proofreading assistant for a non-native speaker who wants to learn.

${contextSection}Analyze the following text for:
1. Grammar errors
2. Wrong word usage
3. Unnatural expressions (from a native speaker's perspective)

Focus ONLY on the English parts. Ignore any Korean or other non-English text.

IMPORTANT: Consider the context when evaluating. Short replies like "Yes, do that" or "The second one" are natural when responding to a previous message.

Text to proofread:
"""
${text}
"""

If there are NO issues, respond with exactly:
NO_ISSUES

If there ARE issues, respond in this format for EACH issue:

💡 "[original phrase]" → "[corrected phrase]"
Explanation: [Detailed educational explanation of why this is wrong and how to remember the correct usage. Include grammar rules, common patterns, or helpful tips.]

---

Be thorough but focus on actual errors, not style preferences. If the English is grammatically correct and natural-sounding, respond with NO_ISSUES.`;
}
```

**Step 4: Run test to verify it passes**

Run: `cd english-proofreader && bun test`
Expected: All tests pass

**Step 5: Commit**

```bash
git add english-proofreader/hooks/proofread.ts english-proofreader/hooks/proofread.test.ts
git commit -m "feat(proofreader): update buildProofreadPrompt to accept context"
```

---

## Task 6: Update main() to Use Context

**Files:**
- Modify: `english-proofreader/hooks/proofread.ts:77-130` (main function)

**Step 1: Update main function**

Replace the main function:

```typescript
// Main function
async function main(): Promise<void> {
  try {
    // 1. Read input from stdin
    const inputJson = await readStdin();
    const input: HookInput = JSON.parse(inputJson);
    const prompt = input.prompt || "";

    // 2. Skip if no English content
    if (!containsEnglish(prompt)) {
      console.log(JSON.stringify({}));
      process.exit(0);
    }

    // 3. Get context from transcript (if available)
    let context: string | null = null;
    if (input.transcript_path) {
      const lastAssistant = await getLastAssistantMessage(input.transcript_path);
      if (lastAssistant) {
        context = truncateContext(lastAssistant);
      }
    }

    // 4. Call Claude for proofreading
    let result = "";
    for await (const message of query({
      prompt: buildProofreadPrompt(prompt, context),
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

    // 5. Parse response and output appropriate JSON
    const parsed = parseProofreadResult(result);

    if (parsed.hasIssues) {
      // Block with educational feedback
      const output: HookOutputBlock = {
        decision: "block",
        reason: `📝 English Proofreading:\n\n${parsed.feedback}\n\nPlease revise your prompt and re-submit.`,
      };
      console.log(JSON.stringify(output));
    } else {
      // Allow with suppressed output
      const output: HookOutputBlock = {
        suppressOutput: true,
        systemMessage: "✅ No English issues found",
      };
      console.log(JSON.stringify(output));
    }
  } catch (error) {
    // On error, allow prompt to proceed (fail-open)
    console.error(`Proofreading error: ${(error as Error).message}`);
    console.log(JSON.stringify({}));
  }

  process.exit(0);
}
```

**Step 2: Run tests to verify no regression**

Run: `cd english-proofreader && bun test`
Expected: All tests pass

**Step 3: Commit**

```bash
git add english-proofreader/hooks/proofread.ts
git commit -m "feat(proofreader): integrate context reading into main function"
```

---

## Task 7: Add Integration Test with Context

**Files:**
- Modify: `english-proofreader/hooks/proofread.test.ts`

**Step 1: Add integration test**

Add to the "Integration: proofread.ts script" describe block:

```typescript
  it(
    "should allow contextual short reply with transcript",
    async () => {
      // Create a temp transcript file
      const tempDir = await mkdtemp(join(tmpdir(), "proofread-integration-"));
      const transcriptPath = join(tempDir, "transcript.jsonl");
      const transcriptContent = [
        JSON.stringify({ type: "human", content: "What should I do?" }),
        JSON.stringify({
          type: "assistant",
          content: "You have two options:\n1. Option A - faster\n2. Option B - more thorough\n\nWhich would you prefer?",
        }),
      ].join("\n");
      await writeFile(transcriptPath, transcriptContent);

      try {
        const { stdout, code } = await runScript({
          prompt: "The second one",
          transcript_path: transcriptPath,
        });
        expect(code).toBe(0);
        const output = JSON.parse(stdout.trim());
        // Should pass because "The second one" is natural in context
        expect(output.suppressOutput).toBe(true);
        expect(output.systemMessage).toContain("No English issues found");
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    },
    { timeout: INTEGRATION_TIMEOUT }
  );
```

**Step 2: Run test**

Run: `cd english-proofreader && bun test`
Expected: All tests pass

**Step 3: Commit**

```bash
git add english-proofreader/hooks/proofread.test.ts
git commit -m "test(proofreader): add integration test for contextual proofreading"
```

---

## Task 8: Update Version and Documentation

**Files:**
- Modify: `english-proofreader/.claude-plugin/plugin.json`
- Modify: `english-proofreader/README.md`

**Step 1: Bump version**

Update `plugin.json`:

```json
{
  "name": "english-proofreader",
  "description": "Proofreads English prompts before execution with educational feedback",
  "version": "1.1.0",
  "author": {
    "name": "jingi.kim"
  },
  "license": "MIT",
  "keywords": ["english", "proofreading", "grammar", "learning"]
}
```

**Step 2: Update README**

Add to Features section in `README.md`:

```markdown
- **Context-aware proofreading** - Uses Claude's last response to understand contextual replies
```

Update How It Works section to include:

```markdown
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
Read transcript → Get Claude's last response (if available)
    ↓
Call Claude Haiku (with context)
    ↓
Issues found? ─No──→ Allow + "✓ No issues"
    ↓ Yes
Block + educational feedback
```

**Step 3: Commit**

```bash
git add english-proofreader/.claude-plugin/plugin.json english-proofreader/README.md
git commit -m "docs(proofreader): update version to 1.1.0 and document context feature"
```

---

## Task 9: Final Verification

**Step 1: Run full test suite**

Run: `cd english-proofreader && bun test`
Expected: All tests pass

**Step 2: Type check**

Run: `cd english-proofreader && bun run tsc --noEmit`
Expected: No errors

**Step 3: Create summary commit (if needed)**

If all tasks were committed individually, no action needed here.
