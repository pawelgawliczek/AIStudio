/**
 * ST-239: TDD Tests for efficiency-metrics.calculator.ts
 * Tests calculation of efficiency metrics from runs
 * Extracts logic from calculateEfficiencyMetrics (lines 221-266)
 */

import { v4 as uuidv4 } from 'uuid';

describe('EfficiencyMetricsCalculator', () => {
  describe('calculateEfficiencyMetrics', () => {
    it('should calculate average tokens per story', () => {
      const runs = [
        createRun({ storyId: 'story-1', tokensInput: 1000, tokensOutput: 500 }),
        createRun({ storyId: 'story-1', tokensInput: 2000, tokensOutput: 1000 }),
        createRun({ storyId: 'story-2', tokensInput: 1500, tokensOutput: 750 }),
      ];

      const result = calculateEfficiencyMetrics(runs);

      // Story 1: 4500 tokens, Story 2: 2250 tokens
      // Average: (4500 + 2250) / 2 = 3375
      expect(result.avgTokensPerStory).toBeCloseTo(3375, 1);
    });

    it('should calculate average tokens per LOC', () => {
      const runs = [
        createRun({ tokensInput: 1000, tokensOutput: 500, locGenerated: 100 }),
        createRun({ tokensInput: 2000, tokensOutput: 1000, locGenerated: 200 }),
      ];

      const result = calculateEfficiencyMetrics(runs);

      // Total tokens: 4500, Total LOC: 300
      // avgTokenPerLoc: 4500 / 300 = 15
      expect(result.avgTokenPerLoc).toBeCloseTo(15, 2);
    });

    it('should handle zero LOC gracefully', () => {
      const runs = [
        createRun({ tokensInput: 1000, tokensOutput: 500, locGenerated: 0 }),
      ];

      const result = calculateEfficiencyMetrics(runs);

      expect(result.avgTokenPerLoc).toBe(0);
    });

    it('should calculate story cycle time in hours', () => {
      const startedAt = new Date('2024-01-01T10:00:00Z');
      const finishedAt = new Date('2024-01-01T14:00:00Z'); // 4 hours later

      const runs = [
        createRun({ storyId: 'story-1', startedAt, finishedAt }),
      ];

      const result = calculateEfficiencyMetrics(runs);

      expect(result.storyCycleTimeHours).toBeCloseTo(4, 1);
    });

    it('should calculate average iterations per story', () => {
      const runs = [
        createRun({ storyId: 'story-1', iterations: 5 }),
        createRun({ storyId: 'story-1', iterations: 3 }),
        createRun({ storyId: 'story-2', iterations: 10 }),
      ];

      const result = calculateEfficiencyMetrics(runs);

      // Story 1: 8 iterations, Story 2: 10 iterations
      // Average: (8 + 10) / 2 = 9
      expect(result.promptIterationsPerStory).toBeCloseTo(9, 1);
    });

    it('should calculate token efficiency ratio (output/input)', () => {
      const runs = [
        createRun({ tokensInput: 1000, tokensOutput: 200 }), // 0.2 ratio
        createRun({ tokensInput: 2000, tokensOutput: 600 }), // 0.3 ratio
      ];

      const result = calculateEfficiencyMetrics(runs);

      // Total input: 3000, Total output: 800
      // Ratio: 800 / 3000 = 0.267
      expect(result.tokenEfficiencyRatio).toBeCloseTo(0.267, 2);
    });

    it('should handle zero input tokens gracefully', () => {
      const runs = [
        createRun({ tokensInput: 0, tokensOutput: 500 }),
      ];

      const result = calculateEfficiencyMetrics(runs);

      expect(result.tokenEfficiencyRatio).toBe(0);
    });

    it('should calculate parallelization efficiency', () => {
      const runs = [
        createRun({ storyId: 'story-1' }),
      ];

      const result = calculateEfficiencyMetrics(runs);

      // Note: Current implementation returns placeholder 75%
      // In real implementation, this would be calculated based on concurrent runs
      expect(result.parallelizationEfficiencyPercent).toBeGreaterThanOrEqual(0);
      expect(result.parallelizationEfficiencyPercent).toBeLessThanOrEqual(100);
    });

    it('should group runs by story correctly', () => {
      const runs = [
        createRun({ storyId: 'story-1', tokensInput: 1000, tokensOutput: 500 }),
        createRun({ storyId: 'story-2', tokensInput: 2000, tokensOutput: 1000 }),
        createRun({ storyId: 'story-1', tokensInput: 500, tokensOutput: 250 }),
      ];

      const result = calculateEfficiencyMetrics(runs);

      // Should aggregate by story
      // Story 1: 2250 tokens, Story 2: 3000 tokens
      // Average: (2250 + 3000) / 2 = 2625
      expect(result.avgTokensPerStory).toBeCloseTo(2625, 1);
    });

    it('should handle empty runs array', () => {
      const runs: any[] = [];

      const result = calculateEfficiencyMetrics(runs);

      expect(result.avgTokensPerStory).toBe(0);
      expect(result.avgTokenPerLoc).toBe(0);
      expect(result.storyCycleTimeHours).toBe(0);
      expect(result.promptIterationsPerStory).toBe(0);
    });

    it('should handle null values in runs', () => {
      const runs = [
        createRun({
          tokensInput: null,
          tokensOutput: null,
          locGenerated: null,
          iterations: null,
        }),
      ];

      const result = calculateEfficiencyMetrics(runs);

      expect(result.avgTokensPerStory).toBe(0);
      expect(result.avgTokenPerLoc).toBe(0);
    });

    it('should calculate cycle time for multiple runs of same story', () => {
      const start1 = new Date('2024-01-01T10:00:00Z');
      const finish1 = new Date('2024-01-01T12:00:00Z');
      const start2 = new Date('2024-01-01T09:00:00Z'); // Earlier start
      const finish2 = new Date('2024-01-01T13:00:00Z'); // Later finish

      const runs = [
        createRun({ storyId: 'story-1', startedAt: start1, finishedAt: finish1 }),
        createRun({ storyId: 'story-1', startedAt: start2, finishedAt: finish2 }),
      ];

      const result = calculateEfficiencyMetrics(runs);

      // Should take earliest start (09:00) to latest finish (13:00) = 4 hours
      expect(result.storyCycleTimeHours).toBeCloseTo(4, 1);
    });

    it('should handle runs without story IDs', () => {
      const runs = [
        createRun({ storyId: null, tokensInput: 1000, tokensOutput: 500 }),
      ];

      const result = calculateEfficiencyMetrics(runs);

      // Should not crash, but may skip stories without IDs
      expect(result).toBeDefined();
    });
  });

  describe('groupRunsByStory', () => {
    it('should group runs by story ID', () => {
      const runs = [
        createRun({ storyId: 'story-1', tokensInput: 1000, tokensOutput: 500 }),
        createRun({ storyId: 'story-2', tokensInput: 2000, tokensOutput: 1000 }),
        createRun({ storyId: 'story-1', tokensInput: 500, tokensOutput: 250 }),
      ];

      const grouped = groupRunsByStory(runs);

      expect(grouped.size).toBe(2);
      expect(grouped.has('story-1')).toBe(true);
      expect(grouped.has('story-2')).toBe(true);
      expect(grouped.get('story-1')!.runs.length).toBe(2);
      expect(grouped.get('story-2')!.runs.length).toBe(1);
    });

    it('should aggregate tokens per story', () => {
      const runs = [
        createRun({ storyId: 'story-1', tokensInput: 1000, tokensOutput: 500 }),
        createRun({ storyId: 'story-1', tokensInput: 2000, tokensOutput: 1000 }),
      ];

      const grouped = groupRunsByStory(runs);

      expect(grouped.get('story-1')!.totalTokens).toBe(4500);
    });

    it('should aggregate LOC per story', () => {
      const runs = [
        createRun({ storyId: 'story-1', locGenerated: 100 }),
        createRun({ storyId: 'story-1', locGenerated: 50 }),
      ];

      const grouped = groupRunsByStory(runs);

      expect(grouped.get('story-1')!.totalLoc).toBe(150);
    });

    it('should aggregate iterations per story', () => {
      const runs = [
        createRun({ storyId: 'story-1', iterations: 5 }),
        createRun({ storyId: 'story-1', iterations: 3 }),
      ];

      const grouped = groupRunsByStory(runs);

      expect(grouped.get('story-1')!.totalIterations).toBe(8);
    });

    it('should track earliest start and latest finish', () => {
      const start1 = new Date('2024-01-01T10:00:00Z');
      const finish1 = new Date('2024-01-01T12:00:00Z');
      const start2 = new Date('2024-01-01T09:00:00Z');
      const finish2 = new Date('2024-01-01T13:00:00Z');

      const runs = [
        createRun({ storyId: 'story-1', startedAt: start1, finishedAt: finish1 }),
        createRun({ storyId: 'story-1', startedAt: start2, finishedAt: finish2 }),
      ];

      const grouped = groupRunsByStory(runs);

      expect(grouped.get('story-1')!.startedAt).toEqual(start2);
      expect(grouped.get('story-1')!.finishedAt).toEqual(finish2);
    });

    it('should skip runs without story IDs', () => {
      const runs = [
        createRun({ storyId: null, tokensInput: 1000, tokensOutput: 500 }),
        createRun({ storyId: 'story-1', tokensInput: 2000, tokensOutput: 1000 }),
      ];

      const grouped = groupRunsByStory(runs);

      expect(grouped.size).toBe(1);
      expect(grouped.has('story-1')).toBe(true);
    });
  });
});

