# Release Workflow

This marketplace follows [Semantic Versioning](https://semver.org/) (semver).

## Version Format

**MAJOR.MINOR.PATCH** (e.g., `1.2.3`)

- **MAJOR**: Breaking changes (incompatible API changes)
- **MINOR**: New features (backwards-compatible)
- **PATCH**: Bug fixes (backwards-compatible)

## Release Process

### 1. Update Version Numbers

Update version in **both** files:

```bash
# english-proofreader/.claude-plugin/plugin.json
{
  "version": "1.2.0"
}

# .claude-plugin/marketplace.json
{
  "metadata": {
    "version": "1.2.0"
  },
  "plugins": [{
    "version": "1.2.0",
    "source": {
      "ref": "v1.2.0"
    }
  }]
}
```

### 2. Commit Changes

```bash
git add .
git commit -m "chore: bump version to v1.2.0"
```

### 3. Create Tag

```bash
git tag -a v1.2.0 -m "Release v1.2.0: Brief description"
```

### 4. Push Everything

```bash
git push origin main
git push origin v1.2.0
```

### 5. Users Get Updates

When users have auto-update enabled:
- Claude Code fetches updated `marketplace.json`
- Sees new `ref: v1.2.0`
- Downloads plugin from that tag
- User gets update on next startup

## Examples

### Patch Release (Bug Fix)

```bash
# 1.0.0 → 1.0.1
# Fix: Typo in error message
```

### Minor Release (New Feature)

```bash
# 1.0.1 → 1.1.0
# Add: New configuration option
```

### Major Release (Breaking Change)

```bash
# 1.1.0 → 2.0.0
# Change: Rename hook output field (breaks existing users)
```

## Checklist

Before releasing:

- [ ] Version updated in `plugin.json`
- [ ] Version updated in `marketplace.json`
- [ ] `ref` field matches new version tag
- [ ] Tests pass (if applicable)
- [ ] README updated (if needed)
- [ ] Commit created
- [ ] Tag created
- [ ] Pushed to GitHub

## Release History

**v1.1.0** - Auto-merge settings feature
- Auto-merge user settings with new defaults on plugin updates
- Added configuration documentation to README

**v1.0.0** - First public release
