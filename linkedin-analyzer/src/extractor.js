#!/usr/bin/env node
import { chromium } from 'playwright';
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

class LinkedInSavedPostsExtractor {
  constructor(liAtCookie, options = {}) {
    this.liAtCookie = liAtCookie;
    this.options = { ...config.extraction, ...options };
    this.browser = null;
    this.page = null;
    this.extractedPosts = [];
    this.debug = options.debug || process.argv.includes('--debug');
    this.outputDir = path.join(__dirname, '../output');
  }

  log(prefix, message, data = null) {
    console.log(`[${prefix}] ${message}${data ? ': ' + JSON.stringify(data) : ''}`);
  }

  debug_log(prefix, message, data = null) {
    if (this.debug) {
      console.log(`[DEBUG] [${prefix}] ${message}${data ? ': ' + JSON.stringify(data) : ''}`);
    }
  }

  async initialize() {
    console.log('[INIT] Launching browser...');

    // Validate cookie before proceeding
    if (!this.liAtCookie || this.liAtCookie.trim().length === 0) {
      throw new Error('li_at cookie is empty or undefined');
    }

    if (this.liAtCookie.length < 50) {
      console.warn('[INIT] Warning: li_at cookie seems too short (may be invalid)');
    }

    const launchOptions = {
      headless: this.options.headless,
      slowMo: this.options.slowMo,
      args: ['--disable-blink-features=AutomationControlled', '--no-sandbox']
    };

    if (process.env.PROXY_URL) {
      launchOptions.proxy = { server: process.env.PROXY_URL };
    }

    this.browser = await chromium.launch(launchOptions);
    const context = await this.browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      locale: 'en-US',
    });

    await context.addCookies([{
      name: 'li_at',
      value: this.liAtCookie,
      domain: '.linkedin.com',
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'None'
    }]);

    this.page = await context.newPage();
    console.log('[INIT] Browser ready with authenticated session');
  }

  async navigateToSavedPosts() {
    console.log('[NAV] Navigating to saved posts...');
    console.log(`[NAV] Using timeout: ${this.options.timeout}ms`);

    if (this.debug) {
      this.debug_log('NAV', 'Debug mode enabled - capturing detailed navigation info');
    }

    let retries = 0;
    const maxRetries = 3;

    while (retries < maxRetries) {
      try {
        await this.page.goto('https://www.linkedin.com/my-items/saved-posts/', {
          waitUntil: 'domcontentloaded',
          timeout: this.options.timeout
        });

        const url = this.page.url();
        const title = await this.page.title();
        console.log(`[NAV] Current URL: ${url}`);
        this.debug_log('NAV', 'Page title', title);

        // Check for authentication redirects
        if (url.includes('/login') || url.includes('/challenge')) {
          throw new Error('Authentication failed - redirected to login. Your li_at cookie may be expired or invalid.');
        }

        // Verify we're on the correct page
        if (!url.includes('/my-items/saved-posts') && !url.includes('saved-posts')) {
          console.warn(`[NAV] Unexpected URL: ${url}. This may indicate authentication issues.`);
        }

        console.log('[NAV] Successfully navigated to saved posts');
        return;
      } catch (error) {
        retries++;
        console.warn(`[NAV] Navigation attempt ${retries}/${maxRetries} failed: ${error.message}`);

        if (retries < maxRetries) {
          const delay = Math.pow(2, retries) * 1000; // Exponential backoff: 2s, 4s, 8s
          console.log(`[NAV] Retrying in ${delay}ms...`);
          await this.page.waitForTimeout(delay);
        } else {
          throw error;
        }
      }
    }
  }

  async extractVisiblePosts() {
    try {
      const selectors = ['[data-reusable-urn]', '.reusable-search__result-container'];
      this.debug_log('EXTRACT', 'Trying selectors', selectors);

      // Wait for content to load with timeout
      try {
        await this.page.waitForSelector('[data-reusable-urn], .reusable-search__result-container, .feed-identity-module', {
          timeout: 5000
        });
        this.debug_log('EXTRACT', 'Selectors found on page');
      } catch (e) {
        this.debug_log('EXTRACT', 'Timeout waiting for post selectors');
      }

      // Try to get element count before evaluation
      const elementCounts = await this.page.evaluate(() => {
        return {
          savedPostItems: document.querySelectorAll('li.WxXwivYqJUmxxchkWDqWtLfOceylXoTEQywA').length,
          chameleonResults: document.querySelectorAll('[data-chameleon-result-urn]').length,
          contentSummaries: document.querySelectorAll('p.entity-result__content-summary').length,
          artilleryContainers: document.querySelectorAll('.artdeco-card').length,
        };
      });

      this.debug_log('EXTRACT', 'Element counts on page', elementCounts);

      if (elementCounts.savedPostItems === 0 && elementCounts.chameleonResults === 0) {
        this.debug_log('EXTRACT', 'No posts found with current selectors, checking page structure');

        // Log page title and body class for debugging
        const pageInfo = await this.page.evaluate(() => {
          return {
            title: document.title,
            url: window.location.href,
            bodyClass: document.body.className,
            bodyHTML: document.body.innerHTML.substring(0, 500)
          };
        });
        this.debug_log('EXTRACT', 'Page info', { title: pageInfo.title, url: pageInfo.url, bodyClass: pageInfo.bodyClass });
      }

      // Use correct selector for LinkedIn's current DOM structure
      return await this.page.$$eval('li.WxXwivYqJUmxxchkWDqWtLfOceylXoTEQywA', items => {
        return items.map(item => {
          try {
            // Get URN from data-chameleon-result-urn attribute
            const chameleonDiv = item.querySelector('[data-chameleon-result-urn]');
            const urn = chameleonDiv?.getAttribute('data-chameleon-result-urn');

            // Extract author name from the specific structure
            const authorSpan = item.querySelector('span[dir="ltr"] span[aria-hidden="true"]');
            const author = authorSpan?.textContent?.trim() || 'Unknown';

            // Get post content from the summary paragraph
            const summaryEl = item.querySelector('p.entity-result__content-summary');
            const summary = summaryEl?.textContent?.trim() || '';

            // Get first line as title (up to 100 chars or first line break)
            const firstLine = summary.split('\n')[0].substring(0, 100);
            const title = firstLine || 'No title';

            // Construct LinkedIn post URL from URN
            const url = urn ? `https://www.linkedin.com/feed/update/${urn}` : null;

            // Try to find timestamp (may not always be present)
            const timeEl = item.querySelector('time');
            const savedDate = timeEl?.getAttribute('datetime') || null;

            return {
              id: urn,
              title: title,
              url: url,
              author: author,
              summary: summary,
              savedDate: savedDate,
              extractedAt: new Date().toISOString()
            };
          } catch (error) {
            console.error('Error extracting post:', error);
            return null;
          }
        }).filter(post => post && post.id);
      });
    } catch (error) {
      this.debug_log('EXTRACT', 'Error in extractVisiblePosts', error.message);
      throw error;
    }
  }

  async scrollAndExtract() {
    console.log('[EXTRACT] Starting extraction...');

    // Log page state at start
    if (this.debug) {
      const pageState = await this.page.evaluate(() => {
        return {
          documentReady: document.readyState,
          bodyHtmlLength: document.body.innerHTML.length,
          title: document.title,
          url: window.location.href
        };
      });
      this.debug_log('EXTRACT', 'Initial page state', pageState);

      // Wait for initial content load
      this.debug_log('EXTRACT', 'Waiting for content to load...');
      try {
        await this.page.waitForLoadState('networkidle', { timeout: 10000 });
        this.debug_log('EXTRACT', 'Network idle state reached');
      } catch (e) {
        this.debug_log('EXTRACT', 'Network idle timeout (may be OK for infinite scroll)', e.message);
      }

      // Take screenshot on first attempt
      try {
        await fs.mkdir(this.outputDir, { recursive: true });
        const screenshotPath = path.join(this.outputDir, 'debug-initial-page.png');
        await this.page.screenshot({ path: screenshotPath, fullPage: true });
        this.debug_log('EXTRACT', `Screenshot saved to ${screenshotPath}`);
      } catch (e) {
        this.debug_log('EXTRACT', 'Failed to save screenshot', e.message);
      }
    }

    let scrollAttempts = 0;
    let noNewContentCount = 0;
    let lastCount = 0;

    while (scrollAttempts < this.options.maxScrollAttempts && noNewContentCount < 3) {
      this.debug_log('EXTRACT', `Scroll attempt ${scrollAttempts + 1}/${this.options.maxScrollAttempts}`);

      const visiblePosts = await this.extractVisiblePosts();
      this.debug_log('EXTRACT', `Found ${visiblePosts.length} posts in this batch`);

      visiblePosts.forEach(post => {
        if (!this.extractedPosts.find(p => p.id === post.id)) {
          this.extractedPosts.push(post);
        }
      });

      const currentCount = this.extractedPosts.length;
      console.log(`[EXTRACT] Progress: ${currentCount} posts`);

      if (currentCount === lastCount) {
        noNewContentCount++;
        this.debug_log('EXTRACT', `No new posts (${noNewContentCount}/3)`);
      } else {
        noNewContentCount = 0;
      }
      lastCount = currentCount;

      // Log scroll action
      this.debug_log('EXTRACT', `Scrolling ${this.options.scrollDistance}px, waiting ${this.options.scrollDelay}ms`);

      await this.page.mouse.wheel(0, this.options.scrollDistance);
      await this.page.waitForTimeout(this.options.scrollDelay);
      scrollAttempts++;
    }

    console.log(`[EXTRACT] Complete. Total: ${this.extractedPosts.length}`);

    if (this.debug && this.extractedPosts.length === 0) {
      this.debug_log('EXTRACT', '⚠️  No posts extracted! Saving debug info...');
      try {
        const pageHtml = await this.page.content();
        const debugFile = path.join(this.outputDir, 'debug-page-html.txt');
        await fs.writeFile(debugFile, pageHtml);
        this.debug_log('EXTRACT', `Full page HTML saved to ${debugFile}`);
      } catch (e) {
        this.debug_log('EXTRACT', 'Failed to save page HTML', e.message);
      }
    }
  }

  async saveResults(outputPath) {
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = outputPath || path.join(__dirname, `../output/saved-posts-${timestamp}.json`);

    await fs.mkdir(path.dirname(filename), { recursive: true });
    await fs.writeFile(filename, JSON.stringify(this.extractedPosts, null, 2));

    console.log(`[SAVE] Saved ${this.extractedPosts.length} posts to ${filename}`);
    return filename;
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      console.log('[CLEANUP] Browser closed');
    }
  }

  async run(outputPath = null) {
    try {
      await this.initialize();
      await this.navigateToSavedPosts();
      await this.scrollAndExtract();
      const savedPath = await this.saveResults(outputPath);
      await this.close();

      return { success: true, postCount: this.extractedPosts.length, outputFile: savedPath };
    } catch (error) {
      console.error('[ERROR]', error);
      await this.close();
      return { success: false, error: error.message };
    }
  }
}

