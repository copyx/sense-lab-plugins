# Design: minEnglishRatio and minEnglishWords Settings

## Overview

Skip proofreading when the stripped prompt doesn't have enough English content — either by ratio or by absolute word count.

## Settings Schema Change

```json
{
  "skipPatterns": ["^Analyze this conversation and determine:"],
  "skipAboveLength": 0,
  "minEnglishRatio": 0.5,
  "minEnglishWords": 3
}
```

- `minEnglishRatio` — skip if English word ratio is below this threshold (default: `0.5`, `0` disables)
- `minEnglishWords` — skip if fewer than this many English words (default: `3`, `0` disables)

## Changes to `proofread.ts`

### 1. Add `minEnglishRatio` and `minEnglishWords` to Settings

- Add fields to `Settings` interface (defaults: `0.5` and `3`)
- Update `DEFAULT_SETTINGS` and `loadSettings()` merge logic

### 2. New function: `countEnglishWords(text: string): { english: number; total: number }`

- Split on whitespace, filter empty strings
- A word is "English" if it contains at least one ASCII letter (`/[a-zA-Z]/.test(w)`)
- Returns both counts so callers can compute ratio or check count

### 3. Add ratio check in `main()` after stripping

After `stripSpecialTokens`, before proofreading:

```typescript
const { english, total } = countEnglishWords(strippedPrompt);
const ratio = total > 0 ? english / total : 0;

if (settings.minEnglishWords > 0 && english < settings.minEnglishWords) {
  console.log(JSON.stringify({}));
  process.exit(0);
}
if (settings.minEnglishRatio > 0 && ratio < settings.minEnglishRatio) {
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
6. **New:** skip if English word count < `minEnglishWords` or ratio < `minEnglishRatio`
7. Get context, call Claude, parse, output, log
