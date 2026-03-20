import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';

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

// Mock Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn()
    }
  }))
}));

// Mock Claude Agent SDK
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  unstable_v2_prompt: vi.fn(),
  query: vi.fn()
}));

// Setup config mock before importing the module
vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({
  analysis: {
    model: 'claude-sonnet-4.5',
    maxTokens: 4096,
    temperature: 0.3
  }
}));

// Import after mocks are set up
const { default: AgentLinkedInAnalyzer } = await import('../agent-analyzer.js');

describe('AgentLinkedInAnalyzer', () => {
  let analyzer;
  let mockPosts;

  beforeEach(async () => {
    // Reset config mock
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({
      analysis: {
        model: 'claude-sonnet-4.5',
        maxTokens: 4096,
        temperature: 0.3
      }
    }));

    mockPosts = [
      {
        id: '1',
        title: 'AI Revolution in Healthcare',
        author: 'Dr. Smith',
        summary: 'Exploring how AI is transforming medical diagnostics and patient care.',
        url: 'https://linkedin.com/feed/update/1'
      },
      {
        id: '2',
        title: 'Remote Work Best Practices',
        author: 'Jane Doe',
        summary: 'Tips for staying productive while working from home.',
        url: 'https://linkedin.com/feed/update/2'
      },
      {
        id: '3',
        title: 'Sustainable Tech Solutions',
        author: 'Green Tech Inc',
        summary: 'How technology can help combat climate change.',
        url: 'https://linkedin.com/feed/update/3'
      }
    ];

    analyzer = new AgentLinkedInAnalyzer({ useAgentSDK: true });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with Agent SDK mode by default', () => {
      expect(analyzer.useAgentSDK).toBe(true);
      expect(analyzer.config).toBeDefined();
    });

    it('should initialize with API key mode when specified', () => {
      const apiAnalyzer = new AgentLinkedInAnalyzer({
        useAgentSDK: false,
        apiKey: 'test-api-key'
      });

      expect(apiAnalyzer.useAgentSDK).toBe(false);
      expect(apiAnalyzer.apiKey).toBe('test-api-key');
    });

    it('should use environment variable for API key', () => {
      process.env.ANTHROPIC_API_KEY = 'env-api-key';

      const envAnalyzer = new AgentLinkedInAnalyzer({ useAgentSDK: false });

      expect(envAnalyzer.apiKey).toBe('env-api-key');

      delete process.env.ANTHROPIC_API_KEY;
    });
  });

  describe('analyzeTopics', () => {
    it('should analyze topics and return structured data', async () => {
      const mockResponse = JSON.stringify({
        themes: [
          {
            name: 'Artificial Intelligence',
            postCount: 1,
            description: 'AI applications in various industries',
            keyInsights: ['AI improving healthcare diagnostics']
          }
        ],
        trends: {
          emerging: ['AI in healthcare'],
          declining: ['Traditional methods']
        }
      });

      vi.spyOn(analyzer, 'callClaude').mockResolvedValue(mockResponse);

      const result = await analyzer.analyzeTopics(mockPosts);

      expect(result).toHaveProperty('themes');
      expect(result).toHaveProperty('trends');
      expect(result.themes).toHaveLength(1);
      expect(result.themes[0].name).toBe('Artificial Intelligence');
    });

    it('should handle empty posts array', async () => {
      vi.spyOn(analyzer, 'callClaude').mockResolvedValue('{"themes":[],"trends":{}}');

      const result = await analyzer.analyzeTopics([]);

      expect(result).toEqual({ themes: [], trends: {} });
    });

    it('should extract JSON from response text', async () => {
      const mockResponse = `Here is the analysis:

      ${JSON.stringify({
        themes: [{ name: 'Test', postCount: 1, description: 'Desc', keyInsights: [] }],
        trends: { emerging: [], declining: [] }
      })}

      That's all!`;

      vi.spyOn(analyzer, 'callClaude').mockResolvedValue(mockResponse);

      const result = await analyzer.analyzeTopics(mockPosts);

      expect(result.themes).toBeDefined();
      expect(result.themes[0].name).toBe('Test');
    });

    it('should return default structure when JSON parsing fails', async () => {
      vi.spyOn(analyzer, 'callClaude').mockResolvedValue('Invalid response');

      const result = await analyzer.analyzeTopics(mockPosts);

      expect(result).toEqual({ themes: [], trends: {} });
    });

    it('should truncate long post summaries', async () => {
      const longPosts = Array.from({ length: 100 }, (_, i) => ({
        id: `${i}`,
        title: `Post ${i}`,
        author: `Author ${i}`,
        summary: 'A'.repeat(1000)
      }));

      const callClaudeSpy = vi.spyOn(analyzer, 'callClaude').mockResolvedValue('{}');

      await analyzer.analyzeTopics(longPosts);

      const calledPrompt = callClaudeSpy.mock.calls[0][0];
      expect(calledPrompt.length).toBeLessThan(10000);
    });
  });

  describe('extractKeyInsights', () => {
    it('should extract insights from posts', async () => {
      const mockResponse = JSON.stringify({
        keyInsights: [
          {
            insight: 'AI is revolutionizing healthcare diagnostics',
            source: 'Dr. Smith',
            postIndex: 1
          }
        ],
        actionItems: ['Research AI healthcare solutions'],
        exploreFurther: ['Machine learning applications']
      });

      vi.spyOn(analyzer, 'callClaude').mockResolvedValue(mockResponse);

      const result = await analyzer.extractKeyInsights(mockPosts);

      expect(result.keyInsights).toHaveLength(1);
      expect(result.keyInsights[0].insight).toContain('AI');
      expect(result.actionItems).toContain('Research AI healthcare solutions');
    });

    it('should limit analysis to top 15 posts', async () => {
      const manyPosts = Array.from({ length: 50 }, (_, i) => ({
        id: `${i}`,
        title: `Post ${i}`,
        author: `Author ${i}`,
        summary: `Summary ${i}`
      }));

      const callClaudeSpy = vi.spyOn(analyzer, 'callClaude').mockResolvedValue('{}');

      await analyzer.extractKeyInsights(manyPosts);

      const calledPrompt = callClaudeSpy.mock.calls[0][0];
      expect(calledPrompt).toContain('Post 14');
      expect(calledPrompt).not.toContain('Post 15');
    });

    it('should handle missing actionItems gracefully', async () => {
      const mockResponse = JSON.stringify({
        keyInsights: [{ insight: 'Test', source: 'A', postIndex: 1 }]
      });

      vi.spyOn(analyzer, 'callClaude').mockResolvedValue(mockResponse);

      const result = await analyzer.extractKeyInsights(mockPosts);

      expect(result.keyInsights).toBeDefined();
      expect(result.actionItems).toBeUndefined();
    });
  });

  describe('analyzeAuthors', () => {
    it('should count and rank authors', async () => {
      const postsWithDuplicateAuthors = [
        { author: 'Alice', id: '1', title: 'Post 1', summary: 'S1' },
        { author: 'Bob', id: '2', title: 'Post 2', summary: 'S2' },
        { author: 'Alice', id: '3', title: 'Post 3', summary: 'S3' },
        { author: 'Alice', id: '4', title: 'Post 4', summary: 'S4' },
        { author: 'Charlie', id: '5', title: 'Post 5', summary: 'S5' }
      ];

      const result = await analyzer.analyzeAuthors(postsWithDuplicateAuthors);

      expect(result.topAuthors).toHaveLength(3);
      expect(result.topAuthors[0].author).toBe('Alice');
      expect(result.topAuthors[0].postCount).toBe(3);
      expect(result.totalAuthors).toBe(3);
    });

    it('should limit to top 10 authors', async () => {
      const manyAuthors = Array.from({ length: 20 }, (_, i) => ({
        author: `Author${i}`,
        id: `${i}`,
        title: `Post ${i}`,
        summary: `Summary ${i}`
      }));

      const result = await analyzer.analyzeAuthors(manyAuthors);

      expect(result.topAuthors).toHaveLength(10);
      expect(result.totalAuthors).toBe(20);
    });

    it('should handle empty posts', async () => {
      const result = await analyzer.analyzeAuthors([]);

      expect(result.topAuthors).toEqual([]);
      expect(result.totalAuthors).toBe(0);
    });

    it('should sort authors by post count descending', async () => {
      const posts = [
        { author: 'A', id: '1', title: 'P1', summary: 'S' },
        { author: 'B', id: '2', title: 'P2', summary: 'S' },
        { author: 'B', id: '3', title: 'P3', summary: 'S' },
        { author: 'C', id: '4', title: 'P4', summary: 'S' },
        { author: 'C', id: '5', title: 'P5', summary: 'S' },
        { author: 'C', id: '6', title: 'P6', summary: 'S' }
      ];

      const result = await analyzer.analyzeAuthors(posts);

      expect(result.topAuthors[0].author).toBe('C');
      expect(result.topAuthors[0].postCount).toBe(3);
      expect(result.topAuthors[1].author).toBe('B');
      expect(result.topAuthors[1].postCount).toBe(2);
    });
  });

  describe('callClaude', () => {
    it('should use Agent SDK v2 prompt when available', async () => {
      const { unstable_v2_prompt } = await import('@anthropic-ai/claude-agent-sdk');

      vi.mocked(unstable_v2_prompt).mockResolvedValue({
        result: 'Test response from v2 prompt'
      });

      const result = await analyzer.callClaude('Test prompt');

      expect(unstable_v2_prompt).toHaveBeenCalledWith(
        'Test prompt',
        expect.objectContaining({
          model: 'claude-sonnet-4.5',
          maxTokens: 4096,
          temperature: 0.3
        })
      );

      expect(result).toBe('Test response from v2 prompt');
    });

    it('should fallback to query API when v2 fails', async () => {
      const { unstable_v2_prompt, query } = await import('@anthropic-ai/claude-agent-sdk');

      vi.mocked(unstable_v2_prompt).mockRejectedValue(new Error('v2 not available'));

      const mockQueryResult = {
        async *[Symbol.asyncIterator]() {
          yield { type: 'result', result: 'Fallback query response' };
        }
      };

      vi.mocked(query).mockReturnValue(mockQueryResult);

      const result = await analyzer.callClaude('Test prompt');

      expect(result).toBe('Fallback query response');
    });

    it('should use API key mode when Agent SDK not available', async () => {
      analyzer.useAgentSDK = false;
      analyzer.apiKey = 'test-api-key';

      const { default: Anthropic } = await import('@anthropic-ai/sdk');
      const mockCreate = vi.fn().mockResolvedValue({
        content: [{ text: 'API response' }]
      });

      Anthropic.mockImplementation(() => ({
        messages: { create: mockCreate }
      }));

      const result = await analyzer.callClaude('Test prompt');

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'claude-sonnet-4.5',
          max_tokens: 4096,
          temperature: 0.3,
          messages: [{ role: 'user', content: 'Test prompt' }]
        })
      );

      expect(result).toBe('API response');
    });

    it('should fallback to API mode when Agent SDK fails completely', async () => {
      analyzer.useAgentSDK = true;
      analyzer.apiKey = 'fallback-key';

      const { unstable_v2_prompt, query } = await import('@anthropic-ai/claude-agent-sdk');

      vi.mocked(unstable_v2_prompt).mockRejectedValue(new Error('v2 failed'));
      vi.mocked(query).mockImplementation(() => {
        throw new Error('query failed');
      });

      const { default: Anthropic } = await import('@anthropic-ai/sdk');
      const mockCreate = vi.fn().mockResolvedValue({
        content: [{ text: 'Fallback API response' }]
      });

      Anthropic.mockImplementation(() => ({
        messages: { create: mockCreate }
      }));

      const result = await analyzer.callClaude('Test prompt');

      expect(result).toBe('Fallback API response');
      expect(analyzer.useAgentSDK).toBe(false);
    });
  });

  describe('run', () => {
    beforeEach(() => {
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
    });

    it('should execute full analysis pipeline', async () => {
      vi.mocked(fs.readFile).mockResolvedValueOnce(JSON.stringify(mockPosts));

      vi.spyOn(analyzer, 'analyzeTopics').mockResolvedValue({
        themes: [{ name: 'AI', postCount: 1, description: 'AI theme', keyInsights: [] }],
        trends: { emerging: [], declining: [] }
      });

      vi.spyOn(analyzer, 'extractKeyInsights').mockResolvedValue({
        keyInsights: [{ insight: 'Test insight', source: 'A', postIndex: 1 }],
        actionItems: []
      });

      vi.spyOn(analyzer, 'analyzeAuthors').mockResolvedValue({
        topAuthors: [{ author: 'Dr. Smith', postCount: 1 }],
        totalAuthors: 3
      });

      const result = await analyzer.run('/path/to/posts.json');

      expect(result).toBeDefined();
      expect(result.analysis.metadata.postCount).toBe(3);
      expect(result.analysis.metadata.mode).toBe('agent-sdk');
      expect(result.analysis.topics).toBeDefined();
      expect(result.analysis.insights).toBeDefined();
      expect(result.analysis.authors).toBeDefined();
    });

    it('should handle empty posts file', async () => {
      vi.mocked(fs.readFile).mockResolvedValueOnce('[]');

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await analyzer.run('/path/to/empty.json');

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('No posts'));

      consoleSpy.mockRestore();
    });

    it('should run analyses in parallel', async () => {
      vi.mocked(fs.readFile).mockResolvedValueOnce(JSON.stringify(mockPosts));

      const topicsSpy = vi.spyOn(analyzer, 'analyzeTopics').mockResolvedValue({ themes: [], trends: {} });
      const insightsSpy = vi.spyOn(analyzer, 'extractKeyInsights').mockResolvedValue({ keyInsights: [], actionItems: [] });
      const authorsSpy = vi.spyOn(analyzer, 'analyzeAuthors').mockResolvedValue({ topAuthors: [], totalAuthors: 0 });

      await analyzer.run('/path/to/posts.json');

      expect(topicsSpy).toHaveBeenCalled();
      expect(insightsSpy).toHaveBeenCalled();
      expect(authorsSpy).toHaveBeenCalled();
    });

    it('should save analysis to output file', async () => {
      vi.mocked(fs.readFile).mockResolvedValueOnce(JSON.stringify(mockPosts));

      vi.spyOn(analyzer, 'analyzeTopics').mockResolvedValue({ themes: [], trends: {} });
      vi.spyOn(analyzer, 'extractKeyInsights').mockResolvedValue({ keyInsights: [], actionItems: [] });
      vi.spyOn(analyzer, 'analyzeAuthors').mockResolvedValue({ topAuthors: [], totalAuthors: 0 });

      const result = await analyzer.run('/path/to/posts.json');

      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('analysis-'),
        expect.stringContaining('"analyzedAt"')
      );

      expect(result.outputPath).toContain('analysis-');
    });
  });
});
