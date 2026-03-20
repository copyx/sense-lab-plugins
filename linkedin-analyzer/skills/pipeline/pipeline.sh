#!/bin/bash
# LinkedIn Analyzer Pipeline Skill
# Executes: extract → analyze → report

set -e  # Exit on any error

PLUGIN_DIR="${CLAUDE_PLUGIN_ROOT}"
cd "$PLUGIN_DIR"

# Color output helpers
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

error() {
    echo -e "${RED}❌ Error: $1${NC}" >&2
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

step() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# Check if .env file exists and has cookie
if [ ! -f ".env" ]; then
    error "Configuration not found!"
    echo ""
    echo "You need to configure your LinkedIn authentication first."
    echo ""
    echo "Run: /linkedin-analyzer:setup"
    echo ""
    echo "Or manually create a .env file with:"
    echo "  LINKEDIN_LI_AT_COOKIE=your_cookie_here"
    exit 1
fi

# Check if cookie is configured
if ! grep -q "LINKEDIN_LI_AT_COOKIE=." .env 2>/dev/null; then
    error "LinkedIn cookie not configured!"
    echo ""
    echo "Run: /linkedin-analyzer:setup"
    echo ""
    echo "This will guide you through obtaining your LinkedIn li_at cookie."
    exit 1
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    warning "Dependencies not installed. Installing now..."
    npm install
    if [ $? -ne 0 ]; then
        error "Failed to install dependencies"
        echo "Try running: npm install"
        exit 1
    fi
    success "Dependencies installed"
fi

# Create data directory if it doesn't exist
mkdir -p data

# Display pipeline overview
echo ""
echo "🚀 LinkedIn Analyzer Pipeline"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "This will execute three steps:"
echo "  1. Extract saved posts from LinkedIn (2-5 min)"
echo "  2. Analyze content with Claude AI (1-2 min)"
echo "  3. Generate markdown report (<1 min)"
echo ""
echo "Total estimated time: 3-8 minutes"
echo ""

# STEP 1: Extract
step "Step 1/3: Extracting LinkedIn Saved Posts"
info "Starting browser automation..."
info "This will:"
info "  • Open LinkedIn in headless browser"
info "  • Scroll through your saved posts"
info "  • Extract post content and metadata"
echo ""

START_TIME=$(date +%s)

if npm run extract; then
    success "Extraction complete!"

    # Count posts if jq is available
    if command -v jq &> /dev/null && [ -f "data/posts.json" ]; then
        POST_COUNT=$(jq '. | length' data/posts.json 2>/dev/null || echo "unknown")
        info "Extracted ${POST_COUNT} posts"
    fi

    info "Saved to: data/posts.json"
else
    error "Extraction failed!"
    echo ""
    echo "Common causes:"
    echo "  • Invalid or expired LinkedIn cookie"
    echo "  • LinkedIn is blocking automated access"
    echo "  • Network connectivity issues"
    echo ""
    echo "Try:"
    echo "  1. Re-run setup to get a fresh cookie: /linkedin-analyzer:setup"
    echo "  2. Check your network connection"
    echo "  3. Wait a few minutes and try again"
    exit 1
fi

# STEP 2: Analyze
step "Step 2/3: Analyzing Content with Claude AI"
info "Processing posts to identify themes and insights..."
echo ""

if npm run analyze; then
    success "Analysis complete!"
    info "Saved to: data/analysis.json"
else
    error "Analysis failed!"
    echo ""
    echo "Common causes:"
    echo "  • Agent SDK not available (are you running from Claude Code?)"
    echo "  • Network issues connecting to Claude API"
    echo "  • Malformed post data"
    echo ""
    echo "Try:"
    echo "  1. Make sure you're running this from Claude Code"
    echo "  2. Check data/posts.json is valid JSON"
    echo "  3. For standalone mode: configure API key in .env"
    exit 1
fi

# STEP 3: Report
step "Step 3/3: Generating Report"
info "Creating markdown report from analysis..."
echo ""

if npm run report; then
    success "Report generated!"
    info "Saved to: data/report.md"
else
    error "Report generation failed!"
    echo ""
    echo "This is unusual - the reporter should work if analysis succeeded."
    echo "Check data/analysis.json for valid content."
    exit 1
fi

# Calculate total time
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))
MINUTES=$((DURATION / 60))
SECONDS=$((DURATION % 60))

# Final success message
echo ""
echo "═══════════════════════════════════════════════════════════"
success "Pipeline Complete! 🎉"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "⏱️  Total time: ${MINUTES}m ${SECONDS}s"
echo ""
echo "📂 Output files:"
echo "   • data/posts.json     - Raw extracted posts"
echo "   • data/analysis.json  - AI-generated insights"
echo "   • data/report.md      - Final report"
echo ""
echo "📖 Next steps:"
echo "   • Open data/report.md to view your insights"
echo "   • Review themes and recommendations"
echo "   • Run again anytime to refresh analysis"
echo ""
