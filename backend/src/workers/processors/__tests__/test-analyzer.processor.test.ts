/**
 * Unit tests for TestAnalyzerProcessor - ST-355
 *
 * Tests cover test analysis functionality:
 * - Test result parsing
 * - Coverage report analysis
 * - Coverage gap calculation
 * - Test recommendations
 * - Metrics storage
 */

import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { PrismaClient } from '@prisma/client';
import { TestAnalyzerProcessor } from '../test-analyzer.processor';

describe('TestAnalyzerProcessor', () => {
  let processor: TestAnalyzerProcessor;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      codeMetrics: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
      testCase: {
        findMany: jest.fn(),
      },
      story: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    processor = new TestAnalyzerProcessor(mockPrisma as PrismaClient);
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // GROUP 1: Analyze Test Results
  // ==========================================================================

  describe('analyzeTestResults', () => {
    it('should analyze test results successfully', async () => {
      const jobData = {
        projectId: 'project-123',
        storyId: 'story-456',
        testResults: {
          tests: [
            { name: 'test1', status: 'passed' as const, duration: 100 },
            { name: 'test2', status: 'passed' as const, duration: 150 },
            { name: 'test3', status: 'failed' as const, duration: 50 },
          ],
          duration: 300,
        },
        coverageReport: {
          overall: 75,
          lines: 80,
          branches: 70,
          functions: 85,
          statements: 78,
        },
      };

      const job = { data: jobData } as Job<any>;

      mockPrisma.story.findUnique.mockResolvedValue({
        id: 'story-456',
        metadata: {},
      });
      mockPrisma.story.update.mockResolvedValue({});

      const result = await processor.analyzeTestResults(job);

      expect(result.success).toBe(true);
      expect(result.stats.total).toBe(3);
      expect(result.stats.passed).toBe(2);
      expect(result.stats.failed).toBe(1);
      expect(result.coverage!.overall).toBe(75);
    });

    it('should handle test results without coverage', async () => {
      const jobData = {
        projectId: 'project-123',
        testResults: {
          tests: [{ name: 'test1', status: 'passed' as const }],
        },
      };

      const job = { data: jobData } as Job<any>;

      const result = await processor.analyzeTestResults(job);

      expect(result.success).toBe(true);
      expect(result.coverage).toBeNull();
    });

    it('should count skipped tests correctly', async () => {
      const jobData = {
        projectId: 'project-123',
        testResults: {
          tests: [
            { name: 'test1', status: 'passed' as const },
            { name: 'test2', status: 'skipped' as const },
            { name: 'test3', status: 'skipped' as const },
          ],
        },
      };

      const job = { data: jobData } as Job<any>;

      const result = await processor.analyzeTestResults(job);

      expect(result.stats.passed).toBe(1);
      expect(result.stats.skipped).toBe(2);
    });

    it('should warn when tests fail', async () => {
      const jobData = {
        projectId: 'project-123',
        testResults: {
          tests: [
            { name: 'test1', status: 'failed' as const },
            { name: 'test2', status: 'failed' as const },
          ],
        },
      };

      const job = { data: jobData } as Job<any>;

      await processor.analyzeTestResults(job);

      expect(Logger.prototype.warn).toHaveBeenCalledWith('2 test(s) failed');
    });

    it('should warn when coverage is below threshold', async () => {
      const jobData = {
        projectId: 'project-123',
        testResults: { tests: [] },
        coverageReport: { overall: 60 },
      };

      const job = { data: jobData } as Job<any>;

      await processor.analyzeTestResults(job);

      expect(Logger.prototype.warn).toHaveBeenCalledWith(
        expect.stringContaining('Coverage 60% is below threshold')
      );
    });

    it('should store test execution for story', async () => {
      const jobData = {
        projectId: 'project-123',
        storyId: 'story-456',
        testResults: {
          tests: [{ name: 'test1', status: 'passed' as const }],
        },
        coverageReport: { overall: 85 },
      };

      const job = { data: jobData } as Job<any>;

      mockPrisma.story.findUnique.mockResolvedValue({
        id: 'story-456',
        metadata: { existing: 'data' },
      });
      mockPrisma.story.update.mockResolvedValue({});

      await processor.analyzeTestResults(job);

      expect(mockPrisma.story.update).toHaveBeenCalledWith({
        where: { id: 'story-456' },
        data: {
          metadata: expect.objectContaining({
            existing: 'data',
            lastTestExecution: expect.objectContaining({
              total: 1,
              passed: 1,
              failed: 0,
              coverage: expect.objectContaining({ overall: 85 }),
            }),
          }),
        },
      });
    });

    it('should handle errors gracefully', async () => {
      const jobData = {
        projectId: 'project-123',
        storyId: 'story-456', // storyId is needed to trigger the error path
        testResults: { tests: [] },
      };

      const job = { data: jobData } as Job<any>;

      mockPrisma.story.findUnique.mockRejectedValue(new Error('Database error'));

      await expect(processor.analyzeTestResults(job)).rejects.toThrow('Database error');
    });
  });

  // ==========================================================================
  // GROUP 2: Calculate Coverage Gaps
  // ==========================================================================

  describe('calculateCoverageGaps', () => {
    it('should calculate coverage gaps successfully', async () => {
      const jobData = { projectId: 'project-123' };
      const job = { data: jobData } as Job<any>;

      mockPrisma.codeMetrics.findMany.mockResolvedValue([
        {
          filePath: 'src/auth.ts',
          linesOfCode: 100,
          metadata: { coverage: 50 },
        },
        {
          filePath: 'src/user.ts',
          linesOfCode: 200,
          metadata: { coverage: 90 },
        },
      ]);

      mockPrisma.testCase.findMany.mockResolvedValue([
        { testLevel: 'unit', executions: [] },
        { testLevel: 'integration', executions: [] },
      ]);

      const result = await processor.calculateCoverageGaps(job);

      expect(result.success).toBe(true);
      expect(result.gaps).toBeDefined();
      expect(result.gaps[0].totalFiles).toBe(2);
      expect(result.gaps[0].totalLOC).toBe(300);
    });

    it('should identify files with low coverage as gaps', async () => {
      const jobData = { projectId: 'project-123' };
      const job = { data: jobData } as Job<any>;

      mockPrisma.codeMetrics.findMany.mockResolvedValue([
        {
          filePath: 'src/uncovered.ts',
          linesOfCode: 100,
          metadata: { coverage: 30 },
        },
      ]);

      mockPrisma.testCase.findMany.mockResolvedValue([]);

      const result = await processor.calculateCoverageGaps(job);

      expect(result.gaps[0].gaps).toHaveLength(1);
      expect(result.gaps[0].gaps[0].filePath).toBe('src/uncovered.ts');
      expect(result.gaps[0].gaps[0].currentCoverage).toBe(30);
      expect(result.gaps[0].gaps[0].priority).toBe('high');
    });

    it('should mark medium priority for moderate coverage', async () => {
      const jobData = { projectId: 'project-123' };
      const job = { data: jobData } as Job<any>;

      mockPrisma.codeMetrics.findMany.mockResolvedValue([
        {
          filePath: 'src/moderate.ts',
          linesOfCode: 100,
          metadata: { coverage: 60 },
        },
      ]);

      mockPrisma.testCase.findMany.mockResolvedValue([]);

      const result = await processor.calculateCoverageGaps(job);

      expect(result.gaps[0].gaps[0].priority).toBe('medium');
    });

    it('should count test cases by level', async () => {
      const jobData = { projectId: 'project-123' };
      const job = { data: jobData } as Job<any>;

      mockPrisma.codeMetrics.findMany.mockResolvedValue([
        { filePath: 'src/test.ts', linesOfCode: 100, metadata: { coverage: 80 } },
      ]);

      mockPrisma.testCase.findMany.mockResolvedValue([
        { testLevel: 'unit', executions: [] },
        { testLevel: 'unit', executions: [] },
        { testLevel: 'integration', executions: [] },
        { testLevel: 'e2e', executions: [] },
      ]);

      const result = await processor.calculateCoverageGaps(job);

      expect(result.gaps[0].testCases.unit).toBe(2);
      expect(result.gaps[0].testCases.integration).toBe(1);
      expect(result.gaps[0].testCases.e2e).toBe(1);
    });

    it('should handle files without coverage metadata', async () => {
      const jobData = { projectId: 'project-123' };
      const job = { data: jobData } as Job<any>;

      mockPrisma.codeMetrics.findMany.mockResolvedValue([
        { filePath: 'src/no-coverage.ts', linesOfCode: 100, metadata: null },
      ]);

      mockPrisma.testCase.findMany.mockResolvedValue([]);

      const result = await processor.calculateCoverageGaps(job);

      expect(result.gaps[0].coveredLOC).toBe(0);
    });

    it('should calculate coverage percentage correctly', async () => {
      const jobData = { projectId: 'project-123' };
      const job = { data: jobData } as Job<any>;

      mockPrisma.codeMetrics.findMany.mockResolvedValue([
        { filePath: 'src/half.ts', linesOfCode: 200, metadata: { coverage: 50 } },
      ]);

      mockPrisma.testCase.findMany.mockResolvedValue([]);

      const result = await processor.calculateCoverageGaps(job);

      expect(result.gaps[0].coveragePercentage).toBe(50);
      expect(result.gaps[0].coveredLOC).toBe(100);
    });

    it('should handle errors gracefully', async () => {
      const jobData = { projectId: 'project-123' };
      const job = { data: jobData } as Job<any>;

      mockPrisma.codeMetrics.findMany.mockRejectedValue(new Error('Database error'));

      await expect(processor.calculateCoverageGaps(job)).rejects.toThrow('Database error');
    });
  });

  // ==========================================================================
  // GROUP 3: Generate Test Recommendations
  // ==========================================================================

  describe('generateTestRecommendations', () => {
    it('should recommend unit tests for complex files', async () => {
      const jobData = {
        storyId: 'story-123',
        changedFiles: ['src/complex.ts'],
      };
      const job = { data: jobData } as Job<any>;

      mockPrisma.codeMetrics.findFirst.mockResolvedValue({
        filePath: 'src/complex.ts',
        cyclomaticComplexity: 15,
      });

      const result = await processor.generateTestRecommendations(job);

      expect(result.success).toBe(true);
      expect(result.recommendations).toHaveLength(1);
      expect(result.recommendations[0].type).toBe('unit');
      expect(result.recommendations[0].priority).toBe('high');
    });

    it('should recommend integration tests for API files', async () => {
      const jobData = {
        storyId: 'story-123',
        changedFiles: ['src/api/users.controller.ts'],
      };
      const job = { data: jobData } as Job<any>;

      mockPrisma.codeMetrics.findFirst.mockResolvedValue({
        filePath: 'src/api/users.controller.ts',
        cyclomaticComplexity: 5,
      });

      const result = await processor.generateTestRecommendations(job);

      const integrationRec = result.recommendations.find((r) => r.type === 'integration');
      expect(integrationRec).toBeDefined();
      expect(integrationRec!.suggestedTests).toContain('Test HTTP request/response');
    });

    it('should recommend E2E tests for UI components', async () => {
      const jobData = {
        storyId: 'story-123',
        changedFiles: ['src/components/LoginForm.tsx'],
      };
      const job = { data: jobData } as Job<any>;

      mockPrisma.codeMetrics.findFirst.mockResolvedValue({
        filePath: 'src/components/LoginForm.tsx',
        cyclomaticComplexity: 3,
      });

      const result = await processor.generateTestRecommendations(job);

      const e2eRec = result.recommendations.find((r) => r.type === 'e2e');
      expect(e2eRec).toBeDefined();
      expect(e2eRec!.suggestedTests).toContain('Test user interaction flow');
    });

    it('should skip files without metrics', async () => {
      const jobData = {
        storyId: 'story-123',
        changedFiles: ['src/missing.ts'],
      };
      const job = { data: jobData } as Job<any>;

      mockPrisma.codeMetrics.findFirst.mockResolvedValue(null);

      const result = await processor.generateTestRecommendations(job);

      expect(result.recommendations).toHaveLength(0);
    });

    it('should generate multiple recommendations for complex API components', async () => {
      const jobData = {
        storyId: 'story-123',
        changedFiles: ['src/components/PaymentForm.tsx'],
      };
      const job = { data: jobData } as Job<any>;

      mockPrisma.codeMetrics.findFirst.mockResolvedValue({
        filePath: 'src/components/PaymentForm.tsx',
        cyclomaticComplexity: 12,
      });

      const result = await processor.generateTestRecommendations(job);

      // Should have both unit test (high complexity) and E2E test (component)
      expect(result.recommendations.length).toBeGreaterThan(1);
    });

    it('should handle errors gracefully', async () => {
      const jobData = { storyId: 'story-123', changedFiles: ['src/test.ts'] };
      const job = { data: jobData } as Job<any>;

      mockPrisma.codeMetrics.findFirst.mockRejectedValue(new Error('Database error'));

      await expect(processor.generateTestRecommendations(job)).rejects.toThrow(
        'Database error'
      );
    });
  });

  // ==========================================================================
  // GROUP 4: Helper Methods
  // ==========================================================================

  describe('Helper Methods', () => {
    it('should parse test results correctly', () => {
      const testResults = {
        tests: [
          { name: 'test1', status: 'passed' as const },
          { name: 'test2', status: 'failed' as const },
          { name: 'test3', status: 'skipped' as const },
        ],
        duration: 500,
      };

      const stats = (processor as any).parseTestResults(testResults);

      expect(stats.total).toBe(3);
      expect(stats.passed).toBe(1);
      expect(stats.failed).toBe(1);
      expect(stats.skipped).toBe(1);
      expect(stats.duration).toBe(500);
      expect(stats.timestamp).toBeInstanceOf(Date);
    });

    it('should handle empty test results', () => {
      const testResults = { tests: [] };

      const stats = (processor as any).parseTestResults(testResults);

      expect(stats.total).toBe(0);
      expect(stats.passed).toBe(0);
      expect(stats.failed).toBe(0);
    });

    it('should parse coverage report correctly', () => {
      const coverageReport = {
        overall: 85,
        lines: 90,
        branches: 80,
        functions: 88,
        statements: 87,
      };

      const coverage = (processor as any).parseCoverageReport(coverageReport);

      expect(coverage.overall).toBe(85);
      expect(coverage.lines).toBe(90);
      expect(coverage.branches).toBe(80);
      expect(coverage.functions).toBe(88);
      expect(coverage.statements).toBe(87);
    });

    it('should handle missing coverage fields', () => {
      const coverageReport = { overall: 75 };

      const coverage = (processor as any).parseCoverageReport(coverageReport);

      expect(coverage.overall).toBe(75);
      expect(coverage.lines).toBe(0);
      expect(coverage.branches).toBe(0);
    });
  });

  // ==========================================================================
  // GROUP 5: Edge Cases
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle null metadata when storing test execution', async () => {
      const jobData = {
        projectId: 'project-123',
        storyId: 'story-456',
        testResults: { tests: [{ name: 'test1', status: 'passed' as const }] },
      };
      const job = { data: jobData } as Job<any>;

      mockPrisma.story.findUnique.mockResolvedValue({
        id: 'story-456',
        metadata: null,
      });
      mockPrisma.story.update.mockResolvedValue({});

      await processor.analyzeTestResults(job);

      expect(mockPrisma.story.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            metadata: expect.objectContaining({
              lastTestExecution: expect.any(Object),
            }),
          }),
        })
      );
    });

    it('should handle zero total LOC when calculating coverage percentage', async () => {
      const jobData = { projectId: 'project-123' };
      const job = { data: jobData } as Job<any>;

      mockPrisma.codeMetrics.findMany.mockResolvedValue([]);
      mockPrisma.testCase.findMany.mockResolvedValue([]);

      const result = await processor.calculateCoverageGaps(job);

      expect(result.gaps[0].coveragePercentage).toBe(0);
    });

    it('should handle multiple file types in recommendations', async () => {
      const jobData = {
        storyId: 'story-123',
        changedFiles: [
          'src/api/users.controller.ts',
          'src/pages/Dashboard.tsx',
          'src/utils/helpers.ts',
        ],
      };
      const job = { data: jobData } as Job<any>;

      mockPrisma.codeMetrics.findFirst
        .mockResolvedValueOnce({ filePath: 'src/api/users.controller.ts', cyclomaticComplexity: 5 })
        .mockResolvedValueOnce({ filePath: 'src/pages/Dashboard.tsx', cyclomaticComplexity: 3 })
        .mockResolvedValueOnce({ filePath: 'src/utils/helpers.ts', cyclomaticComplexity: 2 });

      const result = await processor.generateTestRecommendations(job);

      const types = result.recommendations.map((r) => r.type);
      expect(types).toContain('integration'); // API controller
      expect(types).toContain('e2e'); // UI component
    });
  });
});
