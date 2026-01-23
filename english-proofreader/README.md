# English Proofreader Plugin

Proofreads your English prompts before Claude Code executes them, providing educational feedback to help you improve your English.

## Features

- Automatic proofreading of all English prompts
- Educational feedback with grammar explanations
- Handles mixed Korean/English content (proofreads English parts only)
- Does not consume conversation context
- Automatic dependency installation on first use

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
- You see "✓ No English issues found"
- Your prompt executes normally

**If Bun is not installed:**
- You see an error message with installation instructions

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
Contains English? ─No──→ Allow (silent)
    ↓ Yes
Call Claude Haiku via Agent SDK
    ↓
Issues found? ─No──→ Allow + "✓ No issues"
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
