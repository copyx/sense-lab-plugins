# English Proofreader Plugin

Proofreads your English prompts before Claude Code executes them, providing educational feedback to help you improve your English.

## Features

- Automatic proofreading of all English prompts
- Educational feedback with grammar explanations
- Handles mixed Korean/English content (proofreads English parts only)
- Does not consume conversation context
- Automatic dependency installation on first use
- Context-aware proofreading - Uses Claude's last response to understand contextual replies

## Prerequisites

Install [Bun](https://bun.sh):

```bash
curl -fsSL https://bun.sh/install | bash
```

Then restart your terminal.

## Installation

```bash
# Add the marketplace (if not already added)
/plugin marketplace add jingi-kim/sense-lab-plugins

# Install the plugin
/plugin install english-proofreader@sense-lab-plugins
```

Dependencies are installed automatically on first session start.

## Usage

Once installed, the plugin automatically proofreads every English prompt you submit.

**If issues are found:**
- Your prompt is blocked (not executed)
- You see educational feedback explaining the errors
- Revise your prompt and re-submit

**If no issues:**
- You see "✅ No English issues found"
- Your prompt executes normally

**If proofreading is skipped:**
- You see "⏭️ Proofreading skipped: [reason]" with the specific reason
- Your prompt executes normally
- Reasons include: matches skip pattern, exceeds length limit, insufficient English content, etc.

**If Bun is not installed:**
- You see an error message with installation instructions

## Configuration

Settings are stored in `~/.english-proofreader/settings.json`. The file is automatically created with defaults on first use.

### Available Settings

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `skipPatterns` | `string[]` | `["^Analyze this conversation and determine:"]` | Regular expression patterns to skip proofreading (e.g., system prompts) |
| `skipAboveLength` | `number` | `0` | Skip proofreading if prompt exceeds this character count (0 = no limit) |
| `minEnglishRatio` | `number` | `0.5` | Minimum ratio of English words to total words (0.0-1.0). Skips if below threshold. |
| `minEnglishWords` | `number` | `3` | Minimum number of English words required for proofreading. Skips if below threshold. |

### Auto-Merge Behavior

When the plugin updates with new settings properties:
- Your existing customizations are **preserved**
- New properties are **automatically added** with default values
- You don't need to manually update your settings file

### Common Customizations

**Skip very long prompts:**
```json
{
  "skipAboveLength": 1000,
  "minEnglishRatio": 0.5,
  "minEnglishWords": 3,
  "skipPatterns": ["^Analyze this conversation and determine:"]
}
```

**Proofread Korean-heavy content (lower English ratio threshold):**
```json
{
  "minEnglishRatio": 0.2,
  "minEnglishWords": 2,
  "skipAboveLength": 0,
  "skipPatterns": ["^Analyze this conversation and determine:"]
}
```

**Skip specific system prompt patterns:**
```json
{
  "skipPatterns": [
    "^Analyze this conversation and determine:",
    "^Please summarize the following:",
    "^Debug output:"
  ],
  "minEnglishRatio": 0.5,
  "minEnglishWords": 3,
  "skipAboveLength": 0
}
```

**Disable length-based skipping entirely:**
```json
{
  "skipAboveLength": 0,
  "minEnglishRatio": 0.5,
  "minEnglishWords": 3,
  "skipPatterns": []
}
```

## Example

**Your prompt:**
```
Help me to understand this code
```

**Feedback:**
```
📝 English Proofreading:

✗ "Help me to understand" → "Help me understand"
Explanation: After "help + object", use the bare infinitive without "to".
This is called the "bare infinitive" pattern. Compare: "help me do" (correct)
vs "help me to do" (less natural in American English).

Please revise your prompt and re-submit.
```

## How It Works

```
SessionStart
    ↓
ensure-deps.sh
    ↓
Bun installed? ─No──→ Block with install instructions
    ↓ Yes
node_modules exists? ─No──→ Run `bun install`
    ↓ Yes
Ready

UserPromptSubmit
    ↓
proofread.sh
    ↓
Bun installed? ─No──→ Block with install instructions
    ↓ Yes
proofread.ts
    ↓
Contains English? ─No──→ Skip + "⏭️ Proofreading skipped: [reason]"
    ↓ Yes
Read transcript → Get Claude's last response (if available)
    ↓
Call Claude Haiku (with context)
    ↓
Issues found? ─No──→ Allow + "✅ No issues"
    ↓ Yes
Block + educational feedback
```

## Plugin Structure

```
english-proofreader/
├── .claude-plugin/
│   └── plugin.json          # Plugin metadata
├── hooks/
│   ├── hooks.json           # Hook configuration
│   ├── ensure-deps.sh       # Bun check + dependency installation
│   ├── proofread.sh         # Bun check wrapper
│   ├── proofread.ts         # Proofreading logic (TypeScript)
│   └── proofread.test.ts    # Tests
├── package.json             # Dependencies
├── tsconfig.json            # TypeScript config
└── README.md
```

## Development

```bash
cd english-proofreader

# Install dependencies
bun install

# Run tests
bun test

# Type check
bun run tsc --noEmit
```

## License

MIT
