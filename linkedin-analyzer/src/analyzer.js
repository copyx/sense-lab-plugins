#!/usr/bin/env node
import Anthropic from '@anthropic-ai/sdk';
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

class LinkedInPostAnalyzer {
  constructor(apiKey) {
    this.client = new Anthropic({ apiKey });
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

    const message = await this.client.messages.create({
      model: this.config.model,
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature,
      messages: [{ role: 'user', content: prompt }]
    });

    const response = message.content[0].text;
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

    const message = await this.client.messages.create({
      model: this.config.model,
      max_tokens: this.config.maxTokens,
      messages: [{ role: 'user', content: prompt }]
    });

    const response = message.content[0].text;
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

  async run(inputFile) {
    console.log('🔍 LinkedIn Post Analyzer\n');

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
      metadata: { analyzedAt: new Date().toISOString(), postCount: postsData.length },
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
🔍 LinkedIn Post Analyzer

USAGE:
  node src/analyzer.js [options] [input-file]

OPTIONS:
  --help, -h          Show this help message
  --input, -i FILE    Specify input JSON file (optional)

DESCRIPTION:
  Analyzes extracted LinkedIn posts using Claude AI to identify:
    • Main themes and topics
    • Key insights and takeaways
    • Author patterns and trends
    • Actionable recommendations

PREREQUISITES:
  1. Extract posts first: npm run extract
  2. Set ANTHROPIC_API_KEY in .env
  3. Get API key from: https://console.anthropic.com/

EXAMPLES:
  node src/analyzer.js
  node src/analyzer.js --input output/saved-posts-2024-01-15.json
  npm run analyze

NEXT STEPS:
  After analysis, run:
    npm run report     # Generate markdown report
    npm run pipeline   # Run full pipeline

API COSTS:
  Analysis uses Claude Sonnet (cost-effective for summaries).
  Typical cost: ~$0.01-0.10 per analysis depending on post count.
`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    process.exit(0);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('❌ Error: ANTHROPIC_API_KEY not found in .env file\n');
    console.error('To fix this:');
    console.error('  1. Get API key from: https://console.anthropic.com/');
    console.error('  2. Run: npm run setup');
    console.error('  3. Or manually add to .env: ANTHROPIC_API_KEY=your-key-here\n');
    console.error('For more info, run: node src/analyzer.js --help\n');
    process.exit(1);
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
      const extractionFiles = files.filter(f => f.startsWith('saved-posts-'));

      if (extractionFiles.length === 0) {
        console.error('❌ No extraction files found in output/ directory\n');
        console.error('To fix this:');
        console.error('  1. First extract posts: npm run extract');
        console.error('  2. Then run analysis: npm run analyze\n');
        console.error('Or use full pipeline: npm run pipeline\n');
        process.exit(1);
      }

      const latestFile = extractionFiles.sort().reverse()[0];
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

  const analyzer = new LinkedInPostAnalyzer(apiKey);
  const result = await analyzer.run(inputPath);

  if (result) {
    console.log('\n' + '═'.repeat(60));
    console.log('✅ Analysis Complete!');
    console.log('═'.repeat(60));
    console.log(`📊 Posts analyzed: ${result.analysis.metadata.postCount}`);
    console.log(`💾 Results saved to: ${result.outputPath}\n`);
    console.log('Next steps:');
    console.log('  npm run report     # Generate human-readable markdown report');
    console.log('  cat ' + result.outputPath + '  # View raw JSON analysis\n');
  } else {
    console.error('\n❌ Analysis failed\n');
    console.error('Possible issues:');
    console.error('  • API key may be invalid or expired');
    console.error('  • Network connection issues');
    console.error('  • Input file may be corrupted\n');
    process.exit(1);
  }
}

export default LinkedInPostAnalyzer;
