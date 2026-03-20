# LinkedIn Saved Posts Analyzer - Quick Start

## 🎯 What This Does

Extract your LinkedIn saved posts, analyze them with AI, and get actionable insights - all without needing an Anthropic API key when using Claude Code.

## 🚀 5-Minute Setup

### 1. Install Dependencies

```bash
cd linkedin-analyzer
npm install
```

(Playwright browser installs automatically during `npm install`)

### 2. Configure (Automated Setup)

```bash
npm run setup
```

When prompted:
- **Cookie method**: Choose **1** for Automated (Recommended)
- A browser will open → Log in to LinkedIn normally
- Cookie is captured automatically ✨
- **API key**: Press Enter (skip if using Claude Code)

#### Alternative: Manual Cookie Setup

If automated capture doesn't work:
1. Choose **2** for Manual method
2. Login to LinkedIn in your browser
3. Press `F12` to open DevTools
4. Go to `Application` tab → `Cookies` → `https://www.linkedin.com`
5. Find the cookie named `li_at`
6. Copy its value and paste when prompted

### 3. Run It

```bash
npm run pipeline
```

This will:
1. Extract all your saved posts from LinkedIn
2. Analyze them with Claude AI (using Agent SDK - no API key needed!)
3. Generate a beautiful markdown report

## 📊 Results

Check `output/report-YYYY-MM-DD.md` for:
- Top themes in your saved posts
- Key insights and takeaways
- Action items
- Most saved authors
- Links back to original posts

## 💡 Usage Modes

### With Claude Code (Recommended)

```bash
npm run pipeline
```

✅ No API key needed
✅ Uses your Claude Code session
✅ Zero additional cost

### Standalone CLI

```bash
npm run analyze:api
```

⚠️ Requires `ANTHROPIC_API_KEY` in `.env`
💰 ~$0.01-0.10 per analysis

## 🔧 Individual Commands

```bash
npm run extract    # Just extract posts
npm run analyze    # Just analyze (Agent SDK)
npm run report     # Just generate report
```

## 📝 Workflow Tips

**Daily**: Save 5-10 interesting posts on LinkedIn

**Weekly**: Run `npm run pipeline` on Friday

**Weekend**: Review insights and action items

## ⚠️ Troubleshooting

**"Authentication failed"**
- Your cookie expired (they last 30-90 days)
- Get a fresh cookie and run `npm run setup` again

**"No posts found"**
- Check you have saved posts at linkedin.com/my-items/saved-posts/
- Try saving a few posts first

**"Analysis failed"**
- Using Agent SDK? Make sure you're running from Claude Code
- Using API? Check your `ANTHROPIC_API_KEY` in `.env`
- Try `npm run analyze:legacy` as fallback

## 📚 More Info

- `README.md` - Complete documentation
- `USAGE.md` - Detailed usage guide
- `AGENT_SDK_INTEGRATION.md` - Technical details
- `MIGRATION.md` - Upgrading from v1.0

## 🎓 How It Works

```
You save posts manually on LinkedIn
         ↓
Playwright extracts them (automated)
         ↓
Claude AI analyzes (Agent SDK - no API key!)
         ↓
Markdown report generated
         ↓
You get actionable insights
```

**Key Benefit**: You manually curate quality content, AI extracts insights. Best of both worlds!

---

**Ready to start?** Run `npm run setup` then `npm run pipeline`
