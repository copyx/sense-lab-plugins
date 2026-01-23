# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project Overview

This is a **Claude Code plugin marketplace** - a repository that distributes Claude Code plugins via the `/plugin` command.

## Repository Structure

```
sense-lab-plugins/
├── .claude-plugin/
│   └── marketplace.json         # Required: 마켓플레이스 정의
├── .gitignore
├── LICENSE
├── README.md
├── CLAUDE.md
├── docs/
│   └── plans/                   # Design documents
│
├── product-planning-assistant/  # Plugin: Agent-based
│   ├── .claude-plugin/
│   │   └── plugin.json
│   ├── agents/
│   │   └── product-planner.md
│   └── README.md
│
└── english-proofreader/         # Plugin: Hook-based (TypeScript/Bun)
    ├── .claude-plugin/
    │   └── plugin.json
    ├── hooks/
    │   ├── hooks.json           # SessionStart + UserPromptSubmit hooks
    │   ├── ensure-deps.sh       # Bun check + dependency install
    │   ├── proofread.sh         # Bun check wrapper
    │   ├── proofread.ts         # Proofreading logic
    │   └── proofread.test.ts    # Tests (bun test)
    ├── package.json
    ├── tsconfig.json
    └── README.md
```

## Marketplace Schema

Location: `.claude-plugin/marketplace.json`

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | 마켓플레이스 식별자 (kebab-case) |
| `owner.name` | string | 관리자 이름 |
| `plugins` | array | 플러그인 목록 |
| `plugins[].name` | string | 플러그인 식별자 |
| `plugins[].source` | string/object | 플러그인 경로 |

### Example

```json
{
  "name": "sense-lab-plugins",
  "owner": { "name": "jingi.kim" },
  "plugins": [
    {
      "name": "my-plugin",
      "source": "./my-plugin",
      "description": "Brief description",
      "version": "1.0.0"
    }
  ]
}
```

## Plugin Structure

**Critical**: Only `plugin.json` goes inside `.claude-plugin/`. All other directories must be at plugin root.

```
plugin-name/
├── .claude-plugin/
│   └── plugin.json          # Required
├── commands/                # Slash commands (.md files)
├── agents/                  # Agent definitions (.md files)
├── skills/                  # Agent skills (SKILL.md in subdirectories)
├── hooks/                   # Event handlers (hooks.json)
├── .mcp.json               # MCP server configurations
└── .lsp.json               # LSP server configurations
```

## plugin.json Schema

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `name` | Yes | string | 플러그인 식별자 (kebab-case) |
| `description` | Yes | string | 플러그인 설명 |
| `version` | Yes | string | 버전 (semantic versioning) |
| `author` | No | object | `{ "name": "..." }` |
| `repository` | No | string | GitHub URL |
| `license` | No | string | 라이선스 (MIT, Apache-2.0 등) |
| `keywords` | No | array | 검색 키워드 |

### Example

```json
{
  "name": "my-plugin",
  "description": "Brief description",
  "version": "1.0.0",
  "author": { "name": "jingi.kim" },
  "repository": "https://github.com/jingi-kim/sense-lab-plugins",
  "license": "MIT"
}
```

## Component Formats

### Commands (commands/*.md)

```markdown
---
description: Brief description of the command
disable-model-invocation: true  # Optional: run without Claude
---

Command instructions here. Use $ARGUMENTS for user input.
```

Usage: `/plugin-name:command-name arguments`

### Agents (agents/*.md)

```yaml
---
name: agent-name
description: Brief description
model: inherit
color: blue
---

Agent instructions here.
```

### Skills (skills/skill-name/SKILL.md)

```markdown
---
description: When to use this skill
disable-model-invocation: true
---

Skill instructions here.
```

### Hooks (hooks/hooks.json)

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          { "type": "command", "command": "${CLAUDE_PLUGIN_ROOT}/hooks/setup.sh" }
        ]
      }
    ],
    "UserPromptSubmit": [
      {
        "hooks": [
          { "type": "command", "command": "${CLAUDE_PLUGIN_ROOT}/hooks/validate.sh" }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          { "type": "command", "command": "npm run lint:fix $FILE" }
        ]
      }
    ]
  }
}
```

## Development Workflow

### Adding a New Plugin

1. Create directory: `mkdir -p new-plugin/.claude-plugin`
2. Create `new-plugin/.claude-plugin/plugin.json`
3. Add components (commands, agents, skills, hooks)
4. Register in `.claude-plugin/marketplace.json`
5. Create `new-plugin/README.md`

### Testing

```bash
# 마켓플레이스 검증
/plugin validate .

# 로컬 테스트
/plugin marketplace add ./sense-lab-plugins
/plugin install plugin-name@sense-lab-plugins

# 직접 플러그인 로드
claude --plugin-dir ./new-plugin
```

### Testing english-proofreader

```bash
cd english-proofreader
bun install
bun test
```

## Conventions

- Marketplace/Plugin names: `kebab-case`
- Version: Semantic versioning (MAJOR.MINOR.PATCH)
- Agent instructions: English
- Hook scripts: Use shell wrappers for dependency checks
