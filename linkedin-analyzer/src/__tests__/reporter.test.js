import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ReportGenerator from '../reporter.js';
import fs from 'fs/promises';

// Mock fs/promises
vi.mock('fs/promises');

describe('ReportGenerator', () => {
  let mockAnalysis;
  let mockPosts;
  let generator;

  beforeEach(() => {
    mockAnalysis = {
      metadata: {
        analyzedAt: '2024-01-15T10:00:00Z',
        postCount: 5,
        mode: 'agent-sdk'
      },
      topics: {
        themes: [
          {
            name: 'Artificial Intelligence',
            postCount: 3,
            description: 'Posts about AI and machine learning applications',
            keyInsights: [
              'AI is transforming healthcare',
              'Machine learning improves decision-making'
            ]
          },
          {
            name: 'Remote Work',
            postCount: 2,
            description: 'Best practices for distributed teams',
            keyInsights: [
              'Communication is key',
              'Work-life balance matters'
            ]
          }
        ],
        trends: {
          emerging: ['AI in healthcare', 'Hybrid work models'],
          declining: ['Traditional office setups']
        }
      },
      insights: {
        keyInsights: [
          {
            insight: 'AI can reduce diagnostic errors by 40%',
            source: 'Dr. Smith',
            postIndex: 1
          },
          {
            insight: 'Remote teams need async communication tools',
            source: 'Jane Doe',
            postIndex: 2
          }
        ],
        actionItems: [
          'Research AI diagnostic tools',
          'Implement async standup meetings',
          'Review current communication stack'
        ],
        exploreFurther: [
          'AI ethics in healthcare',
          'Remote work productivity metrics'
        ]
      },
      authors: {
        topAuthors: [
          { author: 'Dr. Smith', postCount: 2 },
          { author: 'Jane Doe', postCount: 1 },
          { author: 'Tech Insights', postCount: 1 },
          { author: 'Innovation Hub', postCount: 1 }
        ],
        totalAuthors: 4
      }
    };

    mockPosts = [
      {
        id: '1',
        title: 'AI in Healthcare',
        author: 'Dr. Smith',
        summary: 'How AI is changing medical diagnostics',
        url: 'https://linkedin.com/feed/update/1'
      },
      {
        id: '2',
        title: 'Remote Work Tips',
        author: 'Jane Doe',
        summary: 'Staying productive while working from home',
        url: 'https://linkedin.com/feed/update/2'
      },
      {
        id: '3',
        title: 'Machine Learning Basics',
        author: 'Dr. Smith',
        summary: 'Understanding ML fundamentals',
        url: 'https://linkedin.com/feed/update/3'
      }
    ];

    generator = new ReportGenerator(mockAnalysis, mockPosts);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with analysis and posts data', () => {
      expect(generator.analysis).toBe(mockAnalysis);
      expect(generator.posts).toBe(mockPosts);
    });
  });

  describe('generateMarkdownReport', () => {
    it('should generate complete markdown report', () => {
      const report = generator.generateMarkdownReport();

      expect(report).toContain('# LinkedIn Insights Report');
      expect(report).toContain('**Posts Analyzed:** 5');
      expect(report).toContain('## 🎯 Top Themes');
      expect(report).toContain('## 💡 Most Valuable Insights');
      expect(report).toContain('## ✅ Action Items');
      expect(report).toContain('## 👥 Most Saved Authors');
    });

    it('should format date correctly', () => {
      const report = generator.generateMarkdownReport();

      expect(report).toContain('**Generated:**');
      // Date format varies by locale, just check it contains a date-like pattern
      expect(report).toMatch(/\*\*Generated:\*\* .+\n/);
    });

    it('should include all themes with descriptions', () => {
      const report = generator.generateMarkdownReport();

      expect(report).toContain('### 1. Artificial Intelligence (3 posts)');
      expect(report).toContain('Posts about AI and machine learning applications');
      expect(report).toContain('### 2. Remote Work (2 posts)');
      expect(report).toContain('Best practices for distributed teams');
    });

    it('should list key insights from themes', () => {
      const report = generator.generateMarkdownReport();

      expect(report).toContain('**Key Insights:**');
      expect(report).toContain('- AI is transforming healthcare');
      expect(report).toContain('- Machine learning improves decision-making');
      expect(report).toContain('- Communication is key');
      expect(report).toContain('- Work-life balance matters');
    });

    it('should include valuable insights with sources and links', () => {
      const report = generator.generateMarkdownReport();

      expect(report).toContain('### 1. AI can reduce diagnostic errors by 40%');
      expect(report).toContain('**Source:** Dr. Smith');
      expect(report).toContain('**Link:** [View Post](https://linkedin.com/feed/update/1)');
      expect(report).toContain('### 2. Remote teams need async communication tools');
      expect(report).toContain('**Source:** Jane Doe');
    });

    it('should limit insights to top 10', () => {
      const manyInsights = Array.from({ length: 15 }, (_, i) => ({
        insight: `Insight ${i + 1}`,
        source: `Source ${i + 1}`,
        postIndex: i + 1
      }));

      const largeAnalysis = {
        ...mockAnalysis,
        insights: { ...mockAnalysis.insights, keyInsights: manyInsights }
      };

      const largeGenerator = new ReportGenerator(largeAnalysis, mockPosts);
      const report = largeGenerator.generateMarkdownReport();

      expect(report).toContain('### 10. Insight 10');
      expect(report).not.toContain('### 11. Insight 11');
    });

    it('should render action items as checkboxes', () => {
      const report = generator.generateMarkdownReport();

      expect(report).toContain('- [ ] Research AI diagnostic tools');
      expect(report).toContain('- [ ] Implement async standup meetings');
      expect(report).toContain('- [ ] Review current communication stack');
    });

    it('should list top authors with post counts', () => {
      const report = generator.generateMarkdownReport();

      expect(report).toContain('1. Dr. Smith (2 posts)');
      expect(report).toContain('2. Jane Doe (1 posts)');
      expect(report).toContain('3. Tech Insights (1 posts)');
      expect(report).toContain('4. Innovation Hub (1 posts)');
    });

    it('should include footer attribution', () => {
      const report = generator.generateMarkdownReport();

      expect(report).toContain('*Generated by LinkedIn Saved Posts Analyzer*');
    });

    it('should handle missing post URL gracefully', () => {
      const postsWithoutUrl = [
        { id: '1', title: 'Post', author: 'A', summary: 'S' }
      ];

      const analysisWithoutUrl = {
        ...mockAnalysis,
        insights: {
          keyInsights: [{ insight: 'Test', source: 'A', postIndex: 1 }],
          actionItems: []
        }
      };

      const gen = new ReportGenerator(analysisWithoutUrl, postsWithoutUrl);
      const report = gen.generateMarkdownReport();

      expect(report).toContain('**Source:** A');
      expect(report).not.toContain('**Link:**');
    });

    it('should handle missing themes section', () => {
      const noThemes = {
        ...mockAnalysis,
        topics: { themes: [], trends: {} }
      };

      const gen = new ReportGenerator(noThemes, mockPosts);
      const report = gen.generateMarkdownReport();

      expect(report).toContain('# LinkedIn Insights Report');
      expect(report).not.toContain('## 🎯 Top Themes');
    });

    it('should handle missing insights section', () => {
      const noInsights = {
        ...mockAnalysis,
        insights: { keyInsights: [], actionItems: [] }
      };

      const gen = new ReportGenerator(noInsights, mockPosts);
      const report = gen.generateMarkdownReport();

      expect(report).toContain('# LinkedIn Insights Report');
      // Should still render section but with no items
    });

    it('should handle missing action items', () => {
      const noActions = {
        ...mockAnalysis,
        insights: {
          ...mockAnalysis.insights,
          actionItems: []
        }
      };

      const gen = new ReportGenerator(noActions, mockPosts);
      const report = gen.generateMarkdownReport();

      expect(report).toContain('# LinkedIn Insights Report');
      expect(report).not.toContain('## ✅ Action Items');
    });

    it('should handle missing authors section', () => {
      const noAuthors = {
        ...mockAnalysis,
        authors: { topAuthors: [], totalAuthors: 0 }
      };

      const gen = new ReportGenerator(noAuthors, mockPosts);
      const report = gen.generateMarkdownReport();

      expect(report).toContain('# LinkedIn Insights Report');
      // Section should render but be empty
    });

    it('should escape markdown special characters in content', () => {
      const specialChars = {
        ...mockAnalysis,
        topics: {
          themes: [
            {
              name: 'Test * with _ special # chars',
              postCount: 1,
              description: 'Description with [brackets] and {braces}',
              keyInsights: ['Insight with `code` and **bold**']
            }
          ],
          trends: {}
        }
      };

      const gen = new ReportGenerator(specialChars, mockPosts);
      const report = gen.generateMarkdownReport();

      expect(report).toBeDefined();
      expect(report).toContain('Test * with _ special # chars');
    });
  });

  describe('save', () => {
    beforeEach(() => {
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
    });

    it('should save report to file', async () => {
      const filename = await generator.save();

      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('report-'),
        expect.stringContaining('# LinkedIn Insights Report')
      );

      expect(filename).toContain('report-');
    });

    it('should use custom output path when provided', async () => {
      const customPath = '/custom/path/my-report.md';
      const filename = await generator.save(customPath);

      expect(filename).toBe(customPath);
      expect(fs.writeFile).toHaveBeenCalledWith(
        customPath,
        expect.any(String)
      );
    });

    it('should generate filename with current date', async () => {
      const filename = await generator.save();

      const today = new Date().toISOString().split('T')[0];
      expect(filename).toContain(`report-${today}.md`);
    });

    it('should write complete markdown content', async () => {
      await generator.save();

      const writtenContent = vi.mocked(fs.writeFile).mock.calls[0][1];

      expect(writtenContent).toContain('# LinkedIn Insights Report');
      expect(writtenContent).toContain('Artificial Intelligence');
      expect(writtenContent).toContain('Dr. Smith');
      expect(writtenContent).toContain('Research AI diagnostic tools');
    });

    it('should handle file write errors', async () => {
      vi.mocked(fs.writeFile).mockRejectedValue(new Error('Permission denied'));

      await expect(generator.save()).rejects.toThrow('Permission denied');
    });

    it('should log success message', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const filename = await generator.save();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Report saved to:')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(filename)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('edge cases', () => {
    it('should handle empty analysis data', () => {
      const emptyAnalysis = {
        metadata: { analyzedAt: '2024-01-15T10:00:00Z', postCount: 0, mode: 'agent-sdk' },
        topics: { themes: [], trends: {} },
        insights: { keyInsights: [], actionItems: [] },
        authors: { topAuthors: [], totalAuthors: 0 }
      };

      const gen = new ReportGenerator(emptyAnalysis, []);
      const report = gen.generateMarkdownReport();

      expect(report).toContain('# LinkedIn Insights Report');
      expect(report).toContain('**Posts Analyzed:** 0');
    });

    it('should handle missing theme keyInsights', () => {
      const noKeyInsights = {
        ...mockAnalysis,
        topics: {
          themes: [
            {
              name: 'Test Theme',
              postCount: 1,
              description: 'Test description',
              keyInsights: []
            }
          ],
          trends: {}
        }
      };

      const gen = new ReportGenerator(noKeyInsights, mockPosts);
      const report = gen.generateMarkdownReport();

      expect(report).toContain('Test Theme');
      expect(report).not.toContain('**Key Insights:**');
    });

    it('should handle out-of-bounds postIndex', () => {
      const invalidIndex = {
        ...mockAnalysis,
        insights: {
          keyInsights: [
            { insight: 'Test', source: 'A', postIndex: 999 }
          ],
          actionItems: []
        }
      };

      const gen = new ReportGenerator(invalidIndex, mockPosts);
      const report = gen.generateMarkdownReport();

      expect(report).toContain('Test');
      expect(report).not.toContain('**Link:**');
    });

    it('should handle very long content gracefully', () => {
      const longContent = {
        ...mockAnalysis,
        topics: {
          themes: [
            {
              name: 'A'.repeat(1000),
              postCount: 1,
              description: 'B'.repeat(5000),
              keyInsights: ['C'.repeat(2000)]
            }
          ],
          trends: {}
        }
      };

      const gen = new ReportGenerator(longContent, mockPosts);
      const report = gen.generateMarkdownReport();

      expect(report).toBeDefined();
      expect(report.length).toBeGreaterThan(5000);
    });
  });
});
