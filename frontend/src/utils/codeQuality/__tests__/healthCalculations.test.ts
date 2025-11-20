/**
 * Tests for health calculation utilities
 */

import { describe, it, expect } from 'vitest';
import {
  getHealthColor,
  getHealthIcon,
  getHealthMaterialIcon,
  getSeverityIcon,
  getSeverityColor,
  calculateTrend,
  getTrendColor,
  getTrendIcon,
  formatPercentageChange,
} from '../healthCalculations';

describe('healthCalculations', () => {
  describe('getHealthColor', () => {
    it('should return green for scores >= 80', () => {
      expect(getHealthColor(80)).toContain('green');
      expect(getHealthColor(100)).toContain('green');
    });

    it('should return yellow for scores 60-79', () => {
      expect(getHealthColor(60)).toContain('yellow');
      expect(getHealthColor(79)).toContain('yellow');
    });

    it('should return red for scores < 60', () => {
      expect(getHealthColor(59)).toContain('red');
      expect(getHealthColor(0)).toContain('red');
    });
  });

  describe('getHealthIcon', () => {
    it('should return checkmark for high scores', () => {
      expect(getHealthIcon(80)).toBe('✓');
    });

    it('should return warning for medium scores', () => {
      expect(getHealthIcon(70)).toBe('⚠️');
    });

    it('should return error for low scores', () => {
      expect(getHealthIcon(50)).toBe('🔴');
    });
  });

  describe('getHealthMaterialIcon', () => {
    it('should return correct material icons', () => {
      expect(getHealthMaterialIcon(85)).toBe('check_circle');
      expect(getHealthMaterialIcon(65)).toBe('warning');
      expect(getHealthMaterialIcon(40)).toBe('error');
    });
  });

  describe('getSeverityIcon', () => {
    it('should return correct icons for each severity', () => {
      expect(getSeverityIcon('critical')).toBe('🔴');
      expect(getSeverityIcon('high')).toBe('⚠️');
      expect(getSeverityIcon('medium')).toBe('⚠️');
      expect(getSeverityIcon('low')).toBe('ℹ️');
    });
  });

  describe('getSeverityColor', () => {
    it('should return correct colors for each severity', () => {
      expect(getSeverityColor('critical')).toContain('red');
      expect(getSeverityColor('high')).toContain('orange');
      expect(getSeverityColor('medium')).toContain('yellow');
      expect(getSeverityColor('low')).toContain('blue');
    });
  });

  describe('calculateTrend', () => {
    it('should return improving for positive change > 2', () => {
      expect(calculateTrend(3)).toBe('improving');
      expect(calculateTrend(10)).toBe('improving');
    });

    it('should return declining for negative change < -2', () => {
      expect(calculateTrend(-3)).toBe('declining');
      expect(calculateTrend(-10)).toBe('declining');
    });

    it('should return stable for small changes', () => {
      expect(calculateTrend(0)).toBe('stable');
      expect(calculateTrend(1)).toBe('stable');
      expect(calculateTrend(-1)).toBe('stable');
    });
  });

  describe('getTrendColor', () => {
    it('should return correct colors for trends', () => {
      expect(getTrendColor('improving')).toContain('green');
      expect(getTrendColor('declining')).toContain('red');
      expect(getTrendColor('stable')).toContain('gray');
    });
  });

  describe('getTrendIcon', () => {
    it('should return correct icons for trends', () => {
      expect(getTrendIcon('improving')).toBe('trending_up');
      expect(getTrendIcon('declining')).toBe('trending_down');
      expect(getTrendIcon('stable')).toBe('trending_flat');
    });
  });

  describe('formatPercentageChange', () => {
    it('should format positive numbers with + sign', () => {
      expect(formatPercentageChange(5.67)).toBe('+5.7%');
    });

    it('should format negative numbers with - sign', () => {
      expect(formatPercentageChange(-3.45)).toBe('-3.5%');
    });

    it('should format zero correctly', () => {
      expect(formatPercentageChange(0)).toBe('0.0%');
    });
  });
});
