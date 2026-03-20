# Test Suite Documentation

## Overview

This project uses **Vitest** as the testing framework. The test suite provides comprehensive coverage for all main modules.

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with UI
npm run test:ui

# Run tests with coverage report
npm run test:coverage
```

## Test Structure

```
src/__tests__/
├── extractor.test.js      # Tests for LinkedInSavedPostsExtractor
├── agent-analyzer.test.js # Tests for AgentLinkedInAnalyzer
└── reporter.test.js       # Tests for ReportGenerator
```

## Test Coverage

### extractor.test.js
- **Constructor**: Initialization with options, debug mode detection
- **Logging**: Standard and debug logging methods
- **Initialize**: Browser setup, cookie validation, proxy configuration
- **Navigate**: Navigation to saved posts, retry logic, authentication checks
- **Extract**: Post extraction from DOM, selector strategies, deduplication
- **Scroll**: Infinite scroll handling, progress tracking
- **Save**: File output, directory creation
- **Close**: Browser cleanup
- **Run**: Full pipeline execution, error handling

### agent-analyzer.test.js
- **Constructor**: Mode selection (Agent SDK vs API key)
- **Topic Analysis**: Theme extraction, trend identification
- **Insight Extraction**: Key insights, action items, recommendations
- **Author Analysis**: Author ranking, post counting
- **Claude Integration**: Agent SDK v2, fallback to query API, API key mode
- **Run**: Full analysis pipeline, parallel execution, file I/O

### reporter.test.js
- **Constructor**: Data initialization
- **Markdown Generation**: Complete report structure, all sections
- **Formatting**: Themes, insights, action items, authors
- **Edge Cases**: Missing data, empty sections, special characters
- **Save**: File output, custom paths, error handling

## Mocking Strategy

### Playwright (extractor.test.js)
- Mock `chromium.launch()` and browser/page hierarchy
- Simulate navigation, DOM queries, scrolling
- Mock file system operations for screenshots/debug files

### Claude SDK (agent-analyzer.test.js)
- Mock `@anthropic-ai/claude-agent-sdk` for Agent SDK mode
- Mock `@anthropic-ai/sdk` for API key mode
- Mock file system for reading posts and saving analysis

### File System (all tests)
- Mock `fs/promises` for all file operations
- Control file reads/writes without touching disk

## Key Testing Patterns

### 1. Async/Await
All tests use async/await for asynchronous operations:
```javascript
it('should initialize browser', async () => {
  await extractor.initialize();
  expect(extractor.browser).toBeDefined();
});
```

### 2. Mock Setup in beforeEach
Common mocks are configured in `beforeEach` hooks:
```javascript
beforeEach(() => {
  mockPage = {
    goto: vi.fn().mockResolvedValue(undefined),
    // ...
  };
});
```

### 3. Spy on Methods
Use spies to verify method calls and control return values:
```javascript
vi.spyOn(analyzer, 'callClaude').mockResolvedValue('{}');
```

### 4. Error Simulation
Test error handling by mocking rejections:
```javascript
mockPage.goto.mockRejectedValue(new Error('Network error'));
await expect(extractor.navigateToSavedPosts()).rejects.toThrow();
```

## Coverage Goals

- **Statements**: >80%
- **Branches**: >75%
- **Functions**: >85%
- **Lines**: >80%

## Running Specific Tests

```bash
# Run single test file
npm test extractor.test.js

# Run tests matching pattern
npm test -- -t "should initialize"

# Run in specific mode
npm test -- --reporter=verbose
```

## CI/CD Integration

Add to your CI pipeline:
```yaml
- name: Run Tests
  run: npm test -- --run

- name: Generate Coverage
  run: npm run test:coverage
```

## Troubleshooting

### Mock Issues
If mocks aren't working:
1. Check `vi.mock()` is at top of file
2. Ensure `mockReset: true` in vitest.config.js
3. Verify mock paths match actual imports

### Async Issues
If tests timeout:
1. Ensure all async operations use `await`
2. Check mock functions return promises
3. Increase timeout: `it('test', async () => {...}, 10000)`

### Import Issues
If ESM imports fail:
1. Verify `"type": "module"` in package.json
2. Use `.js` extensions in imports
3. Check vitest.config.js uses `environment: 'node'`

## Best Practices

1. **Test Isolation**: Each test should be independent
2. **Clear Descriptions**: Use descriptive test names
3. **Arrange-Act-Assert**: Structure tests clearly
4. **Mock External Dependencies**: Don't hit real APIs or file system
5. **Test Edge Cases**: Cover error conditions and boundary cases
6. **Keep Tests Fast**: Use mocks to avoid slow operations

## Future Enhancements

- [ ] Add integration tests with real browser (E2E)
- [ ] Add performance benchmarks
- [ ] Increase coverage to >90%
- [ ] Add snapshot testing for report output
- [ ] Add visual regression tests for debugging screenshots
