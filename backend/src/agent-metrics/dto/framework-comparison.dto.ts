import { IsOptional, IsString, IsArray, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ComplexityBand {
  LOW = 'low', // 1-2
  MEDIUM = 'medium', // 3
  HIGH = 'high', // 4-5
  ALL = 'all',
}

export enum DateRange {
  LAST_7_DAYS = 'last_7_days',
  LAST_30_DAYS = 'last_30_days',
  LAST_90_DAYS = 'last_90_days',
  LAST_6_MONTHS = 'last_6_months',
  ALL_TIME = 'all_time',
  CUSTOM = 'custom',
}

export class GetFrameworkMetricsDto {
  @ApiProperty({ description: 'Project ID' })
  @IsString()
  projectId: string;

  @ApiProperty({ description: 'Framework IDs to compare', type: [String] })
  @IsArray()
  @IsString({ each: true })
  frameworkIds: string[];

  @ApiPropertyOptional({
    description: 'Complexity band filter',
    enum: ComplexityBand,
    default: ComplexityBand.ALL,
  })
  @IsEnum(ComplexityBand)
  @IsOptional()
  complexityBand?: ComplexityBand = ComplexityBand.ALL;

  @ApiPropertyOptional({
    description: 'Date range filter',
    enum: DateRange,
    default: DateRange.LAST_30_DAYS,
  })
  @IsEnum(DateRange)
  @IsOptional()
  dateRange?: DateRange = DateRange.LAST_30_DAYS;

  @ApiPropertyOptional({ description: 'Custom start date (ISO format)' })
  @IsString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Custom end date (ISO format)' })
  @IsString()
  @IsOptional()
  endDate?: string;
}

// Response DTOs

export class EfficiencyMetricsDto {
  avgTokensPerStory: number;
  avgTokenPerLoc: number;
  storyCycleTimeHours: number;
  promptIterationsPerStory: number;
  parallelizationEfficiencyPercent: number;
  tokenEfficiencyRatio: number; // out/in
}

export class QualityMetricsDto {
  defectsPerStory: number;
  defectLeakagePercent: number;
  codeChurnPercent: number;
  testCoveragePercent: number;
  codeComplexityDeltaPercent: number;
  criticalDefects: number;
}

export class CostMetricsDto {
  costPerStory: number;
  costPerAcceptedLoc: number;
  storiesCompleted: number;
  acceptedLoc: number;
  reworkCost: number;
  netCost: number;
}

export class AgentRoleMetricsDto {
  role: string; // 'ba', 'architect', 'developer', 'qa'
  tokens: number;
  percentOfTotal: number;
  valueAdd: string;
}

export class FrameworkOverheadDto {
  agentRoles: AgentRoleMetricsDto[];
  overheadTokens: number;
  overheadRatio: number; // non-dev / dev
  reworkReductionPercent: number;
  reworkSavings: number;
}

export class TrendDataPointDto {
  date: string; // ISO date
  value: number;
  framework: string;
}

export class ComplexityBandBreakdownDto {
  complexityBand: string;
  storiesCompared: string; // e.g., "42 vs 38"
  winner: string;
  reason: string;
}

export class FrameworkComparisonResultDto {
  framework: {
    id: string;
    name: string;
  };
  efficiencyMetrics: EfficiencyMetricsDto;
  qualityMetrics: QualityMetricsDto;
  costMetrics: CostMetricsDto;
  sampleSize: number; // number of stories
  confidenceLevel: string; // 'high', 'medium', 'low'
}

export class FrameworkComparisonResponseDto {
  projectId: string;
  projectName: string;
  complexityBand: ComplexityBand;
  dateRange: DateRange;
  startDate: string;
  endDate: string;
  comparisons: FrameworkComparisonResultDto[];
  overheadAnalysis?: FrameworkOverheadDto; // only for multi-agent frameworks
  trends?: {
    tokenUsage: TrendDataPointDto[];
    defectRate: TrendDataPointDto[];
    storyVelocity: TrendDataPointDto[];
  };
  complexityBreakdown?: ComplexityBandBreakdownDto[];
  aiInsights: string[];
  generatedAt: string;
}
