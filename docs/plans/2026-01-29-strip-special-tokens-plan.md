# Strip Special Tokens Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `stripSpecialTokens` to the english-proofreader so slash commands and mentions don't trigger false proofreading errors.

**Architecture:** A pure function `stripSpecialTokens` in `proofread.ts` strips special tokens before the text is sent to Haiku. Called in `main()` between `containsEnglish()` and `buildProofreadPrompt()`.

**Tech Stack:** TypeScript, Bun, bun:test

---

### Task 1: Write unit tests for `stripSpecialTokens`

**Files:**
- Modify: `english-proofreader/hooks/proofread.test.ts`

**Step 1: Write the failing tests**

Add this test block after the existing `describe("parseProofreadResult", ...)` block in `proofread.test.ts`:

```typescript
import {
  containsEnglish,
  buildProofreadPrompt,
  parseProofreadResult,
  truncateContext,
  extractTextContent,
  getLastAssistantMessage,
  stripSpecialTokens,
} from "./proofread";

// ... existing tests ...

describe("stripSpecialTokens", () => {
  // Slash commands
  it("should strip leading slash command", () => {
    expect(stripSpecialTokens("/commit fix the bug")).toBe("fix the bug");
  });

  it("should return empty for slash command only", () => {
    expect(stripSpecialTokens("/commit")).toBe("");
  });

  // Quoted agent mentions (no dot extension)
  it("should remove quoted agent mention entirely", () => {
    expect(stripSpecialTokens('@"code-reviewer" check this')).toBe("check this");
  });

  it("should remove quoted mention containing 'agent'", () => {
    expect(stripSpecialTokens('@"my-agent" do something')).toBe("do something");
  });

  // Quoted file mentions (has dot extension)
  it("should strip @ and quotes from quoted file mention", () => {
    expect(stripSpecialTokens('update @"src/index.ts" to add')).toBe("update src/index.ts to add");
  });

  // Unquoted file mentions (has dot extension)
  it("should strip @ from unquoted file mention", () => {
    expect(stripSpecialTokens("update @src/index.ts to add")).toBe("update src/index.ts to add");
  });

  // Unquoted agent mentions (contains 'agent')
  it("should remove unquoted mention containing 'agent'", () => {
    expect(stripSpecialTokens("@test-agent do something")).toBe("do something");
  });

  // Ambiguous (no extension, no 'agent')
  it("should leave ambiguous unquoted mention as-is", () => {
    expect(stripSpecialTokens("@utils do something")).toBe("@utils do something");
  });

  // Mixed
  it("should handle slash command + file mention", () => {
    expect(stripSpecialTokens('/review @"src/app.ts" for bugs')).toBe("src/app.ts for bugs");
  });

  // No special tokens
  it("should return plain text unchanged", () => {
    expect(stripSpecialTokens("fix the bug please")).toBe("fix the bug please");
  });

  // Whitespace cleanup
  it("should trim result and collapse multiple spaces", () => {
    expect(stripSpecialTokens('@"my-agent" check this')).toBe("check this");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd english-proofreader && bun test`
Expected: FAIL - `stripSpecialTokens` is not exported from `./proofread`

**Step 3: Commit**

```bash
git add english-proofreader/hooks/proofread.test.ts
git commit -m "test(proofreader): add unit tests for stripSpecialTokens"
```

---

### Task 2: Implement `stripSpecialTokens`

**Files:**
- Modify: `english-proofreader/hooks/proofread.ts`

**Step 1: Add the function**

Add this exported function in `proofread.ts` after `truncateContext` and before `extractTextContent`:

```typescript
// Check if a mention name has a file extension (e.g. .ts, .json)
function hasDotExtension(name: string): boolean {
  return /\.\w+/.test(name);
}

// Strip slash commands and mentions from prompt text
export function stripSpecialTokens(text: string): string {
  let result = text;

  // 1. Strip leading slash command token
  if (result.startsWith("/")) {
    result = result.replace(/^\/\S+\s*/, "");
  }

  // 2. Strip quoted mentions: @"..."
  result = result.replace(/@"([^"]+)"/g, (_match, content: string) => {
    if (hasDotExtension(content)) {
      // File mention: keep content, strip @ and quotes
      return content;
    }
    // Agent mention: remove entirely
    return "";
  });

  // 3. Strip unquoted mentions: @something
  result = result.replace(/@(\S+)/g, (match, name: string) => {
    if (hasDotExtension(name)) {
      // File mention: strip @
      return name;
    }
    if (name.includes("agent")) {
      // Agent mention: remove entirely
      return "";
    }
    // Ambiguous: leave as-is
    return match;
  });

  // Clean up extra spaces
  return result.replace(/\s+/g, " ").trim();
}
```

**Step 2: Run tests to verify they pass**

Run: `cd english-proofreader && bun test`
Expected: All tests PASS

**Step 3: Commit**

```bash
git add english-proofreader/hooks/proofread.ts
git commit -m "feat(proofreader): add stripSpecialTokens function"
```

---

### Task 3: Integrate into `main()`

**Files:**
- Modify: `english-proofreader/hooks/proofread.ts`

**Step 1: Write an integration test**

Add to `proofread.test.ts` inside the `Integration` describe block:

```typescript
it(
  "should pass through slash command prompts after stripping",
  async () => {
    const { stdout, code } = await runScript({
      prompt: "/commit fix the bug in authentication",
    });
    expect(code).toBe(0);
    const output = JSON.parse(stdout.trim());
    // After stripping "/commit", the remaining text is valid English
    expect(output.decision).not.toBe("block");
  },
  { timeout: INTEGRATION_TIMEOUT }
);
```

**Step 2: Modify `main()` to call `stripSpecialTokens`**

In `main()`, after the `containsEnglish` check (line ~199) and before the context retrieval (line ~202), add:

```typescript
    // 2.5. Strip special tokens (slash commands, mentions)
    const strippedPrompt = stripSpecialTokens(prompt);

    // If nothing left after stripping, skip proofreading
    if (!strippedPrompt.trim()) {
      console.log(JSON.stringify({}));
      process.exit(0);
    }
```

Then change `buildProofreadPrompt(prompt, context)` to `buildProofreadPrompt(strippedPrompt, context)` on line ~213.

**Step 3: Run tests to verify they pass**

Run: `cd english-proofreader && bun test`
Expected: All tests PASS

**Step 4: Commit**

```bash
git add english-proofreader/hooks/proofread.ts english-proofreader/hooks/proofread.test.ts
git commit -m "feat(proofreader): integrate stripSpecialTokens into main flow"
```

---

### Task 4: Bump version

**Files:**
- Modify: `english-proofreader/.claude-plugin/plugin.json`

**Step 1: Update version**

Change `"version": "1.1.0"` to `"version": "1.2.0"`.

**Step 2: Commit**

```bash
git add english-proofreader/.claude-plugin/plugin.json
git commit -m "chore(proofreader): bump version to 1.2.0"
```
