---
name: linkedin-analyzer
description: Analyze LinkedIn saved posts with Claude Agent SDK
model: claude-3-5-sonnet-20241022
---

# LinkedIn Saved Posts Analyzer Agent

Analyzes LinkedIn saved posts using Claude's Agent SDK to identify themes, insights, and trends.

## Usage

From Claude Code:

```
Analyze my LinkedIn posts from output/saved-posts-2024-01-15.json
```

The agent will:
1. Load the extracted posts JSON
2. Analyze topics and themes
3. Extract key insights and action items
4. Identify top authors and patterns
5. Generate structured analysis JSON

## Input Format

Expects JSON file with array of posts:

```json
[
  {
    "title": "Post title",
    "author": "Author Name",
    "summary": "Post content...",
    "url": "https://...",
    "savedDate": "2024-01-15"
  }
]
```

## Output

Generates `output/analysis-{date}.json` with:
- **Themes**: Main topics with descriptions and insights
- **Insights**: Key takeaways and action items
- **Authors**: Top content creators and patterns
- **Trends**: Emerging and declining topics

## Prerequisites

1. Run extraction first: `npm run extract`
2. Ensure posts JSON exists in `output/` directory

## No API Key Required

This agent uses Claude Code's built-in Claude access via Agent SDK.
No separate Anthropic API key needed.
