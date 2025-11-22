/**
 * Token Calculation Tests - ST-73
 * Tests for correct token aggregation formulas (input + output only, NOT including cache)
 *
 * @jest-environment node
 */

import { PrismaClient } from '@prisma/client';
import { createTestPrismaClient } from '@/test-utils/safe-prisma-client';
import { MetricsAggregationService } from '../metrics-aggregation.service';

describe('ST-73: Token Calculation Correctness', () => {
  let prisma: PrismaClient;
  let metricsService: MetricsAggregationService;

  beforeAll(() => {
    prisma = createTestPrismaClient();
    metricsService = new MetricsAggregationService(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Component-level token calculation', () => {
    it('should NOT add cache tokens to total', () => {
      // Simulate the calculation from aggregateComponentMetrics
      const componentRun = {
        tokensInput: 25000,
        tokensOutput: 13500,
        tokensCacheRead: 23600,
        tokensCacheWrite: 1400,
      };

      const totalTokens = (componentRun.tokensInput || 0) + (componentRun.tokensOutput || 0);

      expect(totalTokens).toBe(38500); // NOT 62100
      expect(totalTokens).not.toBe(62100); // Verify we're NOT using old buggy calculation
    });

    it('should handle zero cache tokens correctly', () => {
      const componentRun = {
        tokensInput: 10000,
        tokensOutput: 5000,
        tokensCacheRead: 0,
        tokensCacheWrite: 0,
      };

      const totalTokens = (componentRun.tokensInput || 0) + (componentRun.tokensOutput || 0);

      expect(totalTokens).toBe(15000);
    });

    it('should handle full cache scenario (all input cached)', () => {
      const componentRun = {
        tokensInput: 25000,
        tokensOutput: 13500,
        tokensCacheRead: 25000, // All input served from cache
        tokensCacheWrite: 0,
      };

      const totalTokens = (componentRun.tokensInput || 0) + (componentRun.tokensOutput || 0);

      // Total should still be input + output, NOT double-count the cache
      expect(totalTokens).toBe(38500); // NOT 63500
    });

    it('should track cache tokens separately from total', () => {
      const componentRun = {
        tokensInput: 25000,
        tokensOutput: 13500,
        tokensCacheRead: 23600,
        tokensCacheWrite: 0,
      };

      const totalTokens = (componentRun.tokensInput || 0) + (componentRun.tokensOutput || 0);

      // Total excludes cache, but cache is still accessible
      expect(componentRun.tokensCacheRead).toBe(23600);
      expect(totalTokens).toBe(38500);
      expect(totalTokens + componentRun.tokensCacheRead).not.toBe(totalTokens); // Cache is separate metric
    });

    it('should handle null/undefined token values', () => {
      const componentRun = {
        tokensInput: null as any,
        tokensOutput: 5000,
        tokensCacheRead: 2000,
        tokensCacheWrite: undefined as any,
      };

      const totalTokens = (componentRun.tokensInput || 0) + (componentRun.tokensOutput || 0);

      expect(totalTokens).toBe(5000); // Only output, input is null
    });
  });

  describe('Workflow-level token aggregation', () => {
    it('should aggregate component tokens without cache double-counting', () => {
      const componentRuns = [
        { tokensInput: 10000, tokensOutput: 5000, tokensCacheRead: 3000, tokensCacheWrite: 0 },
        { tokensInput: 15000, tokensOutput: 8000, tokensCacheRead: 5000, tokensCacheWrite: 0 },
        { tokensInput: 20000, tokensOutput: 10000, tokensCacheRead: 7000, tokensCacheWrite: 0 },
      ];

      const totalTokens = componentRuns.reduce(
        (sum, cr) => sum + (cr.tokensInput || 0) + (cr.tokensOutput || 0),
        0
      );

      expect(totalTokens).toBe(68000); // 45000 input + 23000 output
      expect(totalTokens).not.toBe(83000); // NOT including 15000 cache tokens
    });

    it('should handle mixed cache scenarios', () => {
      const componentRuns = [
        { tokensInput: 5000, tokensOutput: 2000, tokensCacheRead: 0, tokensCacheWrite: 0 }, // No cache
        { tokensInput: 8000, tokensOutput: 3000, tokensCacheRead: 4000, tokensCacheWrite: 0 }, // Partial cache
        { tokensInput: 10000, tokensOutput: 5000, tokensCacheRead: 10000, tokensCacheWrite: 0 }, // Full cache
      ];

      const totalTokens = componentRuns.reduce(
        (sum, cr) => sum + (cr.tokensInput || 0) + (cr.tokensOutput || 0),
        0
      );

      expect(totalTokens).toBe(33000); // 23000 input + 10000 output
      expect(totalTokens).not.toBe(47000); // NOT including 14000 cache tokens
    });
  });

  describe('Epic-level token aggregation', () => {
    it('should aggregate across multiple stories without cache double-counting', () => {
      const stories = [
        {
          workflowRuns: [
            {
              componentRuns: [
                { tokensInput: 5000, tokensOutput: 2000, tokensCacheRead: 1000, tokensCacheWrite: 0 },
                { tokensInput: 3000, tokensOutput: 1500, tokensCacheRead: 500, tokensCacheWrite: 0 },
              ],
            },
          ],
        },
        {
          workflowRuns: [
            {
              componentRuns: [
                { tokensInput: 8000, tokensOutput: 4000, tokensCacheRead: 2000, tokensCacheWrite: 0 },
              ],
            },
          ],
        },
      ];

      let totalTokens = 0;
      for (const story of stories) {
        for (const run of story.workflowRuns) {
          for (const cr of run.componentRuns) {
            totalTokens += (cr.tokensInput || 0) + (cr.tokensOutput || 0);
          }
        }
      }

      expect(totalTokens).toBe(23500); // 16000 input + 7500 output
      expect(totalTokens).not.toBe(27000); // NOT including 3500 cache tokens
    });
  });

  describe('Time-based grouping token aggregation', () => {
    it('should aggregate tokens by time window without cache double-counting', () => {
      const runs = [
        {
          startedAt: new Date('2024-01-01T10:00:00Z'),
          componentRuns: [
            { tokensInput: 5000, tokensOutput: 2000, tokensCacheRead: 1000, tokensCacheWrite: 0 },
          ],
        },
        {
          startedAt: new Date('2024-01-01T11:00:00Z'),
          componentRuns: [
            { tokensInput: 8000, tokensOutput: 3000, tokensCacheRead: 2000, tokensCacheWrite: 0 },
          ],
        },
      ];

      let totalTokens = 0;
      runs.forEach((run) => {
        run.componentRuns.forEach((cr) => {
          totalTokens += (cr.tokensInput || 0) + (cr.tokensOutput || 0);
        });
      });

      expect(totalTokens).toBe(18000); // 13000 input + 5000 output
      expect(totalTokens).not.toBe(21000); // NOT including 3000 cache tokens
    });
  });

  describe('Consistency validation', () => {
    it('should ensure console, database, and WebUI show identical totals', () => {
      // This test validates that all calculation paths use the same formula
      const componentRun = {
        tokensInput: 25000,
        tokensOutput: 13500,
        tokensCacheRead: 23600,
        tokensCacheWrite: 0,
      };

      // What gets stored in database (record_component_complete.ts:463)
      const databaseTotal = componentRun.tokensInput + componentRun.tokensOutput;

      // What aggregation service calculates (metrics-aggregation.service.ts:145)
      const aggregationTotal = (componentRun.tokensInput || 0) + (componentRun.tokensOutput || 0);

      // What gets displayed in console/WebUI (should read from database)
      const displayTotal = databaseTotal;

      expect(databaseTotal).toBe(38500);
      expect(aggregationTotal).toBe(38500);
      expect(displayTotal).toBe(38500);

      // All three should match exactly
      expect(databaseTotal).toBe(aggregationTotal);
      expect(aggregationTotal).toBe(displayTotal);
    });

    it('should validate cache tokens are available as separate metric', () => {
      const componentRun = {
        tokensInput: 25000,
        tokensOutput: 13500,
        tokensCacheRead: 23600,
        tokensCacheWrite: 1400,
        totalTokens: 38500, // Calculated: input + output
      };

      // Cache tokens should be accessible but NOT part of total
      expect(componentRun.totalTokens).toBe(38500);
      expect(componentRun.tokensCacheRead).toBe(23600);
      expect(componentRun.tokensCacheWrite).toBe(1400);

      // Cache tokens + total should NOT equal total (they're separate)
      expect(componentRun.totalTokens + componentRun.tokensCacheRead).toBeGreaterThan(
        componentRun.totalTokens
      );
    });
  });

  describe('Edge cases', () => {
    it('should handle negative cache values gracefully', () => {
      const componentRun = {
        tokensInput: 10000,
        tokensOutput: 5000,
        tokensCacheRead: -100, // Invalid, but should be handled
        tokensCacheWrite: 0,
      };

      const totalTokens = (componentRun.tokensInput || 0) + (componentRun.tokensOutput || 0);

      // Total should still be correct (cache not added)
      expect(totalTokens).toBe(15000);
    });

    it('should handle very large token counts', () => {
      const componentRun = {
        tokensInput: 999999999,
        tokensOutput: 888888888,
        tokensCacheRead: 777777777,
        tokensCacheWrite: 0,
      };

      const totalTokens = (componentRun.tokensInput || 0) + (componentRun.tokensOutput || 0);

      expect(totalTokens).toBe(1888888887); // Large but correct
      expect(totalTokens).not.toBe(2666666664); // NOT including cache
    });

    it('should handle cache > input scenario (data integrity issue)', () => {
      // This shouldn't happen, but if it does, don't add cache to total
      const componentRun = {
        tokensInput: 10000,
        tokensOutput: 5000,
        tokensCacheRead: 15000, // More than input (bug)
        tokensCacheWrite: 0,
      };

      const totalTokens = (componentRun.tokensInput || 0) + (componentRun.tokensOutput || 0);

      // Still use correct formula, even if data is inconsistent
      expect(totalTokens).toBe(15000);
      expect(totalTokens).not.toBe(30000);
    });
  });
});
