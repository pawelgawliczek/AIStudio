/**
 * Coverage gap calculation utilities for Code Quality Dashboard
 * Pure functions for analyzing test coverage priorities
 */

import { CoverageGap, FolderNode } from '../../types/codeQualityTypes';

/**
 * Calculate priority score for test coverage
 * Higher priority = more important to add tests
 * Formula: (complexity × LOC × (100 - coverage)) / 10000
 *
 * @param complexity - File complexity score
 * @param loc - Lines of code
 * @param coverage - Current coverage percentage (0-100)
 * @returns Priority score
 */
export function calculateCoveragePriority(
  complexity: number,
  loc: number,
  coverage: number
): number {
  return (complexity * loc * (100 - coverage)) / 10000;
}

/**
 * Determine reason for coverage gap
 * @param complexity - File complexity
 * @param coverage - Current coverage percentage
 * @param loc - Lines of code
 * @returns Human-readable reason
 */
export function getCoverageGapReason(
  complexity: number,
  coverage: number,
  loc: number
): string {
  if (coverage === 0) {
    return 'No test coverage';
  }
  if (complexity > 20) {
    return 'High complexity, needs more tests';
  }
  if (coverage < 50) {
    return 'Low coverage, critical gaps';
  }
  if (loc > 500) {
    return 'Large file, incomplete coverage';
  }
  return 'Coverage gaps detected';
}

/**
 * Convert folder node to coverage gap
 * @param node - File node from folder hierarchy
 * @returns Coverage gap object
 */
export function nodeToCoverageGap(node: FolderNode): CoverageGap {
  const priority = calculateCoveragePriority(
    node.metrics.avgComplexity,
    node.metrics.totalLoc,
    node.metrics.avgCoverage
  );

  return {
    filePath: node.path,
    loc: node.metrics.totalLoc,
    complexity: node.metrics.avgComplexity,
    riskScore: node.metrics.avgRiskScore,
    coverage: node.metrics.avgCoverage,
    priority,
    reason: getCoverageGapReason(
      node.metrics.avgComplexity,
      node.metrics.avgCoverage,
      node.metrics.totalLoc
    ),
  };
}

/**
 * Sort coverage gaps by priority (high to low)
 * @param gaps - Array of coverage gaps
 * @returns Sorted array
 */
export function sortByPriority(gaps: CoverageGap[]): CoverageGap[] {
  return [...gaps].sort((a, b) => b.priority - a.priority);
}

/**
 * Filter coverage gaps by minimum priority
 * @param gaps - Array of coverage gaps
 * @param minPriority - Minimum priority threshold
 * @returns Filtered array
 */
export function filterByMinPriority(
  gaps: CoverageGap[],
  minPriority: number
): CoverageGap[] {
  return gaps.filter(gap => gap.priority >= minPriority);
}

/**
 * Get coverage percentage color class
 * @param coverage - Coverage percentage (0-100)
 * @returns Tailwind CSS class string
 */
export function getCoverageColor(coverage: number): string {
  if (coverage >= 80) return 'text-green-600 bg-green-50';
  if (coverage >= 60) return 'text-yellow-600 bg-yellow-50';
  if (coverage > 0) return 'text-orange-600 bg-orange-50';
  return 'text-red-600 bg-red-50';
}

/**
 * Format coverage percentage for display
 * @param coverage - Coverage percentage (0-100)
 * @returns Formatted string with % symbol
 */
export function formatCoverage(coverage: number): string {
  return `${coverage.toFixed(1)}%`;
}
