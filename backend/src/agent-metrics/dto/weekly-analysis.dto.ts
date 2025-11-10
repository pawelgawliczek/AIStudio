import { IsOptional, IsString, IsInt, Min, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ComplexityBand } from './framework-comparison.dto';

export enum ComparisonBaseline {
  PROJECT_AVERAGE = 'project_average',
  PREVIOUS_WEEK = 'previous_week',
  BEST_WEEK = 'best_week',
  CUSTOM_WEEK = 'custom_week',
}

export class GetWeeklyMetricsDto {
  @ApiProperty({ description: 'Project ID' })
  @IsString()
  projectId: string;

  @ApiPropertyOptional({ description: 'Framework ID to analyze' })
  @IsString()
  @IsOptional()
  frameworkId?: string;

  @ApiPropertyOptional({ description: 'Number of weeks to analyze', default: 8 })
  @IsInt()
  @Min(1)
  @IsOptional()
  weekCount?: number = 8;

  @ApiPropertyOptional({
    description: 'Complexity band filter',
    enum: ComplexityBand,
    default: ComplexityBand.ALL,
  })
  @IsEnum(ComplexityBand)
  @IsOptional()
  complexityBand?: ComplexityBand = ComplexityBand.ALL;

  @ApiPropertyOptional({
    description: 'Comparison baseline',
    enum: ComparisonBaseline,
    default: ComparisonBaseline.PROJECT_AVERAGE,
  })
  @IsEnum(ComparisonBaseline)
  @IsOptional()
  baseline?: ComparisonBaseline = ComparisonBaseline.PROJECT_AVERAGE;
}

// Response DTOs

export class WeeklySummaryDto {
  weekNumber: number;
  weekStart: string; // ISO date
  weekEnd: string; // ISO date
  storiesDelivered: number;
  frameworksUsed: string[]; // e.g., ["Full", "Dev-only"]
  frameworkMix: { framework: string; count: number; percentage: number }[];
  avgTokens: number;
  defectsPerStory: number;
  avgLoc: number;
  costPerStory: number;
  velocityScore: number; // 0-100
  vsBaseline: number; // percentage difference from baseline
  status: 'excellent' | 'good' | 'average' | 'below_average' | 'poor';
}

export class DetailedEfficiencyMetricsDto {
  tokensPerLoc: number;
  locPerPrompt: number;
  runtimePerLoc: number; // minutes
  runtimePerToken: number; // seconds
  avgPrompts: number;
  codeChurnPercent: number;
  defectLeakagePercent: number;
  testCoverage: number;
  firstTimeRightPercent: number;
}

export class VelocityScoreBreakdownDto {
  totalScore: number; // 0-100
  throughputScore: number; // 0-40
  qualityScore: number; // 0-40
  efficiencyScore: number; // 0-20
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  breakdown: {
    category: string;
    score: number;
    maxScore: number;
    metrics: { name: string; value: any; target: any; points: number }[];
  }[];
}

export class WeekComparisonDto {
  weekNumber: number;
  metric: string;
  weekValue: any;
  baselineValue: any;
  difference: string;
  betterOrWorse: 'better' | 'worse' | 'same';
}

export class FrameworkPerformanceDto {
  frameworkId: string;
  frameworkName: string;
  storiesProcessed: number;
  agentPerformance: {
    role: string;
    avgTokens: number;
    percentOfTotal: number;
    avgIterations: number;
    avgRuntime: number; // minutes
    avgLoc?: number; // only for code-generating agents
    tokensPerLoc?: number;
  }[];
  totalAvgTokens: number;
  totalAvgRuntime: number; // minutes
  totalAvgIterations: number;
  qualityMetrics: {
    defectsFound: number;
    defectsCaughtByQa: number;
    defectsLeaked: number;
    defectLeakagePercent: number;
    testCoverage: number;
    codeChurn: number;
    codeChurnPercent: number;
  };
  efficiency: {
    parallelizationPercent: number;
    firstTimeRightPercent: number;
    requirementsClarityPercent: number;
  };
  costAnalysis: {
    directCost: number;
    costPerLoc: number;
    reworkCost: number;
    netCost: number;
    roiVsDevOnly?: number; // savings
  };
}

export class WeeklyAnalysisResponseDto {
  projectId: string;
  projectName: string;
  frameworkId?: string;
  frameworkName?: string;
  weekCount: number;
  complexityBand: ComplexityBand;
  baseline: ComparisonBaseline;
  weeklySummary: WeeklySummaryDto[];
  detailedMetrics: Map<number, DetailedEfficiencyMetricsDto>; // weekNumber -> metrics
  projectAverage: WeeklySummaryDto;
  bestWeek: WeeklySummaryDto;
  worstWeek: WeeklySummaryDto;
  trends: {
    storiesDelivered: { week: number; value: number }[];
    qualityMetrics: { week: number; defects: number; churn: number; coverage: number }[];
    efficiencyMetrics: { week: number; tokensPerLoc: number; costPerStory: number }[];
  };
  selectedWeekComparison?: {
    weekNumber: number;
    comparisons: WeekComparisonDto[];
    overallAssessment: string;
  };
  frameworkPerformance?: FrameworkPerformanceDto; // for specific framework
  aiInsights: string[];
  generatedAt: string;
}
