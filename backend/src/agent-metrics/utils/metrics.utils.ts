import { DateRange, ComplexityBand } from '../dto/enums';
import {
  EfficiencyMetricsDto,
  QualityMetricsDto,
  CostMetricsDto,
} from '../dto/metrics.dto';

/**
 * Calculate date range from enum
 */
export function calculateDateRange(
  dateRange: DateRange,
  customStart?: string,
  customEnd?: string,
): { startDate: Date; endDate: Date } {
  const endDate = new Date();
  let startDate = new Date();

  switch (dateRange) {
    case DateRange.LAST_7_DAYS:
      startDate.setDate(endDate.getDate() - 7);
      break;
    case DateRange.LAST_30_DAYS:
      startDate.setDate(endDate.getDate() - 30);
      break;
    case DateRange.LAST_90_DAYS:
      startDate.setDate(endDate.getDate() - 90);
      break;
    case DateRange.LAST_6_MONTHS:
      startDate.setMonth(endDate.getMonth() - 6);
      break;
    case DateRange.CUSTOM:
      if (customStart && customEnd) {
        startDate = new Date(customStart);
        return { startDate, endDate: new Date(customEnd) };
      }
      break;
    case DateRange.ALL_TIME:
      startDate = new Date('2020-01-01');
      break;
  }

  return { startDate, endDate };
}

/**
 * Calculate date range for workflow metrics
 */
export function calculateWorkflowDateRange(
  range: string,
  customStart?: string,
  customEnd?: string,
): { startDate: Date; endDate: Date } {
  const endDate = new Date();
  const startDate = new Date();

  switch (range) {
    case 'week':
      startDate.setDate(endDate.getDate() - 7);
      break;
    case 'month':
      startDate.setMonth(endDate.getMonth() - 1);
      break;
    case 'quarter':
      startDate.setMonth(endDate.getMonth() - 3);
      break;
    case 'custom':
      if (customStart && customEnd) {
        return { startDate: new Date(customStart), endDate: new Date(customEnd) };
      }
      break;
    default:
      startDate.setMonth(endDate.getMonth() - 1);
  }

  return { startDate, endDate };
}

/**
 * Get complexity filter array from enum
 */
export function getComplexityFilter(band: ComplexityBand): number[] | null {
  switch (band) {
    case ComplexityBand.LOW:
      return [1, 2];
    case ComplexityBand.MEDIUM:
      return [3];
    case ComplexityBand.HIGH:
      return [4, 5];
    case ComplexityBand.ALL:
      return null;
  }
}

/**
 * Determine trend from values
 */
export function determineTrend(values: number[]): {
  trend: 'improving' | 'stable' | 'declining';
  changePercent: number;
} {
  if (values.length < 2) {
    return { trend: 'stable', changePercent: 0 };
  }

  const first = values[0];
  const last = values[values.length - 1];
  const changePercent = first > 0 ? ((last - first) / first) * 100 : 0;

  // For cost/tokens metrics, lower is better
  if (changePercent < -5) {
    return { trend: 'improving', changePercent };
  } else if (changePercent > 5) {
    return { trend: 'declining', changePercent };
  }
  return { trend: 'stable', changePercent };
}

/**
 * Calculate percentage difference
 */
export function calculatePercentDiff(value1: number, value2: number): number {
  if (value2 === 0) return 0;
  return ((value1 - value2) / value2) * 100;
}

/**
 * Determine confidence level based on sample size
 */
export function determineConfidenceLevel(sampleSize: number): string {
  if (sampleSize >= 20) return 'high';
  if (sampleSize >= 5) return 'medium';
  return 'low';
}

/**
 * Get empty efficiency metrics
 */
export function getEmptyEfficiencyMetrics(): EfficiencyMetricsDto {
  return {
    avgTokensPerStory: 0,
    avgTokenPerLoc: 0,
    storyCycleTimeHours: 0,
    promptIterationsPerStory: 0,
    parallelizationEfficiencyPercent: 0,
    tokenEfficiencyRatio: 0,
  };
}

/**
 * Get empty quality metrics
 */
export function getEmptyQualityMetrics(): QualityMetricsDto {
  return {
    defectsPerStory: 0,
    defectLeakagePercent: 0,
    codeChurnPercent: 0,
    testCoveragePercent: 0,
    codeComplexityDeltaPercent: 0,
    criticalDefects: 0,
  };
}

/**
 * Get empty cost metrics
 */
export function getEmptyCostMetrics(): CostMetricsDto {
  return {
    costPerStory: 0,
    costPerAcceptedLoc: 0,
    storiesCompleted: 0,
    acceptedLoc: 0,
    reworkCost: 0,
    netCost: 0,
  };
}
