/**
 * Health score calculation utilities for Code Quality Dashboard
 * Pure functions for health metrics, colors, and icons
 */

import { IssueSeverity } from '../../types/codeQualityTypes';

/**
 * Get Tailwind CSS classes for health score color
 * @param score - Health score (0-100)
 * @returns Tailwind CSS class string
 */
export function getHealthColor(score: number): string {
  if (score >= 80) return 'text-green-600 bg-green-50 dark:bg-green-900/20';
  if (score >= 60) return 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20';
  return 'text-red-600 bg-red-50 dark:bg-red-900/20';
}

/**
 * Get icon for health score
 * @param score - Health score (0-100)
 * @returns Icon character
 */
export function getHealthIcon(score: number): string {
  if (score >= 80) return '✓';
  if (score >= 60) return '⚠️';
  return '🔴';
}

/**
 * Get Material Symbol icon name for health score
 * @param score - Health score (0-100)
 * @returns Material Symbol icon name
 */
export function getHealthMaterialIcon(score: number): string {
  if (score >= 80) return 'check_circle';
  if (score >= 60) return 'warning';
  return 'error';
}

/**
 * Get severity icon
 * @param severity - Issue severity level
 * @returns Icon character
 */
export function getSeverityIcon(severity: IssueSeverity | string): string {
  if (severity === 'critical') return '🔴';
  if (severity === 'high') return '⚠️';
  if (severity === 'medium') return '⚠️';
  return 'ℹ️';
}

/**
 * Get Tailwind CSS classes for severity
 * @param severity - Issue severity level
 * @returns Tailwind CSS class string
 */
export function getSeverityColor(severity: IssueSeverity | string): string {
  if (severity === 'critical') return 'text-red-700 bg-red-100 dark:bg-red-900/30';
  if (severity === 'high') return 'text-orange-700 bg-orange-100 dark:bg-orange-900/30';
  if (severity === 'medium') return 'text-yellow-700 bg-yellow-100 dark:bg-yellow-900/30';
  return 'text-blue-700 bg-blue-100 dark:bg-blue-900/30';
}

/**
 * Calculate trend direction from weekly change
 * @param weeklyChange - Percentage change over week
 * @returns Trend direction
 */
export function calculateTrend(weeklyChange: number): 'improving' | 'stable' | 'declining' {
  if (weeklyChange > 2) return 'improving';
  if (weeklyChange < -2) return 'declining';
  return 'stable';
}

/**
 * Get trend color classes
 * @param trend - Trend direction
 * @returns Tailwind CSS class string
 */
export function getTrendColor(trend: 'improving' | 'stable' | 'declining'): string {
  if (trend === 'improving') return 'text-green-600';
  if (trend === 'declining') return 'text-red-600';
  return 'text-gray-600';
}

/**
 * Get trend icon
 * @param trend - Trend direction
 * @returns Material Symbol icon name
 */
export function getTrendIcon(trend: 'improving' | 'stable' | 'declining'): string {
  if (trend === 'improving') return 'trending_up';
  if (trend === 'declining') return 'trending_down';
  return 'trending_flat';
}

/**
 * Format percentage with sign
 * @param value - Numeric percentage value
 * @returns Formatted string with + or - sign
 */
export function formatPercentageChange(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}
