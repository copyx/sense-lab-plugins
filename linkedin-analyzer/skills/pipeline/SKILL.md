---
description: Execute the full LinkedIn analysis pipeline (extract → analyze → report)
---

# LinkedIn Analyzer Pipeline

Execute the complete LinkedIn saved posts analysis workflow in one command.

## What it does

1. **Extract** - Scrapes your LinkedIn saved posts using Playwright
2. **Analyze** - Processes posts with Claude AI to identify themes and insights
3. **Report** - Generates a comprehensive markdown report with findings

## Prerequisites

- LinkedIn `li_at` cookie configured (run `/linkedin-analyzer:setup` if not done)
- Dependencies installed (`npm install` in plugin directory)

## Usage

From Claude Code:
```
/linkedin-analyzer:pipeline
```

Or simply say:
```
run the linkedin analyzer pipeline
analyze my linkedin posts
```

## Pipeline Steps

### Step 1: Extract Posts (2-5 minutes)
- Opens LinkedIn in headless browser
- Scrolls through saved posts to load all content
- Extracts post text, author info, and metadata
- Saves to `data/posts.json`

### Step 2: Analyze Content (1-2 minutes)
- Uses Claude Agent SDK to analyze posts
- Identifies recurring themes and patterns
- Extracts key topics and interests
- Saves insights to `data/analysis.json`

### Step 3: Generate Report (< 1 minute)
- Compiles analysis into readable format
- Creates markdown report with:
  - Executive summary
  - Theme breakdown with examples
  - Topic distribution
  - Recommendations
- Saves to `data/report.md`

## Output Files

All outputs are saved in the `data/` directory:

- `data/posts.json` - Raw extracted post data
- `data/analysis.json` - AI-generated insights
- `data/report.md` - Final human-readable report

## Error Handling

The pipeline stops at the first error and provides:
- Clear error message explaining what went wrong
- Guidance on how to fix the issue
- Next steps to retry

## Common Issues

**"Cookie not configured"**
→ Run `/linkedin-analyzer:setup` to configure your LinkedIn authentication

**"Playwright not installed"**
→ Run `npm install` in the plugin directory (browsers install automatically)

**"No saved posts found"**
→ Check that you have saved posts on LinkedIn and your cookie is valid

**"API key missing" (only in standalone mode)**
→ Either run from Claude Code (recommended) or configure API key in `.env`

## Performance

Typical execution time: **3-8 minutes** depending on:
- Number of saved posts (more posts = longer extraction)
- Network speed
- System resources

Progress updates are shown at each step so you know it's working.
