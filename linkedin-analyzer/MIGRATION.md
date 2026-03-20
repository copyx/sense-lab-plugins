# Migration Guide: v1.0 → v2.0

## What Changed

Version 2.0 introduces **Agent SDK** support, allowing the analyzer to work with Claude Code without requiring a separate Anthropic API key.

## Breaking Changes

### Default Analyzer

The default `npm run analyze` now uses Agent SDK mode instead of direct API.

**Before (v1.0):**
```bash
npm run analyze  # Always required ANTHROPIC_API_KEY
```

**After (v2.0):**
```bash
npm run analyze         # Uses Agent SDK (no API key)
npm run analyze:api     # Uses API key (explicit)
npm run analyze:legacy  # Old analyzer (API key required)
```

### Setup Wizard

The setup wizard now makes API key configuration optional.

**Before (v1.0):**
- Required both LinkedIn cookie and Anthropic API key

**After (v2.0):**
- Required: LinkedIn cookie
- Optional: Anthropic API key (only for standalone mode)

## Migration Steps

### For Existing Users

1. **Update dependencies:**
   ```bash
   npm install
   ```

2. **Choose your mode:**
   - **Agent SDK (recommended)**: No changes needed, works automatically in Claude Code
   - **API mode**: Continue using existing .env with API key

3. **Update scripts** (if using custom scripts):
   - Replace `node src/analyzer.js` with `node src/agent-analyzer.js`
   - Or keep old behavior with `node src/agent-analyzer.js --api-key`

### For New Users

Just run `npm run setup` and follow the prompts. API key is now optional.

## Backward Compatibility

All v1.0 functionality is preserved:

| v1.0 Command | v2.0 Equivalent |
|--------------|-----------------|
| `npm run analyze` | `npm run analyze:legacy` or `npm run analyze:api` |
| Direct API usage | `node src/agent-analyzer.js --api-key` |
| Old analyzer | `node src/analyzer.js` (still available) |

## Feature Comparison

| Feature | v1.0 | v2.0 Agent SDK | v2.0 API Mode |
|---------|------|----------------|---------------|
| API Key Required | ✅ Yes | ❌ No | ✅ Yes |
| Claude Code Integration | ❌ No | ✅ Yes | ⚠️ Limited |
| Standalone CLI | ✅ Yes | ⚠️ Limited | ✅ Yes |
| Cost | API usage | Session (free) | API usage |

## Rollback

If you need to rollback to v1.0 behavior:

```bash
npm run analyze:legacy  # Use old analyzer
```

Or edit `package.json`:

```json
{
  "scripts": {
    "analyze": "node src/analyzer.js"
  }
}
```

## Benefits of Upgrading

- 🆓 **No API costs** when using Agent SDK mode
- 🔗 **Seamless Claude Code integration**
- 🔄 **Backward compatible** with existing workflows
- ⚡ **Faster setup** (no API key needed)
- 🔒 **More secure** (credentials stay in Claude Code)

## Questions?

Open an issue if you encounter any migration problems.
