#!/usr/bin/env node
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function showHelp() {
  console.log(`
🔧 LinkedIn Saved Posts Analyzer - Setup

USAGE:
  node src/setup.js [options]

OPTIONS:
  --help, -h          Show this help message
  --skip-validation   Skip validation of entered credentials

DESCRIPTION:
  Interactive setup wizard to configure the LinkedIn Analyzer.
  Guides you through obtaining and setting up:
    • LinkedIn li_at cookie (for authentication)
    • Anthropic API key (OPTIONAL - for standalone mode only)

WHAT YOU'LL NEED:
  1. Active LinkedIn account
  2. (Optional) Anthropic API account for standalone CLI mode
     When used with Claude Code, NO API key needed!
     Sign up at: https://console.anthropic.com/

EXAMPLES:
  node src/setup.js
  npm run setup

MANUAL SETUP:
  If you prefer manual setup, create a .env file with:
    LINKEDIN_LI_AT_COOKIE=your-cookie-here
    # ANTHROPIC_API_KEY=your-api-key-here (optional)

AGENT SDK MODE (Recommended):
  When using with Claude Code, the analyzer automatically uses
  Agent SDK - no API key configuration needed!

SECURITY NOTE:
  Your .env file is gitignored and stays local.
  Never commit or share these credentials.
`);
}

const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  showHelp();
  process.exit(0);
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise(resolve => rl.question(prompt, resolve));
}

console.log('🔧 LinkedIn Saved Posts Analyzer - Setup Wizard\n');
console.log('═'.repeat(60));
console.log('\nThis wizard will help you configure the analyzer.\n');

console.log('Step 1 of 2: LinkedIn Authentication');
console.log('─'.repeat(60));
console.log('\nYou need your LinkedIn li_at cookie for authentication.\n');
console.log('How would you like to get your cookie?\n');
console.log('  1. Automated (Recommended) - We open a browser, you log in, we capture the cookie');
console.log('  2. Manual - You copy the cookie from DevTools yourself\n');

const cookieMethod = await question('Choose method (1 or 2) [default: 1]: ');

let liAtCookie = '';

if (cookieMethod.trim() === '2') {
  // Manual method
  console.log('\nManual Cookie Capture:');
  console.log('─'.repeat(60));
  console.log('How to get your li_at cookie:');
  console.log('  1. Open LinkedIn in your browser and log in');
  console.log('  2. Press F12 (or right-click → Inspect) to open DevTools');
  console.log('  3. Go to the "Application" tab (Chrome) or "Storage" tab (Firefox)');
  console.log('  4. In the left sidebar, expand "Cookies"');
  console.log('  5. Click on "https://www.linkedin.com"');
  console.log('  6. Find the cookie named "li_at"');
  console.log('  7. Copy its entire value\n');
  console.log('Security note: This cookie is like your password - keep it private!\n');

  liAtCookie = await question('Paste your li_at cookie value: ');
} else {
  // Automated method (default)
  console.log('\n🤖 Starting Automated Cookie Capture...\n');
  console.log('A browser window will open. Please log in to LinkedIn.');
  console.log('The cookie will be captured automatically after login.\n');

  const confirm = await question('Ready to proceed? (yes/no) [default: yes]: ');

  if (confirm.toLowerCase() === 'no') {
    console.log('\nSetup cancelled. Run again when ready.\n');
    rl.close();
    process.exit(0);
  }

  rl.close();

  // Import and run capture-cookie dynamically
  try {
    const { spawn } = await import('child_process');
    const captureProcess = spawn('node', [path.join(__dirname, 'capture-cookie.js')], {
      stdio: 'inherit'
    });

    const exitCode = await new Promise((resolve) => {
      captureProcess.on('close', resolve);
    });

    if (exitCode !== 0) {
      console.error('\n❌ Automated capture failed. Falling back to manual method.\n');
      process.exit(1);
    }

    // If automated capture succeeded, we're done - the cookie is already saved
    console.log('\n✅ Setup complete! Cookie captured and saved.\n');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error running automated capture:\n');
    console.error(`   ${error.message}\n`);
    console.error('Falling back to manual method...\n');

    // Reopen readline for manual fallback
    const rl2 = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    function question2(prompt) {
      return new Promise(resolve => rl2.question(prompt, resolve));
    }

    console.log('How to get your li_at cookie manually:');
    console.log('  1. Open LinkedIn in your browser and log in');
    console.log('  2. Press F12 (or right-click → Inspect) to open DevTools');
    console.log('  3. Go to the "Application" tab (Chrome) or "Storage" tab (Firefox)');
    console.log('  4. In the left sidebar, expand "Cookies"');
    console.log('  5. Click on "https://www.linkedin.com"');
    console.log('  6. Find the cookie named "li_at"');
    console.log('  7. Copy its entire value\n');

    liAtCookie = await question2('Paste your li_at cookie value: ');
    rl2.close();
  }
}

