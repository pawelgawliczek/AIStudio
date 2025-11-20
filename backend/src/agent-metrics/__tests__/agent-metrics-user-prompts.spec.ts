/**
 * ST-68: Tests for totalUserPrompts metrics in Performance Dashboard
 * Tests backend API returning totalUserPrompts and totalUserPromptsChange
 */

import { Test, TestingModule } from '@nestjs/testing';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../prisma/prisma.service';
import { AgentMetricsService } from '../agent-metrics.service';

describe('AgentMetricsService - Total User Prompts (ST-68)', () => {
  let service: AgentMetricsService;
  let prisma: PrismaService;
  let testProjectId: string;
  let testWorkflowIds: string[];
  let testStoryIds: string[];

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentMetricsService,
        {
          provide: PrismaService,
          useValue: {
            project: { findUnique: jest.fn() },
            story: { findMany: jest.fn(), count: jest.fn() },
            workflowRun: { findMany: jest.fn() },
            componentRun: { findMany: jest.fn(), groupBy: jest.fn() },
            workflow: { findMany: jest.fn() },
          },
        },
      ],
    }).compile();

    service = module.get<AgentMetricsService>(AgentMetricsService);
    prisma = module.get<PrismaService>(PrismaService);

    testProjectId = uuidv4();
    testWorkflowIds = [uuidv4(), uuidv4()];
    testStoryIds = [uuidv4(), uuidv4(), uuidv4()];
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

      // Mock current period component runs with userPrompts
      (prisma.componentRun.findMany as jest.Mock).mockResolvedValueOnce([
        {
          id: uuidv4(),
          userPrompts: 5,
          executionOrder: 0, // Orchestrator
          tokensInput: 10000,
          tokensOutput: 2000,
          cost: 0.50,
          linesAdded: 100,
          linesDeleted: 20,
          durationSeconds: 300,
        },
        {
          id: uuidv4(),
          userPrompts: 3,
          executionOrder: 0,
          tokensInput: 8000,
          tokensOutput: 1500,
          cost: 0.40,
          linesAdded: 80,
          linesDeleted: 10,
          durationSeconds: 240,
        },
        {
          id: uuidv4(),
          userPrompts: 7,
          executionOrder: 0,
          tokensInput: 12000,
          tokensOutput: 2500,
          cost: 0.60,
          linesAdded: 120,
          linesDeleted: 30,
          durationSeconds: 360,
        },
      ]);

      // Mock previous period component runs
      (prisma.componentRun.findMany as jest.Mock).mockResolvedValueOnce([
        {
          id: uuidv4(),
          userPrompts: 8,
          executionOrder: 0,
          tokensInput: 10000,
          tokensOutput: 2000,
          cost: 0.50,
          linesAdded: 90,
          linesDeleted: 15,
          durationSeconds: 300,
        },
        {
          id: uuidv4(),
          userPrompts: 12,
          executionOrder: 0,
          tokensInput: 9000,
          tokensOutput: 1800,
          cost: 0.45,
          linesAdded: 100,
          linesDeleted: 25,
          durationSeconds: 280,
        },
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

      // Mock component runs with NO user prompts (fully automated)
      (prisma.componentRun.findMany as jest.Mock).mockResolvedValueOnce([
        {
          id: uuidv4(),
          userPrompts: 0,
          executionOrder: 0,
          tokensInput: 10000,
          tokensOutput: 2000,
          cost: 0.50,
          linesAdded: 100,
          linesDeleted: 20,
          durationSeconds: 300,
        },
      ]);

      // Previous period also zero
      (prisma.componentRun.findMany as jest.Mock).mockResolvedValueOnce([
        {
          id: uuidv4(),
          userPrompts: 0,
          executionOrder: 0,
          tokensInput: 10000,
          tokensOutput: 2000,
          cost: 0.50,
          linesAdded: 90,
          linesDeleted: 15,
          durationSeconds: 300,
        },
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

      // Current period has prompts
      (prisma.componentRun.findMany as jest.Mock).mockResolvedValueOnce([
        {
          id: uuidv4(),
          userPrompts: 10,
          executionOrder: 0,
          tokensInput: 10000,
          tokensOutput: 2000,
          cost: 0.50,
          linesAdded: 100,
          linesDeleted: 20,
          durationSeconds: 300,
        },
      ]);

      // Previous period has ZERO prompts (edge case)
      (prisma.componentRun.findMany as jest.Mock).mockResolvedValueOnce([]);

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

      // Current period: 5 prompts
      (prisma.componentRun.findMany as jest.Mock).mockResolvedValueOnce([
        {
          id: uuidv4(),
          userPrompts: 5,
          executionOrder: 0,
          tokensInput: 10000,
          tokensOutput: 2000,
          cost: 0.50,
          linesAdded: 100,
          linesDeleted: 20,
          durationSeconds: 300,
        },
      ]);

      // Previous period: 10 prompts
      (prisma.componentRun.findMany as jest.Mock).mockResolvedValueOnce([
        {
          id: uuidv4(),
          userPrompts: 10,
          executionOrder: 0,
          tokensInput: 10000,
          tokensOutput: 2000,
          cost: 0.50,
          linesAdded: 90,
          linesDeleted: 15,
          durationSeconds: 300,
        },
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

      // Current period: 20 prompts
      (prisma.componentRun.findMany as jest.Mock).mockResolvedValueOnce([
        {
          id: uuidv4(),
          userPrompts: 20,
          executionOrder: 0,
          tokensInput: 10000,
          tokensOutput: 2000,
          cost: 0.50,
          linesAdded: 100,
          linesDeleted: 20,
          durationSeconds: 300,
        },
      ]);

      // Previous period: 10 prompts
      (prisma.componentRun.findMany as jest.Mock).mockResolvedValueOnce([
        {
          id: uuidv4(),
          userPrompts: 10,
          executionOrder: 0,
          tokensInput: 10000,
          tokensOutput: 2000,
          cost: 0.50,
          linesAdded: 90,
          linesDeleted: 15,
          durationSeconds: 300,
        },
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
      ]);

      // Mock filtered component runs (only workflow 1)
      (prisma.componentRun.findMany as jest.Mock).mockResolvedValueOnce([
        {
          id: uuidv4(),
          userPrompts: 8,
          executionOrder: 0,
          workflowRun: { workflowId: testWorkflowIds[0] },
          tokensInput: 10000,
          tokensOutput: 2000,
          cost: 0.50,
          linesAdded: 100,
          linesDeleted: 20,
          durationSeconds: 300,
        },
      ]);

      (prisma.componentRun.findMany as jest.Mock).mockResolvedValueOnce([
        {
          id: uuidv4(),
          userPrompts: 5,
          executionOrder: 0,
          workflowRun: { workflowId: testWorkflowIds[0] },
          tokensInput: 10000,
          tokensOutput: 2000,
          cost: 0.50,
          linesAdded: 90,
          linesDeleted: 15,
          durationSeconds: 300,
        },
      ]);

      (prisma.story.count as jest.Mock).mockResolvedValue(1);

      const result = await service.getPerformanceDashboardTrends({
        projectId: testProjectId,
        workflowIds: [testWorkflowIds[0]],
        dateRange: 'month',
      });

      expect(result.kpis.totalUserPrompts).toBe(8);
      expect(result.kpis.totalUserPromptsChange).toBeCloseTo(60, 1); // (8-5)/5 * 100
    });

    it('should respect date range filters (week, month, quarter)', async () => {
      (prisma.project.findUnique as jest.Mock).mockResolvedValue({
        id: testProjectId,
        name: 'Test Project',
      });

      (prisma.workflow.findMany as jest.Mock).mockResolvedValue([
        { id: testWorkflowIds[0], name: 'Workflow 1' },
      ]);

      // Test different date ranges
      const dateRanges = ['week', 'month', 'quarter'] as const;

      for (const range of dateRanges) {
        (prisma.componentRun.findMany as jest.Mock).mockResolvedValueOnce([
          {
            id: uuidv4(),
            userPrompts: 12,
            executionOrder: 0,
            tokensInput: 10000,
            tokensOutput: 2000,
            cost: 0.50,
            linesAdded: 100,
            linesDeleted: 20,
            durationSeconds: 300,
          },
        ]);

        (prisma.componentRun.findMany as jest.Mock).mockResolvedValueOnce([
          {
            id: uuidv4(),
            userPrompts: 10,
            executionOrder: 0,
            tokensInput: 10000,
            tokensOutput: 2000,
            cost: 0.50,
            linesAdded: 90,
            linesDeleted: 15,
            durationSeconds: 300,
          },
        ]);

        (prisma.story.count as jest.Mock).mockResolvedValue(1);

        const result = await service.getPerformanceDashboardTrends({
          projectId: testProjectId,
          dateRange: range,
        });

        expect(result.kpis.totalUserPrompts).toBe(12);
        expect(result.kpis.totalUserPromptsChange).toBeCloseTo(20, 1); // (12-10)/10 * 100
      }
    });

    it('should filter by complexity bands', async () => {
      (prisma.project.findUnique as jest.Mock).mockResolvedValue({
        id: testProjectId,
        name: 'Test Project',
      });

      (prisma.workflow.findMany as jest.Mock).mockResolvedValue([
        { id: testWorkflowIds[0], name: 'Workflow 1' },
      ]);

      // High complexity stories typically need more human prompts
      (prisma.componentRun.findMany as jest.Mock).mockResolvedValueOnce([
        {
          id: uuidv4(),
          userPrompts: 25, // High complexity = more prompts
          executionOrder: 0,
          tokensInput: 15000,
          tokensOutput: 3000,
          cost: 0.75,
          linesAdded: 200,
          linesDeleted: 50,
          durationSeconds: 600,
        },
      ]);

      (prisma.componentRun.findMany as jest.Mock).mockResolvedValueOnce([
        {
          id: uuidv4(),
          userPrompts: 20,
          executionOrder: 0,
          tokensInput: 12000,
          tokensOutput: 2500,
          cost: 0.60,
          linesAdded: 180,
          linesDeleted: 40,
          durationSeconds: 500,
        },
      ]);

      (prisma.story.count as jest.Mock).mockResolvedValue(1);

      const result = await service.getPerformanceDashboardTrends({
        projectId: testProjectId,
        dateRange: 'month',
        technicalComplexityMin: 8,
        technicalComplexityMax: 10,
      });

      expect(result.kpis.totalUserPrompts).toBe(25);
      expect(result.kpis.totalUserPromptsChange).toBeCloseTo(25, 1); // (25-20)/20 * 100
    });

    it('should handle null/undefined userPrompts values in database', async () => {
      (prisma.project.findUnique as jest.Mock).mockResolvedValue({
        id: testProjectId,
        name: 'Test Project',
      });

      (prisma.workflow.findMany as jest.Mock).mockResolvedValue([
        { id: testWorkflowIds[0], name: 'Workflow 1' },
      ]);

      // Some runs might have null userPrompts (pre-ST-17 data)
      (prisma.componentRun.findMany as jest.Mock).mockResolvedValueOnce([
        {
          id: uuidv4(),
          userPrompts: null, // Old data
          executionOrder: 0,
          tokensInput: 10000,
          tokensOutput: 2000,
          cost: 0.50,
          linesAdded: 100,
          linesDeleted: 20,
          durationSeconds: 300,
        },
        {
          id: uuidv4(),
          userPrompts: 5,
          executionOrder: 0,
          tokensInput: 8000,
          tokensOutput: 1500,
          cost: 0.40,
          linesAdded: 80,
          linesDeleted: 10,
          durationSeconds: 240,
        },
      ]);

      (prisma.componentRun.findMany as jest.Mock).mockResolvedValueOnce([]);

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
      (prisma.componentRun.findMany as jest.Mock).mockResolvedValue([]);
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
      (prisma.componentRun.findMany as jest.Mock).mockResolvedValueOnce([
        ...Array(100).fill(null).map(() => ({
          id: uuidv4(),
          userPrompts: 50, // 100 runs * 50 prompts = 5000 total
          executionOrder: 0,
          tokensInput: 10000,
          tokensOutput: 2000,
          cost: 0.50,
          linesAdded: 100,
          linesDeleted: 20,
          durationSeconds: 300,
        })),
      ]);

      (prisma.componentRun.findMany as jest.Mock).mockResolvedValueOnce([
        ...Array(100).fill(null).map(() => ({
          id: uuidv4(),
          userPrompts: 45,
          executionOrder: 0,
          tokensInput: 10000,
          tokensOutput: 2000,
          cost: 0.50,
          linesAdded: 90,
          linesDeleted: 15,
          durationSeconds: 300,
        })),
      ]);

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
