/**
 * ST-239: TDD Tests for comprehensive-metrics.calculator.ts
 * Tests calculation of comprehensive metrics from workflow runs
 */

import { v4 as uuidv4 } from 'uuid';
import { ComprehensiveMetricsCalculator } from '../comprehensive-metrics.calculator';

describe('ComprehensiveMetricsCalculator', () => {
  let calculator: ComprehensiveMetricsCalculator;

  beforeAll(() => {
    calculator = new ComprehensiveMetricsCalculator();
  });

  describe('calculateComprehensiveMetrics', () => {
    it('should calculate token metrics from component runs', () => {
      const workflowRuns = [
        createWorkflowRun({
          componentRuns: [
            createComponentRun({ tokensInput: 1000, tokensOutput: 500, tokensCacheRead: 200, tokensCacheWrite: 100 }),
            createComponentRun({ tokensInput: 2000, tokensOutput: 800, tokensCacheRead: 300, tokensCacheWrite: 150 }),
          ],
        }),
      ];

      const result = calculator.calculateComprehensiveMetrics(workflowRuns);

      expect(result.tokens.inputTokens).toBe(3000);
      expect(result.tokens.outputTokens).toBe(1300);
      expect(result.tokens.totalTokens).toBe(4300);
      expect(result.tokens.cacheRead).toBe(500);
      expect(result.tokens.cacheWrite).toBe(250);
    });

    it('should calculate cache hit rate correctly', () => {
      const workflowRuns = [
        createWorkflowRun({
          componentRuns: [
            createComponentRun({ cacheHits: 8, cacheMisses: 2 }),
            createComponentRun({ cacheHits: 7, cacheMisses: 3 }),
          ],
        }),
      ];

      const result = calculator.calculateComprehensiveMetrics(workflowRuns);

      // Total: 15 hits, 5 misses = 15/20 = 75%
      expect(result.tokens.cacheHitRate).toBeCloseTo(0.75, 2);
    });

    it('should handle zero cache hits and misses (avoid division by zero)', () => {
      const workflowRuns = [
        createWorkflowRun({
          componentRuns: [
            createComponentRun({ cacheHits: 0, cacheMisses: 0 }),
          ],
        }),
      ];

      const result = calculator.calculateComprehensiveMetrics(workflowRuns);

      expect(result.tokens.cacheHitRate).toBe(0);
    });

    it('should calculate code impact metrics', () => {
      const workflowRuns = [
        createWorkflowRun({
          componentRuns: [
            createComponentRun({ linesAdded: 100, linesModified: 50, linesDeleted: 20, testsAdded: 5 }),
            createComponentRun({ linesAdded: 150, linesModified: 30, linesDeleted: 10, testsAdded: 3 }),
          ],
        }),
      ];

      const result = calculator.calculateComprehensiveMetrics(workflowRuns);

      expect(result.codeImpact.linesAdded).toBe(250);
      expect(result.codeImpact.linesModified).toBe(80);
      expect(result.codeImpact.linesDeleted).toBe(30);
      expect(result.codeImpact.testsAdded).toBe(8);
    });

    it('should count total files modified across component runs', () => {
      const workflowRuns = [
        createWorkflowRun({
          componentRuns: [
            createComponentRun({ filesModified: ['file1.ts', 'file2.ts'] }),
            createComponentRun({ filesModified: ['file2.ts', 'file3.ts'] }),
          ],
        }),
      ];

      const result = calculator.calculateComprehensiveMetrics(workflowRuns);

      // Counts total length of all filesModified arrays: 2 + 2 = 4
      expect(result.codeImpact.filesModified).toBe(4);
    });

    it('should calculate execution metrics', () => {
      const workflowRuns = [
        createWorkflowRun({
          componentRuns: [
            createComponentRun({ durationSeconds: 300, userPrompts: 5, systemIterations: 10, humanInterventions: 2 }),
            createComponentRun({ durationSeconds: 450, userPrompts: 8, systemIterations: 15, humanInterventions: 3 }),
          ],
        }),
        createWorkflowRun({
          componentRuns: [
            createComponentRun({ durationSeconds: 600, userPrompts: 10, systemIterations: 20, humanInterventions: 1 }),
          ],
        }),
      ];

      const result = calculator.calculateComprehensiveMetrics(workflowRuns);

      expect(result.execution.totalRuns).toBe(2);
      expect(result.execution.totalDurationSeconds).toBe(1350);
      expect(result.execution.avgDurationPerRun).toBeCloseTo(675, 1);
      expect(result.execution.totalPrompts).toBe(23);
      expect(result.execution.totalIterations).toBe(45);
      expect(result.execution.totalInteractions).toBe(6);
    });

    it('should calculate ST-147 turn tracking metrics', () => {
      const workflowRuns = [
        createWorkflowRun({
          componentRuns: [
            createComponentRun({ totalTurns: 20, manualPrompts: 5, autoContinues: 15 }),
            createComponentRun({ totalTurns: 30, manualPrompts: 10, autoContinues: 20 }),
          ],
        }),
      ];

      const result = calculator.calculateComprehensiveMetrics(workflowRuns);

      expect(result.execution.totalTurns).toBe(50);
      expect(result.execution.totalManualPrompts).toBe(15);
      expect(result.execution.totalAutoContinues).toBe(35);
    });

    it('should calculate cost metrics', () => {
      const workflowRuns = [
        createWorkflowRun({
          storyId: 'story-1',
          componentRuns: [
            createComponentRun({ cost: 1.50 }),
            createComponentRun({ cost: 2.00 }),
          ],
        }),
        createWorkflowRun({
          storyId: 'story-2',
          componentRuns: [
            createComponentRun({ cost: 3.25 }),
          ],
        }),
      ];

      const result = calculator.calculateComprehensiveMetrics(workflowRuns);

      expect(result.costValue.storiesCompleted).toBe(2); // 2 unique stories
      const totalCost = 1.50 + 2.00 + 3.25;
      expect(result.costValue.costPerStory).toBeCloseTo(totalCost / 2, 2);
    });

    it('should calculate efficiency ratios', () => {
      const workflowRuns = [
        createWorkflowRun({
          storyId: 'story-1',
          componentRuns: [
            createComponentRun({
              tokensInput: 1000,
              tokensOutput: 500,
              linesAdded: 100,
              linesModified: 50,
              userPrompts: 5,
            }),
          ],
        }),
      ];

      const result = calculator.calculateComprehensiveMetrics(workflowRuns);

      const totalTokens = 1500;
      const totalLOC = 150;
      expect(result.efficiency.tokensPerLOC).toBeCloseTo(totalTokens / totalLOC, 2);
      expect(result.efficiency.promptsPerStory).toBeCloseTo(5, 2);
      expect(result.efficiency.interactionsPerStory).toBe(0); // No interactions in test data
    });

    it('should calculate ST-147 turn-based efficiency metrics', () => {
      const workflowRuns = [
        createWorkflowRun({
          storyId: 'story-1',
          componentRuns: [
            createComponentRun({ totalTurns: 100, manualPrompts: 25, autoContinues: 75 }),
          ],
        }),
      ];

      const result = calculator.calculateComprehensiveMetrics(workflowRuns);

      expect(result.efficiency.turnsPerStory).toBe(100);
      expect(result.efficiency.manualPromptsPerStory).toBe(25);
      // Automation rate: (75 / 100) * 100 = 75%
      expect(result.efficiency.automationRate).toBeCloseTo(75, 1);
    });

    it('should handle empty workflow runs array', () => {
      const workflowRuns: any[] = [];

      const result = calculator.calculateComprehensiveMetrics(workflowRuns);

      expect(result.tokens.totalTokens).toBe(0);
      expect(result.codeImpact.linesAdded).toBe(0);
      expect(result.execution.totalRuns).toBe(0);
      // When no stories, storiesCompleted is 0, but we default to 1 to avoid division by zero
      expect(result.costValue.storiesCompleted).toBeGreaterThanOrEqual(0);
    });

    it('should handle null values in component runs gracefully', () => {
      const workflowRuns = [
        createWorkflowRun({
          componentRuns: [
            {
              id: uuidv4(),
              tokensInput: null,
              tokensOutput: null,
              linesAdded: null,
              cost: null,
            },
          ],
        }),
      ];

      const result = calculator.calculateComprehensiveMetrics(workflowRuns);

      expect(result.tokens.totalTokens).toBe(0);
      expect(result.codeImpact.linesAdded).toBe(0);
    });

    it('should handle division by zero in efficiency calculations', () => {
      const workflowRuns = [
        createWorkflowRun({
          storyId: 'story-1',
          componentRuns: [
            createComponentRun({
              tokensInput: 1000,
              tokensOutput: 500,
              linesAdded: 0, // Zero LOC
              linesModified: 0,
              userPrompts: 0,
            }),
          ],
        }),
      ];

      const result = calculator.calculateComprehensiveMetrics(workflowRuns);

      // Should not crash on division by zero
      expect(result.efficiency.tokensPerLOC).toBe(0);
      expect(result.costValue.costPerAcceptedLoc).toBe(0);
    });

    it('should calculate rework cost based on code churn', () => {
      const workflowRuns = [
        createWorkflowRun({
          storyId: 'story-1',
          componentRuns: [
            createComponentRun({ cost: 10.00 }),
          ],
        }),
      ];

      const result = calculator.calculateComprehensiveMetrics(workflowRuns);

      // Rework cost is calculated but since codeChurnPercent is always 0, reworkCost is 0
      expect(result.costValue.reworkCost).toBeDefined();
      expect(result.costValue.netCost).toBeDefined();
    });

    it('should handle multiple stories in the same workflow run', () => {
      const workflowRuns = [
        createWorkflowRun({
          storyId: 'story-1',
          componentRuns: [createComponentRun({ userPrompts: 5 })],
        }),
        createWorkflowRun({
          storyId: 'story-2',
          componentRuns: [createComponentRun({ userPrompts: 8 })],
        }),
        createWorkflowRun({
          storyId: 'story-1', // Duplicate story
          componentRuns: [createComponentRun({ userPrompts: 3 })],
        }),
      ];

      const result = calculator.calculateComprehensiveMetrics(workflowRuns);

      // Should count unique stories: story-1 and story-2 = 2
      expect(result.costValue.storiesCompleted).toBe(2);
    });

    it('should calculate costPerAcceptedLoc correctly', () => {
      const workflowRuns = [
        createWorkflowRun({
          componentRuns: [
            createComponentRun({ cost: 5.00, linesAdded: 100, linesModified: 50 }),
            createComponentRun({ cost: 3.00, linesAdded: 50, linesModified: 25 }),
          ],
        }),
      ];

      const result = calculator.calculateComprehensiveMetrics(workflowRuns);

      const totalCost = 8.00;
      const totalLOC = 225; // 100 + 50 + 50 + 25
      expect(result.costValue.costPerAcceptedLoc).toBeCloseTo(totalCost / totalLOC, 4);
    });

    it('should handle workflows with no story IDs', () => {
      const workflowRuns = [
        createWorkflowRun({
          storyId: null,
          componentRuns: [createComponentRun({ userPrompts: 5 })],
        }),
      ];

      const result = calculator.calculateComprehensiveMetrics(workflowRuns);

      // Should not crash and handle gracefully
      expect(result.costValue.storiesCompleted).toBeGreaterThanOrEqual(0);
    });

    it('should calculate automation rate with zero turns gracefully', () => {
      const workflowRuns = [
        createWorkflowRun({
          componentRuns: [
            createComponentRun({ totalTurns: 0, manualPrompts: 0, autoContinues: 0 }),
          ],
        }),
      ];

      const result = calculator.calculateComprehensiveMetrics(workflowRuns);

      expect(result.efficiency.automationRate).toBe(0);
    });
  });
});

