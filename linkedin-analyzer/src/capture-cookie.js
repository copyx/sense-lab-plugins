#!/usr/bin/env node
import { chromium } from 'playwright';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🍪 LinkedIn Cookie Capture Tool\n');
console.log('═'.repeat(60));
console.log('\nThis tool will:');
console.log('  1. Open LinkedIn login page in a browser');
console.log('  2. Wait for you to log in manually');
console.log('  3. Automatically capture your li_at cookie');
console.log('  4. Save it to your .env file\n');
console.log('⏳ Please wait while the browser launches...\n');

let browser = null;
let context = null;

try {
  // Launch browser in headed mode so user can log in
  browser = await chromium.launch({
    headless: false,
    args: ['--start-maximized']
  });

  context = await browser.newContext({
    viewport: null,
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });

  const page = await context.newPage();

  console.log('✅ Browser opened successfully\n');
  console.log('📋 Instructions:');
  console.log('  1. Log in to LinkedIn in the browser window');
  console.log('  2. Complete any 2FA/verification if prompted');
  console.log('  3. Wait until you see your LinkedIn feed');
  console.log('  4. The script will automatically detect login and capture the cookie\n');
  console.log('⏳ Navigating to LinkedIn login page...\n');

  // Navigate to LinkedIn login
  await page.goto('https://www.linkedin.com/login', {
    waitUntil: 'domcontentloaded',
    timeout: 30000
  });

  console.log('✅ Login page loaded\n');
  console.log('👉 Please log in now...\n');

  // Wait for successful login by monitoring URL changes
  // LinkedIn redirects to /feed after successful login
  const loginTimeout = 5 * 60 * 1000; // 5 minutes
  const startTime = Date.now();

  while (true) {
    const currentUrl = page.url();

    // Check if user has successfully logged in
    if (currentUrl.includes('/feed') ||
        currentUrl.includes('/mynetwork') ||
        currentUrl.includes('/jobs') ||
        (currentUrl === 'https://www.linkedin.com/' && !currentUrl.includes('/login'))) {
      console.log('✅ Login detected!\n');
      break;
    }

    // Check timeout
    if (Date.now() - startTime > loginTimeout) {
      throw new Error('Login timeout. Please try again and complete login within 5 minutes.');
    }

    // Wait a bit before checking again
    await page.waitForTimeout(1000);
  }

  console.log('🔍 Extracting li_at cookie...\n');

  // Get all cookies
  const cookies = await context.cookies();

  // Find the li_at cookie
  const liAtCookie = cookies.find(cookie => cookie.name === 'li_at');

  if (!liAtCookie || !liAtCookie.value) {
    throw new Error('Could not find li_at cookie. Please try the manual method instead.');
  }

  console.log('✅ Cookie captured successfully!\n');
  console.log(`Cookie value: ${liAtCookie.value.substring(0, 20)}...${liAtCookie.value.substring(liAtCookie.value.length - 10)}\n`);

  // Close browser
  await browser.close();
  browser = null;

  console.log('💾 Saving to .env file...\n');

  // Read existing .env if it exists
  const envPath = path.join(__dirname, '../.env');
  let existingEnv = '';
  let anthropicKey = '';

  try {
    existingEnv = await fs.readFile(envPath, 'utf8');

    // Extract existing ANTHROPIC_API_KEY if present
    const apiKeyMatch = existingEnv.match(/^ANTHROPIC_API_KEY=(.+)$/m);
    if (apiKeyMatch && apiKeyMatch[1] && !apiKeyMatch[1].startsWith('#')) {
      anthropicKey = apiKeyMatch[1].trim();
    }
  } catch (error) {
    // .env doesn't exist yet, that's fine
  }

  // Create new .env content
  const envContent = `# LinkedIn Authentication
# This cookie authenticates you with LinkedIn
# Keep it secret! It's like your password.
LINKEDIN_LI_AT_COOKIE=${liAtCookie.value}

# Anthropic Claude API (OPTIONAL)
# The analyzer uses Claude Agent SDK by default (no API key needed)
# Only needed for standalone API mode with --api-key flag
# Get yours at: https://console.anthropic.com/
${anthropicKey ? `ANTHROPIC_API_KEY=${anthropicKey}` : '# ANTHROPIC_API_KEY=your_api_key_here'}
`;

  await fs.writeFile(envPath, envContent);

  console.log('═'.repeat(60));
  console.log('✅ Cookie Capture Complete!');
  console.log('═'.repeat(60));
  console.log('\n📝 Cookie saved to .env file\n');
  console.log('🎉 You\'re all set! Next steps:\n');
  console.log('  1. Run the full pipeline:');
  console.log('     npm run pipeline\n');
  console.log('  2. Or run steps individually:');
  console.log('     npm run extract    # Extract your saved posts');
  console.log('     npm run analyze    # Analyze with AI');
  console.log('     npm run report     # Generate markdown report\n');

  process.exit(0);

} catch (error) {
  console.error('\n❌ Cookie Capture Failed\n');
  console.error('═'.repeat(60));
  console.error(`\nError: ${error.message}\n`);

  console.error('Troubleshooting:\n');

  if (error.message.includes('timeout') || error.message.includes('Timeout')) {
    console.error('  • The login took too long (>5 minutes)');
    console.error('  • Try running the script again');
    console.error('  • Have your credentials ready before starting\n');
  } else if (error.message.includes('browser') || error.message.includes('launch')) {
    console.error('  • Playwright browser may not be installed');
    console.error('  • Run: npm install');
    console.error('  • Or: npx playwright install chromium --with-deps\n');
  } else if (error.message.includes('li_at cookie')) {
    console.error('  • Cookie was not found after login');
    console.error('  • This is unusual - please try manual method\n');
  } else {
    console.error('  • An unexpected error occurred');
    console.error('  • Try the manual cookie capture method instead\n');
  }

  console.error('📖 Manual Method:\n');
  console.error('  Run: npm run setup');
  console.error('  Choose the manual option when prompted\n');

  // Clean up browser if still open
  if (browser) {
    try {
      await browser.close();
    } catch (e) {
      // Ignore cleanup errors
    }
  }

  process.exit(1);
}
