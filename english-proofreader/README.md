# English Proofreader Plugin

Proofreads your English prompts before Claude Code executes them, providing educational feedback to help you improve your English.

## Features

- Automatic proofreading of all English prompts
- Educational feedback with grammar explanations
- Handles mixed Korean/English content (proofreads English parts only)
- Does not consume conversation context

## Prerequisites

1. Install [Bun](https://bun.sh):

```bash
curl -fsSL https://bun.sh/install | bash
```

2. Install the Claude Agent SDK globally:

```bash
npm install -g @anthropic-ai/claude-agent-sdk
```

## Installation

```bash
# Add the marketplace (if not already added)
/plugin marketplace add jingi-kim/sense-lab-plugins

# Install the plugin
/plugin install english-proofreader@sense-lab-plugins
```

## Usage

Once installed, the plugin automatically proofreads every English prompt you submit.

**If issues are found:**
- Your prompt is blocked (not executed)
- You see educational feedback explaining the errors
- Revise your prompt and re-submit

**If no issues:**
- You see "✓ No English issues found"
- Your prompt executes normally

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

## Development

```bash
# Install dependencies
bun install

# Run tests
bun test
```

## License

MIT
