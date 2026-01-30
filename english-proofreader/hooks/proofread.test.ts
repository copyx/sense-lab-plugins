import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { spawn } from "child_process";
import { join } from "path";

import {
  containsEnglish,
  buildProofreadPrompt,
  parseProofreadResult,
  truncateContext,
  extractTextContent,
  getLastAssistantMessage,
  stripSpecialTokens,
  parseFeedbackItems,
} from "./proofread";
import { mkdtemp, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";

const SCRIPT_PATH = join(import.meta.dir, "proofread.ts");

// Helper to run the script with input
interface RunScriptResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

function runScript(input: object, timeout = 60000): Promise<RunScriptResult> {
  return new Promise((resolve, reject) => {
    const child = spawn("bun", ["run", SCRIPT_PATH], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    const timeoutId = setTimeout(() => {
      child.kill();
      reject(new Error("Script timed out"));
    }, timeout);

    child.stdout.on("data", (data: Buffer) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      clearTimeout(timeoutId);
      resolve({ code, stdout, stderr });
    });

    child.on("error", (err) => {
      clearTimeout(timeoutId);
      reject(err);
    });

    child.stdin.write(JSON.stringify(input));
    child.stdin.end();
  });
}

// =============================================================================
// Unit Tests
// =============================================================================

describe("containsEnglish", () => {
  it("should return true for English text", () => {
    expect(containsEnglish("Hello world")).toBe(true);
  });

  it("should return true for mixed case English", () => {
    expect(containsEnglish("HELLO")).toBe(true);
    expect(containsEnglish("hello")).toBe(true);
  });

  it("should return false for Korean only", () => {
    expect(containsEnglish("안녕하세요")).toBe(false);
  });

  it("should return false for numbers only", () => {
    expect(containsEnglish("12345")).toBe(false);
  });

  it("should return false for symbols only", () => {
    expect(containsEnglish("!@#$%")).toBe(false);
  });

  it("should return true for mixed Korean and English", () => {
    expect(containsEnglish("안녕 Hello")).toBe(true);
  });

  it("should return false for empty string", () => {
    expect(containsEnglish("")).toBe(false);
  });

  it("should return true for single English letter", () => {
    expect(containsEnglish("a")).toBe(true);
    expect(containsEnglish("Z")).toBe(true);
  });
});

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

describe("buildProofreadPrompt", () => {
  it("should include the input text", () => {
    const text = "Test input text";
    const prompt = buildProofreadPrompt(text);
    expect(prompt).toContain(text);
  });

  it("should include proofreading instructions", () => {
    const prompt = buildProofreadPrompt("test");
    expect(prompt).toContain("Grammar errors");
    expect(prompt).toContain("Wrong word usage");
    expect(prompt).toContain("Unnatural expressions");
  });

  it("should include NO_ISSUES instruction", () => {
    const prompt = buildProofreadPrompt("test");
    expect(prompt).toContain("NO_ISSUES");
  });

  it("should include feedback format instructions", () => {
    const prompt = buildProofreadPrompt("test");
    expect(prompt).toContain("Explanation:");
  });

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
});

describe("parseProofreadResult", () => {
  it("should return hasIssues: false for NO_ISSUES", () => {
    const result = parseProofreadResult("NO_ISSUES");
    expect(result).toEqual({ hasIssues: false, feedback: "" });
  });

  it("should return hasIssues: false for NO_ISSUES with whitespace", () => {
    const result = parseProofreadResult("  NO_ISSUES  ");
    expect(result).toEqual({ hasIssues: false, feedback: "" });
  });

  it("should return hasIssues: false for NO_ISSUES with extra text", () => {
    const result = parseProofreadResult("NO_ISSUES - your text is perfect!");
    expect(result).toEqual({ hasIssues: false, feedback: "" });
  });

  it("should return hasIssues: true for feedback", () => {
    const feedback = '✗ "test" → "corrected"\nExplanation: Some reason';
    const result = parseProofreadResult(feedback);
    expect(result.hasIssues).toBe(true);
    expect(result.feedback).toBe(feedback);
  });

  it("should trim feedback whitespace", () => {
    const feedback = '  ✗ "test" → "corrected"  ';
    const result = parseProofreadResult(feedback);
    expect(result.feedback).toBe(feedback.trim());
  });
});

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

// =============================================================================
// Integration Tests (calls real Claude API)
// =============================================================================

// Set longer timeout for integration tests that call Claude API
const INTEGRATION_TIMEOUT = 30000; // 30 seconds

describe("Integration: proofread.ts script", () => {
  it(
    "should pass through Korean-only prompts",
    async () => {
      const { stdout, code } = await runScript({ prompt: "한글만 있는 프롬프트입니다" });
      expect(code).toBe(0);
      const output = JSON.parse(stdout.trim());
      expect(output).toEqual({});
    },
    { timeout: INTEGRATION_TIMEOUT }
  );

  it(
    "should pass through empty prompts",
    async () => {
      const { stdout, code } = await runScript({ prompt: "" });
      expect(code).toBe(0);
      const output = JSON.parse(stdout.trim());
      expect(output).toEqual({});
    },
    { timeout: INTEGRATION_TIMEOUT }
  );

  it(
    "should pass through prompts with numbers only",
    async () => {
      const { stdout, code } = await runScript({ prompt: "12345 67890" });
      expect(code).toBe(0);
      const output = JSON.parse(stdout.trim());
      expect(output).toEqual({});
    },
    { timeout: INTEGRATION_TIMEOUT }
  );

  it(
    "should allow correct English prompts",
    async () => {
      const { stdout, code } = await runScript({
        prompt: "Please help me understand this code.",
      });
      expect(code).toBe(0);
      const output = JSON.parse(stdout.trim());
      expect(output.suppressOutput).toBe(true);
      expect(output.systemMessage).toContain("No English issues found");
    },
    { timeout: INTEGRATION_TIMEOUT }
  );

  it(
    "should block prompts with grammar errors",
    async () => {
      const { stdout, code } = await runScript({
        prompt: "I have went to the store and buyed some foods yesterday.",
      });
      expect(code).toBe(0);
      const output = JSON.parse(stdout.trim());
      expect(output.decision).toBe("block");
      expect(output.reason).toContain("English Proofreading");
    },
    { timeout: INTEGRATION_TIMEOUT }
  );

  it(
    "should handle mixed Korean/English with errors",
    async () => {
      const { stdout, code } = await runScript({
        prompt: "이 코드에서 I want to fix this bugs 부분을 수정해줘",
      });
      expect(code).toBe(0);
      const output = JSON.parse(stdout.trim());
      expect(output.decision).toBe("block");
      expect(
        output.reason.includes("this bug") || output.reason.includes("these bugs")
      ).toBe(true);
    },
    { timeout: INTEGRATION_TIMEOUT }
  );

  it(
    "should handle malformed JSON input gracefully",
    async () => {
      const child = spawn("bun", ["run", SCRIPT_PATH], {
        stdio: ["pipe", "pipe", "pipe"],
      });

      let stdout = "";
      child.stdout.on("data", (data: Buffer) => {
        stdout += data.toString();
      });

      const result = await new Promise<{ code: number | null; stdout: string }>(
        (resolve) => {
          child.on("close", (code) => {
            resolve({ code, stdout });
          });
          child.stdin.write("not valid json");
          child.stdin.end();
        }
      );

      expect(result.code).toBe(0);
      const output = JSON.parse(result.stdout.trim());
      expect(output).toEqual({}); // Fail-open behavior
    },
    { timeout: INTEGRATION_TIMEOUT }
  );

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
});
