#!/usr/bin/env bun

import { query } from "@anthropic-ai/claude-agent-sdk";
import { mkdir, appendFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

// Types for hook input/output
interface HookInput {
  prompt?: string;
  transcript_path?: string;
}

interface HookOutputBlock {
  decision?: "block";
  reason?: string;
  suppressOutput?: boolean;
  systemMessage?: string;
}

interface ProofreadResult {
  hasIssues: boolean;
  items: FeedbackItem[];
}

export interface FeedbackItem {
  original?: string;
  corrected?: string;
  explanation?: string;
  raw?: string;
}

export function parseFeedbackItems(text: string): FeedbackItem[] {
  try {
    // Strip markdown code fences if present
    const stripped = text.replace(/^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/m, "$1");
    const parsed = JSON.parse(stripped);
    if (!Array.isArray(parsed)) {
      return [{ raw: text }];
    }
    return parsed;
  } catch {
    return [{ raw: text }];
  }
}

export function formatFeedbackForUser(items: FeedbackItem[]): string {
  if (items.length === 0) return "";

  return items
    .map((item) => {
      if (item.raw) return item.raw;
      return `💡 "${item.original}" → "${item.corrected}"\nExplanation: ${item.explanation}`;
    })
    .join("\n\n---\n\n");
}

export interface LogEntry {
  timestamp: string;
  prompt: string;
  feedback: FeedbackItem[];
  decision: "block" | "pass";
}

export async function appendLog(entry: LogEntry): Promise<void> {
  try {
    const home = process.env.HOME || homedir();
    const logDir = join(home, ".english-proofreader", "logs");
    await mkdir(logDir, { recursive: true });
    const date = entry.timestamp.slice(0, 10);
    const filePath = join(logDir, `${date}.jsonl`);
    await appendFile(filePath, JSON.stringify(entry) + "\n");
  } catch (err) {
    console.error(`Log write error: ${(err as Error).message}`);
  }
}

// Read stdin
async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString("utf-8");
}

// Check if text contains English letters
export function containsEnglish(text: string): boolean {
  return /[a-zA-Z]/.test(text);
}

// Maximum context size in characters (~500 tokens)
const MAX_CONTEXT_CHARS = 2000;

// Truncate context to limit, keeping the end (most relevant to user's reply)
export function truncateContext(text: string): string {
  if (text.length <= MAX_CONTEXT_CHARS) {
    return text;
  }
  return "..." + text.slice(-MAX_CONTEXT_CHARS);
}

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

If there ARE issues, respond with ONLY a JSON array (no markdown, no explanation outside the JSON):
[{"original": "[original phrase]", "corrected": "[corrected phrase]", "explanation": "[Detailed educational explanation of why this is wrong and how to remember the correct usage. Include grammar rules, common patterns, or helpful tips.]"}]

Each object must have "original", "corrected", and "explanation" fields.

Be thorough but focus on actual errors, not style preferences. If the English is grammatically correct and natural-sounding, respond with NO_ISSUES.`;
}

// Parse proofreading result
export function parseProofreadResult(result: string): ProofreadResult {
  const trimmed = result.trim();

  if (trimmed === "NO_ISSUES" || trimmed.startsWith("NO_ISSUES")) {
    return { hasIssues: false, items: [] };
  }

  return { hasIssues: true, items: parseFeedbackItems(trimmed) };
}

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

    // 2.5. Strip special tokens (slash commands, mentions)
    const strippedPrompt = stripSpecialTokens(prompt);

    // If nothing left after stripping, skip proofreading
    if (!strippedPrompt.trim()) {
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
      prompt: buildProofreadPrompt(strippedPrompt, context),
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
  } catch (error) {
    // On error, allow prompt to proceed (fail-open)
    console.error(`Proofreading error: ${(error as Error).message}`);
    console.log(JSON.stringify({}));
  }

  process.exit(0);
}

// Only run main when executed directly, not when imported
const isMainModule = import.meta.main;
if (isMainModule) {
  main();
}