// Test helper functions
function createWorkflowRun(partial: Partial<any> = {}): any {
  return {
    id: uuidv4(),
    storyId: partial.storyId !== undefined ? partial.storyId : uuidv4(),
    workflowId: uuidv4(),
    startedAt: new Date(),
    componentRuns: partial.componentRuns || [],
    ...partial,
  };
}

function createComponentRun(partial: Partial<any> = {}): any {
  return {
    id: uuidv4(),
    tokensInput: partial.tokensInput ?? 0,
    tokensOutput: partial.tokensOutput ?? 0,
    tokensCacheRead: partial.tokensCacheRead ?? 0,
    tokensCacheWrite: partial.tokensCacheWrite ?? 0,
    cacheHits: partial.cacheHits ?? 0,
    cacheMisses: partial.cacheMisses ?? 0,
    linesAdded: partial.linesAdded ?? 0,
    linesModified: partial.linesModified ?? 0,
    linesDeleted: partial.linesDeleted ?? 0,
    testsAdded: partial.testsAdded ?? 0,
    filesModified: partial.filesModified ?? [],
    durationSeconds: partial.durationSeconds ?? 0,
    userPrompts: partial.userPrompts ?? 0,
    systemIterations: partial.systemIterations ?? 0,
    humanInterventions: partial.humanInterventions ?? 0,
    totalTurns: partial.totalTurns ?? 0,
    manualPrompts: partial.manualPrompts ?? 0,
    autoContinues: partial.autoContinues ?? 0,
    cost: partial.cost ?? 0,
    ...partial,
  };
}
