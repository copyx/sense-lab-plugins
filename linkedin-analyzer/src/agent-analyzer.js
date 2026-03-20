#!/usr/bin/env node
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const config = JSON.parse(
  await fs.readFile(path.join(__dirname, '../config/config.json'), 'utf-8')
);

class AgentLinkedInAnalyzer {
  constructor(options = {}) {
    // Agent SDK mode (uses Claude Code session) or API key mode
    this.useAgentSDK = options.useAgentSDK ?? true;
    this.apiKey = options.apiKey || process.env.ANTHROPIC_API_KEY;
    this.config = config.analysis;
  }

  async analyzeTopics(posts) {
    console.log('[ANALYZE] Step 1/3: Analyzing topics and themes...');

    const postSummaries = posts.map((p, i) =>
      `${i + 1}. [${p.author}] ${p.title}\n   ${p.summary}`
    ).join('\n\n');

    const prompt = `Analyze these LinkedIn saved posts and identify main themes.

Posts:
${postSummaries.slice(0, 5000)}

Provide JSON:
{
  "themes": [{"name": "Theme", "postCount": 10, "description": "...", "keyInsights": ["..."]}],
  "trends": {"emerging": ["..."], "declining": ["..."]}
}`;

    const response = await this.callClaude(prompt);
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : { themes: [], trends: {} };
  }

  async extractKeyInsights(posts) {
    console.log('[ANALYZE] Step 2/3: Extracting key insights...');

    const topPosts = posts.slice(0, 15);
    const postSummaries = topPosts.map((p, i) =>
      `${i + 1}. [${p.author}] ${p.title}\n   ${p.summary}`
    ).join('\n\n');

    const prompt = `Extract valuable insights from these posts.

Posts:
${postSummaries}

Provide JSON:
{
  "keyInsights": [{"insight": "...", "source": "Author", "postIndex": 1}],
  "actionItems": ["..."],
  "exploreFurther": ["..."]
}`;

    const response = await this.callClaude(prompt);
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : { keyInsights: [], actionItems: [] };
  }

  async analyzeAuthors(posts) {
    console.log('[ANALYZE] Step 3/3: Analyzing author patterns...');

    const authorCounts = {};
    posts.forEach(post => {
      authorCounts[post.author] = (authorCounts[post.author] || 0) + 1;
    });

    const topAuthors = Object.entries(authorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([author, count]) => ({ author, postCount: count }));

    return { topAuthors, totalAuthors: Object.keys(authorCounts).length };
  }

  async callClaude(prompt) {
    if (this.useAgentSDK) {
      // Agent SDK mode - uses Claude Code session
      try {
        const { unstable_v2_prompt } = await import('@anthropic-ai/claude-agent-sdk');

        const result = await unstable_v2_prompt(prompt, {
          model: this.config.model,
          maxTokens: this.config.maxTokens,
          temperature: this.config.temperature
        });

        return result.result || '';
      } catch (sdkError) {
        // Fallback: try older query API
        try {
          const { query } = await import('@anthropic-ai/claude-agent-sdk');

          let responseText = '';
          const q = query({
            prompt,
            options: {
              model: this.config.model,
              maxTokens: this.config.maxTokens,
              temperature: this.config.temperature
            }
          });

          for await (const msg of q) {
            if (msg.type === 'result') {
              responseText = msg.result;
            }
          }

          return responseText;
        } catch (fallbackError) {
          console.warn('Agent SDK not available, falling back to API mode');
          this.useAgentSDK = false;
          return this.callClaude(prompt);
        }
      }
    } else {
      // Fallback to direct API mode
      const { default: Anthropic } = await import('@anthropic-ai/sdk');
      const client = new Anthropic({ apiKey: this.apiKey });

      const message = await client.messages.create({
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        messages: [{ role: 'user', content: prompt }]
      });

      return message.content[0].text;
    }
  }

  async run(inputFile) {
    console.log('🔍 LinkedIn Post Analyzer (Agent SDK Mode)\n');

    const postsData = JSON.parse(await fs.readFile(inputFile, 'utf-8'));
    console.log(`📊 Loaded ${postsData.length} posts`);

    if (postsData.length === 0) {
      console.warn('⚠️  No posts to analyze');
      return null;
    }

    const [topics, insights, authors] = await Promise.all([
      this.analyzeTopics(postsData),
      this.extractKeyInsights(postsData),
      this.analyzeAuthors(postsData)
    ]);

    const analysis = {
      metadata: {
        analyzedAt: new Date().toISOString(),
        postCount: postsData.length,
        mode: this.useAgentSDK ? 'agent-sdk' : 'api-key'
      },
      topics,
      insights,
      authors
    };

    const timestamp = new Date().toISOString().split('T')[0];
    const outputPath = path.join(__dirname, `../output/analysis-${timestamp}.json`);
    await fs.writeFile(outputPath, JSON.stringify(analysis, null, 2));

    console.log(`\n✅ Analysis complete!`);
    console.log(`💾 Saved to: ${outputPath}`);
    return { analysis, outputPath };
  }
}

