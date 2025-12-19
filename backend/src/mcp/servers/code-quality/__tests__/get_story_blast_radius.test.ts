/**
 * Unit tests for get_story_blast_radius MCP tool - ST-355
 *
 * Tests cover blast radius analysis:
 * - Direct file changes from commits
 * - Indirect impact analysis
 * - Test file detection
 * - Risk assessment and scoring
 * - File suggestions when no commits exist
 */

import { PrismaClient } from '@prisma/client';
import { handler } from '../get_story_blast_radius';

describe('get_story_blast_radius MCP Tool', () => {
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      story: {
        findUnique: jest.fn(),
      },
      codeMetrics: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // GROUP 1: Input Validation
  // ==========================================================================

  describe('Input Validation', () => {
    it('should throw error when story not found', async () => {
      mockPrisma.story.findUnique.mockResolvedValue(null);

      await expect(
        handler(mockPrisma as PrismaClient, { storyId: 'nonexistent' })
      ).rejects.toThrow('Story not found: nonexistent');
    });

    it('should handle missing includeSuggestions parameter', async () => {
      const mockStory = createMockStory();
      mockPrisma.story.findUnique.mockResolvedValue(mockStory);
      mockPrisma.codeMetrics.findMany.mockResolvedValue([]);

      const result: any = await handler(mockPrisma as PrismaClient, { storyId: 'story-123' });

      expect(result.content[0].type).toBe('text');
    });
  });

  // ==========================================================================
  // GROUP 2: Direct File Analysis
  // ==========================================================================

  describe('Direct File Analysis', () => {
    it('should analyze direct file changes from commits', async () => {
      const mockStory = createMockStory({
        commits: [
          {
            hash: 'abc123',
            message: 'Fix bug',
            timestamp: new Date('2025-01-01'),
            files: [
              { filePath: 'backend/src/auth.ts', locAdded: 10, locDeleted: 5 },
              { filePath: 'backend/src/user.ts', locAdded: 20, locDeleted: 3 },
            ],
          },
        ],
      });

      mockPrisma.story.findUnique.mockResolvedValue(mockStory);
      mockPrisma.codeMetrics.findMany.mockResolvedValue([
        createMockMetric('backend/src/auth.ts', { linesOfCode: 100, cyclomaticComplexity: 5 }),
        createMockMetric('backend/src/user.ts', { linesOfCode: 150, cyclomaticComplexity: 8 }),
      ]);
      mockPrisma.codeMetrics.findFirst.mockResolvedValue(null);

      const result: any = await handler(mockPrisma as PrismaClient, { storyId: 'story-123' });
      const data = JSON.parse(result.content[0].text);

      expect(data.blastRadius.direct.fileCount).toBe(2);
      expect(data.blastRadius.direct.totalLoc).toBe(250);
      expect(data.blastRadius.direct.files).toHaveLength(2);
      expect(data.blastRadius.direct.files[0].changes).toEqual({ added: 10, deleted: 5 });
    });

    it('should aggregate changes from multiple commits', async () => {
      const mockStory = createMockStory({
        commits: [
          {
            hash: 'commit1',
            message: 'Add feature',
            timestamp: new Date('2025-01-01'),
            files: [{ filePath: 'src/main.ts', locAdded: 10, locDeleted: 0 }],
          },
          {
            hash: 'commit2',
            message: 'Fix typo',
            timestamp: new Date('2025-01-02'),
            files: [{ filePath: 'src/main.ts', locAdded: 0, locDeleted: 2 }],
          },
        ],
      });

      mockPrisma.story.findUnique.mockResolvedValue(mockStory);
      mockPrisma.codeMetrics.findMany.mockResolvedValue([
        createMockMetric('src/main.ts', { linesOfCode: 100 }),
      ]);
      mockPrisma.codeMetrics.findFirst.mockResolvedValue(null);

      const result: any = await handler(mockPrisma as PrismaClient, { storyId: 'story-123' });
      const data = JSON.parse(result.content[0].text);

      expect(data.blastRadius.direct.fileCount).toBe(1);
      expect(data.blastRadius.direct.files[0].changes).toEqual({ added: 10, deleted: 2 });
    });

    it('should calculate file metrics correctly', async () => {
      const mockStory = createMockStory({
        commits: [
          {
            hash: 'abc123',
            message: 'Test',
            timestamp: new Date(),
            files: [{ filePath: 'src/complex.ts', locAdded: 50, locDeleted: 10 }],
          },
        ],
      });

      mockPrisma.story.findUnique.mockResolvedValue(mockStory);
      mockPrisma.codeMetrics.findMany.mockResolvedValue([
        createMockMetric('src/complex.ts', {
          linesOfCode: 500,
          cyclomaticComplexity: 20,
          maintainabilityIndex: 45,
          testCoverage: 30,
        }),
      ]);
      mockPrisma.codeMetrics.findFirst.mockResolvedValue(null);

      const result: any = await handler(mockPrisma as PrismaClient, { storyId: 'story-123' });
      const data = JSON.parse(result.content[0].text);

      expect(data.blastRadius.direct.avgComplexity).toBe(20);
      expect(data.blastRadius.direct.avgCoverage).toBe(30);
      expect(data.blastRadius.direct.files[0].maintainability).toBe(45);
    });
  });

  // ==========================================================================
  // GROUP 3: Indirect Impact Analysis
  // ==========================================================================

  describe('Indirect Impact Analysis', () => {
    it('should identify files that depend on changed files', async () => {
      const mockStory = createMockStory({
        commits: [
          {
            hash: 'abc123',
            message: 'Change API',
            timestamp: new Date(),
            files: [{ filePath: 'src/api.ts', locAdded: 10, locDeleted: 5 }],
          },
        ],
      });

      mockPrisma.story.findUnique.mockResolvedValue(mockStory);
      mockPrisma.codeMetrics.findMany.mockResolvedValue([
        createMockMetric('src/api.ts', {
          linesOfCode: 100,
          metadata: { importedBy: ['src/controller.ts', 'src/service.ts'] },
        }),
      ]);
      mockPrisma.codeMetrics.findFirst.mockResolvedValue(null);

      const result: any = await handler(mockPrisma as PrismaClient, { storyId: 'story-123' });
      const data = JSON.parse(result.content[0].text);

      expect(data.blastRadius.indirect.fileCount).toBe(2);
      expect(data.blastRadius.indirect.files).toContain('src/controller.ts');
      expect(data.blastRadius.indirect.files).toContain('src/service.ts');
    });

    it('should not include direct files in indirect list', async () => {
      const mockStory = createMockStory({
        commits: [
          {
            hash: 'abc123',
            message: 'Test',
            timestamp: new Date(),
            files: [
              { filePath: 'src/a.ts', locAdded: 10, locDeleted: 0 },
              { filePath: 'src/b.ts', locAdded: 5, locDeleted: 0 },
            ],
          },
        ],
      });

      mockPrisma.story.findUnique.mockResolvedValue(mockStory);
      mockPrisma.codeMetrics.findMany.mockResolvedValue([
        createMockMetric('src/a.ts', { metadata: { importedBy: ['src/b.ts', 'src/c.ts'] } }),
        createMockMetric('src/b.ts', { metadata: { importedBy: ['src/a.ts'] } }),
      ]);
      mockPrisma.codeMetrics.findFirst.mockResolvedValue(null);

      const result: any = await handler(mockPrisma as PrismaClient, { storyId: 'story-123' });
      const data = JSON.parse(result.content[0].text);

      // src/a.ts and src/b.ts are direct, so they shouldn't be in indirect
      expect(data.blastRadius.indirect.files).not.toContain('src/a.ts');
      expect(data.blastRadius.indirect.files).not.toContain('src/b.ts');
      expect(data.blastRadius.indirect.files).toContain('src/c.ts');
    });
  });

  // ==========================================================================
  // GROUP 4: Test File Detection
  // ==========================================================================

  describe('Test File Detection', () => {
    it('should detect test files from importedBy metadata', async () => {
      const mockStory = createMockStory({
        commits: [
          {
            hash: 'abc123',
            message: 'Test',
            timestamp: new Date(),
            files: [{ filePath: 'src/service.ts', locAdded: 10, locDeleted: 0 }],
          },
        ],
      });

      mockPrisma.story.findUnique.mockResolvedValue(mockStory);
      mockPrisma.codeMetrics.findMany.mockResolvedValue([
        createMockMetric('src/service.ts', {
          metadata: { importedBy: ['src/service.spec.ts', 'src/other.ts'] },
        }),
      ]);
      mockPrisma.codeMetrics.findFirst.mockResolvedValue(null);

      const result: any = await handler(mockPrisma as PrismaClient, { storyId: 'story-123' });
      const data = JSON.parse(result.content[0].text);

      expect(data.blastRadius.tests.files).toContain('src/service.spec.ts');
    });

    it('should find corresponding test files', async () => {
      const mockStory = createMockStory({
        commits: [
          {
            hash: 'abc123',
            message: 'Test',
            timestamp: new Date(),
            files: [{ filePath: 'src/auth.ts', locAdded: 10, locDeleted: 0 }],
          },
        ],
      });

      mockPrisma.story.findUnique.mockResolvedValue(mockStory);
      mockPrisma.codeMetrics.findMany.mockResolvedValue([
        createMockMetric('src/auth.ts', { metadata: {} }),
      ]);
      mockPrisma.codeMetrics.findFirst.mockResolvedValueOnce({
        filePath: 'src/auth.spec.ts',
      });

      const result: any = await handler(mockPrisma as PrismaClient, { storyId: 'story-123' });
      const data = JSON.parse(result.content[0].text);

      expect(data.blastRadius.tests.files).toContain('src/auth.spec.ts');
    });

    it('should recommend creating tests when none exist', async () => {
      const mockStory = createMockStory({
        commits: [
          {
            hash: 'abc123',
            message: 'Test',
            timestamp: new Date(),
            files: [{ filePath: 'src/new.ts', locAdded: 50, locDeleted: 0 }],
          },
        ],
      });

      mockPrisma.story.findUnique.mockResolvedValue(mockStory);
      mockPrisma.codeMetrics.findMany.mockResolvedValue([
        createMockMetric('src/new.ts', { metadata: {} }),
      ]);
      mockPrisma.codeMetrics.findFirst.mockResolvedValue(null);

      const result: any = await handler(mockPrisma as PrismaClient, { storyId: 'story-123' });
      const data = JSON.parse(result.content[0].text);

      expect(data.blastRadius.tests.fileCount).toBe(0);
      expect(data.blastRadius.tests.recommendation).toBe('Create test files for all changed files');
    });
  });

  // ==========================================================================
  // GROUP 5: Risk Assessment
  // ==========================================================================

  describe('Risk Assessment', () => {
    it('should calculate HIGH risk for complex code with poor coverage', async () => {
      const mockStory = createMockStory({
        commits: [
          {
            hash: 'abc123',
            message: 'Test',
            timestamp: new Date(),
            files: [{ filePath: 'src/complex.ts', locAdded: 100, locDeleted: 50 }],
          },
        ],
      });

      mockPrisma.story.findUnique.mockResolvedValue(mockStory);
      mockPrisma.codeMetrics.findMany.mockResolvedValue([
        createMockMetric('src/complex.ts', {
          linesOfCode: 1500,
          cyclomaticComplexity: 25,
          testCoverage: 30,
          metadata: { importedBy: Array(15).fill('file.ts') },
        }),
      ]);
      mockPrisma.codeMetrics.findFirst.mockResolvedValue(null);

      const result: any = await handler(mockPrisma as PrismaClient, { storyId: 'story-123' });
      const data = JSON.parse(result.content[0].text);

      expect(data.blastRadius.risk.level).toBe('HIGH');
      expect(data.blastRadius.risk.score).toBeGreaterThanOrEqual(70);
    });

    it('should calculate LOW risk for simple code with good coverage', async () => {
      const mockStory = createMockStory({
        commits: [
          {
            hash: 'abc123',
            message: 'Test',
            timestamp: new Date(),
            files: [{ filePath: 'src/simple.ts', locAdded: 10, locDeleted: 5 }],
          },
        ],
      });

      mockPrisma.story.findUnique.mockResolvedValue(mockStory);
      mockPrisma.codeMetrics.findMany.mockResolvedValue([
        createMockMetric('src/simple.ts', {
          linesOfCode: 100,
          cyclomaticComplexity: 3,
          testCoverage: 90,
          metadata: { importedBy: [] },
        }),
      ]);
      mockPrisma.codeMetrics.findFirst.mockResolvedValue(null);

      const result: any = await handler(mockPrisma as PrismaClient, { storyId: 'story-123' });
      const data = JSON.parse(result.content[0].text);

      expect(data.blastRadius.risk.level).toBe('LOW');
      expect(data.blastRadius.risk.score).toBeLessThan(50);
    });

    it('should calculate MEDIUM risk for moderate complexity', async () => {
      const mockStory = createMockStory({
        commits: [
          {
            hash: 'abc123',
            message: 'Test',
            timestamp: new Date(),
            files: [{ filePath: 'src/moderate.ts', locAdded: 50, locDeleted: 20 }],
          },
        ],
      });

      mockPrisma.story.findUnique.mockResolvedValue(mockStory);
      mockPrisma.codeMetrics.findMany.mockResolvedValue([
        createMockMetric('src/moderate.ts', {
          linesOfCode: 600,
          cyclomaticComplexity: 12,
          testCoverage: 60,
          metadata: { importedBy: Array(7).fill('file.ts') },
        }),
      ]);
      mockPrisma.codeMetrics.findFirst.mockResolvedValue(null);

      const result: any = await handler(mockPrisma as PrismaClient, { storyId: 'story-123' });
      const data = JSON.parse(result.content[0].text);

      expect(data.blastRadius.risk.level).toBe('MEDIUM');
      expect(data.blastRadius.risk.score).toBeGreaterThanOrEqual(50);
      expect(data.blastRadius.risk.score).toBeLessThan(70);
    });
  });

  // ==========================================================================
  // GROUP 6: File Suggestions (No Commits)
  // ==========================================================================

  describe('File Suggestions', () => {
    it('should suggest files when no commits exist and includeSuggestions is true', async () => {
      const mockStory = createMockStory({
        title: 'Add authentication',
        description: 'Implement user authentication',
        commits: [],
      });

      mockPrisma.story.findUnique.mockResolvedValue(mockStory);
      mockPrisma.codeMetrics.findMany.mockResolvedValue([
        { filePath: 'src/auth/login.ts' },
        { filePath: 'src/auth/register.ts' },
        { filePath: 'src/user/profile.ts' },
      ]);

      const result: any = await handler(mockPrisma as PrismaClient, {
        storyId: 'story-123',
        includeSuggestions: true,
      });
      const data = JSON.parse(result.content[0].text);

      expect(data.analysis.suggestedFiles.length).toBeGreaterThan(0);
      expect(data.analysis.suggestedFiles).toContain('src/auth/login.ts');
    });

    it('should not suggest files when includeSuggestions is false', async () => {
      const mockStory = createMockStory({ commits: [] });

      mockPrisma.story.findUnique.mockResolvedValue(mockStory);
      mockPrisma.codeMetrics.findMany.mockResolvedValue([]);

      const result: any = await handler(mockPrisma as PrismaClient, {
        storyId: 'story-123',
        includeSuggestions: false,
      });
      const data = JSON.parse(result.content[0].text);

      expect(data.blastRadius.direct.fileCount).toBe(0);
      expect(data.analysis.suggestedFiles).toEqual([]);
    });

    it('should match files based on keywords', async () => {
      const mockStory = createMockStory({
        title: 'Fix payment bug',
        description: 'Fix issue with payment processing',
        commits: [],
      });

      mockPrisma.story.findUnique.mockResolvedValue(mockStory);
      mockPrisma.codeMetrics.findMany.mockResolvedValue([
        { filePath: 'src/payment/checkout.ts' },
        { filePath: 'src/payment/processor.ts' },
        { filePath: 'src/auth/login.ts' },
      ]);

      const result: any = await handler(mockPrisma as PrismaClient, {
        storyId: 'story-123',
        includeSuggestions: true,
      });
      const data = JSON.parse(result.content[0].text);

      expect(data.analysis.suggestedFiles).toContain('src/payment/checkout.ts');
      expect(data.analysis.suggestedFiles).toContain('src/payment/processor.ts');
      expect(data.analysis.suggestedFiles).not.toContain('src/auth/login.ts');
    });
  });

  // ==========================================================================
  // GROUP 7: Insights and Recommendations
  // ==========================================================================

  describe('Insights and Recommendations', () => {
    it('should generate appropriate insights for high risk', async () => {
      const mockStory = createMockStory({
        commits: [
          {
            hash: 'abc123',
            message: 'Test',
            timestamp: new Date(),
            files: [{ filePath: 'src/critical.ts', locAdded: 100, locDeleted: 50 }],
          },
        ],
      });

      mockPrisma.story.findUnique.mockResolvedValue(mockStory);
      mockPrisma.codeMetrics.findMany.mockResolvedValue([
        createMockMetric('src/critical.ts', {
          linesOfCode: 2000,
          cyclomaticComplexity: 30,
          testCoverage: 20,
          metadata: { importedBy: Array(20).fill('file.ts') },
        }),
      ]);
      mockPrisma.codeMetrics.findFirst.mockResolvedValue(null);

      const result: any = await handler(mockPrisma as PrismaClient, { storyId: 'story-123' });
      const data = JSON.parse(result.content[0].text);

      expect(data.insights.some((i: string) => i.includes('HIGH RISK'))).toBe(true);
      expect(data.insights.some((i: string) => i.includes('CRITICAL'))).toBe(true);
      expect(data.insights.some((i: string) => i.includes('COMPLEX CODE'))).toBe(true);
    });

    it('should include recommendations', async () => {
      const mockStory = createMockStory({
        commits: [
          {
            hash: 'abc123',
            message: 'Test',
            timestamp: new Date(),
            files: [{ filePath: 'src/test.ts', locAdded: 10, locDeleted: 0 }],
          },
        ],
      });

      mockPrisma.story.findUnique.mockResolvedValue(mockStory);
      mockPrisma.codeMetrics.findMany.mockResolvedValue([
        createMockMetric('src/test.ts', { linesOfCode: 100 }),
      ]);
      mockPrisma.codeMetrics.findFirst.mockResolvedValue(null);

      const result: any = await handler(mockPrisma as PrismaClient, { storyId: 'story-123' });
      const data = JSON.parse(result.content[0].text);

      expect(data.recommendations).toBeDefined();
      expect(data.recommendations.length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // Helper Functions
  // ==========================================================================

  function createMockStory(overrides: any = {}) {
    return {
      id: 'story-123',
      key: 'ST-123',
      title: 'Test Story',
      description: 'Test description',
      status: 'impl',
      projectId: 'project-456',
      epicId: null,
      technicalComplexity: 5,
      commits: [],
      project: { name: 'Test Project' },
      ...overrides,
    };
  }

  function createMockMetric(filePath: string, overrides: any = {}) {
    return {
      filePath,
      linesOfCode: 100,
      cyclomaticComplexity: 5,
      maintainabilityIndex: 70,
      testCoverage: 80,
      metadata: {},
      ...overrides,
    };
  }
});
