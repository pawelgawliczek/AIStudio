/**
 * Unit tests for WorkflowMetricsService
 * Tests comprehensive workflow metrics and comparison functionality
 */

import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../prisma/prisma.service';
import { ComprehensiveMetricsCalculator } from '../../calculators/comprehensive-metrics.calculator';
import { AggregationLevel } from '../../dto/enums';
import { MetricsAggregationService } from '../metrics-aggregation.service';
import { WorkflowMetricsService } from '../workflow-metrics.service';

describe('WorkflowMetricsService', () => {
  let service: WorkflowMetricsService;
  let mockPrisma: any;
  let mockMetricsCalculator: any;
  let mockAggregationService: any;

  const mockProject = {
    id: 'proj-123',
    name: 'Test Project',
  };

  const mockWorkflow = {
    id: 'wf-123',
    name: 'Test Workflow',
  };

  const mockWorkflowRun = {
    id: 'run-123',
    workflowId: 'wf-123',
    storyId: 'story-123',
    startedAt: new Date('2024-01-01'),
    status: 'completed',
    workflow: mockWorkflow,
    story: {
      id: 'story-123',
      type: 'feature',
      businessComplexity: 5,
      technicalComplexity: 6,
      epic: null,
    },
    componentRuns: [],
  };

  beforeEach(async () => {
    mockPrisma = {
      project: {
        findUnique: jest.fn(),
      },
      workflow: {
        findUnique: jest.fn(),
      },
      workflowRun: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
      },
      componentRun: {
        findMany: jest.fn(),
        aggregate: jest.fn(),
      },
    };

    mockMetricsCalculator = {
      calculateComprehensiveMetrics: jest.fn(),
    };

    mockAggregationService = {
      aggregateByWorkflow: jest.fn(),
      aggregateByStory: jest.fn(),
      aggregateByEpic: jest.fn(),
      aggregateByAgent: jest.fn(),
      calculateWorkflowTrends: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkflowMetricsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ComprehensiveMetricsCalculator, useValue: mockMetricsCalculator },
        { provide: MetricsAggregationService, useValue: mockAggregationService },
      ],
    }).compile();

    service = module.get<WorkflowMetricsService>(WorkflowMetricsService);
    jest.clearAllMocks();
  });

  // ==========================================================================
  // getWorkflowMetrics Tests
  // ==========================================================================

  describe('getWorkflowMetrics', () => {
    it('should throw NotFoundException if project not found', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(null);

      await expect(service.getWorkflowMetrics({
        projectId: 'invalid',
      })).rejects.toThrow(NotFoundException);
    });

    it('should calculate metrics for project with default date range', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(mockProject);
      mockPrisma.workflowRun.findMany.mockResolvedValue([mockWorkflowRun]);
      mockMetricsCalculator.calculateComprehensiveMetrics.mockReturnValue({
        totalRuns: 1,
        successRate: 100,
      });
      mockAggregationService.aggregateByWorkflow.mockReturnValue([]);
      mockAggregationService.calculateWorkflowTrends.mockReturnValue([]);

      const result = await service.getWorkflowMetrics({
        projectId: 'proj-123',
      });

      expect(result.projectId).toBe('proj-123');
      expect(result.projectName).toBe('Test Project');
      expect(result.dateRange).toBeDefined();
      expect(result.summary).toBeDefined();
    });

    it('should filter by specific workflow', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(mockProject);
      mockPrisma.workflowRun.findMany.mockResolvedValue([]);
      mockMetricsCalculator.calculateComprehensiveMetrics.mockReturnValue({});
      mockAggregationService.aggregateByWorkflow.mockReturnValue([]);
      mockAggregationService.calculateWorkflowTrends.mockReturnValue([]);

      await service.getWorkflowMetrics({
        projectId: 'proj-123',
        workflowId: 'wf-specific',
      });

      expect(mockPrisma.workflowRun.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            workflowId: 'wf-specific',
          }),
        })
      );
    });

    it('should filter by business complexity range', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(mockProject);
      mockPrisma.workflowRun.findMany.mockResolvedValue([]);
      mockMetricsCalculator.calculateComprehensiveMetrics.mockReturnValue({});
      mockAggregationService.aggregateByWorkflow.mockReturnValue([]);
      mockAggregationService.calculateWorkflowTrends.mockReturnValue([]);

      await service.getWorkflowMetrics({
        projectId: 'proj-123',
        businessComplexityMin: 3,
        businessComplexityMax: 7,
      });

      expect(mockPrisma.workflowRun.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            story: expect.objectContaining({
              businessComplexity: { gte: 3, lte: 7 },
            }),
          }),
        })
      );
    });

    it('should filter by technical complexity range', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(mockProject);
      mockPrisma.workflowRun.findMany.mockResolvedValue([]);
      mockMetricsCalculator.calculateComprehensiveMetrics.mockReturnValue({});
      mockAggregationService.aggregateByWorkflow.mockReturnValue([]);
      mockAggregationService.calculateWorkflowTrends.mockReturnValue([]);

      await service.getWorkflowMetrics({
        projectId: 'proj-123',
        technicalComplexityMin: 4,
        technicalComplexityMax: 8,
      });

      expect(mockPrisma.workflowRun.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            story: expect.objectContaining({
              technicalComplexity: { gte: 4, lte: 8 },
            }),
          }),
        })
      );
    });

    it('should aggregate by workflow level', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(mockProject);
      mockPrisma.workflowRun.findMany.mockResolvedValue([mockWorkflowRun]);
      mockMetricsCalculator.calculateComprehensiveMetrics.mockReturnValue({});
      mockAggregationService.aggregateByWorkflow.mockReturnValue([{ workflowId: 'wf-123' }]);
      mockAggregationService.calculateWorkflowTrends.mockReturnValue([]);

      const result = await service.getWorkflowMetrics({
        projectId: 'proj-123',
        aggregateBy: AggregationLevel.WORKFLOW,
      });

      expect(result.workflows).toBeDefined();
      expect(result.stories).toBeUndefined();
      expect(mockAggregationService.aggregateByWorkflow).toHaveBeenCalled();
    });

    it('should aggregate by story level', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(mockProject);
      mockPrisma.workflowRun.findMany.mockResolvedValue([mockWorkflowRun]);
      mockMetricsCalculator.calculateComprehensiveMetrics.mockReturnValue({});
      mockAggregationService.aggregateByStory.mockReturnValue([{ storyId: 'story-123' }]);
      mockAggregationService.calculateWorkflowTrends.mockReturnValue([]);

      const result = await service.getWorkflowMetrics({
        projectId: 'proj-123',
        aggregateBy: AggregationLevel.STORY,
      });

      expect(result.stories).toBeDefined();
      expect(result.workflows).toBeUndefined();
      expect(mockAggregationService.aggregateByStory).toHaveBeenCalled();
    });

    it('should aggregate by epic level', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(mockProject);
      mockPrisma.workflowRun.findMany.mockResolvedValue([mockWorkflowRun]);
      mockMetricsCalculator.calculateComprehensiveMetrics.mockReturnValue({});
      mockAggregationService.aggregateByEpic.mockReturnValue([{ epicId: 'epic-123' }]);
      mockAggregationService.calculateWorkflowTrends.mockReturnValue([]);

      const result = await service.getWorkflowMetrics({
        projectId: 'proj-123',
        aggregateBy: AggregationLevel.EPIC,
      });

      expect(result.epics).toBeDefined();
      expect(result.workflows).toBeUndefined();
      expect(mockAggregationService.aggregateByEpic).toHaveBeenCalled();
    });

    it('should aggregate by agent level', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(mockProject);
      mockPrisma.workflowRun.findMany.mockResolvedValue([mockWorkflowRun]);
      mockMetricsCalculator.calculateComprehensiveMetrics.mockReturnValue({});
      mockAggregationService.aggregateByAgent.mockReturnValue([{ agentName: 'Architect' }]);
      mockAggregationService.calculateWorkflowTrends.mockReturnValue([]);

      const result = await service.getWorkflowMetrics({
        projectId: 'proj-123',
        aggregateBy: AggregationLevel.AGENT,
      });

      expect(result.agents).toBeDefined();
      expect(result.workflows).toBeUndefined();
      expect(mockAggregationService.aggregateByAgent).toHaveBeenCalled();
    });

    it('should include trends in results', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(mockProject);
      mockPrisma.workflowRun.findMany.mockResolvedValue([mockWorkflowRun]);
      mockMetricsCalculator.calculateComprehensiveMetrics.mockReturnValue({});
      mockAggregationService.aggregateByWorkflow.mockReturnValue([]);
      mockAggregationService.calculateWorkflowTrends.mockReturnValue([
        { date: '2024-01-01', totalRuns: 5 },
      ]);

      const result = await service.getWorkflowMetrics({
        projectId: 'proj-123',
      });

      expect(result.trends).toHaveLength(1);
    });
  });

  // ==========================================================================
  // compareWorkflows Tests
  // ==========================================================================

  describe('compareWorkflows', () => {
    const mockWorkflowMetrics = {
      projectId: 'proj-123',
      projectName: 'Test',
      dateRange: { start: '2024-01-01', end: '2024-01-31' },
      aggregationLevel: AggregationLevel.WORKFLOW,
      summary: {},
      workflows: [{
        workflowId: 'wf-1',
        workflowName: 'Workflow A',
        metrics: {
          efficiency: { tokensPerLOC: 10, defectsPerStory: 2 },
          costValue: { costPerStory: 1.5 },
          execution: { avgDurationPerRun: 300 },
        },
      }],
      generatedAt: new Date().toISOString(),
    };

    it('should compare two workflows', async () => {
      jest.spyOn(service, 'getWorkflowMetrics')
        .mockResolvedValueOnce({
          ...mockWorkflowMetrics,
          workflows: [{
            workflowId: 'wf-1',
            workflowName: 'Workflow A',
            metrics: {
              efficiency: { tokensPerLOC: 10, defectsPerStory: 2 },
              costValue: { costPerStory: 1.5 },
              execution: { avgDurationPerRun: 300 },
            },
          }],
        } as any)
        .mockResolvedValueOnce({
          ...mockWorkflowMetrics,
          workflows: [{
            workflowId: 'wf-2',
            workflowName: 'Workflow B',
            metrics: {
              efficiency: { tokensPerLOC: 12, defectsPerStory: 3 },
              costValue: { costPerStory: 2.0 },
              execution: { avgDurationPerRun: 400 },
            },
          }],
        } as any);

      const result = await service.compareWorkflows(
        'proj-123',
        'wf-1',
        'wf-2'
      );

      expect(result.comparison.workflow1.workflowId).toBe('wf-1');
      expect(result.comparison.workflow2.workflowId).toBe('wf-2');
      expect(result.comparison.percentageDifference).toBeDefined();
      expect(result.insights).toBeDefined();
    });

    it('should throw NotFoundException if workflow has no data', async () => {
      jest.spyOn(service, 'getWorkflowMetrics')
        .mockResolvedValue({
          ...mockWorkflowMetrics,
          workflows: [],
        } as any);

      await expect(service.compareWorkflows(
        'proj-123',
        'wf-1',
        'wf-2'
      )).rejects.toThrow(NotFoundException);
    });

    it('should generate insights for better workflow', async () => {
      jest.spyOn(service, 'getWorkflowMetrics')
        .mockResolvedValueOnce({
          ...mockWorkflowMetrics,
          workflows: [{
            workflowId: 'wf-1',
            workflowName: 'Workflow A',
            metrics: {
              efficiency: { tokensPerLOC: 8, defectsPerStory: 1 },
              costValue: { costPerStory: 1.0 },
              execution: { avgDurationPerRun: 200 },
            },
          }],
        } as any)
        .mockResolvedValueOnce({
          ...mockWorkflowMetrics,
          workflows: [{
            workflowId: 'wf-2',
            workflowName: 'Workflow B',
            metrics: {
              efficiency: { tokensPerLOC: 12, defectsPerStory: 3 },
              costValue: { costPerStory: 2.0 },
              execution: { avgDurationPerRun: 400 },
            },
          }],
        } as any);

      const result = await service.compareWorkflows(
        'proj-123',
        'wf-1',
        'wf-2'
      );

      expect(result.insights.length).toBeGreaterThan(0);
      expect(result.insights.some(i => i.includes('fewer tokens'))).toBe(true);
      expect(result.insights.some(i => i.includes('less per story'))).toBe(true);
      expect(result.insights.some(i => i.includes('faster'))).toBe(true);
    });

    it('should provide recommendation based on cost and quality', async () => {
      jest.spyOn(service, 'getWorkflowMetrics')
        .mockResolvedValueOnce({
          ...mockWorkflowMetrics,
          workflows: [{
            workflowId: 'wf-1',
            workflowName: 'Workflow A',
            metrics: {
              efficiency: { tokensPerLOC: 8, defectsPerStory: 1 },
              costValue: { costPerStory: 1.0 },
              execution: { avgDurationPerRun: 200 },
            },
          }],
        } as any)
        .mockResolvedValueOnce({
          ...mockWorkflowMetrics,
          workflows: [{
            workflowId: 'wf-2',
            workflowName: 'Workflow B',
            metrics: {
              efficiency: { tokensPerLOC: 12, defectsPerStory: 1 },
              costValue: { costPerStory: 2.0 },
              execution: { avgDurationPerRun: 400 },
            },
          }],
        } as any);

      const result = await service.compareWorkflows(
        'proj-123',
        'wf-1',
        'wf-2'
      );

      expect(result.comparison.recommendation).toContain('cost-effective');
    });
  });

  // ==========================================================================
  // getWorkflowDetails Tests
  // ==========================================================================

  describe('getWorkflowDetails', () => {
    it('should throw NotFoundException if workflow not found', async () => {
      mockPrisma.workflow.findUnique.mockResolvedValue(null);

      await expect(service.getWorkflowDetails({
        projectId: 'proj-123',
        workflowAId: 'invalid',
        businessComplexity: 'all',
        technicalComplexity: 'all',
      })).rejects.toThrow(NotFoundException);
    });

    it('should calculate metrics for single workflow', async () => {
      mockPrisma.workflow.findUnique.mockResolvedValue(mockWorkflow);
      mockPrisma.workflowRun.findMany.mockResolvedValue([
        {
          ...mockWorkflowRun,
          componentRuns: [
            {
              tokensInput: 1000,
              tokensOutput: 500,
              cost: 0.05,
              durationSeconds: 30,
              linesAdded: 100,
              linesDeleted: 10,
            },
          ],
        },
      ]);
      mockPrisma.workflowRun.count
        .mockResolvedValueOnce(10) // all runs
        .mockResolvedValueOnce(5) // previous period runs
        .mockResolvedValueOnce(4); // previous completed runs
      mockPrisma.componentRun.aggregate.mockResolvedValue({
        _sum: { cost: 0.2 },
        _count: 5,
      });

      const result = await service.getWorkflowDetails({
        projectId: 'proj-123',
        workflowAId: 'wf-123',
        businessComplexity: 'all',
        technicalComplexity: 'all',
      });

      expect(result.workflowA).toBeDefined();
      expect(result.workflowA.id).toBe('wf-123');
      expect(result.workflowA.successRate).toBeDefined();
      expect(result.workflowA.tokensPerLOC).toBeDefined();
    });

    it('should calculate metrics for two workflows', async () => {
      mockPrisma.workflow.findUnique
        .mockResolvedValueOnce({ ...mockWorkflow, id: 'wf-a' })
        .mockResolvedValueOnce({ ...mockWorkflow, id: 'wf-b' });
      mockPrisma.workflowRun.findMany.mockResolvedValue([
        {
          ...mockWorkflowRun,
          componentRuns: [{ tokensInput: 1000, tokensOutput: 500 }],
        },
      ]);
      mockPrisma.workflowRun.count.mockResolvedValue(10);
      mockPrisma.componentRun.aggregate.mockResolvedValue({
        _sum: { cost: 0 },
        _count: 0,
      });

      const result = await service.getWorkflowDetails({
        projectId: 'proj-123',
        workflowAId: 'wf-a',
        workflowBId: 'wf-b',
        businessComplexity: 'medium',
        technicalComplexity: 'high',
      });

      expect(result.workflowA).toBeDefined();
      expect(result.workflowB).toBeDefined();
    });

    it('should filter by complexity levels', async () => {
      mockPrisma.workflow.findUnique.mockResolvedValue(mockWorkflow);
      mockPrisma.workflowRun.findMany.mockResolvedValue([]);
      mockPrisma.workflowRun.count.mockResolvedValue(0);
      mockPrisma.componentRun.aggregate.mockResolvedValue({
        _sum: { cost: null },
        _count: 0,
      });

      await service.getWorkflowDetails({
        projectId: 'proj-123',
        workflowAId: 'wf-123',
        businessComplexity: 'low',
        technicalComplexity: 'high',
      });

      // Verify complexity range filters
      expect(mockPrisma.workflowRun.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            story: expect.objectContaining({
              businessComplexity: { gte: 1, lte: 3 },
              technicalComplexity: { gte: 7, lte: 10 },
            }),
          }),
        })
      );
    });

    it('should include system averages', async () => {
      mockPrisma.workflow.findUnique.mockResolvedValue(mockWorkflow);
      mockPrisma.workflowRun.findMany
        .mockResolvedValueOnce([]) // workflow A runs
        .mockResolvedValueOnce([  // all project runs
          {
            ...mockWorkflowRun,
            componentRuns: [
              { tokensInput: 1000, tokensOutput: 500, cost: 0.05 },
            ],
          },
        ]);
      mockPrisma.workflowRun.count.mockResolvedValue(0);
      mockPrisma.componentRun.aggregate.mockResolvedValue({
        _sum: { cost: null },
        _count: 0,
      });

      const result = await service.getWorkflowDetails({
        projectId: 'proj-123',
        workflowAId: 'wf-123',
        businessComplexity: 'all',
        technicalComplexity: 'all',
      });

      expect(result.systemAverages).toBeDefined();
      expect(result.systemAverages.successRate).toBeDefined();
      expect(result.systemAverages.tokensPerLOC).toBeDefined();
    });

    it('should calculate code impact metrics', async () => {
      mockPrisma.workflow.findUnique.mockResolvedValue(mockWorkflow);
      mockPrisma.workflowRun.findMany.mockResolvedValue([
        {
          ...mockWorkflowRun,
          componentRuns: [
            {
              tokensInput: 1000,
              tokensOutput: 500,
              linesAdded: 150,
              linesModified: 50,
              linesDeleted: 20,
              testsAdded: 10,
              filesModified: ['file1.ts', 'file2.ts'],
            },
          ],
        },
      ]);
      mockPrisma.workflowRun.count.mockResolvedValue(1);
      mockPrisma.componentRun.aggregate.mockResolvedValue({
        _sum: { cost: null },
        _count: 0,
      });

      const result = await service.getWorkflowDetails({
        projectId: 'proj-123',
        workflowAId: 'wf-123',
        businessComplexity: 'all',
        technicalComplexity: 'all',
      });

      expect(result.workflowA.linesAdded).toBe(150);
      expect(result.workflowA.linesModified).toBe(50);
      expect(result.workflowA.linesDeleted).toBe(20);
      expect(result.workflowA.testsAdded).toBe(10);
    });

    it('should include story and bug counts', async () => {
      mockPrisma.workflow.findUnique.mockResolvedValue(mockWorkflow);
      mockPrisma.workflowRun.findMany
        .mockResolvedValueOnce([
          {
            ...mockWorkflowRun,
            storyId: 'story-1',
            story: { type: 'feature' },
            componentRuns: [],
          },
        ])
        .mockResolvedValueOnce([
          {
            ...mockWorkflowRun,
            storyId: 'story-2',
            story: { type: 'bug' },
            componentRuns: [],
          },
        ]);
      mockPrisma.workflowRun.count.mockResolvedValue(1);
      mockPrisma.componentRun.aggregate.mockResolvedValue({
        _sum: { cost: null },
        _count: 0,
      });

      const result = await service.getWorkflowDetails({
        projectId: 'proj-123',
        workflowAId: 'wf-123',
        businessComplexity: 'all',
        technicalComplexity: 'all',
      });

      expect(result.counts).toBeDefined();
      expect(result.counts.totalStories).toBeGreaterThanOrEqual(0);
      expect(result.counts.totalBugs).toBeGreaterThanOrEqual(0);
    });
  });
});
