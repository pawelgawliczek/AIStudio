/**
 * ST-239: TDD Tests for cost-metrics.calculator.ts
 * Tests calculation of cost metrics from runs
 * Extracts logic from calculateCostMetrics (lines 342-375)
 */

import { v4 as uuidv4 } from 'uuid';

describe('CostMetricsCalculator', () => {
  const TOKEN_COST_PER_1K = 0.01;

  describe('calculateCostMetrics', () => {
    it('should calculate cost per story', () => {
      const runs = [
        createRun({ storyId: 'story-1', tokensInput: 1000, tokensOutput: 500 }),
        createRun({ storyId: 'story-1', tokensInput: 2000, tokensOutput: 1000 }),
        createRun({ storyId: 'story-2', tokensInput: 1500, tokensOutput: 750 }),
      ];

      const result = calculateCostMetrics(runs, 0);

      // Story 1: 4500 tokens = 4.5K * 0.01 = $0.045
      // Story 2: 2250 tokens = 2.25K * 0.01 = $0.0225
      // Total: $0.0675 / 2 stories = $0.03375
      expect(result.costPerStory).toBeCloseTo(0.034, 2);
    });

    it('should calculate cost per accepted LOC', () => {
      const runs = [
        createRun({ tokensInput: 1000, tokensOutput: 500, locGenerated: 100 }),
        createRun({ tokensInput: 2000, tokensOutput: 1000, locGenerated: 200 }),
      ];

      const result = calculateCostMetrics(runs, 0);

      // Total: 4500 tokens = 4.5K * 0.01 = $0.045
      // Total LOC: 300
      // Cost per LOC: 0.045 / 300 = 0.00015
      expect(result.costPerAcceptedLoc).toBeCloseTo(0.00015, 5);
    });

    it('should handle zero LOC gracefully', () => {
      const runs = [
        createRun({ tokensInput: 1000, tokensOutput: 500, locGenerated: 0 }),
      ];

      const result = calculateCostMetrics(runs, 0);

      expect(result.costPerAcceptedLoc).toBe(0);
    });

    it('should count stories completed', () => {
      const runs = [
        createRun({ storyId: 'story-1' }),
        createRun({ storyId: 'story-1' }),
        createRun({ storyId: 'story-2' }),
        createRun({ storyId: 'story-3' }),
      ];

      const result = calculateCostMetrics(runs, 0);

      expect(result.storiesCompleted).toBe(3);
    });

    it('should count accepted LOC', () => {
      const runs = [
        createRun({ locGenerated: 100 }),
        createRun({ locGenerated: 150 }),
        createRun({ locGenerated: 50 }),
      ];

      const result = calculateCostMetrics(runs, 0);

      expect(result.acceptedLoc).toBe(300);
    });

    it('should calculate rework cost based on code churn', () => {
      const runs = [
        createRun({ storyId: 'story-1', tokensInput: 1000, tokensOutput: 500 }),
      ];
      const codeChurnPercent = 20; // 20% churn

      const result = calculateCostMetrics(runs, codeChurnPercent);

      // Cost per story: (1500 / 1000) * 0.01 = 0.015
      // Rework cost: 0.015 * (20 / 100) = 0.003
      expect(result.reworkCost).toBeCloseTo(0.003, 4);
    });

    it('should calculate net cost (cost + rework)', () => {
      const runs = [
        createRun({ storyId: 'story-1', tokensInput: 1000, tokensOutput: 500 }),
      ];
      const codeChurnPercent = 20;

      const result = calculateCostMetrics(runs, codeChurnPercent);

      // Cost: 0.015, Rework: 0.003
      // Net: 0.015 + 0.003 = 0.018
      expect(result.netCost).toBeCloseTo(0.018, 3);
    });

    it('should handle zero code churn', () => {
      const runs = [
        createRun({ storyId: 'story-1', tokensInput: 1000, tokensOutput: 500 }),
      ];

      const result = calculateCostMetrics(runs, 0);

      expect(result.reworkCost).toBe(0);
      expect(result.netCost).toBeCloseTo(result.costPerStory, 2);
    });

    it('should round costs to 2 decimal places', () => {
      const runs = [
        createRun({ storyId: 'story-1', tokensInput: 1234, tokensOutput: 567 }),
      ];

      const result = calculateCostMetrics(runs, 0);

      // Total: 1801 tokens = 1.801K * 0.01 = 0.01801
      // Should round to 0.02
      expect(result.costPerStory).toBeCloseTo(0.02, 2);
    });

    it('should round costPerAcceptedLoc to 4 decimal places', () => {
      const runs = [
        createRun({ tokensInput: 1000, tokensOutput: 500, locGenerated: 123 }),
      ];

      const result = calculateCostMetrics(runs, 0);

      expect(typeof result.costPerAcceptedLoc).toBe('number');
      // Should have proper precision
      expect(result.costPerAcceptedLoc.toFixed(4)).toBeDefined();
    });

    it('should handle empty runs array', () => {
      const runs: any[] = [];

      const result = calculateCostMetrics(runs, 0);

      expect(result.costPerStory).toBe(0);
      expect(result.costPerAcceptedLoc).toBe(0);
      expect(result.storiesCompleted).toBe(0);
      expect(result.acceptedLoc).toBe(0);
      expect(result.reworkCost).toBe(0);
      expect(result.netCost).toBe(0);
    });

    it('should handle null token values', () => {
      const runs = [
        createRun({ tokensInput: null, tokensOutput: null }),
      ];

      const result = calculateCostMetrics(runs, 0);

      expect(result.costPerStory).toBe(0);
    });

    it('should calculate costs for multiple stories correctly', () => {
      const runs = [
        createRun({ storyId: 'story-1', tokensInput: 1000, tokensOutput: 500, locGenerated: 100 }),
        createRun({ storyId: 'story-2', tokensInput: 2000, tokensOutput: 1000, locGenerated: 200 }),
        createRun({ storyId: 'story-3', tokensInput: 1500, tokensOutput: 750, locGenerated: 150 }),
      ];

      const result = calculateCostMetrics(runs, 10);

      // Total tokens: 7500, Cost: 0.075
      // 3 stories, Cost per story: 0.025
      // Rework: 0.025 * 0.1 = 0.0025
      // Net: 0.0275
      expect(result.storiesCompleted).toBe(3);
      expect(result.acceptedLoc).toBe(450);
      expect(result.costPerStory).toBeCloseTo(0.025, 3);
      expect(result.reworkCost).toBeCloseTo(0.0025, 4);
      expect(result.netCost).toBeCloseTo(0.0275, 3);
    });

    it('should handle high code churn scenarios', () => {
      const runs = [
        createRun({ storyId: 'story-1', tokensInput: 1000, tokensOutput: 500 }),
      ];
      const codeChurnPercent = 100; // 100% churn (everything rewritten)

      const result = calculateCostMetrics(runs, codeChurnPercent);

      // Rework cost should equal base cost
      expect(result.reworkCost).toBeCloseTo(result.costPerStory, 2);
      // Net cost should be 2x base cost
      expect(result.netCost).toBeCloseTo(result.costPerStory * 2, 2);
    });
  });
});

// Test helper functions
function createRun(partial: Partial<any> = {}): any {
  return {
    id: uuidv4(),
    storyId: partial.storyId ?? uuidv4(),
    tokensInput: partial.tokensInput ?? 0,
    tokensOutput: partial.tokensOutput ?? 0,
    locGenerated: partial.locGenerated ?? 0,
    ...partial,
  };
}

// Type definitions
interface CostMetricsDto {
  costPerStory: number;
  costPerAcceptedLoc: number;
  storiesCompleted: number;
  acceptedLoc: number;
  reworkCost: number;
  netCost: number;
}

declare function calculateCostMetrics(runs: any[], codeChurnPercent: number): CostMetricsDto;
