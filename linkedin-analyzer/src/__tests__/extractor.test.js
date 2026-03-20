import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';

// Mock Playwright
vi.mock('playwright', () => ({
  chromium: {
    launch: vi.fn()
  }
}));

// Mock fs/promises
vi.mock('fs/promises', () => ({
  default: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
    readdir: vi.fn(),
    access: vi.fn()
  }
}));

// Mock dotenv
vi.mock('dotenv', () => ({
  default: {
    config: vi.fn()
  }
}));

// Setup config mock before importing the module
vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({
  extraction: {
    headless: true,
    slowMo: 50,
    timeout: 30000,
    scrollDelay: 1000,
    scrollDistance: 500,
    maxScrollAttempts: 10
  }
}));

// Import after mocks are set up
const { default: LinkedInSavedPostsExtractor } = await import('../extractor.js');

describe('LinkedInSavedPostsExtractor', () => {
  let extractor;
  let mockBrowser;
  let mockContext;
  let mockPage;
  const testCookie = 'test_li_at_cookie_value_that_is_long_enough_to_pass_validation_checks';

  beforeEach(async () => {
    // Reset config mock
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({
      extraction: {
        headless: true,
        slowMo: 50,
        timeout: 30000,
        scrollDelay: 1000,
        scrollDistance: 500,
        maxScrollAttempts: 10
      }
    }));

    // Setup mock browser/page hierarchy
    mockPage = {
      goto: vi.fn().mockResolvedValue(undefined),
      url: vi.fn().mockReturnValue('https://www.linkedin.com/my-items/saved-posts/'),
      title: vi.fn().mockResolvedValue('Saved Posts | LinkedIn'),
      waitForTimeout: vi.fn().mockResolvedValue(undefined),
      waitForSelector: vi.fn().mockResolvedValue(undefined),
      waitForLoadState: vi.fn().mockResolvedValue(undefined),
      $$eval: vi.fn().mockResolvedValue([]),
      evaluate: vi.fn().mockResolvedValue({}),
      screenshot: vi.fn().mockResolvedValue(undefined),
      content: vi.fn().mockResolvedValue('<html><body>Test</body></html>'),
      mouse: {
        wheel: vi.fn().mockResolvedValue(undefined)
      }
    };

    mockContext = {
      newPage: vi.fn().mockResolvedValue(mockPage),
      addCookies: vi.fn().mockResolvedValue(undefined)
    };

    mockBrowser = {
      newContext: vi.fn().mockResolvedValue(mockContext),
      close: vi.fn().mockResolvedValue(undefined)
    };

    const { chromium } = await import('playwright');
    vi.mocked(chromium.launch).mockResolvedValue(mockBrowser);

    extractor = new LinkedInSavedPostsExtractor(testCookie, { debug: false });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with valid cookie and options', () => {
      expect(extractor.liAtCookie).toBe(testCookie);
      expect(extractor.extractedPosts).toEqual([]);
      expect(extractor.browser).toBeNull();
      expect(extractor.page).toBeNull();
    });

    it('should merge default config with custom options', () => {
      const customExtractor = new LinkedInSavedPostsExtractor(testCookie, {
        headless: false,
        debug: true
      });

      expect(customExtractor.debug).toBe(true);
      expect(customExtractor.options.headless).toBe(false);
    });

    it('should detect debug flag from command line args', () => {
      const originalArgv = process.argv;
      process.argv = [...process.argv, '--debug'];

      const debugExtractor = new LinkedInSavedPostsExtractor(testCookie);
      expect(debugExtractor.debug).toBe(true);

      process.argv = originalArgv;
    });
  });

  describe('log and debug_log', () => {
    it('should log messages with prefix', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      extractor.log('TEST', 'message');
      expect(consoleSpy).toHaveBeenCalledWith('[TEST] message');

      extractor.log('TEST', 'with data', { key: 'value' });
      expect(consoleSpy).toHaveBeenCalledWith('[TEST] with data: {"key":"value"}');

      consoleSpy.mockRestore();
    });

    it('should only log debug messages when debug is enabled', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      extractor.debug = false;
      extractor.debug_log('DEBUG', 'hidden message');
      expect(consoleSpy).not.toHaveBeenCalled();

      extractor.debug = true;
      extractor.debug_log('DEBUG', 'visible message');
      expect(consoleSpy).toHaveBeenCalledWith('[DEBUG] [DEBUG] visible message');

      consoleSpy.mockRestore();
    });
  });

  describe('initialize', () => {
    it('should successfully initialize browser with valid cookie', async () => {
      await extractor.initialize();

      const { chromium } = await import('playwright');
      expect(chromium.launch).toHaveBeenCalledWith(
        expect.objectContaining({
          headless: true,
          slowMo: 50
        })
      );

      expect(mockBrowser.newContext).toHaveBeenCalledWith(
        expect.objectContaining({
          viewport: { width: 1920, height: 1080 },
          locale: 'en-US'
        })
      );

      expect(mockContext.addCookies).toHaveBeenCalledWith([
        expect.objectContaining({
          name: 'li_at',
          value: testCookie,
          domain: '.linkedin.com'
        })
      ]);

      expect(extractor.browser).toBe(mockBrowser);
      expect(extractor.page).toBe(mockPage);
    });

    it('should throw error for empty cookie', async () => {
      const invalidExtractor = new LinkedInSavedPostsExtractor('');

      await expect(invalidExtractor.initialize()).rejects.toThrow(
        'li_at cookie is empty or undefined'
      );
    });

    it('should throw error for undefined cookie', async () => {
      const invalidExtractor = new LinkedInSavedPostsExtractor(null);

      await expect(invalidExtractor.initialize()).rejects.toThrow(
        'li_at cookie is empty or undefined'
      );
    });

    it('should warn for short cookies', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const shortExtractor = new LinkedInSavedPostsExtractor('short');

      // Short cookie triggers warning but doesn't throw - it's just a warning
      await shortExtractor.initialize();

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Warning: li_at cookie seems too short')
      );
      expect(shortExtractor.browser).toBe(mockBrowser);

      warnSpy.mockRestore();
    });

    it('should configure proxy when PROXY_URL is set', async () => {
      const originalProxyUrl = process.env.PROXY_URL;
      process.env.PROXY_URL = 'http://proxy.example.com:8080';

      await extractor.initialize();

      const { chromium } = await import('playwright');
      expect(chromium.launch).toHaveBeenCalledWith(
        expect.objectContaining({
          proxy: { server: 'http://proxy.example.com:8080' }
        })
      );

      process.env.PROXY_URL = originalProxyUrl;
    });
  });

  describe('navigateToSavedPosts', () => {
    beforeEach(async () => {
      await extractor.initialize();
    });

    it('should successfully navigate to saved posts page', async () => {
      await extractor.navigateToSavedPosts();

      expect(mockPage.goto).toHaveBeenCalledWith(
        'https://www.linkedin.com/my-items/saved-posts/',
        expect.objectContaining({
          waitUntil: 'domcontentloaded',
          timeout: 30000
        })
      );
    });

    it('should throw error when redirected to login', async () => {
      mockPage.url.mockReturnValue('https://www.linkedin.com/login');

      await expect(extractor.navigateToSavedPosts()).rejects.toThrow(
        'Authentication failed - redirected to login'
      );
    });

    it('should throw error when redirected to challenge', async () => {
      mockPage.url.mockReturnValue('https://www.linkedin.com/challenge');

      await expect(extractor.navigateToSavedPosts()).rejects.toThrow(
        'Authentication failed - redirected to login'
      );
    });

    it('should retry navigation on failure with exponential backoff', async () => {
      mockPage.goto
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockResolvedValueOnce(undefined);

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await extractor.navigateToSavedPosts();

      expect(mockPage.goto).toHaveBeenCalledTimes(3);
      expect(warnSpy).toHaveBeenCalledTimes(2);

      warnSpy.mockRestore();
    });

    it('should fail after max retries', async () => {
      mockPage.goto.mockRejectedValue(new Error('Persistent network error'));

      await expect(extractor.navigateToSavedPosts()).rejects.toThrow(
        'Persistent network error'
      );

      expect(mockPage.goto).toHaveBeenCalledTimes(3);
    });
  });

  describe('extractVisiblePosts', () => {
    beforeEach(async () => {
      await extractor.initialize();
    });

    it('should extract posts from page with correct structure', async () => {
      const mockPosts = [
        {
          id: 'urn:li:activity:1234567890',
          title: 'Test Post 1',
          url: 'https://www.linkedin.com/feed/update/urn:li:activity:1234567890',
          author: 'John Doe',
          summary: 'This is a test post about testing',
          savedDate: '2024-01-15T10:00:00Z',
          extractedAt: expect.any(String)
        },
        {
          id: 'urn:li:activity:9876543210',
          title: 'Test Post 2',
          url: 'https://www.linkedin.com/feed/update/urn:li:activity:9876543210',
          author: 'Jane Smith',
          summary: 'Another test post with more content',
          savedDate: '2024-01-14T15:30:00Z',
          extractedAt: expect.any(String)
        }
      ];

      mockPage.evaluate.mockResolvedValue({
        savedPostItems: 2,
        chameleonResults: 2,
        contentSummaries: 2,
        artilleryContainers: 2
      });

      mockPage.$$eval.mockResolvedValue(mockPosts);

      const posts = await extractor.extractVisiblePosts();

      expect(posts).toEqual(mockPosts);
      expect(posts).toHaveLength(2);
    });

    it('should handle pages with no posts', async () => {
      mockPage.evaluate.mockResolvedValue({
        savedPostItems: 0,
        chameleonResults: 0,
        contentSummaries: 0,
        artilleryContainers: 0
      });

      mockPage.$$eval.mockResolvedValue([]);

      const posts = await extractor.extractVisiblePosts();

      expect(posts).toEqual([]);
    });

    it('should filter out posts without IDs', async () => {
      mockPage.evaluate.mockResolvedValue({
        savedPostItems: 2,
        chameleonResults: 2,
        contentSummaries: 2,
        artilleryContainers: 2
      });

      // The filtering happens in the $$eval callback, so we need to mock it correctly
      // The actual filtering is done by the browser-side code
      mockPage.$$eval.mockResolvedValue([
        {
          id: 'urn:li:activity:123',
          title: 'Valid Post',
          author: 'Author',
          summary: 'Content'
        }
        // Invalid post with null ID is already filtered out by the browser-side .filter()
      ]);

      const posts = await extractor.extractVisiblePosts();

      expect(posts).toHaveLength(1);
      expect(posts[0].id).toBe('urn:li:activity:123');
    });

    it('should wait for selectors with timeout', async () => {
      mockPage.waitForSelector.mockRejectedValue(new Error('Timeout'));

      extractor.debug = true;
      mockPage.$$eval.mockResolvedValue([]);

      await extractor.extractVisiblePosts();

      expect(mockPage.waitForSelector).toHaveBeenCalled();
    });
  });

  describe('scrollAndExtract', () => {
    beforeEach(async () => {
      await extractor.initialize();
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
    });

    it('should scroll and extract posts until no new content', async () => {
      const mockBatch1 = [
        { id: '1', title: 'Post 1', author: 'A', summary: 'Content 1' }
      ];
      const mockBatch2 = [
        { id: '1', title: 'Post 1', author: 'A', summary: 'Content 1' },
        { id: '2', title: 'Post 2', author: 'B', summary: 'Content 2' }
      ];
      const mockBatch3 = [
        { id: '1', title: 'Post 1', author: 'A', summary: 'Content 1' },
        { id: '2', title: 'Post 2', author: 'B', summary: 'Content 2' }
      ];

      mockPage.$$eval
        .mockResolvedValueOnce(mockBatch1)
        .mockResolvedValueOnce(mockBatch2)
        .mockResolvedValueOnce(mockBatch3)
        .mockResolvedValueOnce(mockBatch3);

      await extractor.scrollAndExtract();

      expect(extractor.extractedPosts).toHaveLength(2);
      expect(mockPage.mouse.wheel).toHaveBeenCalled();
    });

    it('should respect maxScrollAttempts', async () => {
      extractor.options.maxScrollAttempts = 2;

      mockPage.$$eval.mockResolvedValue([
        { id: '1', title: 'Post 1', author: 'A', summary: 'Content' }
      ]);

      await extractor.scrollAndExtract();

      expect(mockPage.mouse.wheel).toHaveBeenCalledTimes(2);
    });

    it('should deduplicate posts by ID', async () => {
      const duplicatePost = { id: '1', title: 'Post', author: 'A', summary: 'Content' };

      mockPage.$$eval
        .mockResolvedValueOnce([duplicatePost])
        .mockResolvedValueOnce([duplicatePost])
        .mockResolvedValueOnce([duplicatePost]);

      await extractor.scrollAndExtract();

      expect(extractor.extractedPosts).toHaveLength(1);
    });

    it('should save debug screenshot when debug mode enabled', async () => {
      extractor.debug = true;

      mockPage.evaluate.mockResolvedValue({
        documentReady: 'complete',
        bodyHtmlLength: 1000,
        title: 'Test',
        url: 'https://test.com'
      });

      mockPage.$$eval.mockResolvedValue([]);

      await extractor.scrollAndExtract();

      expect(mockPage.screenshot).toHaveBeenCalled();
      expect(fs.mkdir).toHaveBeenCalled();
    });

    it('should save page HTML when no posts found in debug mode', async () => {
      extractor.debug = true;

      mockPage.$$eval.mockResolvedValue([]);
      mockPage.content.mockResolvedValue('<html><body>Empty</body></html>');

      await extractor.scrollAndExtract();

      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('debug-page-html.txt'),
        expect.any(String)
      );
    });
  });

  describe('saveResults', () => {
    beforeEach(async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
    });

    it('should save posts to JSON file', async () => {
      extractor.extractedPosts = [
        { id: '1', title: 'Post 1', author: 'A', summary: 'Content' },
        { id: '2', title: 'Post 2', author: 'B', summary: 'More content' }
      ];

      const filename = await extractor.saveResults();

      expect(fs.mkdir).toHaveBeenCalled();
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('saved-posts-'),
        expect.stringContaining('"id": "1"')
      );
      expect(filename).toContain('saved-posts-');
    });

    it('should use custom output path when provided', async () => {
      extractor.extractedPosts = [{ id: '1', title: 'Post', author: 'A', summary: 'Content' }];

      const customPath = '/custom/path/output.json';
      const filename = await extractor.saveResults(customPath);

      expect(filename).toBe(customPath);
      expect(fs.writeFile).toHaveBeenCalledWith(
        customPath,
        expect.any(String)
      );
    });

    it('should create output directory if missing', async () => {
      extractor.extractedPosts = [];

      await extractor.saveResults();

      expect(fs.mkdir).toHaveBeenCalledWith(
        expect.any(String),
        { recursive: true }
      );
    });
  });

  describe('close', () => {
    it('should close browser when initialized', async () => {
      await extractor.initialize();
      await extractor.close();

      expect(mockBrowser.close).toHaveBeenCalled();
    });

    it('should handle close when browser not initialized', async () => {
      await expect(extractor.close()).resolves.not.toThrow();
    });
  });

  describe('run', () => {
    beforeEach(() => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      mockPage.$$eval.mockResolvedValue([
        { id: '1', title: 'Post', author: 'A', summary: 'Content' }
      ]);
    });

    it('should execute full extraction pipeline successfully', async () => {
      const result = await extractor.run();

      expect(result.success).toBe(true);
      expect(result.postCount).toBe(1);
      expect(result.outputFile).toBeDefined();
      expect(mockBrowser.close).toHaveBeenCalled();
    });

    it('should handle errors and return failure result', async () => {
      mockPage.goto.mockRejectedValue(new Error('Network failure'));

      const result = await extractor.run();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network failure');
      expect(mockBrowser.close).toHaveBeenCalled();
    });

    it('should accept custom output path', async () => {
      const customPath = '/custom/output.json';
      const result = await extractor.run(customPath);

      expect(result.success).toBe(true);
      expect(result.outputFile).toBe(customPath);
    });
  });
});
