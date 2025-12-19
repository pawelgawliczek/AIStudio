/**
 * Unit tests for AnalyticsService
 * Tests analytics calculations, metrics aggregation, and trend generation
 */

import { NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { TimeRange } from '../../dtos/analytics.dto';
import { AnalyticsService } from '../analytics.service';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      component: {
        findUnique: jest.fn(),
      },
      workflow: {
        findUnique: jest.fn(),
      },
      componentRun: {
        findMany: jest.fn(),
      },
      workflowRun: {
        findMany: jest.fn(),
      },
    };

    service = new AnalyticsService(mockPrisma as PrismaClient);
    jest.clearAllMocks();
  });

  // ==========================================================================
  // Time Range Calculations
  // ==========================================================================

  describe('Time Range Calculations', () => {
    it('should return null date for "all" time range', () => {
      const date = (service as any).getTimeRangeDate('all');
      expect(date).toBeNull();
    });

    it('should calculate 7 days ago for "7d" range', () => {
      const date = (service as any).getTimeRangeDate('7d');
      const now = new Date();
      const expected = new Date(now);
      expected.setDate(expected.getDate() - 7);

      expect(date.toDateString()).toBe(expected.toDateString());
    });

    it('should calculate 30 days ago for "30d" range', () => {
      const date = (service as any).getTimeRangeDate('30d');
      const now = new Date();
      const expected = new Date(now);
      expected.setDate(expected.getDate() - 30);

      expect(date.toDateString()).toBe(expected.toDateString());
    });

    it('should calculate 90 days ago for "90d" range', () => {
      const date = (service as any).getTimeRangeDate('90d');
      const now = new Date();
      const expected = new Date(now);
      expected.setDate(expected.getDate() - 90);

      expect(date.toDateString()).toBe(expected.toDateString());
    });

    it('should return null filter for undefined time range', () => {
      const filter = (service as any).buildTimeRangeFilter(undefined);
      expect(filter).toBeUndefined();
    });

    it('should return gte filter for valid time range', () => {
      const filter = (service as any).buildTimeRangeFilter('7d');
      expect(filter).toHaveProperty('gte');
      expect(filter.gte).toBeInstanceOf(Date);
    });
  });

  // ==========================================================================
  // Component Analytics
  // ==========================================================================

  describe('getComponentAnalytics', () => {
    const mockComponent = {
      id: 'comp-123',
      name: 'Test Component',
      versionMajor: 1,
      versionMinor: 0,
    };

    it('should throw NotFoundException when component not found', async () => {
      mockPrisma.component.findUnique.mockResolvedValue(null);

      await expect(
        service.getComponentAnalytics('comp-123')
      ).rejects.toThrow(NotFoundException);
    });

    it('should return analytics for component', async () => {
      mockPrisma.component.findUnique.mockResolvedValue(mockComponent);
      mockPrisma.componentRun.findMany.mockResolvedValue([
        {
          id: 'run-1',
          componentId: 'comp-123',
          status: 'completed',
          startedAt: new Date(),
          finishedAt: new Date(),
          metadata: { tokensUsed: 1000 },
          workflowRun: {
            workflow: { name: 'Test Workflow' },
            triggeredBy: 'user-1',
            context: {},
          },
        },
      ]);

      const result = await service.getComponentAnalytics('comp-123');

      expect(result.versionId).toBe('comp-123');
      expect(result.version).toBe('1.0');
      expect(result.metrics).toBeDefined();
      expect(result.workflowsUsing).toBeDefined();
      expect(result.executionHistory).toBeDefined();
      expect(result.executionTrend).toBeDefined();
      expect(result.costTrend).toBeDefined();
    });

    it('should use versionId when provided', async () => {
      mockPrisma.component.findUnique.mockResolvedValue({
        ...mockComponent,
        id: 'comp-version-456',
      });
      mockPrisma.componentRun.findMany.mockResolvedValue([]);

      await service.getComponentAnalytics('comp-123', 'comp-version-456');

      expect(mockPrisma.component.findUnique).toHaveBeenCalledWith({
        where: { id: 'comp-version-456' },
      });
    });

    it('should filter by time range', async () => {
      mockPrisma.component.findUnique.mockResolvedValue(mockComponent);
      mockPrisma.componentRun.findMany.mockResolvedValue([]);

      await service.getComponentAnalytics('comp-123', undefined, '7d');

      expect(mockPrisma.componentRun.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            startedAt: expect.objectContaining({ gte: expect.any(Date) }),
          }),
        })
      );
    });

    it('should limit execution history to 10 items', async () => {
      mockPrisma.component.findUnique.mockResolvedValue(mockComponent);
      const runs = Array.from({ length: 15 }, (_, i) => ({
        id: `run-${i}`,
        componentId: 'comp-123',
        status: 'completed',
        startedAt: new Date(),
        finishedAt: new Date(),
        metadata: {},
        workflowRun: { workflow: { name: 'Test' }, triggeredBy: 'user-1' },
      }));
      mockPrisma.componentRun.findMany.mockResolvedValue(runs);

      const result = await service.getComponentAnalytics('comp-123');

      expect(result.executionHistory.length).toBeLessThanOrEqual(10);
    });
  });

  // ==========================================================================
  // Workflow Analytics
  // ==========================================================================

  describe('getWorkflowAnalytics', () => {
    const mockWorkflow = {
      id: 'workflow-123',
      name: 'Test Workflow',
      versionMajor: 2,
      versionMinor: 1,
    };

    it('should throw NotFoundException when workflow not found', async () => {
      mockPrisma.workflow.findUnique.mockResolvedValue(null);

      await expect(
        service.getWorkflowAnalytics('workflow-123')
      ).rejects.toThrow(NotFoundException);
    });

    it('should return workflow analytics', async () => {
      mockPrisma.workflow.findUnique.mockResolvedValue(mockWorkflow);
      mockPrisma.workflowRun.findMany.mockResolvedValue([
        {
          id: 'run-1',
          workflowId: 'workflow-123',
          status: 'completed',
          startedAt: new Date(),
          endTime: new Date(),
          totalTokens: 5000,
          estimatedCost: 0.5,
          triggeredBy: 'user-1',
          workflow: mockWorkflow,
        },
      ]);
      mockPrisma.componentRun.findMany.mockResolvedValue([]);

      const result = await service.getWorkflowAnalytics('workflow-123');

      expect(result.versionId).toBe('workflow-123');
      expect(result.version).toBe('2.1');
      expect(result.metrics).toBeDefined();
      expect(result.componentBreakdown).toBeDefined();
      expect(result.executionHistory).toBeDefined();
    });
  });

  // ==========================================================================
  // Metrics Calculation
  // ==========================================================================

  describe('calculateMetrics', () => {
    it('should return zero metrics for empty execution history', () => {
      const metrics = (service as any).calculateMetrics([]);

      expect(metrics.totalExecutions).toBe(0);
      expect(metrics.successfulExecutions).toBe(0);
      expect(metrics.failedExecutions).toBe(0);
      expect(metrics.successRate).toBe(0);
      expect(metrics.avgDuration).toBe(0);
      expect(metrics.totalCost).toBe(0);
      expect(metrics.avgCost).toBe(0);
    });

    it('should calculate metrics from execution history', () => {
      const executionHistory = [
        { status: 'completed', duration: 100, cost: 0.5 },
        { status: 'completed', duration: 200, cost: 0.8 },
        { status: 'failed', duration: 50, cost: 0.2 },
      ];

      const metrics = (service as any).calculateMetrics(executionHistory);

      expect(metrics.totalExecutions).toBe(3);
      expect(metrics.successfulExecutions).toBe(2);
      expect(metrics.failedExecutions).toBe(1);
      expect(metrics.successRate).toBeCloseTo(66.67, 1);
      expect(metrics.avgDuration).toBeCloseTo(116.67, 1);
      expect(metrics.totalCost).toBeCloseTo(1.5, 1);
      expect(metrics.avgCost).toBe(0.5);
    });

    it('should handle executions without duration', () => {
      const executionHistory = [
        { status: 'completed' },
        { status: 'completed', duration: 100 },
      ];

      const metrics = (service as any).calculateMetrics(executionHistory);

      expect(metrics.avgDuration).toBe(100);
    });

    it('should calculate 100% success rate for all completed', () => {
      const executionHistory = [
        { status: 'completed', duration: 100, cost: 0.5 },
        { status: 'completed', duration: 150, cost: 0.6 },
      ];

      const metrics = (service as any).calculateMetrics(executionHistory);

      expect(metrics.successRate).toBe(100);
      expect(metrics.failedExecutions).toBe(0);
    });
  });

  // ==========================================================================
  // Deprecated Coordinator Methods
  // ==========================================================================

  describe('Deprecated Coordinator Methods (ST-164)', () => {
    it('should return empty array for getCoordinatorExecutionHistory', async () => {
      const result = await service.getCoordinatorExecutionHistory('coord-123');
      expect(result).toEqual([]);
    });

    it('should return empty array for getWorkflowsUsingCoordinator', async () => {
      const result = await service.getWorkflowsUsingCoordinator('coord-123');
      expect(result).toEqual([]);
    });

    it('should return empty array for getCoordinatorComponentUsage', async () => {
      const result = await service.getCoordinatorComponentUsage('coord-123');
      expect(result).toEqual([]);
    });

    it('should return analytics for coordinator with empty arrays', async () => {
      mockPrisma.component.findUnique.mockResolvedValue({
        id: 'coord-123',
        versionMajor: 1,
        versionMinor: 0,
      });

      const result = await service.getCoordinatorAnalytics('coord-123');

      expect(result.metrics.totalExecutions).toBe(0);
      expect(result.workflowsUsing).toEqual([]);
      expect(result.componentUsage).toEqual([]);
    });
  });

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  describe('Helper Methods', () => {
    it('should calculate average correctly', () => {
      const avg = (service as any).average([10, 20, 30]);
      expect(avg).toBe(20);
    });

    it('should return 0 for empty array average', () => {
      const avg = (service as any).average([]);
      expect(avg).toBe(0);
    });

    it('should extract cost from metadata', () => {
      const run = { metadata: { cost: 1.5 } };
      const cost = (service as any).extractCost(run);
      expect(cost).toBe(1.5);
    });

    it('should calculate cost from tokens when cost not in metadata', () => {
      const run = { metadata: { tokensUsed: 1000 } };
      const cost = (service as any).extractCost(run);
      expect(cost).toBeCloseTo(0.01, 2);
    });

    it('should return 0 cost when no metadata available', () => {
      const run = { metadata: {} };
      const cost = (service as any).extractCost(run);
      expect(cost).toBe(0);
    });

    it('should get bucket size for different time ranges', () => {
      expect((service as any).getBucketSize('7d')).toBe(24);
      expect((service as any).getBucketSize('30d')).toBe(24);
      expect((service as any).getBucketSize('90d')).toBe(24 * 7);
      expect((service as any).getBucketSize('all')).toBe(24 * 7);
    });

    it('should format bucket label for daily buckets', () => {
      const date = new Date('2025-01-15T10:30:00Z');
      const label = (service as any).formatBucketLabel(date, 24);
      expect(label).toBe('2025-01-15');
    });

    it('should format bucket label for hourly buckets', () => {
      const date = new Date('2025-01-15T10:30:00Z');
      const label = (service as any).formatBucketLabel(date, 1);
      expect(label).toContain('2025-01-15T10:00');
    });
  });

  // ==========================================================================
  // Workflow Execution History
  // ==========================================================================

  describe('getWorkflowExecutionHistory', () => {
    it('should return workflow execution history', async () => {
      const mockRuns = [
        {
          id: 'run-1',
          workflowId: 'workflow-123',
          status: 'completed',
          startedAt: new Date('2025-01-10'),
          endTime: new Date('2025-01-10'),
          totalTokens: 1000,
          triggeredBy: 'user-1',
          workflow: { name: 'Test Workflow' },
          context: {},
        },
      ];

      mockPrisma.workflowRun.findMany.mockResolvedValue(mockRuns);

      const result = await service.getWorkflowExecutionHistory('workflow-123');

      expect(result).toHaveLength(1);
      expect(result[0].workflowName).toBe('Test Workflow');
      expect(result[0].status).toBe('completed');
    });

    it('should apply time range filter', async () => {
      mockPrisma.workflowRun.findMany.mockResolvedValue([]);

      await service.getWorkflowExecutionHistory('workflow-123', undefined, '30d');

      expect(mockPrisma.workflowRun.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            startedAt: expect.objectContaining({ gte: expect.any(Date) }),
          }),
        })
      );
    });

    it('should respect limit parameter', async () => {
      mockPrisma.workflowRun.findMany.mockResolvedValue([]);

      await service.getWorkflowExecutionHistory('workflow-123', undefined, undefined, 50);

      expect(mockPrisma.workflowRun.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 50,
        })
      );
    });

    it('should respect offset parameter', async () => {
      mockPrisma.workflowRun.findMany.mockResolvedValue([]);

      await service.getWorkflowExecutionHistory('workflow-123', undefined, undefined, 100, 25);

      expect(mockPrisma.workflowRun.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 25,
        })
      );
    });
  });

  // ==========================================================================
  // Component Breakdown
  // ==========================================================================

  describe('getWorkflowComponentBreakdown', () => {
    it('should return component breakdown for workflow', async () => {
      const mockComponentRuns = [
        {
          componentId: 'comp-1',
          component: { name: 'Component A' },
          status: 'completed',
          startedAt: new Date('2025-01-01T10:00:00'),
          finishedAt: new Date('2025-01-01T10:05:00'),
          metadata: { cost: 0.5 },
        },
        {
          componentId: 'comp-1',
          component: { name: 'Component A' },
          status: 'failed',
          startedAt: new Date('2025-01-02T10:00:00'),
          finishedAt: new Date('2025-01-02T10:03:00'),
          metadata: { cost: 0.3 },
        },
      ];

      mockPrisma.componentRun.findMany.mockResolvedValue(mockComponentRuns);

      const result = await service.getWorkflowComponentBreakdown('workflow-123');

      expect(result).toHaveLength(1);
      expect(result[0].componentName).toBe('Component A');
      expect(result[0].avgDuration).toBeCloseTo(240, 0); // Average of 300s and 180s
      expect(result[0].avgCost).toBe(0.4); // Average of 0.5 and 0.3
      expect(result[0].failureRate).toBe(50);
    });

    it('should aggregate multiple components', async () => {
      const mockComponentRuns = [
        {
          componentId: 'comp-1',
          component: { name: 'Component A' },
          status: 'completed',
          startedAt: new Date('2025-01-01T10:00:00'),
          finishedAt: new Date('2025-01-01T10:05:00'),
          metadata: {},
        },
        {
          componentId: 'comp-2',
          component: { name: 'Component B' },
          status: 'completed',
          startedAt: new Date('2025-01-01T11:00:00'),
          finishedAt: new Date('2025-01-01T11:02:00'),
          metadata: {},
        },
      ];

      mockPrisma.componentRun.findMany.mockResolvedValue(mockComponentRuns);

      const result = await service.getWorkflowComponentBreakdown('workflow-123');

      expect(result).toHaveLength(2);
      expect(result.find(c => c.componentName === 'Component A')).toBeDefined();
      expect(result.find(c => c.componentName === 'Component B')).toBeDefined();
    });
  });

  // ==========================================================================
  // Trend Generation
  // ==========================================================================

  describe('Trend Generation', () => {
    it('should generate execution trend with correct buckets', () => {
      const executionHistory = [
        { startTime: new Date().toISOString(), status: 'completed' },
        { startTime: new Date().toISOString(), status: 'completed' },
      ];

      const trend = (service as any).generateExecutionTrend(executionHistory, '7d');

      expect(trend.length).toBeGreaterThan(0);
      expect(trend[0]).toHaveProperty('timestamp');
      expect(trend[0]).toHaveProperty('value');
      expect(trend[0]).toHaveProperty('label');
    });

    it('should generate cost trend with accumulated costs', () => {
      const now = new Date();
      const executionHistory = [
        { startTime: now.toISOString(), cost: 0.5 },
        { startTime: now.toISOString(), cost: 0.8 },
      ];

      const trend = (service as any).generateCostTrend(executionHistory, '7d');

      expect(trend.length).toBeGreaterThan(0);
      expect(trend.some(bucket => bucket.value > 0)).toBe(true);
    });

    it('should find correct bucket for execution', () => {
      const buckets = [
        {
          timestamp: '2025-01-01T00:00:00Z',
          value: 0,
          label: '2025-01-01',
        },
        {
          timestamp: '2025-01-02T00:00:00Z',
          value: 0,
          label: '2025-01-02',
        },
      ];

      const bucket = (service as any).findBucket(
        buckets,
        24,
        '2025-01-01T12:00:00Z'
      );

      expect(bucket).toBeDefined();
      expect(bucket.label).toBe('2025-01-01');
    });

    it('should return null when no bucket matches', () => {
      const buckets = [
        {
          timestamp: '2025-01-01T00:00:00Z',
          value: 0,
          label: '2025-01-01',
        },
      ];

      const bucket = (service as any).findBucket(
        buckets,
        24,
        '2025-01-05T12:00:00Z'
      );

      expect(bucket).toBeNull();
    });
  });
});
