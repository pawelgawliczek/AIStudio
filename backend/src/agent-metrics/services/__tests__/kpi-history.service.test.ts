/**
 * ST-265: TDD Tests for KPI History Service
 *
 * Tests for new endpoint `/agent-metrics/kpi-history` that provides
 * daily KPI values for historical trend graphs in TeamDetailsPage.
 *
 * This service will be called from frontend to replace fake random data.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../../prisma/prisma.service';
import { ComprehensiveMetricsCalculator } from '../../calculators/comprehensive-metrics.calculator';
import { KpiHistoryService } from '../kpi-history.service';
import { MetricsAggregationService } from '../metrics-aggregation.service';

describe('KpiHistoryService - ST-265', () => {
  let service: KpiHistoryService;
  let prisma: jest.Mocked<PrismaService>;

  const testProjectId = uuidv4();
  const testWorkflowAId = uuidv4();
  const testWorkflowBId = uuidv4();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KpiHistoryService,
        ComprehensiveMetricsCalculator,
        MetricsAggregationService,
        {
          provide: PrismaService,
          useValue: {
            workflowRun: {
              findMany: jest.fn(),
            },
            workflow: {
              findMany: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<KpiHistoryService>(KpiHistoryService);
    prisma = module.get(PrismaService) as jest.Mocked<PrismaService>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getKpiHistory - Basic Functionality', () => {
    it('should return daily KPI values for specified workflow', async () => {
      // Mock workflows
      (prisma.workflow.findMany as jest.Mock).mockResolvedValue([
        { id: testWorkflowAId, name: 'Workflow A' },
      ]);

      // Mock workflow runs with daily data
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const twoDaysAgo = new Date(today);
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

      (prisma.workflowRun.findMany as jest.Mock).mockResolvedValue([
        createMockWorkflowRun({
          workflowId: testWorkflowAId,
          startedAt: today,
          componentRuns: [
            createMockComponentRun({
              userPrompts: 10,
              tokensInput: 10000,
              tokensOutput: 2000,
              linesAdded: 100,
            }),
          ],
          story: { type: 'feature' },
        }),
        createMockWorkflowRun({
          workflowId: testWorkflowAId,
          startedAt: yesterday,
          componentRuns: [
            createMockComponentRun({
              userPrompts: 8,
              tokensInput: 8000,
              tokensOutput: 1600,
              linesAdded: 80,
            }),
          ],
          story: { type: 'feature' },
        }),
        createMockWorkflowRun({
          workflowId: testWorkflowAId,
          startedAt: twoDaysAgo,
          componentRuns: [
            createMockComponentRun({
              userPrompts: 12,
              tokensInput: 12000,
              tokensOutput: 2400,
              linesAdded: 120,
            }),
          ],
          story: { type: 'feature' },
        }),
      ]);

      const result = await service.getKpiHistory({
        projectId: testProjectId,
        workflowAId: testWorkflowAId,
        days: 30,
      });

      expect(result).toBeDefined();
      expect(result.workflowA).toBeDefined();
      expect(result.systemAverage).toBeDefined();

      // Verify daily data structure
      expect(result.workflowA.length).toBeGreaterThan(0);
      const todayData = result.workflowA.find(
        (d) => d.date === today.toISOString().split('T')[0]
      );
      expect(todayData).toBeDefined();
      expect(todayData?.tokensPerLOC).toBeGreaterThan(0);
      expect(todayData?.promptsPerStory).toBeGreaterThan(0);
      expect(todayData?.costPerStory).toBeGreaterThanOrEqual(0);
    });

    it('should calculate system-wide averages correctly', async () => {
      const workflow2Id = uuidv4();
      (prisma.workflow.findMany as jest.Mock).mockResolvedValue([
        { id: testWorkflowAId, name: 'Workflow A' },
        { id: workflow2Id, name: 'Workflow B' },
      ]);

      const today = new Date();

      // Mock runs from multiple workflows
      (prisma.workflowRun.findMany as jest.Mock).mockResolvedValue([
        createMockWorkflowRun({
          workflowId: testWorkflowAId,
          startedAt: today,
          componentRuns: [
            createMockComponentRun({
              userPrompts: 10,
              tokensInput: 10000,
              tokensOutput: 2000,
              linesAdded: 100,
            }),
          ],
          story: { type: 'feature' },
        }),
        createMockWorkflowRun({
          workflowId: workflow2Id,
          startedAt: today,
          componentRuns: [
            createMockComponentRun({
              userPrompts: 20,
              tokensInput: 20000,
              tokensOutput: 4000,
              linesAdded: 200,
            }),
          ],
          story: { type: 'feature' },
        }),
      ]);

      const result = await service.getKpiHistory({
        projectId: testProjectId,
        workflowAId: testWorkflowAId,
        days: 7,
      });

      expect(result.systemAverage).toBeDefined();
      expect(result.systemAverage.length).toBeGreaterThan(0);

      // System average should be between workflow A and workflow B values
      const todayAvg = result.systemAverage.find(
        (d) => d.date === today.toISOString().split('T')[0]
      );
      expect(todayAvg).toBeDefined();
      expect(todayAvg?.promptsPerStory).toBeGreaterThan(0);
    });

    it('should support comparison with workflow B', async () => {
      (prisma.workflow.findMany as jest.Mock).mockResolvedValue([
        { id: testWorkflowAId, name: 'Workflow A' },
        { id: testWorkflowBId, name: 'Workflow B' },
      ]);

      const today = new Date();

      (prisma.workflowRun.findMany as jest.Mock).mockResolvedValue([
        createMockWorkflowRun({
          workflowId: testWorkflowAId,
          startedAt: today,
          componentRuns: [
            createMockComponentRun({ userPrompts: 10, linesAdded: 100 }),
          ],
          story: { type: 'feature' },
        }),
        createMockWorkflowRun({
          workflowId: testWorkflowBId,
          startedAt: today,
          componentRuns: [
            createMockComponentRun({ userPrompts: 15, linesAdded: 150 }),
          ],
          story: { type: 'feature' },
        }),
      ]);

      const result = await service.getKpiHistory({
        projectId: testProjectId,
        workflowAId: testWorkflowAId,
        workflowBId: testWorkflowBId,
        days: 30,
      });

      expect(result.workflowA).toBeDefined();
      expect(result.workflowB).toBeDefined();
      expect(result.workflowB?.length).toBeGreaterThan(0);
    });
  });

  describe('Complexity Filtering', () => {
    it('should filter by business complexity level', async () => {
      (prisma.workflow.findMany as jest.Mock).mockResolvedValue([
        { id: testWorkflowAId, name: 'Workflow A' },
      ]);

      const today = new Date();

      (prisma.workflowRun.findMany as jest.Mock).mockResolvedValue([
        createMockWorkflowRun({
          workflowId: testWorkflowAId,
          startedAt: today,
          componentRuns: [createMockComponentRun({ userPrompts: 5 })],
          story: { type: 'feature', businessComplexity: 2 }, // Low
        }),
        createMockWorkflowRun({
          workflowId: testWorkflowAId,
          startedAt: today,
          componentRuns: [createMockComponentRun({ userPrompts: 10 })],
          story: { type: 'feature', businessComplexity: 5 }, // Medium
        }),
        createMockWorkflowRun({
          workflowId: testWorkflowAId,
          startedAt: today,
          componentRuns: [createMockComponentRun({ userPrompts: 15 })],
          story: { type: 'feature', businessComplexity: 8 }, // High
        }),
      ]);

      // Filter for low complexity only (1-3)
      const result = await service.getKpiHistory({
        projectId: testProjectId,
        workflowAId: testWorkflowAId,
        businessComplexity: 'low',
        days: 7,
      });

      // Should only include runs with businessComplexity 1-3
      expect(result.workflowA).toBeDefined();
      const todayData = result.workflowA.find(
        (d) => d.date === today.toISOString().split('T')[0]
      );
      // Total userPrompts should be 5 (only low complexity)
      expect(todayData?.promptsPerStory).toBeLessThan(10);
    });

    it('should filter by technical complexity level', async () => {
      (prisma.workflow.findMany as jest.Mock).mockResolvedValue([
        { id: testWorkflowAId, name: 'Workflow A' },
      ]);

      const today = new Date();

      (prisma.workflowRun.findMany as jest.Mock).mockResolvedValue([
        createMockWorkflowRun({
          workflowId: testWorkflowAId,
          startedAt: today,
          componentRuns: [createMockComponentRun({ linesAdded: 50 })],
          story: { type: 'feature', technicalComplexity: 2 }, // Low
        }),
        createMockWorkflowRun({
          workflowId: testWorkflowAId,
          startedAt: today,
          componentRuns: [createMockComponentRun({ linesAdded: 100 })],
          story: { type: 'feature', technicalComplexity: 9 }, // High
        }),
      ]);

      // Filter for high complexity (7-10)
      const result = await service.getKpiHistory({
        projectId: testProjectId,
        workflowAId: testWorkflowAId,
        technicalComplexity: 'high',
        days: 7,
      });

      expect(result.workflowA).toBeDefined();
      // Should only include high complexity run
      const todayData = result.workflowA.find(
        (d) => d.date === today.toISOString().split('T')[0]
      );
      expect(todayData?.linesAdded).toBe(100);
    });

    it('should combine business and technical complexity filters', async () => {
      (prisma.workflow.findMany as jest.Mock).mockResolvedValue([
        { id: testWorkflowAId, name: 'Workflow A' },
      ]);

      const today = new Date();

      (prisma.workflowRun.findMany as jest.Mock).mockResolvedValue([
        createMockWorkflowRun({
          workflowId: testWorkflowAId,
          startedAt: today,
          componentRuns: [createMockComponentRun({ userPrompts: 5 })],
          story: {
            type: 'feature',
            businessComplexity: 2,
            technicalComplexity: 2,
          }, // Both low
        }),
        createMockWorkflowRun({
          workflowId: testWorkflowAId,
          startedAt: today,
          componentRuns: [createMockComponentRun({ userPrompts: 10 })],
          story: {
            type: 'feature',
            businessComplexity: 8,
            technicalComplexity: 2,
          }, // High business, low technical
        }),
        createMockWorkflowRun({
          workflowId: testWorkflowAId,
          startedAt: today,
          componentRuns: [createMockComponentRun({ userPrompts: 15 })],
          story: {
            type: 'feature',
            businessComplexity: 8,
            technicalComplexity: 8,
          }, // Both high
        }),
      ]);

      // Filter for high business + high technical
      const result = await service.getKpiHistory({
        projectId: testProjectId,
        workflowAId: testWorkflowAId,
        businessComplexity: 'high',
        technicalComplexity: 'high',
        days: 7,
      });

      expect(result.workflowA).toBeDefined();
      // Should only include the run with both high (userPrompts: 15)
      const todayData = result.workflowA.find(
        (d) => d.date === today.toISOString().split('T')[0]
      );
      expect(todayData?.promptsPerStory).toBe(15);
    });
  });

  describe('KPI Calculations', () => {
    it('should calculate tokensPerLOC correctly', async () => {
      (prisma.workflow.findMany as jest.Mock).mockResolvedValue([
        { id: testWorkflowAId, name: 'Workflow A' },
      ]);

      const today = new Date();

      (prisma.workflowRun.findMany as jest.Mock).mockResolvedValue([
        createMockWorkflowRun({
          workflowId: testWorkflowAId,
          startedAt: today,
          componentRuns: [
            createMockComponentRun({
              tokensInput: 10000,
              tokensOutput: 2000,
              linesAdded: 100,
              linesModified: 50,
            }),
          ],
          story: { type: 'feature' },
        }),
      ]);

      const result = await service.getKpiHistory({
        projectId: testProjectId,
        workflowAId: testWorkflowAId,
        days: 7,
      });

      const todayData = result.workflowA.find(
        (d) => d.date === today.toISOString().split('T')[0]
      );

      // Total tokens: 12000, Total LOC: 150 -> tokensPerLOC = 80
      expect(todayData?.tokensPerLOC).toBeCloseTo(80, 1);
    });

    it('should calculate promptsPerStory correctly', async () => {
      (prisma.workflow.findMany as jest.Mock).mockResolvedValue([
        { id: testWorkflowAId, name: 'Workflow A' },
      ]);

      const today = new Date();
      const story1Id = uuidv4();
      const story2Id = uuidv4();

      (prisma.workflowRun.findMany as jest.Mock).mockResolvedValue([
        createMockWorkflowRun({
          workflowId: testWorkflowAId,
          storyId: story1Id,
          startedAt: today,
          componentRuns: [createMockComponentRun({ userPrompts: 10 })],
          story: { id: story1Id, type: 'feature' },
        }),
        createMockWorkflowRun({
          workflowId: testWorkflowAId,
          storyId: story2Id,
          startedAt: today,
          componentRuns: [createMockComponentRun({ userPrompts: 15 })],
          story: { id: story2Id, type: 'feature' },
        }),
      ]);

      const result = await service.getKpiHistory({
        projectId: testProjectId,
        workflowAId: testWorkflowAId,
        days: 7,
      });

      const todayData = result.workflowA.find(
        (d) => d.date === today.toISOString().split('T')[0]
      );

      // Total prompts: 25, Total stories: 2 -> avg = 12.5
      expect(todayData?.promptsPerStory).toBeCloseTo(12.5, 1);
    });

    it('should calculate costPerStory correctly', async () => {
      (prisma.workflow.findMany as jest.Mock).mockResolvedValue([
        { id: testWorkflowAId, name: 'Workflow A' },
      ]);

      const today = new Date();
      const story1Id = uuidv4();

      (prisma.workflowRun.findMany as jest.Mock).mockResolvedValue([
        createMockWorkflowRun({
          workflowId: testWorkflowAId,
          storyId: story1Id,
          startedAt: today,
          componentRuns: [createMockComponentRun({ cost: 2.5 })],
          story: { id: story1Id, type: 'feature' },
        }),
      ]);

      const result = await service.getKpiHistory({
        projectId: testProjectId,
        workflowAId: testWorkflowAId,
        days: 7,
      });

      const todayData = result.workflowA.find(
        (d) => d.date === today.toISOString().split('T')[0]
      );

      expect(todayData?.costPerStory).toBe(2.5);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty data gracefully', async () => {
      (prisma.workflow.findMany as jest.Mock).mockResolvedValue([
        { id: testWorkflowAId, name: 'Workflow A' },
      ]);
      (prisma.workflowRun.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.getKpiHistory({
        projectId: testProjectId,
        workflowAId: testWorkflowAId,
        days: 30,
      });

      expect(result).toBeDefined();
      expect(result.workflowA).toBeDefined();
      // Should return array with zeros or empty array for days with no data
      expect(Array.isArray(result.workflowA)).toBe(true);
    });

    it('should handle missing userPrompts (null values)', async () => {
      (prisma.workflow.findMany as jest.Mock).mockResolvedValue([
        { id: testWorkflowAId, name: 'Workflow A' },
      ]);

      const today = new Date();

      (prisma.workflowRun.findMany as jest.Mock).mockResolvedValue([
        createMockWorkflowRun({
          workflowId: testWorkflowAId,
          startedAt: today,
          componentRuns: [
            {
              ...createMockComponentRun({ linesAdded: 100 }),
              userPrompts: null, // Old data without prompts tracked
            },
          ],
          story: { type: 'feature' },
        }),
      ]);

      const result = await service.getKpiHistory({
        projectId: testProjectId,
        workflowAId: testWorkflowAId,
        days: 7,
      });

      expect(result.workflowA).toBeDefined();
      // Should treat null userPrompts as 0
      const todayData = result.workflowA.find(
        (d) => d.date === today.toISOString().split('T')[0]
      );
      expect(todayData?.promptsPerStory).toBe(0);
    });

    it('should handle division by zero (no LOC)', async () => {
      (prisma.workflow.findMany as jest.Mock).mockResolvedValue([
        { id: testWorkflowAId, name: 'Workflow A' },
      ]);

      const today = new Date();

      (prisma.workflowRun.findMany as jest.Mock).mockResolvedValue([
        createMockWorkflowRun({
          workflowId: testWorkflowAId,
          startedAt: today,
          componentRuns: [
            createMockComponentRun({
              tokensInput: 10000,
              tokensOutput: 2000,
              linesAdded: 0, // No code changes
              linesModified: 0,
            }),
          ],
          story: { type: 'feature' },
        }),
      ]);

      const result = await service.getKpiHistory({
        projectId: testProjectId,
        workflowAId: testWorkflowAId,
        days: 7,
      });

      const todayData = result.workflowA.find(
        (d) => d.date === today.toISOString().split('T')[0]
      );

      // Should handle division by zero gracefully (return 0 or null)
      expect(todayData?.tokensPerLOC).toBeGreaterThanOrEqual(0);
    });

    it('should return data for specified number of days', async () => {
      (prisma.workflow.findMany as jest.Mock).mockResolvedValue([
        { id: testWorkflowAId, name: 'Workflow A' },
      ]);

      // Mock data for last 7 days
      const runs = [];
      for (let i = 0; i < 7; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        runs.push(
          createMockWorkflowRun({
            workflowId: testWorkflowAId,
            startedAt: date,
            componentRuns: [createMockComponentRun({ userPrompts: 10 })],
            story: { type: 'feature' },
          })
        );
      }

      (prisma.workflowRun.findMany as jest.Mock).mockResolvedValue(runs);

      const result = await service.getKpiHistory({
        projectId: testProjectId,
        workflowAId: testWorkflowAId,
        days: 7,
      });

      // Should return up to 7 days of data
      expect(result.workflowA.length).toBeLessThanOrEqual(7);
    });
  });
});

// Helper functions
function createMockWorkflowRun(partial: Partial<any> = {}): any {
  return {
    id: uuidv4(),
    workflowId: partial.workflowId || uuidv4(),
    storyId: partial.storyId || uuidv4(),
    startedAt: partial.startedAt || new Date(),
    status: 'completed',
    workflow: { name: 'Default Workflow' },
    story: partial.story || { type: 'feature' },
    componentRuns: partial.componentRuns || [],
    ...partial,
  };
}

function createMockComponentRun(partial: Partial<any> = {}): any {
  return {
    id: uuidv4(),
    componentId: uuidv4(),
    userPrompts: partial.userPrompts ?? 0,
    tokensInput: partial.tokensInput ?? 0,
    tokensOutput: partial.tokensOutput ?? 0,
    tokensCacheRead: 0,
    tokensCacheWrite: 0,
    linesAdded: partial.linesAdded ?? 0,
    linesModified: partial.linesModified ?? 0,
    linesDeleted: partial.linesDeleted ?? 0,
    testsAdded: 0,
    filesModified: [],
    durationSeconds: 300,
    cost: partial.cost ?? 0.5,
    component: { name: 'Test Component' },
    ...partial,
  };
}
