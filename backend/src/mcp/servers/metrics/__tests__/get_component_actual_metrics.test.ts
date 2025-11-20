/**
 * Unit Tests for ST-27: Get Component Actual Metrics
 * Tests cache performance, cost breakdown, and code impact metrics
 */

import { handler } from '../get_component_actual_metrics';
import { prismaMock, fixtures } from './test-setup';

describe('ST-27: Get Component Actual Metrics - Unit Tests', () => {
  describe('TC-METRICS-001: Validate componentRunId is required', () => {
    it('should throw error when componentRunId is missing', async () => {
      await expect(handler(prismaMock, {})).rejects.toThrow('componentRunId is required');
    });
  });

  describe('TC-METRICS-002: Return error for non-existent componentRunId', () => {
    it('should throw error when component run not found', async () => {
      const params = { componentRunId: 'non-existent-id' };

      prismaMock.componentRun.findUnique.mockResolvedValue(null);

      await expect(handler(prismaMock, params)).rejects.toThrow(
        'Component run with ID non-existent-id not found'
      );
    });
  });

  describe('TC-METRICS-003: Calculate cache efficiency score', () => {
    it('should calculate cache efficiency with hit rate and tokens saved bonus', async () => {
      const params = { componentRunId: fixtures.componentRun.id };

      prismaMock.componentRun.findUnique.mockResolvedValue({
        ...fixtures.componentRun,
        component: fixtures.component,
        workflowRun: {
          ...fixtures.workflowRun,
          story: fixtures.story,
        },
      } as any);

      const result = await handler(prismaMock, params);

      // Cache hit rate: 45/(45+12) = 0.789
      // Tokens saved: 12000 → bonus = min(12000/10000, 0.5) = 0.5
      // Efficiency = min((0.789 + 0.5) * 100, 100) = 100 (capped)
      expect(result.cache.hitRate).toBeCloseTo(0.789);
      expect(result.cache.tokensSaved).toBe(12000);
      expect(result.cache.efficiencyScore).toBeGreaterThanOrEqual(0);
      expect(result.cache.efficiencyScore).toBeLessThanOrEqual(100);
    });
  });

  describe('TC-METRICS-004: Return tool breakdown with statistics', () => {
    it('should aggregate tool usage statistics correctly', async () => {
      const params = { componentRunId: fixtures.componentRun.id, includeToolBreakdown: true };

      prismaMock.componentRun.findUnique.mockResolvedValue({
        ...fixtures.componentRun,
        component: fixtures.component,
        workflowRun: {
          ...fixtures.workflowRun,
          story: fixtures.story,
        },
      } as any);

      const result = await handler(prismaMock, params);

      expect(result.toolUsage).toBeDefined();
      expect(result.toolUsage.totalCalls).toBe(60); // 25+8+12+15
      expect(result.toolUsage.totalErrors).toBe(1); // 0+1+0+0
      expect(result.toolUsage.mostUsedTool).toBe('Read'); // 25 calls
      expect(result.toolUsage.avgToolDuration).toBeGreaterThan(0);
    });
  });

  describe('TC-METRICS-005: Return cost breakdown with per-token cost', () => {
    it('should calculate cost per 1K tokens', async () => {
      const params = { componentRunId: fixtures.componentRun.id, includeCostBreakdown: true };

      prismaMock.componentRun.findUnique.mockResolvedValue({
        ...fixtures.componentRun,
        component: fixtures.component,
        workflowRun: {
          ...fixtures.workflowRun,
          story: fixtures.story,
        },
      } as any);

      const result = await handler(prismaMock, params);

      expect(result.cost).toBeDefined();
      expect(result.cost.totalCost).toBeCloseTo(0.3186, 3);
      expect(result.cost.inputCost).toBeCloseTo(0.195, 3);
      expect(result.cost.outputCost).toBeCloseTo(0.12, 3);
      expect(result.cost.cacheCost).toBeCloseTo(0.0036, 4);
      // Cost per 1K tokens: 0.3186 / (73000/1000) = 0.00436
      expect(result.cost.costPerToken).toBeGreaterThan(0);
    });
  });

  describe('TC-METRICS-006: Return code impact metrics with deltas', () => {
    it('should calculate complexity and coverage deltas', async () => {
      const params = { componentRunId: fixtures.componentRun.id, includeCodeImpact: true };

      prismaMock.componentRun.findUnique.mockResolvedValue({
        ...fixtures.componentRun,
        component: fixtures.component,
        workflowRun: {
          ...fixtures.workflowRun,
          story: fixtures.story,
        },
      } as any);

      const result = await handler(prismaMock, params);

      expect(result.codeImpact).toBeDefined();
      expect(result.codeImpact.linesAdded).toBe(150);
      expect(result.codeImpact.linesDeleted).toBe(35);
      expect(result.codeImpact.netLinesChanged).toBe(137); // 150-35+22
      expect(result.codeImpact.complexityDelta).toBeCloseTo(0.7); // 9.2-8.5
      expect(result.codeImpact.coverageDelta).toBeCloseTo(3.8); // 82.3-78.5
    });
  });

  describe('TC-METRICS-007: Return throughput metrics', () => {
    it('should return tokens per second and time to first token', async () => {
      const params = { componentRunId: fixtures.componentRun.id };

      prismaMock.componentRun.findUnique.mockResolvedValue({
        ...fixtures.componentRun,
        component: fixtures.component,
        workflowRun: {
          ...fixtures.workflowRun,
          story: fixtures.story,
        },
      } as any);

      const result = await handler(prismaMock, params);

      expect(result.throughput).toBeDefined();
      expect(result.throughput.tokensPerSecond).toBe(608.3);
      expect(result.throughput.timeToFirstTokenMs).toBe(850); // 0.85 * 1000
      expect(result.throughput.modelId).toBe('claude-sonnet-4-5-20250929');
      expect(result.throughput.temperature).toBe(0.2);
    });
  });

  describe('TC-METRICS-008: Handle null values gracefully', () => {
    it('should return default values when metrics are null', async () => {
      const params = { componentRunId: fixtures.componentRun.id };

      const componentWithNulls = {
        ...fixtures.componentRun,
        tokensCacheRead: null,
        tokensCacheWrite: null,
        cacheHits: null,
        cacheMisses: null,
        cacheHitRate: null,
        toolBreakdown: null,
        costBreakdown: null,
        linesAdded: null,
        complexityBefore: null,
        complexityAfter: null,
        component: fixtures.component,
        workflowRun: {
          ...fixtures.workflowRun,
          story: fixtures.story,
        },
      };

      prismaMock.componentRun.findUnique.mockResolvedValue(componentWithNulls as any);

      const result = await handler(prismaMock, params);

      expect(result.cache.hits).toBe(0);
      expect(result.cache.misses).toBe(0);
      expect(result.cache.hitRate).toBe(0);
      expect(result.cache.tokensSaved).toBe(0);
      expect(result.codeImpact.complexityDelta).toBeNull();
    });
  });
});
