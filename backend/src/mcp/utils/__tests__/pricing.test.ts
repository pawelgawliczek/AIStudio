/**
 * ST-242: Pricing Utility Tests
 * TDD Approach: Tests written BEFORE implementation fixes
 *
 * Tests for centralized multi-model pricing calculation utility
 * Validates model family extraction, cost calculation, and cache token pricing
 */

import {
  getModelFamily,
  getModelPricing,
  calculateCost,
  calculateCostWithBreakdown,
  formatCost,
  CLAUDE_PRICING,
  ModelPricing,
  CostCalculationParams,
} from '../pricing';

describe('pricing utility', () => {
  describe('CLAUDE_PRICING', () => {
    it('should export pricing object with all model families', () => {
      expect(CLAUDE_PRICING).toBeDefined();
      expect(CLAUDE_PRICING).toHaveProperty('claude-opus-4-5');
      expect(CLAUDE_PRICING).toHaveProperty('claude-sonnet-4');
      expect(CLAUDE_PRICING).toHaveProperty('claude-sonnet-4-5');
      expect(CLAUDE_PRICING).toHaveProperty('claude-haiku-3-5');
      expect(CLAUDE_PRICING).toHaveProperty('claude-haiku-4-5');
      expect(CLAUDE_PRICING).toHaveProperty('default');
    });

    it('should have correct pricing structure for each model', () => {
      const pricing = CLAUDE_PRICING['claude-sonnet-4'];
      expect(pricing).toHaveProperty('input');
      expect(pricing).toHaveProperty('output');
      expect(pricing).toHaveProperty('cacheWrite');
      expect(pricing).toHaveProperty('cacheRead');
      expect(typeof pricing.input).toBe('number');
      expect(typeof pricing.output).toBe('number');
    });

    it('should have cache pricing as 1.25x input for write', () => {
      const pricing = CLAUDE_PRICING['claude-sonnet-4'];
      expect(pricing.cacheWrite).toBe(pricing.input * 1.25);
    });

    it('should have cache pricing as 0.1x input for read', () => {
      const pricing = CLAUDE_PRICING['claude-sonnet-4'];
      expect(pricing.cacheRead).toBeCloseTo(pricing.input * 0.1);
    });
  });

  describe('getModelFamily', () => {
    describe('new naming convention (claude-{tier}-{version}-{date})', () => {
      it('should extract claude-sonnet-4-5 from full model ID', () => {
        expect(getModelFamily('claude-sonnet-4-5-20250929')).toBe('claude-sonnet-4-5');
      });

      it('should extract claude-opus-4-5 from full model ID', () => {
        expect(getModelFamily('claude-opus-4-5-20251101')).toBe('claude-opus-4-5');
      });

      it('should extract claude-sonnet-4 from full model ID', () => {
        expect(getModelFamily('claude-sonnet-4-20250514')).toBe('claude-sonnet-4');
      });

      it('should extract claude-haiku-4-5 from full model ID', () => {
        expect(getModelFamily('claude-haiku-4-5-20250101')).toBe('claude-haiku-4-5');
      });
    });

    describe('legacy naming convention (claude-{major}-{minor}-{tier}-{date})', () => {
      it('should extract claude-haiku-3-5 from legacy format', () => {
        expect(getModelFamily('claude-3-5-haiku-20241022')).toBe('claude-haiku-3-5');
      });

      it('should extract claude-sonnet-3-5 from legacy format', () => {
        expect(getModelFamily('claude-3-5-sonnet-20241022')).toBe('claude-sonnet-3-5');
      });

      it('should extract claude-opus-3 from legacy format', () => {
        expect(getModelFamily('claude-3-opus-20240229')).toBe('claude-opus-3');
      });
    });

    describe('edge cases', () => {
      it('should return default for null', () => {
        expect(getModelFamily(null)).toBe('default');
      });

      it('should return default for undefined', () => {
        expect(getModelFamily(undefined)).toBe('default');
      });

      it('should return default for empty string', () => {
        expect(getModelFamily('')).toBe('default');
      });

      it('should return default for unknown model format', () => {
        expect(getModelFamily('gpt-4-turbo')).toBe('default');
      });

      it('should return default for malformed model ID', () => {
        expect(getModelFamily('claude-invalid-format')).toBe('default');
      });
    });
  });

  describe('getModelPricing', () => {
    it('should return correct pricing for claude-sonnet-4-5', () => {
      const pricing = getModelPricing('claude-sonnet-4-5-20250929');
      expect(pricing).toEqual(CLAUDE_PRICING['claude-sonnet-4-5']);
      expect(pricing.input).toBe(3.0);
      expect(pricing.output).toBe(15.0);
    });

    it('should return correct pricing for claude-opus-4-5', () => {
      const pricing = getModelPricing('claude-opus-4-5-20251101');
      expect(pricing).toEqual(CLAUDE_PRICING['claude-opus-4-5']);
      expect(pricing.input).toBe(5.0);
      expect(pricing.output).toBe(25.0);
    });

    it('should return correct pricing for claude-haiku-3-5', () => {
      const pricing = getModelPricing('claude-3-5-haiku-20241022');
      expect(pricing).toEqual(CLAUDE_PRICING['claude-haiku-3-5']);
      expect(pricing.input).toBe(0.8);
      expect(pricing.output).toBe(4.0);
    });

    it('should return default pricing for null', () => {
      const pricing = getModelPricing(null);
      expect(pricing).toEqual(CLAUDE_PRICING['default']);
    });

    it('should return default pricing for unknown model', () => {
      const pricing = getModelPricing('unknown-model-id');
      expect(pricing).toEqual(CLAUDE_PRICING['default']);
    });
  });

  describe('calculateCost', () => {
    describe('basic token cost calculation', () => {
      it('should calculate cost for input tokens only', () => {
        const params: CostCalculationParams = {
          tokensInput: 1_000_000,
          tokensOutput: 0,
          modelId: 'claude-sonnet-4-20250514',
        };
        const cost = calculateCost(params);
        // 1M tokens * $3.00 per million = $3.00
        expect(cost).toBe(3.0);
      });

      it('should calculate cost for output tokens only', () => {
        const params: CostCalculationParams = {
          tokensInput: 0,
          tokensOutput: 1_000_000,
          modelId: 'claude-sonnet-4-20250514',
        };
        const cost = calculateCost(params);
        // 1M tokens * $15.00 per million = $15.00
        expect(cost).toBe(15.0);
      });

      it('should calculate cost for input + output tokens', () => {
        const params: CostCalculationParams = {
          tokensInput: 500_000,
          tokensOutput: 100_000,
          modelId: 'claude-sonnet-4-20250514',
        };
        const cost = calculateCost(params);
        // Input: 500K * $3.00/M = $1.50
        // Output: 100K * $15.00/M = $1.50
        // Total: $3.00
        expect(cost).toBe(3.0);
      });
    });

    describe('cache token cost calculation', () => {
      it('should calculate cost for cache creation tokens', () => {
        const params: CostCalculationParams = {
          tokensInput: 0,
          tokensOutput: 0,
          tokensCacheCreation: 1_000_000,
          modelId: 'claude-sonnet-4-20250514',
        };
        const cost = calculateCost(params);
        // 1M tokens * $3.75 per million (1.25x input) = $3.75
        expect(cost).toBe(3.75);
      });

      it('should calculate cost for cache read tokens', () => {
        const params: CostCalculationParams = {
          tokensInput: 0,
          tokensOutput: 0,
          tokensCacheRead: 1_000_000,
          modelId: 'claude-sonnet-4-20250514',
        };
        const cost = calculateCost(params);
        // 1M tokens * $0.30 per million (0.1x input) = $0.30
        expect(cost).toBe(0.3);
      });

      it('should calculate cost for all token types combined', () => {
        const params: CostCalculationParams = {
          tokensInput: 100_000,
          tokensOutput: 50_000,
          tokensCacheCreation: 200_000,
          tokensCacheRead: 500_000,
          modelId: 'claude-sonnet-4-20250514',
        };
        const cost = calculateCost(params);
        // Input: 100K * $3.00/M = $0.30
        // Output: 50K * $15.00/M = $0.75
        // Cache write: 200K * $3.75/M = $0.75
        // Cache read: 500K * $0.30/M = $0.15
        // Total: $1.95
        expect(cost).toBe(1.95);
      });
    });

    describe('different model pricing', () => {
      it('should use correct pricing for claude-opus-4-5', () => {
        const params: CostCalculationParams = {
          tokensInput: 1_000_000,
          tokensOutput: 0,
          modelId: 'claude-opus-4-5-20251101',
        };
        const cost = calculateCost(params);
        // 1M tokens * $5.00 per million = $5.00
        expect(cost).toBe(5.0);
      });

      it('should use correct pricing for claude-haiku-3-5', () => {
        const params: CostCalculationParams = {
          tokensInput: 1_000_000,
          tokensOutput: 0,
          modelId: 'claude-3-5-haiku-20241022',
        };
        const cost = calculateCost(params);
        // 1M tokens * $0.80 per million = $0.80
        expect(cost).toBe(0.8);
      });
    });

    describe('edge cases', () => {
      it('should handle null token values', () => {
        const params: CostCalculationParams = {
          tokensInput: null,
          tokensOutput: null,
          tokensCacheCreation: null,
          tokensCacheRead: null,
          modelId: 'claude-sonnet-4-20250514',
        };
        const cost = calculateCost(params);
        expect(cost).toBe(0);
      });

      it('should handle undefined token values', () => {
        const params: CostCalculationParams = {
          modelId: 'claude-sonnet-4-20250514',
        };
        const cost = calculateCost(params);
        expect(cost).toBe(0);
      });

      it('should handle zero tokens', () => {
        const params: CostCalculationParams = {
          tokensInput: 0,
          tokensOutput: 0,
          tokensCacheCreation: 0,
          tokensCacheRead: 0,
          modelId: 'claude-sonnet-4-20250514',
        };
        const cost = calculateCost(params);
        expect(cost).toBe(0);
      });

      it('should use default pricing for null modelId', () => {
        const params: CostCalculationParams = {
          tokensInput: 1_000_000,
          tokensOutput: 0,
          modelId: null,
        };
        const cost = calculateCost(params);
        // Should use default pricing (claude-sonnet-4)
        expect(cost).toBe(3.0);
      });

      it('should use default pricing for unknown modelId', () => {
        const params: CostCalculationParams = {
          tokensInput: 1_000_000,
          tokensOutput: 0,
          modelId: 'gpt-4-turbo',
        };
        const cost = calculateCost(params);
        // Should use default pricing (claude-sonnet-4)
        expect(cost).toBe(3.0);
      });
    });

    describe('realistic workflow scenarios', () => {
      it('should calculate cost for typical component run', () => {
        // Typical component: 10K input, 2K output, 5K cache read
        const params: CostCalculationParams = {
          tokensInput: 10_000,
          tokensOutput: 2_000,
          tokensCacheRead: 5_000,
          modelId: 'claude-sonnet-4-20250514',
        };
        const cost = calculateCost(params);
        // Input: 10K * $3.00/M = $0.03
        // Output: 2K * $15.00/M = $0.03
        // Cache read: 5K * $0.30/M = $0.0015
        // Total: $0.0615
        expect(cost).toBeCloseTo(0.0615, 4);
      });

      it('should calculate cost for large exploration agent', () => {
        // Explorer: 50K input, 8K output, 100K cache creation
        const params: CostCalculationParams = {
          tokensInput: 50_000,
          tokensOutput: 8_000,
          tokensCacheCreation: 100_000,
          modelId: 'claude-sonnet-4-20250514',
        };
        const cost = calculateCost(params);
        // Input: 50K * $3.00/M = $0.15
        // Output: 8K * $15.00/M = $0.12
        // Cache write: 100K * $3.75/M = $0.375
        // Total: $0.645
        expect(cost).toBeCloseTo(0.645, 4);
      });
    });
  });

  describe('calculateCostWithBreakdown', () => {
    it('should return detailed cost breakdown', () => {
      const params: CostCalculationParams = {
        tokensInput: 100_000,
        tokensOutput: 50_000,
        tokensCacheCreation: 20_000,
        tokensCacheRead: 80_000,
        modelId: 'claude-sonnet-4-20250514',
      };
      const breakdown = calculateCostWithBreakdown(params);

      expect(breakdown).toHaveProperty('inputCost');
      expect(breakdown).toHaveProperty('outputCost');
      expect(breakdown).toHaveProperty('cacheWriteCost');
      expect(breakdown).toHaveProperty('cacheReadCost');
      expect(breakdown).toHaveProperty('totalCost');
      expect(breakdown).toHaveProperty('modelFamily');
      expect(breakdown).toHaveProperty('pricing');
    });

    it('should calculate correct breakdown values', () => {
      const params: CostCalculationParams = {
        tokensInput: 100_000,
        tokensOutput: 50_000,
        tokensCacheCreation: 20_000,
        tokensCacheRead: 80_000,
        modelId: 'claude-sonnet-4-20250514',
      };
      const breakdown = calculateCostWithBreakdown(params);

      // Input: 100K * $3.00/M = $0.30
      expect(breakdown.inputCost).toBe(0.3);
      // Output: 50K * $15.00/M = $0.75
      expect(breakdown.outputCost).toBe(0.75);
      // Cache write: 20K * $3.75/M = $0.075
      expect(breakdown.cacheWriteCost).toBe(0.075);
      // Cache read: 80K * $0.30/M = $0.024
      expect(breakdown.cacheReadCost).toBe(0.024);
      // Total
      expect(breakdown.totalCost).toBeCloseTo(1.149, 4);
    });

    it('should include model family in breakdown', () => {
      const params: CostCalculationParams = {
        tokensInput: 1000,
        modelId: 'claude-opus-4-5-20251101',
      };
      const breakdown = calculateCostWithBreakdown(params);

      expect(breakdown.modelFamily).toBe('claude-opus-4-5');
    });

    it('should include pricing details in breakdown', () => {
      const params: CostCalculationParams = {
        tokensInput: 1000,
        modelId: 'claude-sonnet-4-20250514',
      };
      const breakdown = calculateCostWithBreakdown(params);

      expect(breakdown.pricing).toEqual(CLAUDE_PRICING['claude-sonnet-4']);
      expect(breakdown.pricing.input).toBe(3.0);
      expect(breakdown.pricing.output).toBe(15.0);
    });

    it('should match calculateCost total', () => {
      const params: CostCalculationParams = {
        tokensInput: 75_000,
        tokensOutput: 25_000,
        tokensCacheRead: 10_000,
        modelId: 'claude-haiku-3-5-20241022',
      };
      const cost = calculateCost(params);
      const breakdown = calculateCostWithBreakdown(params);

      expect(breakdown.totalCost).toBe(cost);
    });
  });

  describe('formatCost', () => {
    it('should format zero cost', () => {
      expect(formatCost(0)).toBe('$0.00');
    });

    it('should format small cost with 4 decimals by default', () => {
      expect(formatCost(0.0123)).toBe('$0.0123');
    });

    it('should format large cost', () => {
      expect(formatCost(12.3456)).toBe('$12.3456');
    });

    it('should format very small cost in exponential notation', () => {
      const formatted = formatCost(0.00001);
      expect(formatted).toContain('e');
      expect(formatted).toMatch(/\$\d\.\d{2}e-\d+/);
    });

    it('should respect custom precision', () => {
      expect(formatCost(1.23456789, 2)).toBe('$1.23');
      expect(formatCost(1.23456789, 6)).toBe('$1.234568');
    });

    it('should handle typical workflow costs', () => {
      // Typical component run: ~$0.05
      expect(formatCost(0.0515)).toBe('$0.0515');
      // Full workflow: ~$2.50
      expect(formatCost(2.4827)).toBe('$2.4827');
    });
  });

  describe('integration: cost calculation pipeline', () => {
    it('should calculate realistic workflow run cost', () => {
      // Simulate a workflow with 3 components
      const component1: CostCalculationParams = {
        tokensInput: 15_000,
        tokensOutput: 3_000,
        tokensCacheCreation: 50_000,
        modelId: 'claude-sonnet-4-20250514',
      };
      const component2: CostCalculationParams = {
        tokensInput: 20_000,
        tokensOutput: 5_000,
        tokensCacheRead: 40_000,
        modelId: 'claude-sonnet-4-20250514',
      };
      const component3: CostCalculationParams = {
        tokensInput: 30_000,
        tokensOutput: 8_000,
        tokensCacheRead: 60_000,
        modelId: 'claude-sonnet-4-20250514',
      };

      const cost1 = calculateCost(component1);
      const cost2 = calculateCost(component2);
      const cost3 = calculateCost(component3);
      const totalCost = cost1 + cost2 + cost3;

      expect(totalCost).toBeGreaterThan(0);
      expect(totalCost).toBeLessThan(1.0); // Reasonable for small workflow
    });

    it('should provide breakdown for debugging', () => {
      const params: CostCalculationParams = {
        tokensInput: 25_000,
        tokensOutput: 5_000,
        tokensCacheCreation: 10_000,
        tokensCacheRead: 15_000,
        modelId: 'claude-sonnet-4-20250514',
      };

      const breakdown = calculateCostWithBreakdown(params);
      const cost = calculateCost(params);

      // Verify breakdown sums correctly
      const sum =
        breakdown.inputCost +
        breakdown.outputCost +
        breakdown.cacheWriteCost +
        breakdown.cacheReadCost;

      expect(sum).toBeCloseTo(cost, 10);
      expect(breakdown.totalCost).toBeCloseTo(cost, 10);
    });
  });
});
