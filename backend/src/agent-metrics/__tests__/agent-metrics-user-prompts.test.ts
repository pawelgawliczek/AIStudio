/**
 * ST-68: Tests for totalUserPrompts metrics in Performance Dashboard
 * Tests backend API returning totalUserPrompts and totalUserPromptsChange
 *
 * Updated for refactored service architecture (ST-239)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../prisma/prisma.service';
import { ComprehensiveMetricsCalculator } from '../calculators/comprehensive-metrics.calculator';
import { DashboardMetricsService } from '../services/dashboard-metrics.service';
import { MetricsAggregationService } from '../services/metrics-aggregation.service';

describe('DashboardMetricsService - Total User Prompts (ST-68)', () => {
  let service: DashboardMetricsService;
  let prisma: jest.Mocked<PrismaService>;
  let testProjectId: string;
  let testWorkflowIds: string[];

  // Helper to create mock workflow run with component runs
  const createMockWorkflowRun = (overrides: {
    storyId?: string;
    workflowId?: string;
    componentRuns?: any[];
    story?: any;
  } = {}) => ({
    id: uuidv4(),
    storyId: overrides.storyId || uuidv4(),
    workflowId: overrides.workflowId || testWorkflowIds[0],
    startedAt: new Date(),
    status: 'completed',
    workflow: { id: overrides.workflowId || testWorkflowIds[0], name: 'Workflow 1' },
    story: overrides.story || { id: overrides.storyId || uuidv4(), type: 'feature' },
    componentRuns: overrides.componentRuns || [],
  });

  // Helper to create mock component run
  const createMockComponentRun = (overrides: Partial<{
    userPrompts: number | null;
    tokensInput: number;
    tokensOutput: number;
    linesAdded: number;
    linesModified: number;
    linesDeleted: number;
    durationSeconds: number;
    cost: number;
    totalTurns: number;
    manualPrompts: number;
    autoContinues: number;
  }> = {}) => ({
    id: uuidv4(),
    userPrompts: overrides.userPrompts ?? 5,
    tokensInput: overrides.tokensInput ?? 10000,
    tokensOutput: overrides.tokensOutput ?? 2000,
    tokensCacheRead: 0,
    tokensCacheWrite: 0,
    cacheHits: 0,
    cacheMisses: 0,
    linesAdded: overrides.linesAdded ?? 100,
    linesModified: overrides.linesModified ?? 50,
    linesDeleted: overrides.linesDeleted ?? 20,
    testsAdded: 0,
    filesModified: [],
    durationSeconds: overrides.durationSeconds ?? 300,
    cost: overrides.cost ?? 0.50,
    systemIterations: 0,
    humanInterventions: 0,
    totalTurns: overrides.totalTurns ?? 0,
    manualPrompts: overrides.manualPrompts ?? 0,
    autoContinues: overrides.autoContinues ?? 0,
  });

  beforeAll(async () => {
    testProjectId = uuidv4();
    testWorkflowIds = [uuidv4(), uuidv4()];

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardMetricsService,
        ComprehensiveMetricsCalculator,
        MetricsAggregationService,
        {
          provide: PrismaService,
          useValue: {
            project: { findUnique: jest.fn() },
            story: { count: jest.fn() },
            workflowRun: { findMany: jest.fn() },
            workflow: { findMany: jest.fn() },
          },
        },
      ],
    }).compile();

    service = module.get<DashboardMetricsService>(DashboardMetricsService);
    prisma = module.get(PrismaService) as jest.Mocked<PrismaService>;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getPerformanceDashboardTrends - totalUserPrompts KPI', () => {
    it('should include totalUserPrompts and totalUserPromptsChange in KPIs', async () => {
      // Mock project
      (prisma.project.findUnique as jest.Mock).mockResolvedValue({
        id: testProjectId,
        name: 'Test Project',
      });

      // Mock workflows
      (prisma.workflow.findMany as jest.Mock).mockResolvedValue([
        { id: testWorkflowIds[0], name: 'Workflow 1' },
        { id: testWorkflowIds[1], name: 'Workflow 2' },
      ]);

      const story1Id = uuidv4();
      const story2Id = uuidv4();
      const story3Id = uuidv4();

      // Mock current period workflow runs
      (prisma.workflowRun.findMany as jest.Mock)
        .mockResolvedValueOnce([
          createMockWorkflowRun({
            storyId: story1Id,
            componentRuns: [createMockComponentRun({ userPrompts: 5 })],
            story: { id: story1Id, type: 'feature' },
          }),
          createMockWorkflowRun({
            storyId: story2Id,
            componentRuns: [createMockComponentRun({ userPrompts: 3 })],
            story: { id: story2Id, type: 'feature' },
          }),
          createMockWorkflowRun({
            storyId: story3Id,
            componentRuns: [createMockComponentRun({ userPrompts: 7 })],
            story: { id: story3Id, type: 'feature' },
          }),
        ])
        // Mock previous period (fewer prompts)
        .mockResolvedValueOnce([
          createMockWorkflowRun({
            storyId: story1Id,
            componentRuns: [createMockComponentRun({ userPrompts: 8 })],
            story: { id: story1Id, type: 'feature' },
          }),
          createMockWorkflowRun({
            storyId: story2Id,
            componentRuns: [createMockComponentRun({ userPrompts: 12 })],
            story: { id: story2Id, type: 'feature' },
          }),
        ]);

      // Mock stories count
      (prisma.story.count as jest.Mock).mockResolvedValue(3);

      const result = await service.getPerformanceDashboardTrends({
        projectId: testProjectId,
        dateRange: 'month',
      });

      // Verify totalUserPrompts is included
      expect(result.kpis.totalUserPrompts).toBeDefined();
      expect(result.kpis.totalUserPrompts).toBe(15); // 5 + 3 + 7

      // Verify totalUserPromptsChange is calculated correctly
      expect(result.kpis.totalUserPromptsChange).toBeDefined();
      // Previous period: 20 prompts (8 + 12)
      // Current period: 15 prompts
      // Change: ((15 - 20) / 20) * 100 = -25%
      expect(result.kpis.totalUserPromptsChange).toBeCloseTo(-25, 1);
    });

    it('should handle zero user prompts gracefully', async () => {
      (prisma.project.findUnique as jest.Mock).mockResolvedValue({
        id: testProjectId,
        name: 'Test Project',
      });

      (prisma.workflow.findMany as jest.Mock).mockResolvedValue([
        { id: testWorkflowIds[0], name: 'Workflow 1' },
      ]);

      const storyId = uuidv4();

      // Mock component runs with NO user prompts (fully automated)
      (prisma.workflowRun.findMany as jest.Mock)
        .mockResolvedValueOnce([
          createMockWorkflowRun({
            storyId,
            componentRuns: [createMockComponentRun({ userPrompts: 0 })],
            story: { id: storyId, type: 'feature' },
          }),
        ])
        // Previous period also zero
        .mockResolvedValueOnce([
          createMockWorkflowRun({
            storyId,
            componentRuns: [createMockComponentRun({ userPrompts: 0 })],
            story: { id: storyId, type: 'feature' },
          }),
        ]);

      (prisma.story.count as jest.Mock).mockResolvedValue(1);

      const result = await service.getPerformanceDashboardTrends({
        projectId: testProjectId,
        dateRange: 'week',
      });

      expect(result.kpis.totalUserPrompts).toBe(0);
      expect(result.kpis.totalUserPromptsChange).toBe(0);
    });

    it('should handle missing previous period data (avoid division by zero)', async () => {
      (prisma.project.findUnique as jest.Mock).mockResolvedValue({
        id: testProjectId,
        name: 'Test Project',
      });

      (prisma.workflow.findMany as jest.Mock).mockResolvedValue([
        { id: testWorkflowIds[0], name: 'Workflow 1' },
      ]);

      const storyId = uuidv4();

      // Current period has prompts
      (prisma.workflowRun.findMany as jest.Mock)
        .mockResolvedValueOnce([
          createMockWorkflowRun({
            storyId,
            componentRuns: [createMockComponentRun({ userPrompts: 10 })],
            story: { id: storyId, type: 'feature' },
          }),
        ])
        // Previous period has NO data
        .mockResolvedValueOnce([]);

      (prisma.story.count as jest.Mock).mockResolvedValue(1);

      const result = await service.getPerformanceDashboardTrends({
        projectId: testProjectId,
        dateRange: 'week',
      });

      expect(result.kpis.totalUserPrompts).toBe(10);
      // Should handle division by zero gracefully
      expect(result.kpis.totalUserPromptsChange).toBe(0);
    });

    it('should calculate negative change when prompts decrease (automation improvement)', async () => {
      (prisma.project.findUnique as jest.Mock).mockResolvedValue({
        id: testProjectId,
        name: 'Test Project',
      });

      (prisma.workflow.findMany as jest.Mock).mockResolvedValue([
        { id: testWorkflowIds[0], name: 'Workflow 1' },
      ]);

      const storyId = uuidv4();

      // Current period: 5 prompts
      (prisma.workflowRun.findMany as jest.Mock)
        .mockResolvedValueOnce([
          createMockWorkflowRun({
            storyId,
            componentRuns: [createMockComponentRun({ userPrompts: 5 })],
            story: { id: storyId, type: 'feature' },
          }),
        ])
        // Previous period: 10 prompts
        .mockResolvedValueOnce([
          createMockWorkflowRun({
            storyId,
            componentRuns: [createMockComponentRun({ userPrompts: 10 })],
            story: { id: storyId, type: 'feature' },
          }),
        ]);

      (prisma.story.count as jest.Mock).mockResolvedValue(1);

      const result = await service.getPerformanceDashboardTrends({
        projectId: testProjectId,
        dateRange: 'month',
      });

      expect(result.kpis.totalUserPrompts).toBe(5);
      // Change: ((5 - 10) / 10) * 100 = -50%
      expect(result.kpis.totalUserPromptsChange).toBeCloseTo(-50, 1);
    });

    it('should calculate positive change when prompts increase (more intervention needed)', async () => {
      (prisma.project.findUnique as jest.Mock).mockResolvedValue({
        id: testProjectId,
        name: 'Test Project',
      });

      (prisma.workflow.findMany as jest.Mock).mockResolvedValue([
        { id: testWorkflowIds[0], name: 'Workflow 1' },
      ]);

      const storyId = uuidv4();

      // Current period: 20 prompts
      (prisma.workflowRun.findMany as jest.Mock)
        .mockResolvedValueOnce([
          createMockWorkflowRun({
            storyId,
            componentRuns: [createMockComponentRun({ userPrompts: 20 })],
            story: { id: storyId, type: 'feature' },
          }),
        ])
        // Previous period: 10 prompts
        .mockResolvedValueOnce([
          createMockWorkflowRun({
            storyId,
            componentRuns: [createMockComponentRun({ userPrompts: 10 })],
            story: { id: storyId, type: 'feature' },
          }),
        ]);

      (prisma.story.count as jest.Mock).mockResolvedValue(1);

      const result = await service.getPerformanceDashboardTrends({
        projectId: testProjectId,
        dateRange: 'week',
      });

      expect(result.kpis.totalUserPrompts).toBe(20);
      // Change: ((20 - 10) / 10) * 100 = +100%
      expect(result.kpis.totalUserPromptsChange).toBeCloseTo(100, 1);
    });

    it('should filter by workflow IDs when provided', async () => {
      (prisma.project.findUnique as jest.Mock).mockResolvedValue({
        id: testProjectId,
        name: 'Test Project',
      });

      (prisma.workflow.findMany as jest.Mock).mockResolvedValue([
        { id: testWorkflowIds[0], name: 'Workflow 1' },
        { id: testWorkflowIds[1], name: 'Workflow 2' },
      ]);

      const storyId = uuidv4();

      // Mock current runs - includes both workflows
      (prisma.workflowRun.findMany as jest.Mock)
        .mockResolvedValueOnce([
          createMockWorkflowRun({
            storyId,
            workflowId: testWorkflowIds[0],
            componentRuns: [createMockComponentRun({ userPrompts: 8 })],
            story: { id: storyId, type: 'feature' },
          }),
          createMockWorkflowRun({
            storyId: uuidv4(),
            workflowId: testWorkflowIds[1],
            componentRuns: [createMockComponentRun({ userPrompts: 100 })], // Should be filtered out
            story: { id: uuidv4(), type: 'feature' },
          }),
        ])
        // Previous period
        .mockResolvedValueOnce([
          createMockWorkflowRun({
            storyId,
            workflowId: testWorkflowIds[0],
            componentRuns: [createMockComponentRun({ userPrompts: 5 })],
            story: { id: storyId, type: 'feature' },
          }),
        ]);

      (prisma.story.count as jest.Mock).mockResolvedValue(1);

      const result = await service.getPerformanceDashboardTrends({
        projectId: testProjectId,
        workflowIds: [testWorkflowIds[0]], // Only workflow 1
        dateRange: 'month',
      });

      expect(result.kpis.totalUserPrompts).toBe(8);
      expect(result.kpis.totalUserPromptsChange).toBeCloseTo(60, 1); // (8-5)/5 * 100
    });

    it('should handle null/undefined userPrompts values in database', async () => {
      (prisma.project.findUnique as jest.Mock).mockResolvedValue({
        id: testProjectId,
        name: 'Test Project',
      });

      (prisma.workflow.findMany as jest.Mock).mockResolvedValue([
        { id: testWorkflowIds[0], name: 'Workflow 1' },
      ]);

      const storyId = uuidv4();

      // Some runs might have null userPrompts (pre-ST-17 data)
      // Create raw component runs with explicit null values (bypassing helper default)
      const nullComponentRun = {
        id: uuidv4(),
        userPrompts: null, // Old data without prompts tracked
        tokensInput: 10000,
        tokensOutput: 2000,
        tokensCacheRead: 0,
        tokensCacheWrite: 0,
        cacheHits: 0,
        cacheMisses: 0,
        linesAdded: 100,
        linesModified: 50,
        linesDeleted: 20,
        testsAdded: 0,
        filesModified: [],
        durationSeconds: 300,
        cost: 0.50,
        systemIterations: 0,
        humanInterventions: 0,
        totalTurns: 0,
        manualPrompts: 0,
        autoContinues: 0,
      };

      (prisma.workflowRun.findMany as jest.Mock)
        .mockResolvedValueOnce([
          createMockWorkflowRun({
            storyId,
            componentRuns: [
              nullComponentRun,
              createMockComponentRun({ userPrompts: 5 }),
            ],
            story: { id: storyId, type: 'feature' },
          }),
        ])
        .mockResolvedValueOnce([]);

      (prisma.story.count as jest.Mock).mockResolvedValue(1);

      const result = await service.getPerformanceDashboardTrends({
        projectId: testProjectId,
        dateRange: 'week',
      });

      // Should treat null as 0 and only count the 5
      expect(result.kpis.totalUserPrompts).toBe(5);
    });
  });

  describe('Edge Cases and Data Validation', () => {
    it('should return valid response structure even with no data', async () => {
      (prisma.project.findUnique as jest.Mock).mockResolvedValue({
        id: testProjectId,
        name: 'Empty Project',
      });

      (prisma.workflow.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.workflowRun.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.story.count as jest.Mock).mockResolvedValue(0);

      const result = await service.getPerformanceDashboardTrends({
        projectId: testProjectId,
        dateRange: 'month',
      });

      expect(result).toBeDefined();
      expect(result.kpis).toBeDefined();
      expect(result.kpis.totalUserPrompts).toBe(0);
      expect(result.kpis.totalUserPromptsChange).toBe(0);
    });

    it('should handle very large numbers of prompts', async () => {
      (prisma.project.findUnique as jest.Mock).mockResolvedValue({
        id: testProjectId,
        name: 'Test Project',
      });

      (prisma.workflow.findMany as jest.Mock).mockResolvedValue([
        { id: testWorkflowIds[0], name: 'Workflow 1' },
      ]);

      // Simulate a project with many workflow runs and high prompts
      const storyIds = Array(100).fill(null).map(() => uuidv4());

      (prisma.workflowRun.findMany as jest.Mock)
        .mockResolvedValueOnce(
          storyIds.map((storyId) =>
            createMockWorkflowRun({
              storyId,
              componentRuns: [createMockComponentRun({ userPrompts: 50 })],
              story: { id: storyId, type: 'feature' },
            })
          )
        )
        // Previous period
        .mockResolvedValueOnce(
          storyIds.map((storyId) =>
            createMockWorkflowRun({
              storyId,
              componentRuns: [createMockComponentRun({ userPrompts: 45 })],
              story: { id: storyId, type: 'feature' },
            })
          )
        );

      (prisma.story.count as jest.Mock).mockResolvedValue(50);

      const result = await service.getPerformanceDashboardTrends({
        projectId: testProjectId,
        dateRange: 'quarter',
      });

      expect(result.kpis.totalUserPrompts).toBe(5000); // 100 * 50
      expect(result.kpis.totalUserPromptsChange).toBeCloseTo(11.11, 1); // (5000-4500)/4500 * 100
    });
  });
});
