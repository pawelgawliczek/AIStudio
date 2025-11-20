/**
 * Unit Tests for ST-27: Get Workflow Metrics Breakdown
 * Tests aggregation of metrics across components
 */

import { handler } from '../get_workflow_metrics_breakdown';
import { prismaMock, fixtures } from './test-setup';

describe('ST-27: Get Workflow Metrics Breakdown - Unit Tests', () => {
  describe('TC-WORKFLOW-001: Validate workflowRunId is required', () => {
    it('should throw error when workflowRunId is missing', async () => {
      await expect(handler(prismaMock, {})).rejects.toThrow('workflowRunId is required');
    });
  });

  describe('TC-WORKFLOW-002: Return error for non-existent workflowRunId', () => {
    it('should throw error when workflow run not found', async () => {
      const params = { workflowRunId: 'non-existent-id' };

      prismaMock.workflowRun.findUnique.mockResolvedValue(null);

      await expect(handler(prismaMock, params)).rejects.toThrow(
        'Workflow run with ID non-existent-id not found'
      );
    });
  });

  describe('TC-WORKFLOW-003: Aggregate tokens across components', () => {
    it('should sum total tokens from all component runs', async () => {
      const params = { workflowRunId: fixtures.workflowRun.id };

      const mockComponents = [
        {
          ...fixtures.componentRun,
          id: '1',
          totalTokens: 50000,
          tokensCacheRead: 8000,
          component: fixtures.component,
        },
        {
          ...fixtures.componentRun,
          id: '2',
          totalTokens: 35000,
          tokensCacheRead: 5000,
          component: fixtures.component,
        },
        {
          ...fixtures.componentRun,
          id: '3',
          totalTokens: 20000,
          tokensCacheRead: 3000,
          component: fixtures.component,
        },
      ];

      prismaMock.workflowRun.findUnique.mockResolvedValue({
        ...fixtures.workflowRun,
        workflow: fixtures.workflow,
        story: fixtures.story,
        componentRuns: mockComponents,
      } as any);

      const result = await handler(prismaMock, params);

      expect(result.overall.totalTokens).toBe(105000); // 50k + 35k + 20k
      expect(result.overall.totalCacheRead).toBe(16000); // 8k + 5k + 3k
      expect(result.overall.completedComponents).toBe(3);
    });
  });

  describe('TC-WORKFLOW-004: Calculate average cache hit rate', () => {
    it('should average cache hit rates across components', async () => {
      const params = { workflowRunId: fixtures.workflowRun.id };

      const mockComponents = [
        {
          ...fixtures.componentRun,
          id: '1',
          cacheHitRate: 0.8,
          cacheHits: 40,
          cacheMisses: 10,
          component: fixtures.component,
        },
        {
          ...fixtures.componentRun,
          id: '2',
          cacheHitRate: 0.6,
          cacheHits: 30,
          cacheMisses: 20,
          component: fixtures.component,
        },
      ];

      prismaMock.workflowRun.findUnique.mockResolvedValue({
        ...fixtures.workflowRun,
        workflow: fixtures.workflow,
        story: fixtures.story,
        componentRuns: mockComponents,
      } as any);

      const result = await handler(prismaMock, params);

      expect(result.overall.avgCacheHitRate).toBeCloseTo(0.7); // (0.8 + 0.6) / 2
      expect(result.cachePerformance.totalHits).toBe(70); // 40 + 30
      expect(result.cachePerformance.totalMisses).toBe(30); // 10 + 20
    });
  });

  describe('TC-WORKFLOW-005: Aggregate cost breakdown', () => {
    it('should sum costs from all components', async () => {
      const params = { workflowRunId: fixtures.workflowRun.id };

      const mockComponents = [
        {
          ...fixtures.componentRun,
          id: '1',
          cost: 0.25,
          costBreakdown: { input: 0.1, output: 0.14, cache: 0.01, total: 0.25 },
          component: fixtures.component,
        },
        {
          ...fixtures.componentRun,
          id: '2',
          cost: 0.18,
          costBreakdown: { input: 0.08, output: 0.09, cache: 0.01, total: 0.18 },
          component: fixtures.component,
        },
      ];

      prismaMock.workflowRun.findUnique.mockResolvedValue({
        ...fixtures.workflowRun,
        workflow: fixtures.workflow,
        story: fixtures.story,
        componentRuns: mockComponents,
      } as any);

      const result = await handler(prismaMock, params);

      expect(result.overall.totalCost).toBeCloseTo(0.43); // 0.25 + 0.18
      expect(result.costBreakdown.input).toBeCloseTo(0.18); // 0.1 + 0.08
      expect(result.costBreakdown.output).toBeCloseTo(0.23); // 0.14 + 0.09
      expect(result.costBreakdown.cache).toBeCloseTo(0.02); // 0.01 + 0.01
    });
  });

  describe('TC-WORKFLOW-006: Aggregate code impact metrics', () => {
    it('should sum lines changed across components', async () => {
      const params = { workflowRunId: fixtures.workflowRun.id };

      const mockComponents = [
        {
          ...fixtures.componentRun,
          id: '1',
          linesAdded: 100,
          linesDeleted: 20,
          linesModified: 15,
          component: fixtures.component,
        },
        {
          ...fixtures.componentRun,
          id: '2',
          linesAdded: 50,
          linesDeleted: 10,
          linesModified: 8,
          component: fixtures.component,
        },
      ];

      prismaMock.workflowRun.findUnique.mockResolvedValue({
        ...fixtures.workflowRun,
        workflow: fixtures.workflow,
        story: fixtures.story,
        componentRuns: mockComponents,
      } as any);

      const result = await handler(prismaMock, params);

      expect(result.codeImpact.totalLinesAdded).toBe(150); // 100 + 50
      expect(result.codeImpact.totalLinesDeleted).toBe(30); // 20 + 10
      expect(result.codeImpact.totalLinesModified).toBe(23); // 15 + 8
      expect(result.codeImpact.netLinesChanged).toBe(143); // 150 - 30 + 23
    });
  });

  describe('TC-WORKFLOW-007: Group by tool usage', () => {
    it('should aggregate tool usage across all components', async () => {
      const params = { workflowRunId: fixtures.workflowRun.id, groupBy: 'tool' };

      const mockComponents = [
        {
          ...fixtures.componentRun,
          id: '1',
          toolBreakdown: {
            Read: { calls: 10, errors: 0, avgDuration: 0.1, totalDuration: 1 },
            Write: { calls: 5, errors: 1, avgDuration: 0.3, totalDuration: 1.5 },
          },
          component: fixtures.component,
        },
        {
          ...fixtures.componentRun,
          id: '2',
          toolBreakdown: {
            Read: { calls: 8, errors: 0, avgDuration: 0.12, totalDuration: 0.96 },
            Bash: { calls: 3, errors: 0, avgDuration: 2.0, totalDuration: 6 },
          },
          component: fixtures.component,
        },
      ];

      prismaMock.workflowRun.findUnique.mockResolvedValue({
        ...fixtures.workflowRun,
        workflow: fixtures.workflow,
        story: fixtures.story,
        componentRuns: mockComponents,
      } as any);

      const result = await handler(prismaMock, params);

      expect(result.breakdown).toBeDefined();
      const readTool = result.breakdown.find((t: any) => t.toolName === 'Read');
      expect(readTool).toBeDefined();
      expect(readTool.calls).toBe(18); // 10 + 8
      expect(readTool.totalDuration).toBeCloseTo(1.96); // 1 + 0.96
    });
  });

  describe('TC-WORKFLOW-008: Include timeline when requested', () => {
    it('should include component execution timeline', async () => {
      const params = { workflowRunId: fixtures.workflowRun.id, includeTimeline: true };

      const mockComponents = [
        {
          ...fixtures.componentRun,
          id: '1',
          startedAt: new Date('2025-11-17T10:00:00Z'),
          finishedAt: new Date('2025-11-17T10:05:00Z'),
          durationSeconds: 300,
          component: { name: 'Context Explore' },
        },
        {
          ...fixtures.componentRun,
          id: '2',
          startedAt: new Date('2025-11-17T10:05:00Z'),
          finishedAt: new Date('2025-11-17T10:10:00Z'),
          durationSeconds: 300,
          component: { name: 'Business Analyst' },
        },
      ];

      prismaMock.workflowRun.findUnique.mockResolvedValue({
        ...fixtures.workflowRun,
        workflow: fixtures.workflow,
        story: fixtures.story,
        componentRuns: mockComponents,
      } as any);

      const result = await handler(prismaMock, params);

      expect(result.timeline).toBeDefined();
      expect(result.timeline).toHaveLength(2);
      expect(result.timeline[0].componentName).toBe('Context Explore');
      expect(result.timeline[1].componentName).toBe('Business Analyst');
    });
  });
});
