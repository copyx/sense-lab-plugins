# LinkedIn Saved Posts Analyzer

Extract, analyze, and generate insights from your LinkedIn saved posts using Playwright and Claude Agent SDK.

## 🆕 What's New in v2.0

**Agent SDK Integration**: No API key required when using with Claude Code! The analyzer now uses Claude's Agent SDK, seamlessly integrating with your Claude Code session.

## 🎯 Your Workflow

```
1. Browse LinkedIn → Save interesting posts (manual)
2. Run extractor → Get all saved posts (automated)
3. AI analysis → Topics, insights, trends (automated, NO API KEY!)
4. Read report → Actionable takeaways (automated)
```

## 🚀 Quick Start

### Option 1: With Claude Code (Recommended)

```bash
cd linkedin-analyzer
npm install      # Installs dependencies + Playwright browsers
npm run setup    # Only need LinkedIn cookie
npm run pipeline # Extract → Analyze → Report (uses Agent SDK)
```

### Option 2: Standalone CLI

```bash
cd linkedin-analyzer
npm install      # Installs dependencies + Playwright browsers
npm run setup    # Configure both cookie and API key
npm run pipeline # Uses API key mode
```

## 📋 Setup Steps

### 1. Run Setup Wizard

```bash
npm run setup
```

The wizard will guide you through two steps:

**Step 1: LinkedIn Cookie (Required)**

Choose your preferred method:

**Option A: Automated (Recommended)**
- Browser opens automatically
- You log in to LinkedIn normally
- Cookie captured and saved automatically ✨
- Takes 30 seconds

**Option B: Manual**
- Open LinkedIn and DevTools yourself
- Copy `li_at` cookie value manually
- Paste into setup wizard

**Step 2: API Key (Optional)**
- Skip if using with Claude Code (recommended)
- Only needed for standalone CLI mode
- Get from https://console.anthropic.com/

### 2. Alternative: Standalone Cookie Capture

```bash
npm run capture-cookie
```

Runs just the automated cookie capture without full setup.

## 🔧 Commands

```bash
npm run setup           # Interactive setup wizard (automated cookie capture)
npm run capture-cookie  # Standalone automated cookie capture
npm run extract         # Extract saved posts from LinkedIn
npm run analyze         # Analyze with Agent SDK (default)
npm run analyze:api     # Analyze with API key (standalone)
npm run analyze:legacy  # Use old analyzer (requires API key)
npm run report          # Generate markdown report
npm run pipeline        # Run all three steps (uses Agent SDK)
```

## 📊 What You Get

**Extracted Data** (`output/saved-posts-YYYY-MM-DD.json`):
- Post titles, authors, URLs
- Saved dates
- Summaries
- Engagement metrics

**Analysis** (`output/analysis-YYYY-MM-DD.json`):
- Topic clustering
- Key insights
- Author statistics
- Trending themes

**Report** (`output/report-YYYY-MM-DD.md`):
- Top themes with insights
- Actionable items
- Most saved authors
- Links to original posts

## ⚙️ Configuration

Edit `config/config.json`:

```json
{
  "extraction": {
    "maxScrollAttempts": 100,
    "scrollDelay": 1500,
    "headless": true
  },
  "analysis": {
    "model": "claude-3-5-sonnet-20241022",
    "enableTopicClustering": true
  }
}
```

## 🤖 Usage Modes

### Agent SDK Mode (Default)

When run from Claude Code or using `npm run analyze`:
- Uses Claude Code's session
- No API key needed
- Zero additional cost
- Seamless integration

### API Mode (Optional)

For standalone CLI usage with `npm run analyze:api --api-key`:
- Requires ANTHROPIC_API_KEY in .env
- Direct API calls
- Typical cost: ~$0.01-0.10 per analysis

## 🔒 Privacy & Security

- All data stays local
- Agent SDK mode: Analysis happens within Claude Code session
- API mode: Data sent to Anthropic API (encrypted, not stored)
- `.env` is git-ignored
- No third-party services

## 🐛 Troubleshooting

### Cookie Capture Issues

**Automated capture fails**:
- Check internet connection
- Ensure Playwright browsers installed: `npm install`
- Try manual method instead (option 2 in setup)

**Browser doesn't open**:
- Run: `npx playwright install chromium --with-deps`
- Check browser permissions in your system

**Login detected but no cookie**:
- Very rare - use manual method instead
- Report issue on GitHub

### Authentication Issues

**Authentication failed**:
- Cookie expired (30-90 days lifetime)
- Run `npm run setup` or `npm run capture-cookie` to get fresh cookie

**No posts extracted**:
- Check you have saved posts at linkedin.com/my-items/saved-posts/
- Save a few test posts first

### Analysis Issues

**Analysis failed (Agent SDK)**:
- Ensure running from Claude Code session
- Try `npm run analyze:api` as fallback

**Analysis failed (API mode)**:
- Check API key in `.env` file
- Verify credits at console.anthropic.com

**Agent SDK not working**:
- Use `npm run analyze:api` for direct API mode
- Check `ANTHROPIC_API_KEY` is set in `.env`

## 📝 Recommended Workflow

**Weekly**:
1. Save 5-10 interesting posts daily on LinkedIn
2. Friday: Run `npm run pipeline`
3. Weekend: Review report and action items

## ⚠️ Disclaimer

For personal use only. Automated scraping may violate LinkedIn ToS. Use sparingly (weekly) on your own saved posts only.

## 🎓 Why This Approach Works

- ✅ **Compliant**: You manually curate posts
- ✅ **Ethical**: Processing your own saved content
- ✅ **Valuable**: AI extracts insights
- ✅ **Low-risk**: Minimal automation

---

Built for personal knowledge management 📚