function showHelp() {
  console.log(`
🔍 LinkedIn Post Analyzer (Agent SDK)

USAGE:
  node src/agent-analyzer.js [options] [input-file]

OPTIONS:
  --help, -h          Show this help message
  --input, -i FILE    Specify input JSON file (optional)
  --api-key           Use API key mode instead of Agent SDK
  --agent-sdk         Use Agent SDK mode (default)

DESCRIPTION:
  Analyzes extracted LinkedIn posts using Claude Agent SDK to identify:
    • Main themes and topics
    • Key insights and takeaways
    • Author patterns and trends
    • Actionable recommendations

MODES:
  1. Agent SDK (default): Uses Claude Code's built-in Claude access
     - No API key required
     - Works within Claude Code sessions
     - Recommended for plugin usage

  2. API Key (fallback): Uses direct Anthropic API
     - Requires ANTHROPIC_API_KEY in .env
     - For standalone CLI usage
     - Get key from: https://console.anthropic.com/

PREREQUISITES:
  1. Extract posts first: npm run extract
  2. For API mode: Set ANTHROPIC_API_KEY in .env

EXAMPLES:
  node src/agent-analyzer.js                    # Agent SDK mode
  node src/agent-analyzer.js --agent-sdk        # Explicit Agent SDK
  node src/agent-analyzer.js --api-key          # API key mode
  node src/agent-analyzer.js -i output/saved-posts-2024-01-15.json
  npm run analyze

NEXT STEPS:
  After analysis, run:
    npm run report     # Generate markdown report
    npm run pipeline   # Run full pipeline
`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    process.exit(0);
  }

  // Determine mode
  const useAgentSDK = !args.includes('--api-key');
  const options = { useAgentSDK };

  // Check API key for API mode
  if (!useAgentSDK) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error('❌ Error: ANTHROPIC_API_KEY not found in .env file\n');
      console.error('To fix this:');
      console.error('  1. Get API key from: https://console.anthropic.com/');
      console.error('  2. Run: npm run setup');
      console.error('  3. Or manually add to .env: ANTHROPIC_API_KEY=your-key-here\n');
      console.error('For more info, run: node src/agent-analyzer.js --help\n');
      process.exit(1);
    }
    options.apiKey = apiKey;
  } else {
    console.log('🤖 Using Agent SDK mode (Claude Code session)\n');
  }

  const inputIndex = args.findIndex(arg => arg === '--input' || arg === '-i');
  let inputPath;

  if (inputIndex !== -1 && args[inputIndex + 1]) {
    inputPath = path.resolve(args[inputIndex + 1]);
    try {
      await fs.access(inputPath);
    } catch {
      console.error(`❌ Error: File not found: ${inputPath}\n`);
      console.error('Make sure the file path is correct.');
      console.error('Run with --help for usage examples.\n');
      process.exit(1);
    }
  } else {
    const outputDir = path.join(__dirname, '../output');
    try {
      const files = await fs.readdir(outputDir);
      // Exclude sample files and get only real extractions
      const extractionFiles = files.filter(f =>
        f.startsWith('saved-posts-') &&
        !f.includes('sample') &&
        f.endsWith('.json')
      );

      if (extractionFiles.length === 0) {
        console.error('❌ No extraction files found in output/ directory\n');
        console.error('To fix this:');
        console.error('  1. First extract posts: npm run extract');
        console.error('  2. Then run analysis: npm run analyze\n');
        console.error('Or use full pipeline: npm run pipeline\n');
        process.exit(1);
      }

      // Sort by date in filename (YYYY-MM-DD format) to get latest
      const latestFile = extractionFiles
        .sort((a, b) => {
          // Extract date from filename: saved-posts-YYYY-MM-DD.json
          const dateA = a.match(/\d{4}-\d{2}-\d{2}/)?.[0] || '';
          const dateB = b.match(/\d{4}-\d{2}-\d{2}/)?.[0] || '';
          return dateB.localeCompare(dateA); // Descending order
        })[0];

      inputPath = path.join(outputDir, latestFile);
      console.log(`📂 Using latest extraction: ${latestFile}\n`);
    } catch (error) {
      console.error('❌ Error: output/ directory not found or not readable\n');
      console.error('Run: npm run extract\n');
      process.exit(1);
    }
  }

  console.log('🔍 Starting AI Analysis...\n');
  console.log('This will analyze your posts using Claude AI.');
  console.log('Expected duration: 10-30 seconds depending on post count.\n');

  const analyzer = new AgentLinkedInAnalyzer(options);
  const result = await analyzer.run(inputPath);

  if (result) {
    console.log('\n' + '═'.repeat(60));
    console.log('✅ Analysis Complete!');
    console.log('═'.repeat(60));
    console.log(`📊 Posts analyzed: ${result.analysis.metadata.postCount}`);
    console.log(`🤖 Mode: ${result.analysis.metadata.mode}`);
    console.log(`💾 Results saved to: ${result.outputPath}\n`);
    console.log('Next steps:');
    console.log('  npm run report     # Generate human-readable markdown report');
    console.log('  cat ' + result.outputPath + '  # View raw JSON analysis\n');
  } else {
    console.error('\n❌ Analysis failed\n');
    console.error('Possible issues:');
    console.error('  • Network connection issues');
    console.error('  • Input file may be corrupted\n');
    process.exit(1);
  }
}

export default AgentLinkedInAnalyzer;
