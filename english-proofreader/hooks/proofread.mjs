#!/usr/bin/env node

import { createRequire } from "module";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

// Lazy-load SDK to avoid loading when imported for testing
let _query = null;
function getQuery() {
  if (!_query) {
    const globalModulesPath = execSync("npm root -g", { encoding: "utf-8" }).trim();
    const require = createRequire(`${globalModulesPath}/`);
    _query = require("@anthropic-ai/claude-agent-sdk").query;
  }
  return _query;
}

// Read stdin
async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf-8");
}

// Check if text contains English letters
export function containsEnglish(text) {
  return /[a-zA-Z]/.test(text);
}

// Build proofreading prompt
export function buildProofreadPrompt(text) {
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
export function parseProofreadResult(result) {
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
    const query = getQuery();
    let result = "";
    for await (const message of query({
      prompt: buildProofreadPrompt(prompt),
      options: {
        allowedTools: [],
        maxTurns: 1,
        model: "haiku"
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

// Only run main when executed directly, not when imported
const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);
if (isMainModule) {
  main();
}
