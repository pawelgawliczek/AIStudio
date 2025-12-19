/**
 * Unit tests for FrameworkMetricsService
 * ST-355: Add unit tests for top 20 uncovered backend files
 */

import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { GetFrameworkMetricsDto } from '../../dto/metrics.dto';
import { FrameworkMetricsService } from '../framework-metrics.service';
import { MetricsAggregationService } from '../metrics-aggregation.service';

describe('FrameworkMetricsService', () => {
  let service: FrameworkMetricsService;
  let mockPrisma: any;
  let mockAggregationService: any;

  beforeEach(() => {
    mockPrisma = {
      project: {
        findUnique: jest.fn(),
      },
      run: {
        findMany: jest.fn(),
      },
      story: {
        findMany: jest.fn(),
      },
    };

    mockAggregationService = {
      groupRunsByStory: jest.fn(),
    };

    service = new FrameworkMetricsService(
      mockPrisma as PrismaService,
      mockAggregationService as MetricsAggregationService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getFrameworkComparison', () => {
    const mockDto: GetFrameworkMetricsDto = {
      projectId: 'project-1',
      frameworkIds: ['framework-1', 'framework-2'],
      dateRange: '30d',
      complexityBand: null,
    };

    it('should throw NotFoundException when project does not exist', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(null);

      await expect(service.getFrameworkComparison(mockDto)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.getFrameworkComparison(mockDto)).rejects.toThrow(
        'Project project-1 not found',
      );
    });

    it('should successfully generate framework comparison', async () => {
      const mockProject = { id: 'project-1', name: 'Test Project' };
      const mockRuns = [
        {
          id: 'run-1',
          storyId: 'story-1',
          frameworkId: 'framework-1',
          success: true,
          tokensInput: 1000,
          tokensOutput: 500,
          startedAt: new Date(),
          framework: { id: 'framework-1', name: 'Framework A' },
          story: { technicalComplexity: 5 },
        },
      ];

      mockPrisma.project.findUnique.mockResolvedValue(mockProject);
      mockPrisma.run.findMany.mockResolvedValue(mockRuns);
      mockPrisma.story.findMany.mockResolvedValue([]);
      mockAggregationService.groupRunsByStory.mockReturnValue(
        new Map([
          [
            'story-1',
            {
              totalTokens: 1500,
              totalLoc: 100,
              cycleTimeHours: 2,
              totalIterations: 3,
            },
          ],
        ]),
      );

      const result = await service.getFrameworkComparison(mockDto);

      expect(result.projectId).toBe('project-1');
      expect(result.projectName).toBe('Test Project');
      expect(result.comparisons).toHaveLength(2);
      expect(result.generatedAt).toBeDefined();
    });

    it('should include AI insights when comparing multiple frameworks', async () => {
      const mockProject = { id: 'project-1', name: 'Test Project' };
      mockPrisma.project.findUnique.mockResolvedValue(mockProject);
      mockPrisma.run.findMany.mockResolvedValue([]);
      mockPrisma.story.findMany.mockResolvedValue([]);

      const result = await service.getFrameworkComparison(mockDto);

      expect(result.aiInsights).toBeDefined();
      expect(Array.isArray(result.aiInsights)).toBe(true);
    });
  });

  describe('calculateFrameworkMetrics', () => {
    it('should return empty metrics when no runs exist', async () => {
      mockPrisma.run.findMany.mockResolvedValue([]);

      const result = await (service as any).calculateFrameworkMetrics(
        'project-1',
        'framework-1',
        null,
        new Date('2024-01-01'),
        new Date('2024-01-31'),
      );

      expect(result.sampleSize).toBe(0);
      expect(result.confidenceLevel).toBe('none');
      expect(result.framework.name).toBe('Unknown');
    });

    it('should calculate metrics for runs with valid data', async () => {
      const mockRuns = [
        {
          id: 'run-1',
          storyId: 'story-1',
          frameworkId: 'framework-1',
          success: true,
          tokensInput: 1000,
          tokensOutput: 500,
          startedAt: new Date(),
          framework: { id: 'framework-1', name: 'Framework A' },
          story: { technicalComplexity: 5 },
        },
        {
          id: 'run-2',
          storyId: 'story-1',
          frameworkId: 'framework-1',
          success: true,
          tokensInput: 800,
          tokensOutput: 400,
          startedAt: new Date(),
          framework: { id: 'framework-1', name: 'Framework A' },
          story: { technicalComplexity: 5 },
        },
      ];

      mockPrisma.run.findMany.mockResolvedValue(mockRuns);
      mockPrisma.story.findMany.mockResolvedValue([]);
      mockAggregationService.groupRunsByStory.mockReturnValue(
        new Map([
          [
            'story-1',
            {
              totalTokens: 2700,
              totalLoc: 150,
              cycleTimeHours: 3,
              totalIterations: 4,
            },
          ],
        ]),
      );

      const result = await (service as any).calculateFrameworkMetrics(
        'project-1',
        'framework-1',
        null,
        new Date('2024-01-01'),
        new Date('2024-01-31'),
      );

      expect(result.sampleSize).toBe(1);
      expect(result.framework.name).toBe('Framework A');
      expect(result.efficiencyMetrics).toBeDefined();
      expect(result.qualityMetrics).toBeDefined();
      expect(result.costMetrics).toBeDefined();
    });
  });

  describe('calculateEfficiencyMetrics', () => {
    it('should calculate efficiency metrics from runs', () => {
      const mockRuns = [
        {
          id: 'run-1',
          storyId: 'story-1',
          tokensInput: 1000,
          tokensOutput: 500,
        },
      ];

      const storyMetrics = [
        {
          totalTokens: 1500,
          totalLoc: 100,
          cycleTimeHours: 2,
          totalIterations: 3,
        },
      ];

      mockAggregationService.groupRunsByStory.mockReturnValue(
        new Map([['story-1', storyMetrics[0]]]),
      );

      const result = (service as any).calculateEfficiencyMetrics(mockRuns);

      expect(result.avgTokensPerStory).toBe(1500);
      expect(result.avgTokenPerLoc).toBe(15);
      expect(result.storyCycleTimeHours).toBe(2);
      expect(result.promptIterationsPerStory).toBe(3);
      expect(result.tokenEfficiencyRatio).toBeCloseTo(0.5, 2);
    });

    it('should handle zero LOC gracefully', () => {
      const mockRuns = [
        {
          id: 'run-1',
          storyId: 'story-1',
          tokensInput: 1000,
          tokensOutput: 500,
        },
      ];

      const storyMetrics = [
        {
          totalTokens: 1500,
          totalLoc: 0,
          cycleTimeHours: 2,
          totalIterations: 3,
        },
      ];

      mockAggregationService.groupRunsByStory.mockReturnValue(
        new Map([['story-1', storyMetrics[0]]]),
      );

      const result = (service as any).calculateEfficiencyMetrics(mockRuns);

      expect(result.avgTokenPerLoc).toBe(0);
    });
  });

  describe('calculateQualityMetrics', () => {
    it('should calculate quality metrics from stories', async () => {
      const mockStories = [
        {
          id: 'story-1',
          defect: null,
          commits: [
            {
              files: [
                {
                  coverageAfter: 80,
                  complexityBefore: 5,
                  complexityAfter: 6,
                  churn: 1,
                },
              ],
            },
          ],
        },
      ];

      mockPrisma.story.findMany.mockResolvedValue(mockStories);

      const result = await (service as any).calculateQualityMetrics(
        'project-1',
        'framework-1',
        null,
        new Date('2024-01-01'),
        new Date('2024-01-31'),
      );

      expect(result.defectsPerStory).toBe(0);
      expect(result.defectLeakagePercent).toBe(0);
      expect(result.testCoveragePercent).toBeGreaterThan(0);
      expect(result.criticalDefects).toBe(0);
    });

    it('should calculate defect metrics correctly', async () => {
      const mockStories = [
        {
          id: 'story-1',
          defect: { severity: 'critical', discoveryStage: 'production' },
          commits: [],
        },
        {
          id: 'story-2',
          defect: { severity: 'low', discoveryStage: 'development' },
          commits: [],
        },
      ];

      mockPrisma.story.findMany.mockResolvedValue(mockStories);

      const result = await (service as any).calculateQualityMetrics(
        'project-1',
        'framework-1',
        null,
        new Date('2024-01-01'),
        new Date('2024-01-31'),
      );

      expect(result.defectsPerStory).toBe(1);
      expect(result.defectLeakagePercent).toBe(50);
      expect(result.criticalDefects).toBe(1);
    });
  });

  describe('calculateCostMetrics', () => {
    it('should calculate cost metrics from runs', () => {
      const mockRuns = [
        {
          id: 'run-1',
          storyId: 'story-1',
          tokensInput: 1000,
          tokensOutput: 500,
        },
      ];

      const storyMetrics = [
        {
          totalTokens: 1500,
          totalLoc: 100,
        },
      ];

      mockAggregationService.groupRunsByStory.mockReturnValue(
        new Map([['story-1', storyMetrics[0]]]),
      );

      const result = (service as any).calculateCostMetrics(mockRuns, 20);

      expect(result.costPerStory).toBeGreaterThan(0);
      expect(result.costPerAcceptedLoc).toBeGreaterThan(0);
      expect(result.storiesCompleted).toBe(1);
      expect(result.acceptedLoc).toBe(100);
      expect(result.reworkCost).toBeGreaterThanOrEqual(0);
      expect(result.netCost).toBeGreaterThan(0);
    });

    it('should handle zero LOC gracefully', () => {
      const mockRuns = [
        {
          id: 'run-1',
          storyId: 'story-1',
          tokensInput: 1000,
          tokensOutput: 500,
        },
      ];

      const storyMetrics = [
        {
          totalTokens: 1500,
          totalLoc: 0,
        },
      ];

      mockAggregationService.groupRunsByStory.mockReturnValue(
        new Map([['story-1', storyMetrics[0]]]),
      );

      const result = (service as any).calculateCostMetrics(mockRuns, 20);

      expect(result.costPerAcceptedLoc).toBe(0);
    });
  });

  describe('calculateCodeQualityMetrics', () => {
    it('should calculate code quality metrics from commits', async () => {
      const mockStories = [
        {
          id: 'story-1',
          commits: [
            {
              files: [
                {
                  coverageAfter: 80,
                  complexityBefore: 5,
                  complexityAfter: 6,
                  churn: 1,
                },
                {
                  coverageAfter: 90,
                  complexityBefore: 3,
                  complexityAfter: 4,
                  churn: 0,
                },
              ],
            },
          ],
        },
      ];

      const result = await (service as any).calculateCodeQualityMetrics(
        mockStories,
      );

      expect(result.avgCoverage).toBeGreaterThan(0);
      expect(result.churnPercent).toBeGreaterThan(0);
      expect(result.complexityDelta).toBeGreaterThan(0);
    });

    it('should use defaults when no file data available', async () => {
      const mockStories = [
        {
          id: 'story-1',
          commits: [
            {
              files: [
                {
                  coverageAfter: null,
                  complexityBefore: null,
                  complexityAfter: null,
                  churn: null,
                },
              ],
            },
          ],
        },
      ];

      const result = await (service as any).calculateCodeQualityMetrics(
        mockStories,
      );

      expect(result.avgCoverage).toBe(85);
      expect(result.churnPercent).toBe(20);
    });
  });

  describe('generateAIInsights', () => {
    it('should generate insights comparing defect rates', () => {
      const mockComparisons = [
        {
          framework: { id: 'f1', name: 'Framework A' },
          qualityMetrics: { defectsPerStory: 0.2 },
          costMetrics: { netCost: 10 },
          sampleSize: 10,
        },
        {
          framework: { id: 'f2', name: 'Framework B' },
          qualityMetrics: { defectsPerStory: 0.4 },
          costMetrics: { netCost: 15 },
          sampleSize: 10,
        },
      ];

      const insights = (service as any).generateAIInsights(mockComparisons);

      expect(insights.some(i => i.includes('Framework A reduces defects'))).toBe(true);
    });

    it('should generate insights comparing costs', () => {
      const mockComparisons = [
        {
          framework: { id: 'f1', name: 'Framework A' },
          qualityMetrics: { defectsPerStory: 0.2 },
          costMetrics: { netCost: 10 },
          sampleSize: 10,
        },
        {
          framework: { id: 'f2', name: 'Framework B' },
          qualityMetrics: { defectsPerStory: 0.2 },
          costMetrics: { netCost: 15 },
          sampleSize: 10,
        },
      ];

      const insights = (service as any).generateAIInsights(mockComparisons);

      expect(insights.some(i => i.includes('Framework A is') && i.includes('cost-effective'))).toBe(true);
    });

    it('should warn about small sample sizes', () => {
      const mockComparisons = [
        {
          framework: { id: 'f1', name: 'Framework A' },
          qualityMetrics: { defectsPerStory: 0.2 },
          costMetrics: { netCost: 10 },
          sampleSize: 3,
        },
        {
          framework: { id: 'f2', name: 'Framework B' },
          qualityMetrics: { defectsPerStory: 0.4 },
          costMetrics: { netCost: 15 },
          sampleSize: 2,
        },
      ];

      const insights = (service as any).generateAIInsights(mockComparisons);

      expect(insights.some(i => i.includes('Small sample size detected'))).toBe(true);
    });

    it('should return empty insights for single framework', () => {
      const mockComparisons = [
        {
          framework: { id: 'f1', name: 'Framework A' },
          qualityMetrics: { defectsPerStory: 0.2 },
          costMetrics: { netCost: 10 },
          sampleSize: 10,
        },
      ];

      const insights = (service as any).generateAIInsights(mockComparisons);

      expect(insights).toEqual([]);
    });
  });
});