function showHelp() {
  console.log(`
🚀 LinkedIn Saved Posts Extractor

USAGE:
  node src/extractor.js [options]

OPTIONS:
  --help, -h          Show this help message
  --output, -o PATH   Specify output file path
  --debug             Enable verbose debug logging and save diagnostics

DESCRIPTION:
  Extracts your saved LinkedIn posts using browser automation.
  Requires li_at cookie to be configured in .env file.

DEBUG MODE:
  Use --debug flag to enable detailed logging:
  - Logs all selectors being tried
  - Shows element counts for each selector
  - Captures initial page screenshot
  - Saves full page HTML if no posts found
  - Displays page title and URL
  - Shows scroll attempts and post counts per batch

  Example:
    node src/extractor.js --debug
    node src/extractor.js --debug --output my-posts.json

PREREQUISITES:
  1. Run setup: npm run setup
  2. Or manually set LINKEDIN_LI_AT_COOKIE in .env

HOW TO GET li_at COOKIE:
  1. Login to LinkedIn in your browser
  2. Open DevTools (F12 or right-click → Inspect)
  3. Go to Application tab → Cookies → https://www.linkedin.com
  4. Find and copy the "li_at" cookie value
  5. Add to .env: LINKEDIN_LI_AT_COOKIE=your-cookie-here

EXAMPLES:
  node src/extractor.js
  node src/extractor.js --output my-posts.json
  node src/extractor.js --debug
  npm run extract

TROUBLESHOOTING:
  If getting 0 posts:
    1. Try: node src/extractor.js --debug
    2. Check output/ directory for debug-*.png and debug-*.txt files
    3. Review debug logs for selector information
    4. Verify LinkedIn page structure hasn't changed

NEXT STEPS:
  After extraction, run:
    npm run analyze    # Analyze posts with AI
    npm run report     # Generate markdown report
    npm run pipeline   # Run all steps at once
`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    process.exit(0);
  }

  const outputIndex = args.findIndex(arg => arg === '--output' || arg === '-o');
  const outputPath = outputIndex !== -1 ? args[outputIndex + 1] : null;

  const debugMode = args.includes('--debug');

  const liAtCookie = process.env.LINKEDIN_LI_AT_COOKIE;

  if (!liAtCookie) {
    console.error('❌ Error: LINKEDIN_LI_AT_COOKIE not found in .env file\n');
    console.error('To fix this:');
    console.error('  1. Run: npm run setup');
    console.error('  2. Or manually add LINKEDIN_LI_AT_COOKIE to .env\n');
    console.error('For detailed instructions, run: node src/extractor.js --help\n');
    process.exit(1);
  }

  console.log('🚀 LinkedIn Saved Posts Extractor\n');
  if (debugMode) {
    console.log('🔍 DEBUG MODE ENABLED\n');
  }
  console.log('Starting extraction process...\n');

  const extractor = new LinkedInSavedPostsExtractor(liAtCookie, { debug: debugMode });
  const result = await extractor.run(outputPath);

  if (result.success) {
    console.log('\n' + '═'.repeat(60));
    console.log(`✅ Extraction Complete!`);
    console.log('═'.repeat(60));
    console.log(`📊 Posts extracted: ${result.postCount}`);
    console.log(`💾 Saved to: ${result.outputFile}\n`);
    console.log('Next steps:');
    console.log('  npm run analyze    # Analyze posts with Claude AI');
    console.log('  npm run report     # Generate readable report');
    console.log('  npm run pipeline   # Run full analysis pipeline\n');
  } else {
    console.error('\n' + '═'.repeat(60));
    console.error('❌ Extraction Failed');
    console.error('═'.repeat(60));
    console.error(`Error: ${result.error}\n`);

    if (result.error.includes('Authentication failed')) {
      console.error('Authentication issue detected:');
      console.error('  • Your li_at cookie may be expired or invalid');
      console.error('  • Try logging out and back into LinkedIn');
      console.error('  • Get a fresh li_at cookie and update .env');
      console.error('  • Run: npm run setup\n');
    } else if (result.error.includes('timeout')) {
      console.error('Timeout issue detected:');
      console.error('  • Check your internet connection');
      console.error('  • LinkedIn may be slow - try again later');
      console.error('  • Increase timeout in config/config.json\n');
    } else {
      console.error('Troubleshooting:');
      console.error('  • Check your internet connection');
      console.error('  • Verify .env file exists and has valid cookie');
      console.error('  • Run with --help for more information\n');
    }

    process.exit(1);
  }
}

export default LinkedInSavedPostsExtractor;
