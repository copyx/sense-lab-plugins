# Design: minEnglishRatio Setting

## Overview

Skip proofreading when less than a configurable percentage of words in the stripped prompt are English. Prompts that are mostly Korean with a few English words mixed in aren't worth proofreading.

## Settings Schema Change

```json
{
  "skipPatterns": ["^Analyze this conversation and determine:"],
  "skipAboveLength": 0,
  "minEnglishRatio": 0.5
}
```

- `minEnglishRatio` — skip if English word ratio is below this threshold (default: `0.5`, `0` disables)

## Changes to `proofread.ts`

### 1. Add `minEnglishRatio` to Settings

- Add field to `Settings` interface (default: `0.5`)
- Update `DEFAULT_SETTINGS` and `loadSettings()` merge logic

### 2. New function: `englishWordRatio(text: string): number`

- Split on whitespace, filter empty strings
- A word is "English" if it contains at least one ASCII letter (`/[a-zA-Z]/.test(w)`)
- Return `englishWords.length / totalWords.length`
- Empty string returns `0`

### 3. Add ratio check in `main()` after stripping

After `stripSpecialTokens`, before proofreading:

```typescript
if (settings.minEnglishRatio > 0 && englishWordRatio(strippedPrompt) < settings.minEnglishRatio) {
  console.log(JSON.stringify({}));
  process.exit(0);
}
```

### 4. Remove `containsEnglish` check from `main()`

Subsumed by the ratio check (0% English → ratio 0 < 0.5 → skip).

Note: Keep the `containsEnglish` function exported — it may be used elsewhere or in tests.

## Flow in `main()`

1. Read input
2. Load settings
3. `shouldSkip(prompt, settings)` — patterns + length on **original** prompt
4. `stripSpecialTokens(prompt)` — remove mentions/commands
5. Skip if stripped prompt is empty
6. **New:** skip if `englishWordRatio(strippedPrompt) < minEnglishRatio`
7. Get context, call Claude, parse, output, log
