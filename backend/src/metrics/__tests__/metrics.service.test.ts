import { Test, TestingModule } from '@nestjs/testing';
import { RunStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TimeGranularity } from '../dto/metrics-query.dto';
import { MetricsService } from '../metrics.service';

describe('MetricsService', () => {
  let service: MetricsService;
  let prismaService: PrismaService;

  const mockWorkflowRuns = [
    {
      id: 'run-1',
      workflowId: 'wf-1',
      storyId: 'story-1',
      status: RunStatus.completed,
      startedAt: new Date('2025-11-01'),
      totalTokens: 50000,
      totalLocGenerated: 1200,
      estimatedCost: 2.5,
      durationSeconds: 300,
      workflow: {
        id: 'wf-1',
        name: 'Test Workflow',
        version: 'v1.0',
      },
      story: {
        id: 'story-1',
        key: 'ST-1',
      },
    },
  ];

  const mockTestCases = [
    { id: 'test-1', title: 'Unit test 1', createdAt: new Date('2025-11-01') },
    { id: 'test-2', title: 'Unit test 2', createdAt: new Date('2025-11-02') },
    { id: 'test-3', title: 'Integration test 1', createdAt: new Date('2025-11-03') },
  ];

  const mockPrismaService = {
    workflowRun: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    componentRun: {
      findMany: jest.fn(),
    },
    testCase: {
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MetricsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<MetricsService>(MetricsService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getWeeklyAggregations', () => {
    it('should include testsAdded in weekly aggregations', async () => {
      mockPrismaService.workflowRun.findMany.mockResolvedValue(mockWorkflowRuns);
      mockPrismaService.testCase.count.mockResolvedValue(3);

      const result = await service.getWeeklyAggregations('project-1', 8);

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);

      // Check that aggregated metrics include testsAdded
      const weeklyAgg = result[0];
      expect(weeklyAgg.aggregated).toBeDefined();
      expect(weeklyAgg.aggregated.testsAdded).toBe(3);

      // Verify testCase.count was called with correct parameters
      expect(mockPrismaService.testCase.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            useCase: expect.any(Object),
            createdAt: expect.any(Object),
          }),
        }),
      );
    });

    it('should handle stories with no tests', async () => {
      mockPrismaService.workflowRun.findMany.mockResolvedValue(mockWorkflowRuns);
      mockPrismaService.testCase.count.mockResolvedValue(0);

      const result = await service.getWeeklyAggregations('project-1', 8);

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);

      // When no tests, testsAdded should be undefined
      const weeklyAgg = result[0];
      expect(weeklyAgg.aggregated.testsAdded).toBeUndefined();
    });

    it('should filter by business complexity', async () => {
      mockPrismaService.workflowRun.findMany.mockResolvedValue(mockWorkflowRuns);
      mockPrismaService.testCase.count.mockResolvedValue(2);

      const result = await service.getWeeklyAggregations('project-1', 8, { businessComplexity: 5 });

      expect(result).toBeDefined();

      // Verify findMany was called with complexity filter
      expect(mockPrismaService.workflowRun.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            story: expect.objectContaining({
              businessComplexity: 5,
            }),
          }),
        }),
      );
    });
  });

  describe('getWorkflowMetrics', () => {
    it('should include testsAdded in workflow metrics', async () => {
      mockPrismaService.workflowRun.findMany.mockResolvedValue(mockWorkflowRuns);
      mockPrismaService.testCase.count.mockResolvedValue(5);

      const result = await service.getWorkflowMetrics('project-1', {
        granularity: TimeGranularity.WEEKLY,
      });

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);

      const workflowMetrics = result[0];
      expect(workflowMetrics.testsAdded).toBe(5);
      expect(workflowMetrics.totalLoc).toBe(1200);
    });
  });

  describe('getTrends', () => {
    it('should return trends including LOC', async () => {
      mockPrismaService.workflowRun.findMany.mockResolvedValue(mockWorkflowRuns);

      const result = await service.getTrends('project-1', {
        granularity: TimeGranularity.WEEKLY,
      });

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);

      // Should have trends for tokens, LOC, cost, duration
      const locTrend = result.find((trend) => trend.metric === 'loc');
      expect(locTrend).toBeDefined();
    });
  });
});
