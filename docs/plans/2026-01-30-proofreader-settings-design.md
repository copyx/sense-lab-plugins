# Design: Proofreader Settings

## Overview

Add a user-configurable settings file at `~/.english-proofreader/settings.json` to control proofreading behavior. Replace the hardcoded `isSystemPrompt()` check with dynamic settings.

## Settings Schema

```json
{
  "skipPatterns": ["^Analyze this conversation and determine:"],
  "skipAboveLength": 0
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `skipPatterns` | `string[]` | `["^Analyze this conversation and determine:"]` | Regex patterns; skip proofreading if prompt matches any |
| `skipAboveLength` | `number` | `0` | Skip proofreading if prompt exceeds this character count. `0` = no limit |

## Behavior

- Settings file is read on every hook invocation (hook is short-lived, no caching needed)
- If file doesn't exist or is invalid JSON, use defaults
- If a field is missing, use its default
- Regex patterns are tested against the full prompt string

## Changes to `proofread.ts`

### 1. New type: `Settings`

```typescript
interface Settings {
  skipPatterns: string[];
  skipAboveLength: number;
}
```

### 2. New function: `loadSettings(): Promise<Settings>`

- Reads `~/.english-proofreader/settings.json`
- Returns parsed settings merged with defaults
- On any error (missing file, invalid JSON), returns defaults

### 3. New function: `shouldSkip(prompt: string, settings: Settings): boolean`

- Returns `true` if prompt matches any `skipPatterns` regex
- Returns `true` if `skipAboveLength > 0` and `prompt.length > skipAboveLength`
- Replaces `isSystemPrompt()`

### 4. Update `main()`

- Load settings after reading input
- Replace `isSystemPrompt(prompt)` check with `shouldSkip(prompt, settings)`

### 5. Remove `isSystemPrompt()`

Replaced by `shouldSkip()`.

### 6. Create default settings file

On first run, if `~/.english-proofreader/settings.json` doesn't exist, create it with defaults so users can discover and edit it.
