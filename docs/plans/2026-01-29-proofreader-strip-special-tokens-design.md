# Strip Special Tokens from Proofreader Input

## Summary

Add a `stripSpecialTokens` function to the english-proofreader plugin that removes slash commands and mentions from prompts before proofreading, so they don't trigger false positives.

## Rules

### Slash commands

If the prompt starts with `/`, strip the first whitespace-delimited token.

### Mentions (`@...`)

| Pattern | Has dot extension? | Contains "agent"? | Classification | Action |
|---------|-------------------|-------------------|---------------|--------|
| `@"..."` | Yes | - | File | Strip `@` and quotes, keep content |
| `@"..."` | No | - | Agent | Remove entirely |
| `@something` | Yes | - | File | Strip `@` only |
| `@something` | No | Yes | Agent | Remove entirely |
| `@something` | No | No | Ambiguous | Leave as-is |

### Edge cases

- If stripping results in empty/whitespace-only text, skip proofreading entirely.
- Slash command stripping runs first, then mention stripping.

## Implementation

### New function: `stripSpecialTokens(text: string): string`

Pure function in `proofread.ts`. Runs in order:
1. Strip leading slash command token.
2. Strip quoted mentions (`@"..."`).
3. Strip unquoted mentions (`@[^\s]+`).

### Integration

Called in `main()` after `containsEnglish()` check, before `buildProofreadPrompt()`.

### Tests

| Input | Expected output |
|-------|----------------|
| `/commit fix the bug` | `fix the bug` |
| `@"code-reviewer" check this` | `check this` |
| `update @"src/index.ts" to add` | `update src/index.ts to add` |
| `update @src/index.ts to add` | `update src/index.ts to add` |
| `@"my-agent" do something` | `do something` |
| `@utils do something` | `@utils do something` |
| `/commit` | `` (skip proofreading) |
| `/review @"src/app.ts" for bugs` | `src/app.ts for bugs` |

### Version

Bump `plugin.json` version from 1.1.0 to 1.2.0.
