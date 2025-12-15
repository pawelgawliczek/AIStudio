/**
 * ST-239: TDD Tests for metrics.utils.ts
 * Pure utility functions for date range calculation, complexity filtering, and trend analysis
 */

describe('MetricsUtils - Pure Utility Functions', () => {
  describe('calculateDateRange', () => {
    it('should calculate last 7 days for LAST_7_DAYS', () => {
      const result = calculateDateRange('LAST_7_DAYS');
      const daysDiff = Math.floor((result.endDate.getTime() - result.startDate.getTime()) / (1000 * 60 * 60 * 24));

      expect(daysDiff).toBe(7);
      expect(result.endDate).toBeInstanceOf(Date);
      expect(result.startDate).toBeInstanceOf(Date);
      expect(result.startDate < result.endDate).toBe(true);
    });

    it('should calculate last 30 days for LAST_30_DAYS', () => {
      const result = calculateDateRange('LAST_30_DAYS');
      const daysDiff = Math.floor((result.endDate.getTime() - result.startDate.getTime()) / (1000 * 60 * 60 * 24));

      expect(daysDiff).toBeGreaterThanOrEqual(29);
      expect(daysDiff).toBeLessThanOrEqual(31);
    });

    it('should calculate last 90 days for LAST_90_DAYS', () => {
      const result = calculateDateRange('LAST_90_DAYS');
      const daysDiff = Math.floor((result.endDate.getTime() - result.startDate.getTime()) / (1000 * 60 * 60 * 24));

      expect(daysDiff).toBeGreaterThanOrEqual(89);
      expect(daysDiff).toBeLessThanOrEqual(91);
    });

    it('should calculate last 6 months for LAST_6_MONTHS', () => {
      const result = calculateDateRange('LAST_6_MONTHS');
      const monthsDiff =
        (result.endDate.getFullYear() - result.startDate.getFullYear()) * 12 +
        (result.endDate.getMonth() - result.startDate.getMonth());

      expect(monthsDiff).toBe(6);
    });

    it('should handle CUSTOM range with provided dates', () => {
      const customStart = '2024-01-01';
      const customEnd = '2024-12-31';

      const result = calculateDateRange('CUSTOM', customStart, customEnd);

      expect(result.startDate.toISOString().startsWith('2024-01-01')).toBe(true);
      expect(result.endDate.toISOString().startsWith('2024-12-31')).toBe(true);
    });

    it('should default to ALL_TIME for invalid range', () => {
      const result = calculateDateRange('ALL_TIME');

      expect(result.startDate.getFullYear()).toBe(2020);
      expect(result.startDate.getMonth()).toBe(0);
      expect(result.startDate.getDate()).toBe(1);
    });

    it('should handle CUSTOM range without dates by falling back', () => {
      const result = calculateDateRange('CUSTOM');

      // Should not crash and return valid dates
      expect(result.startDate).toBeInstanceOf(Date);
      expect(result.endDate).toBeInstanceOf(Date);
    });
  });

  describe('calculateWorkflowDateRange', () => {
    it('should calculate week range for "week"', () => {
      const result = calculateWorkflowDateRange('week');
      const daysDiff = Math.floor((result.endDate.getTime() - result.startDate.getTime()) / (1000 * 60 * 60 * 24));

      expect(daysDiff).toBe(7);
    });

    it('should calculate month range for "month"', () => {
      const result = calculateWorkflowDateRange('month');
      const monthsDiff =
        (result.endDate.getFullYear() - result.startDate.getFullYear()) * 12 +
        (result.endDate.getMonth() - result.startDate.getMonth());

      expect(monthsDiff).toBe(1);
    });

    it('should calculate quarter range for "quarter"', () => {
      const result = calculateWorkflowDateRange('quarter');
      const monthsDiff =
        (result.endDate.getFullYear() - result.startDate.getFullYear()) * 12 +
        (result.endDate.getMonth() - result.startDate.getMonth());

      expect(monthsDiff).toBe(3);
    });

    it('should handle custom range with provided dates', () => {
      const result = calculateWorkflowDateRange('custom', '2024-06-01', '2024-06-30');

      expect(result.startDate.toISOString().startsWith('2024-06-01')).toBe(true);
      expect(result.endDate.toISOString().startsWith('2024-06-30')).toBe(true);
    });

    it('should default to month for unknown range', () => {
      const result = calculateWorkflowDateRange('unknown');
      const monthsDiff =
        (result.endDate.getFullYear() - result.startDate.getFullYear()) * 12 +
        (result.endDate.getMonth() - result.startDate.getMonth());

      expect(monthsDiff).toBe(1);
    });
  });

  describe('getComplexityFilter', () => {
    it('should return [1, 2] for LOW complexity', () => {
      const result = getComplexityFilter('LOW');

      expect(result).toEqual([1, 2]);
    });

    it('should return [3] for MEDIUM complexity', () => {
      const result = getComplexityFilter('MEDIUM');

      expect(result).toEqual([3]);
    });

    it('should return [4, 5] for HIGH complexity', () => {
      const result = getComplexityFilter('HIGH');

      expect(result).toEqual([4, 5]);
    });

    it('should return null for ALL complexity (no filter)', () => {
      const result = getComplexityFilter('ALL');

      expect(result).toBeNull();
    });

    it('should handle lowercase input', () => {
      const result = getComplexityFilter('low');

      expect(result).toEqual([1, 2]);
    });
  });

  describe('determineTrend', () => {
    it('should detect improving trend when values decrease by >5%', () => {
      const values = [100, 95, 90, 85, 80];

      const result = determineTrend(values);

      expect(result.trend).toBe('improving');
      expect(result.changePercent).toBeCloseTo(-20, 1);
    });

    it('should detect declining trend when values increase by >5%', () => {
      const values = [100, 105, 110, 115, 120];

      const result = determineTrend(values);

      expect(result.trend).toBe('declining');
      expect(result.changePercent).toBeCloseTo(20, 1);
    });

    it('should detect stable trend when change is <=5%', () => {
      const values = [100, 101, 102, 103, 104];

      const result = determineTrend(values);

      expect(result.trend).toBe('stable');
      expect(result.changePercent).toBeCloseTo(4, 1);
    });

    it('should handle single value as stable', () => {
      const values = [100];

      const result = determineTrend(values);

      expect(result.trend).toBe('stable');
      expect(result.changePercent).toBe(0);
    });

    it('should handle empty array as stable', () => {
      const values: number[] = [];

      const result = determineTrend(values);

      expect(result.trend).toBe('stable');
      expect(result.changePercent).toBe(0);
    });

    it('should handle zero as first value (division by zero)', () => {
      const values = [0, 10, 20];

      const result = determineTrend(values);

      expect(result.trend).toBe('stable');
      expect(result.changePercent).toBe(0);
    });

    it('should detect improvement when cost/tokens decrease (lower is better)', () => {
      const tokenCosts = [1000, 950, 900, 850, 800];

      const result = determineTrend(tokenCosts);

      expect(result.trend).toBe('improving');
      expect(result.changePercent).toBeLessThan(-5);
    });

    it('should detect exact 5% boundary as stable (not improving)', () => {
      const values = [100, 95];

      const result = determineTrend(values);

      expect(result.trend).toBe('stable');
      expect(result.changePercent).toBe(-5);
    });

    it('should detect exact -5% boundary as stable (not declining)', () => {
      const values = [100, 105];

      const result = determineTrend(values);

      expect(result.trend).toBe('stable');
      expect(result.changePercent).toBe(5);
    });
  });

  describe('calculatePercentDiff', () => {
    it('should calculate positive percentage difference', () => {
      const result = calculatePercentDiff(120, 100);

      expect(result).toBe(20);
    });

    it('should calculate negative percentage difference', () => {
      const result = calculatePercentDiff(80, 100);

      expect(result).toBe(-20);
    });

    it('should return 0 when values are equal', () => {
      const result = calculatePercentDiff(100, 100);

      expect(result).toBe(0);
    });

    it('should handle zero as second value (division by zero)', () => {
      const result = calculatePercentDiff(100, 0);

      expect(result).toBe(0);
    });

    it('should calculate percentage with decimal precision', () => {
      const result = calculatePercentDiff(105, 100);

      expect(result).toBe(5);
    });

    it('should handle negative numbers', () => {
      const result = calculatePercentDiff(-50, -100);

      expect(result).toBe(50);
    });

    it('should handle large percentage differences', () => {
      const result = calculatePercentDiff(1000, 100);

      expect(result).toBe(900);
    });
  });

  describe('determineConfidenceLevel', () => {
    it('should return "high" for sample size >= 20', () => {
      const result = determineConfidenceLevel(20);
      expect(result).toBe('high');

      const result2 = determineConfidenceLevel(50);
      expect(result2).toBe('high');
    });

    it('should return "medium" for sample size between 5 and 19', () => {
      const result = determineConfidenceLevel(5);
      expect(result).toBe('medium');

      const result2 = determineConfidenceLevel(19);
      expect(result2).toBe('medium');
    });

    it('should return "low" for sample size < 5', () => {
      const result = determineConfidenceLevel(4);
      expect(result).toBe('low');

      const result2 = determineConfidenceLevel(1);
      expect(result2).toBe('low');
    });

    it('should handle zero sample size as low confidence', () => {
      const result = determineConfidenceLevel(0);

      expect(result).toBe('low');
    });
  });
});

// Type imports (these will be defined in implementation)
type DateRange = 'LAST_7_DAYS' | 'LAST_30_DAYS' | 'LAST_90_DAYS' | 'LAST_6_MONTHS' | 'CUSTOM' | 'ALL_TIME';
type ComplexityBand = 'LOW' | 'MEDIUM' | 'HIGH' | 'ALL';

// Function signatures (to be implemented)
declare function calculateDateRange(
  dateRange: DateRange | string,
  customStart?: string,
  customEnd?: string,
): { startDate: Date; endDate: Date };

declare function calculateWorkflowDateRange(
  range: string,
  customStart?: string,
  customEnd?: string,
): { startDate: Date; endDate: Date };

declare function getComplexityFilter(band: ComplexityBand | string): number[] | null;

declare function determineTrend(values: number[]): {
  trend: 'improving' | 'stable' | 'declining';
  changePercent: number;
};

declare function calculatePercentDiff(value1: number, value2: number): number;

declare function determineConfidenceLevel(sampleSize: number): 'high' | 'medium' | 'low';
