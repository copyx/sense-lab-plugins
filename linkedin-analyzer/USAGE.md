# LinkedIn Analyzer Usage Guide

## Quick Reference

### Agent SDK Mode (Recommended)

```bash
# From Claude Code session
npm run pipeline
```

No API key required! Uses your Claude Code session automatically.

### Standalone API Mode

```bash
# Requires ANTHROPIC_API_KEY in .env
npm run analyze:api
```

## Detailed Workflows

### 1. First-Time Setup

```bash
cd linkedin-analyzer
npm install
npx playwright install chromium
npm run setup
```

The setup wizard will ask for:
1. **LinkedIn li_at cookie** (required)
2. **Anthropic API key** (optional - only for standalone mode)

### 2. Extract Posts

```bash
npm run extract
```

This will:
- Launch a browser (headless by default)
- Navigate to your saved posts
- Scroll and extract all posts
- Save to `output/saved-posts-{date}.json`

### 3. Analyze Posts

#### Option A: Agent SDK (Claude Code)

```bash
npm run analyze
```

Uses Claude Code's built-in Claude access. No API key needed.

#### Option B: Direct API

```bash
npm run analyze:api
```

Uses your API key from .env file.

#### Option C: Legacy Analyzer

```bash
npm run analyze:legacy
```

Uses the old v1.0 analyzer (API key required).

### 4. Generate Report

```bash
npm run report
```

Creates a human-readable markdown report in `output/report-{date}.md`.

### 5. Full Pipeline

```bash
npm run pipeline
```

Runs all three steps: extract → analyze → report

## Advanced Usage

### Custom Input File

```bash
node src/agent-analyzer.js --input output/saved-posts-2024-01-15.json
```

### Explicit Mode Selection

```bash
# Force Agent SDK mode
node src/agent-analyzer.js --agent-sdk

# Force API mode
node src/agent-analyzer.js --api-key
```

### Headless vs. Headed Browser

Edit `config/config.json`:

```json
{
  "extraction": {
    "headless": false  // Shows browser window
  }
}
```

### Adjust Scroll Behavior

```json
{
  "extraction": {
    "maxScrollAttempts": 200,  // Scroll more times
    "scrollDelay": 2000        // Wait longer between scrolls
  }
}
```

## Integration with Claude Code

### As a Plugin

Register in `.claude/settings.json`:

```json
{
  "plugins": {
    "linkedin-analyzer": "/path/to/linkedin-analyzer"
  }
}
```

### From Claude Chat

Once registered, you can say:

```
"Analyze my LinkedIn posts from output/saved-posts-2024-01-15.json"
```

Claude will automatically use the linkedin-analyzer agent.

## Output Files

### extracted Posts

**Location:** `output/saved-posts-{date}.json`

**Format:**
```json
[
  {
    "title": "How to build scalable systems",
    "author": "John Doe",
    "summary": "Post content...",
    "url": "https://linkedin.com/posts/...",
    "savedDate": "2024-01-15T10:30:00Z",
    "engagement": {
      "likes": 150,
      "comments": 25
    }
  }
]
```

### Analysis

**Location:** `output/analysis-{date}.json`

**Format:**
```json
{
  "metadata": {
    "analyzedAt": "2024-01-15T12:00:00Z",
    "postCount": 42,
    "mode": "agent-sdk"
  },
  "topics": {
    "themes": [
      {
        "name": "System Design",
        "postCount": 12,
        "description": "...",
        "keyInsights": ["..."]
      }
    ],
    "trends": {
      "emerging": ["AI/ML", "Cloud"],
      "declining": ["Monoliths"]
    }
  },
  "insights": {
    "keyInsights": [...],
    "actionItems": [...],
    "exploreFurther": [...]
  },
  "authors": {
    "topAuthors": [
      {"author": "John Doe", "postCount": 5}
    ],
    "totalAuthors": 28
  }
}
```

### Report

**Location:** `output/report-{date}.md`

Human-readable markdown with:
- Executive summary
- Top themes and insights
- Action items
- Top authors
- Links to original posts

## Troubleshooting

### "No posts extracted"

1. Check you have saved posts at linkedin.com/my-items/saved-posts/
2. Verify your li_at cookie is valid (login to LinkedIn)
3. Try with headless: false to see what's happening

### "Authentication failed"

Your li_at cookie expired. Get a new one:
1. Login to LinkedIn
2. F12 → Application → Cookies → linkedin.com
3. Copy li_at value
4. Run `npm run setup` again

### "Analysis failed" (Agent SDK)

1. Ensure you're running from Claude Code session
2. Try API mode: `npm run analyze:api`
3. Check network connectivity

### "Analysis failed" (API mode)

1. Verify ANTHROPIC_API_KEY in .env
2. Check API credits at console.anthropic.com
3. Test with: `curl https://api.anthropic.com/v1/messages -H "x-api-key: $ANTHROPIC_API_KEY"`

### "Module not found"

```bash
npm install
npx playwright install chromium
```

## Best Practices

### Frequency

Run extraction **weekly** to avoid rate limiting:
```bash
# Monday morning routine
npm run pipeline
```

### Cookie Management

Cookies expire in 30-90 days. Set a calendar reminder to refresh.

### Cost Management (API Mode)

- Use Agent SDK mode when possible (free)
- API mode costs ~$0.01-0.10 per analysis
- Monitor usage at console.anthropic.com

### Privacy

- Run locally (don't deploy to servers)
- Never commit .env file
- Use on your own saved posts only

## Performance

### Extraction Speed

- ~100 posts: 2-5 minutes
- ~500 posts: 10-15 minutes
- Depends on scroll speed and network

### Analysis Speed

- Agent SDK: 10-30 seconds
- API mode: 10-30 seconds
- Parallel processing for 3 analysis steps

## Examples

### Weekly Knowledge Review

```bash
#!/bin/bash
# weekly-review.sh

cd ~/linkedin-analyzer
echo "Starting weekly LinkedIn review..."

npm run pipeline

# Open report in browser
open "output/report-$(date +%Y-%m-%d).md"

echo "Review complete!"
```

### Incremental Updates

```bash
# Only extract new posts since last run
# (requires incremental.enabled: true in config)
npm run extract
npm run analyze
npm run report
```

### Custom Analysis

```javascript
// custom-analysis.js
import AgentLinkedInAnalyzer from './src/agent-analyzer.js';

const analyzer = new AgentLinkedInAnalyzer({ useAgentSDK: true });
const result = await analyzer.run('output/saved-posts-2024-01-15.json');

console.log(`Found ${result.analysis.topics.themes.length} themes`);
console.log(`Top theme: ${result.analysis.topics.themes[0].name}`);
```

## Migration from v1.0

See [MIGRATION.md](./MIGRATION.md) for detailed migration guide.

## Support

For issues, questions, or feature requests:
1. Check this guide and README.md
2. Review troubleshooting section
3. Open an issue on GitHub
