/**
 * Tests for coverage helper utilities
 */

import { describe, it, expect } from 'vitest';
import {
  calculateCoveragePriority,
  getCoverageGapReason,
  nodeToCoverageGap,
  sortByPriority,
  filterByMinPriority,
  getCoverageColor,
  formatCoverage,
} from '../coverageHelpers';

describe('coverageHelpers', () => {
  describe('calculateCoveragePriority', () => {
    it('should calculate priority correctly', () => {
      const result = calculateCoveragePriority(10, 100, 50);
      expect(result).toBeGreaterThan(0);
    });

    it('should return 0 for 100% coverage', () => {
      const result = calculateCoveragePriority(10, 100, 100);
      expect(result).toBe(0);
    });
  });

  describe('getCoverageGapReason', () => {
    it('should return correct reason for no coverage', () => {
      expect(getCoverageGapReason(10, 0, 100)).toBe('No test coverage');
    });

    it('should return correct reason for high complexity', () => {
      expect(getCoverageGapReason(25, 50, 100)).toBe('High complexity, needs more tests');
    });

    it('should return correct reason for low coverage', () => {
      expect(getCoverageGapReason(10, 40, 100)).toBe('Low coverage, critical gaps');
    });

    it('should return correct reason for large file', () => {
      expect(getCoverageGapReason(10, 70, 600)).toBe('Large file, incomplete coverage');
    });
  });

  describe('sortByPriority', () => {
    it('should sort gaps by priority descending', () => {
      const gaps = [
        { priority: 10 } as any,
        { priority: 30 } as any,
        { priority: 20 } as any,
      ];
      const result = sortByPriority(gaps);
      expect(result[0].priority).toBe(30);
      expect(result[2].priority).toBe(10);
    });
  });

  describe('filterByMinPriority', () => {
    it('should filter gaps by minimum priority', () => {
      const gaps = [
        { priority: 10 } as any,
        { priority: 30 } as any,
        { priority: 20 } as any,
      ];
      const result = filterByMinPriority(gaps, 15);
      expect(result).toHaveLength(2);
    });
  });

  describe('getCoverageColor', () => {
    it('should return green for high coverage', () => {
      expect(getCoverageColor(85)).toContain('green');
    });

    it('should return yellow for medium coverage', () => {
      expect(getCoverageColor(70)).toContain('yellow');
    });

    it('should return orange for low coverage', () => {
      expect(getCoverageColor(30)).toContain('orange');
    });

    it('should return red for zero coverage', () => {
      expect(getCoverageColor(0)).toContain('red');
    });
  });

  describe('formatCoverage', () => {
    it('should format coverage with % symbol', () => {
      expect(formatCoverage(75.5)).toBe('75.5%');
    });
  });
});
