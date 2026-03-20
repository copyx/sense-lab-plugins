# Changelog

All notable changes to the LinkedIn Analyzer project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-02-03

### 🆕 Added

#### Agent SDK Integration
- **Claude Agent SDK support**: Analyzer now works with Claude Code without requiring a separate Anthropic API key
- **Dual-mode operation**: Automatic detection between Agent SDK mode and API mode
- **New agent-analyzer.js**: Complete rewrite using `@anthropic-ai/claude-agent-sdk`
- **Plugin structure**: Added `.claude-plugin/plugin.json` for Claude Code plugin registration
- **Agent definition**: Created `agents/linkedin-analyzer.md` for agent-based usage

#### Documentation
- **AGENT_SDK_INTEGRATION.md**: Comprehensive guide for Agent SDK integration
- **MIGRATION.md**: Migration guide from v1.0 to v2.0
- **USAGE.md**: Detailed usage documentation for all modes
- **CHANGELOG.md**: This file

#### Scripts
- `npm run analyze:api`: Explicit API mode usage
- `npm run analyze:legacy`: Use old v1.0 analyzer

### 🔄 Changed

#### Setup Process
- Made Anthropic API key **optional** in setup wizard
- Updated setup prompts to explain Agent SDK mode
- Setup now only requires LinkedIn cookie for Claude Code usage

#### Default Behavior
- `npm run analyze` now uses Agent SDK mode by default
- Automatic fallback from Agent SDK → API mode if SDK unavailable
- Multi-level fallback: V2 SDK → V1 SDK → Direct API

#### Documentation Updates
- **README.md**: Added Agent SDK sections, dual-mode documentation
- **.env.example**: Marked ANTHROPIC_API_KEY as optional
- **setup.js**: Updated help text and prompts

### 🔧 Technical Changes

#### Dependencies
- Added: `@anthropic-ai/claude-agent-sdk` (^0.2.0)
- Kept: `@anthropic-ai/sdk` (^0.30.0) for API mode fallback
- Kept: All existing dependencies unchanged

#### Implementation Details
- Uses `unstable_v2_prompt` for V2 SDK API
- Falls back to `query` for V1 SDK API
- Graceful degradation to direct API calls
- Smart mode detection via command-line flags
- Metadata tracking (mode: "agent-sdk" vs "api-key")

### 🛡️ Backward Compatibility

All v1.0 functionality preserved:
- Old `analyzer.js` remains untouched
- API key mode still fully supported
- All existing workflows continue to work
- No breaking changes for existing users

### 📋 Migration Guide

For existing users:
1. Run `npm install` to get new dependencies
2. Continue using existing .env with API key (works as before)
3. Or remove API key and use Agent SDK mode (recommended)

For new users:
1. Run `npm run setup`
2. Enter LinkedIn cookie only
3. Skip API key configuration
4. Use `npm run pipeline`

### 🐛 Fixed

- N/A (new release)

### 🗑️ Deprecated

- None (old analyzer kept for compatibility)

### 🔒 Security

- Agent SDK mode keeps credentials in Claude Code session
- No API key stored/transmitted when using Agent SDK
- Existing API key security maintained for API mode

---

## [1.0.0] - 2024-XX-XX

### Initial Release

#### Features
- LinkedIn saved posts extraction via Playwright
- AI-powered analysis using Claude API
- Topic clustering and theme identification
- Key insights extraction
- Author statistics
- Markdown report generation
- Interactive setup wizard
- Configurable extraction and analysis parameters

#### Components
- `src/extractor.js`: Web scraping with Playwright
- `src/analyzer.js`: AI analysis with Anthropic API
- `src/reporter.js`: Markdown report generation
- `src/setup.js`: Interactive configuration wizard

#### Requirements
- LinkedIn li_at cookie
- Anthropic API key
- Node.js 18+
- Chromium browser (via Playwright)

---

## Version Comparison

| Feature | v1.0 | v2.0 |
|---------|------|------|
| **API Key Required** | ✅ Always | ❌ Optional |
| **Claude Code Integration** | ❌ No | ✅ Yes |
| **Standalone CLI** | ✅ Yes | ✅ Yes |
| **Plugin Support** | ❌ No | ✅ Yes |
| **Cost (Agent SDK)** | API usage | Free |
| **Cost (API mode)** | ~$0.01-0.10 | ~$0.01-0.10 |
| **Setup Complexity** | 2 credentials | 1 credential |
| **Backward Compatible** | N/A | ✅ Yes |

---

## Upgrade Instructions

### From v1.0 to v2.0

```bash
# Pull latest code
git pull origin main

# Install new dependencies
npm install

# Option 1: Continue with API key mode
# No changes needed - works as before
npm run analyze:legacy

# Option 2: Switch to Agent SDK mode
# Remove API key from .env (optional)
npm run analyze
```

### Testing Upgrade

```bash
# Test Agent SDK mode
npm run analyze

# Test API mode
npm run analyze:api

# Test legacy analyzer
npm run analyze:legacy
```

All three should work correctly.

---

## Future Roadmap

### v2.1 (Planned)
- [ ] Real-time streaming analysis results
- [ ] Interactive follow-up questions
- [ ] Improved error messages
- [ ] Performance optimizations

### v2.2 (Planned)
- [ ] Multi-agent workflow (extract → analyze → report as separate agents)
- [ ] Session-based conversations
- [ ] Automated weekly summaries
- [ ] Dashboard integration

### v3.0 (Future)
- [ ] Marketplace publication
- [ ] Plugin marketplace distribution
- [ ] Cross-platform support (LinkedIn, Twitter, etc.)
- [ ] Team collaboration features

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for contribution guidelines.

## License

MIT License - See [LICENSE](./LICENSE) for details.
