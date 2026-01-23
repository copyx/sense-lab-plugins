#!/usr/bin/env node

import { describe, it } from "node:test";
import assert from "node:assert";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  containsEnglish,
  buildProofreadPrompt,
  parseProofreadResult,
} from "./proofread.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SCRIPT_PATH = join(__dirname, "proofread.mjs");

// Helper to run the script with input
function runScript(input, timeout = 60000) {
  return new Promise((resolve, reject) => {
    const child = spawn("node", [SCRIPT_PATH], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    const timeoutId = setTimeout(() => {
      child.kill();
      reject(new Error("Script timed out"));
    }, timeout);

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
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
    assert.strictEqual(containsEnglish("Hello world"), true);
  });

  it("should return true for mixed case English", () => {
    assert.strictEqual(containsEnglish("HELLO"), true);
    assert.strictEqual(containsEnglish("hello"), true);
  });

  it("should return false for Korean only", () => {
    assert.strictEqual(containsEnglish("안녕하세요"), false);
  });

  it("should return false for numbers only", () => {
    assert.strictEqual(containsEnglish("12345"), false);
  });

  it("should return false for symbols only", () => {
    assert.strictEqual(containsEnglish("!@#$%"), false);
  });

  it("should return true for mixed Korean and English", () => {
    assert.strictEqual(containsEnglish("안녕 Hello"), true);
  });

  it("should return false for empty string", () => {
    assert.strictEqual(containsEnglish(""), false);
  });

  it("should return true for single English letter", () => {
    assert.strictEqual(containsEnglish("a"), true);
    assert.strictEqual(containsEnglish("Z"), true);
  });
});

describe("buildProofreadPrompt", () => {
  it("should include the input text", () => {
    const text = "Test input text";
    const prompt = buildProofreadPrompt(text);
    assert.ok(prompt.includes(text));
  });

  it("should include proofreading instructions", () => {
    const prompt = buildProofreadPrompt("test");
    assert.ok(prompt.includes("Grammar errors"));
    assert.ok(prompt.includes("Wrong word usage"));
    assert.ok(prompt.includes("Unnatural expressions"));
  });

  it("should include NO_ISSUES instruction", () => {
    const prompt = buildProofreadPrompt("test");
    assert.ok(prompt.includes("NO_ISSUES"));
  });

  it("should include feedback format instructions", () => {
    const prompt = buildProofreadPrompt("test");
    assert.ok(prompt.includes("Explanation:"));
  });
});

describe("parseProofreadResult", () => {
  it("should return hasIssues: false for NO_ISSUES", () => {
    const result = parseProofreadResult("NO_ISSUES");
    assert.deepStrictEqual(result, { hasIssues: false, feedback: "" });
  });

  it("should return hasIssues: false for NO_ISSUES with whitespace", () => {
    const result = parseProofreadResult("  NO_ISSUES  ");
    assert.deepStrictEqual(result, { hasIssues: false, feedback: "" });
  });

  it("should return hasIssues: false for NO_ISSUES with extra text", () => {
    const result = parseProofreadResult("NO_ISSUES - your text is perfect!");
    assert.deepStrictEqual(result, { hasIssues: false, feedback: "" });
  });

  it("should return hasIssues: true for feedback", () => {
    const feedback = '✗ "test" → "corrected"\nExplanation: Some reason';
    const result = parseProofreadResult(feedback);
    assert.strictEqual(result.hasIssues, true);
    assert.strictEqual(result.feedback, feedback);
  });

  it("should trim feedback whitespace", () => {
    const feedback = '  ✗ "test" → "corrected"  ';
    const result = parseProofreadResult(feedback);
    assert.strictEqual(result.feedback, feedback.trim());
  });
});

// =============================================================================
// Integration Tests (calls real Claude API)
// =============================================================================

describe("Integration: proofread.mjs script", () => {
  it("should pass through Korean-only prompts", async () => {
    const { stdout, code } = await runScript({ prompt: "한글만 있는 프롬프트입니다" });
    assert.strictEqual(code, 0);
    const output = JSON.parse(stdout.trim());
    assert.deepStrictEqual(output, {});
  });

  it("should pass through empty prompts", async () => {
    const { stdout, code } = await runScript({ prompt: "" });
    assert.strictEqual(code, 0);
    const output = JSON.parse(stdout.trim());
    assert.deepStrictEqual(output, {});
  });

  it("should pass through prompts with numbers only", async () => {
    const { stdout, code } = await runScript({ prompt: "12345 67890" });
    assert.strictEqual(code, 0);
    const output = JSON.parse(stdout.trim());
    assert.deepStrictEqual(output, {});
  });

  it("should allow correct English prompts", async () => {
    const { stdout, code } = await runScript({
      prompt: "Please help me understand this code.",
    });
    assert.strictEqual(code, 0);
    const output = JSON.parse(stdout.trim());
    assert.strictEqual(output.suppressOutput, true);
    assert.ok(output.systemMessage.includes("No English issues found"));
  });

  it("should block prompts with grammar errors", async () => {
    const { stdout, code } = await runScript({
      prompt: "I have went to the store and buyed some foods yesterday.",
    });
    assert.strictEqual(code, 0);
    const output = JSON.parse(stdout.trim());
    assert.strictEqual(output.decision, "block");
    assert.ok(output.reason.includes("English Proofreading"));
  });

  it("should handle mixed Korean/English with errors", async () => {
    const { stdout, code } = await runScript({
      prompt: "이 코드에서 I want to fix this bugs 부분을 수정해줘",
    });
    assert.strictEqual(code, 0);
    const output = JSON.parse(stdout.trim());
    assert.strictEqual(output.decision, "block");
    assert.ok(output.reason.includes("this bug") || output.reason.includes("these bugs"));
  });

  it("should handle malformed JSON input gracefully", async () => {
    const child = spawn("node", [SCRIPT_PATH], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    const result = await new Promise((resolve) => {
      child.on("close", (code) => {
        resolve({ code, stdout });
      });
      child.stdin.write("not valid json");
      child.stdin.end();
    });

    assert.strictEqual(result.code, 0);
    const output = JSON.parse(result.stdout.trim());
    assert.deepStrictEqual(output, {}); // Fail-open behavior
  });
});