// Test helper functions
function createRun(partial: Partial<any> = {}): any {
  const now = new Date();
  return {
    id: uuidv4(),
    storyId: partial.storyId ?? uuidv4(),
    tokensInput: partial.tokensInput ?? 0,
    tokensOutput: partial.tokensOutput ?? 0,
    locGenerated: partial.locGenerated ?? 0,
    iterations: partial.iterations ?? 0,
    startedAt: partial.startedAt ?? now,
    finishedAt: partial.finishedAt ?? new Date(now.getTime() + 3600000), // +1 hour
    ...partial,
  };
}

// Type definitions
interface EfficiencyMetricsDto {
  avgTokensPerStory: number;
  avgTokenPerLoc: number;
  storyCycleTimeHours: number;
  promptIterationsPerStory: number;
  parallelizationEfficiencyPercent: number;
  tokenEfficiencyRatio: number;
}

interface StoryMetrics {
  storyId: string;
  runs: any[];
  totalTokens: number;
  totalLoc: number;
  totalIterations: number;
  startedAt: Date;
  finishedAt: Date;
  cycleTimeHours: number;
}

declare function calculateEfficiencyMetrics(runs: any[]): EfficiencyMetricsDto;
declare function groupRunsByStory(runs: any[]): Map<string, StoryMetrics>;