if (!liAtCookie || liAtCookie.trim().length < 20) {
  console.error('\n⚠️  Warning: The cookie looks too short. Make sure you copied the full value.');
  const confirm = await question('Continue anyway? (yes/no): ');
  if (confirm.toLowerCase() !== 'yes') {
    console.log('\nSetup cancelled. Run again when ready.\n');
    rl.close();
    process.exit(0);
  }
}

console.log('\n✓ LinkedIn cookie received\n');

console.log('Step 2 of 2: Claude API Configuration (Optional)');
console.log('─'.repeat(60));
console.log('\n🆕 NEW: This analyzer now uses Claude Agent SDK!\n');
console.log('When run from Claude Code, NO API KEY is needed.');
console.log('The analyzer uses your Claude Code session automatically.\n');
console.log('API key is ONLY needed if you want standalone CLI mode.');
console.log('Do you want to configure an API key for standalone mode?\n');

const configureApiKey = await question('Configure API key? (yes/no) [default: no]: ');

let anthropicKey = '';
if (configureApiKey.toLowerCase() === 'yes') {
  console.log('\nHow to get your API key:');
  console.log('  1. Visit: https://console.anthropic.com/');
  console.log('  2. Sign up or log in (free tier available)');
  console.log('  3. Go to "API Keys" in the dashboard');
  console.log('  4. Click "Create Key" and copy it\n');

  anthropicKey = await question('Paste your Anthropic API key: ');

  if (!anthropicKey || anthropicKey.trim().length < 20) {
    console.error('\n⚠️  Warning: The API key looks invalid. Make sure you copied the full key.');
    const confirm = await question('Continue anyway? (yes/no): ');
    if (confirm.toLowerCase() !== 'yes') {
      console.log('\nSetup cancelled. Run again when ready.\n');
      rl.close();
      process.exit(0);
    }
  }
  console.log('\n✓ API key received\n');
} else {
  console.log('\n✓ Skipping API key configuration (using Agent SDK mode)\n');
}

const envContent = `# LinkedIn Authentication
# This cookie authenticates you with LinkedIn
# Keep it secret! It's like your password.
LINKEDIN_LI_AT_COOKIE=${liAtCookie.trim()}

# Anthropic Claude API (OPTIONAL)
# The analyzer uses Claude Agent SDK by default (no API key needed)
# Only needed for standalone API mode with --api-key flag
# Get yours at: https://console.anthropic.com/
${anthropicKey ? `ANTHROPIC_API_KEY=${anthropicKey.trim()}` : '# ANTHROPIC_API_KEY=your_api_key_here'}
`;

try {
  await fs.writeFile(path.join(__dirname, '../.env'), envContent);

  console.log('═'.repeat(60));
  console.log('✅ Setup Complete!');
  console.log('═'.repeat(60));
  console.log('\n📝 Configuration saved to .env file\n');
  console.log('Next steps:\n');
  console.log('  1. Install dependencies (if not done yet):');
  console.log('     npm install');
  console.log('     (Playwright browsers install automatically)\n');
  console.log('  2. Run the full pipeline:');
  console.log('     npm run pipeline\n');
  console.log('Or run steps individually:');
  console.log('  npm run extract    # Extract your saved posts');
  console.log('  npm run analyze    # Analyze with AI');
  console.log('  npm run report     # Generate markdown report\n');
  console.log('💡 Tip: Run any script with --help for detailed usage info\n');

} catch (error) {
  console.error('\n❌ Error saving configuration\n');
  console.error(`Error: ${error.message}\n`);
  console.error('Troubleshooting:');
  console.error('  • Check that you have write permissions');
  console.error('  • Ensure the directory exists');
  console.error('  • Try running with elevated permissions\n');
  rl.close();
  process.exit(1);
}

rl.close();
