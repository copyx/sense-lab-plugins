# Sense Lab Plugins

A personal Claude Code plugin marketplace by jingi.kim.

## Available Plugins

| Plugin | Description | Version |
|--------|-------------|---------|
| [product-planning-assistant](./product-planning-assistant) | Helps refine product requirements before design phase | 1.0.0 |
| [english-proofreader](./english-proofreader) | Proofreads English prompts with educational feedback | 1.0.0 |

## Installation

### Step 1: Add Marketplace

```bash
# GitHub에서 추가 (권장)
/plugin marketplace add jingi-kim/sense-lab-plugins

# 로컬 디렉토리로 추가
/plugin marketplace add ./sense-lab-plugins

# Git URL로 추가
/plugin marketplace add https://github.com/jingi-kim/sense-lab-plugins.git
```

### Step 2: Install Plugin

```bash
# Product Planning Assistant
/plugin install product-planning-assistant@sense-lab-plugins

# English Proofreader (requires Bun)
/plugin install english-proofreader@sense-lab-plugins
```

### Alternative: Direct Loading

```bash
# 마켓플레이스 없이 직접 로드
claude --plugin-dir ./sense-lab-plugins/product-planning-assistant
```

## Marketplace Structure

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
└── english-proofreader/         # Plugin: Hook-based
    ├── .claude-plugin/
    │   └── plugin.json
    ├── hooks/
    │   ├── hooks.json
    │   ├── ensure-deps.sh
    │   ├── proofread.sh
    │   ├── proofread.ts
    │   └── proofread.test.ts
    ├── package.json
    ├── tsconfig.json
    └── README.md
```

## marketplace.json Schema

Location: `.claude-plugin/marketplace.json`

```json
{
  "name": "sense-lab-plugins",
  "owner": {
    "name": "jingi.kim"
  },
  "metadata": {
    "description": "A personal Claude Code plugin marketplace",
    "version": "1.0.0"
  },
  "plugins": [
    {
      "name": "product-planning-assistant",
      "source": "./product-planning-assistant",
      "description": "An agent that helps refine requirements before design",
      "version": "1.0.0"
    },
    {
      "name": "english-proofreader",
      "source": "./english-proofreader",
      "description": "Proofreads English prompts with educational feedback",
      "version": "1.0.0"
    }
  ]
}
```

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | 마켓플레이스 식별자 (kebab-case) |
| `owner.name` | string | 관리자 이름 |
| `plugins` | array | 플러그인 목록 |
| `plugins[].name` | string | 플러그인 식별자 (kebab-case) |
| `plugins[].source` | string/object | 플러그인 경로 또는 Git 소스 |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `owner.email` | string | 관리자 이메일 |
| `metadata.description` | string | 마켓플레이스 설명 |
| `metadata.version` | string | 마켓플레이스 버전 |
| `plugins[].description` | string | 플러그인 설명 |
| `plugins[].version` | string | 플러그인 버전 |
| `plugins[].author` | object | 플러그인 작성자 |
| `plugins[].keywords` | array | 검색 키워드 |
| `plugins[].category` | string | 카테고리 |

### Plugin Source Options

```json
// 상대 경로 (Git으로 추가 시에만 동작)
{ "source": "./plugins/my-plugin" }

// GitHub
{
  "source": {
    "source": "github",
    "repo": "owner/repo",
    "ref": "v1.0.0",
    "sha": "a1b2c3d..."
  }
}

// Git URL (GitLab, Bitbucket 등)
{
  "source": {
    "source": "url",
    "url": "https://gitlab.com/team/plugin.git",
    "ref": "main"
  }
}
```

## Adding a New Plugin

### 1. Create Plugin Structure

```bash
mkdir -p new-plugin/.claude-plugin
mkdir -p new-plugin/commands    # 또는 agents, skills, hooks
```

### 2. Create plugin.json

```json
{
  "name": "new-plugin",
  "description": "Brief description",
  "version": "1.0.0",
  "author": {
    "name": "jingi.kim"
  }
}
```

### 3. Add Components

- `commands/` - Slash commands (.md files)
- `agents/` - Agent definitions (.md files)
- `skills/` - Agent skills (subdirectories with SKILL.md)
- `hooks/` - Event handlers (hooks.json)
- `.mcp.json` - MCP server configurations
- `.lsp.json` - LSP server configurations

### 4. Register in marketplace.json

```json
{
  "name": "new-plugin",
  "source": "./new-plugin",
  "description": "Brief description",
  "version": "1.0.0"
}
```

## Testing

```bash
# 마켓플레이스 검증
/plugin validate .

# 로컬 테스트
/plugin marketplace add ./sense-lab-plugins
/plugin install plugin-name@sense-lab-plugins

# 직접 플러그인 로드
claude --plugin-dir ./new-plugin
```

## Distribution

| Method | Command |
|--------|---------|
| GitHub (권장) | `/plugin marketplace add owner/repo` |
| GitLab/Bitbucket | `/plugin marketplace add https://gitlab.com/...` |
| Private Repo | `GITHUB_TOKEN` 또는 `GITLAB_TOKEN` 환경변수 설정 필요 |

## Team Configuration

프로젝트의 `.claude/settings.json`에서 마켓플레이스 자동 추가:

```json
{
  "extraKnownMarketplaces": {
    "sense-lab-plugins": {
      "source": {
        "source": "github",
        "repo": "jingi-kim/sense-lab-plugins"
      }
    }
  },
  "enabledPlugins": {
    "product-planning-assistant@sense-lab-plugins": true,
    "english-proofreader@sense-lab-plugins": true
  }
}
```

## License

MIT
