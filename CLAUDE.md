# CLAUDE.md

Claude Code plugin marketplace - distributes plugins via `/plugin` command.

## Repository Structure

```
sense-lab-plugins/
├── .claude-plugin/marketplace.json    # Marketplace definition
├── docs/plans/                        # Design documents
└── english-proofreader/               # Plugin (Hook-based, Bun)
    ├── .claude-plugin/plugin.json
    ├── hooks/{hooks.json, *.sh, *.ts}
    ├── package.json, tsconfig.json
    └── README.md
```

## Schemas

### marketplace.json

Location: `.claude-plugin/marketplace.json`

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | 마켓플레이스 식별자 (kebab-case) |
| `owner.name` | Yes | 관리자 이름 |
| `plugins[].name` | Yes | 플러그인 식별자 |
| `plugins[].source` | Yes | 경로 또는 Git 소스 (아래 참조) |
| `metadata.*`, `plugins[].description/version/author/keywords` | No | 추가 메타데이터 |

**Source options:**
```json
"./my-plugin"                                           // 상대 경로
{"source":"github","repo":"owner/repo","ref":"v1.0.0"}  // GitHub
{"source":"url","url":"https://...","ref":"main"}       // Git URL
```

### plugin.json

Location: `plugin-name/.claude-plugin/plugin.json`

| Field | Required | Description |
|-------|----------|-------------|
| `name`, `description`, `version` | Yes | 기본 정보 |
| `author`, `repository`, `license`, `keywords` | No | 추가 메타데이터 |

## Plugin Components

**Critical**: Only `plugin.json` goes inside `.claude-plugin/`. All others at plugin root.

| Directory | Format | Description |
|-----------|--------|-------------|
| `commands/` | `*.md` | Slash commands (`/plugin:cmd`) |
| `agents/` | `*.md` | Agent definitions |
| `skills/` | `*/SKILL.md` | Agent skills |
| `hooks/` | `hooks.json` | Event handlers |
| `.mcp.json` | JSON | MCP servers |
| `.lsp.json` | JSON | LSP servers |

### Component Frontmatter

```yaml
# commands/*.md, skills/*/SKILL.md
---
description: Brief description
disable-model-invocation: true  # Optional
---

# agents/*.md
---
name: agent-name
description: Brief description
model: inherit
color: blue
---
```

### hooks.json

```json
{"hooks": {
  "SessionStart": [{"hooks": [{"type":"command","command":"${CLAUDE_PLUGIN_ROOT}/setup.sh"}]}],
  "UserPromptSubmit": [{"hooks": [{"type":"command","command":"..."}]}],
  "PostToolUse": [{"matcher":"Write|Edit","hooks":[{"type":"command","command":"..."}]}]
}}
```

## Development

### New Plugin

1. `mkdir -p new-plugin/.claude-plugin`
2. Create `plugin.json`, add components
3. Register in `marketplace.json`
4. Create `README.md`

### Testing

```bash
/plugin validate .                              # 검증
/plugin marketplace add ./sense-lab-plugins    # 로컬 테스트
claude --plugin-dir ./new-plugin               # 직접 로드
cd english-proofreader && bun test             # 유닛 테스트
```

### Distribution

| Method | Command |
|--------|---------|
| GitHub | `/plugin marketplace add owner/repo` |
| Git URL | `/plugin marketplace add https://...` |
| Private | `GITHUB_TOKEN` 또는 `GITLAB_TOKEN` 필요 |

### Team Config (`.claude/settings.json`)

```json
{"extraKnownMarketplaces":{"sense-lab-plugins":{"source":{"source":"github","repo":"jingi-kim/sense-lab-plugins"}}},"enabledPlugins":{"english-proofreader@sense-lab-plugins":true}}
```

## Release Management

- Follows [semantic versioning](https://semver.org/) (MAJOR.MINOR.PATCH)
- Git tags (e.g., `v1.0.0`) control plugin distribution
- `marketplace.json` `ref` field must match git tag for auto-updates
- Both `plugin.json` and `marketplace.json` versions must stay in sync
- See `RELEASE.md` for step-by-step release process

### Version Control

- Plugin version in `plugin.json` is development version
- Released versions are tagged in git (`git tag -a v1.0.0`)
- Marketplace `ref` field pins users to specific tag
- Auto-updates happen when `ref` changes and users have auto-update enabled

## Conventions

### Naming & Structure

- Names: `kebab-case`
- Hook scripts: Shell wrappers for dependency checks

### Versioning (Semver)

Format: `MAJOR.MINOR.PATCH` (e.g., `1.2.3`)

- **MAJOR**: Breaking changes (incompatible API changes)
- **MINOR**: New features (backwards-compatible)
- **PATCH**: Bug fixes (backwards-compatible)

### Commit Messages (Conventional Commits)

Format: `<type>(<scope>): <description>`

**Types:**
- `feat`: New feature (bumps MINOR)
- `fix`: Bug fix (bumps PATCH)
- `docs`: Documentation only
- `chore`: Maintenance (dependencies, config)
- `refactor`: Code restructuring
- `test`: Test additions/changes
- `perf`: Performance improvements

**Breaking changes:** Add `!` after type or `BREAKING CHANGE:` in footer (bumps MAJOR)

**Examples:**
```
feat(proofreader): add minEnglishRatio setting
fix(hooks): handle curly quotes in agent mentions
docs: update release workflow
chore: bump version to v1.1.0
feat(api)!: rename output field (breaking change)
```

## References

- [Plugin Marketplaces](https://code.claude.com/docs/en/plugin-marketplaces)
- [Plugins](https://code.claude.com/docs/en/plugins) | [Reference](https://code.claude.com/docs/en/plugins-reference) | [Discover](https://code.claude.com/docs/en/discover-plugins)
- [Hooks Guide](https://code.claude.com/docs/en/hooks-guide) | [Reference](https://code.claude.com/docs/en/hooks)
- [Skills](https://code.claude.com/docs/en/skills)
- [Sub-agents](https://code.claude.com/docs/en/sub-agents)
- [Headless Mode](https://code.claude.com/docs/en/headless)
- [CLI Reference](https://code.claude.com/docs/en/cli-reference)
- [Agent SDK](https://platform.claude.com/docs/en/agent-sdk/overview)
