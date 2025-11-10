import { IsOptional, IsString, IsArray, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ComplexityBand, DateRange } from './framework-comparison.dto';

export class GetPerAgentMetricsDto {
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
    default: ComplexityBand.MEDIUM,
  })
  @IsEnum(ComplexityBand)
  @IsOptional()
  complexityBand?: ComplexityBand = ComplexityBand.MEDIUM;

  @ApiPropertyOptional({
    description: 'Date range filter',
    enum: DateRange,
    default: DateRange.LAST_30_DAYS,
  })
  @IsEnum(DateRange)
  @IsOptional()
  dateRange?: DateRange = DateRange.LAST_30_DAYS;
}

// Response DTOs

export class AgentRoleEfficiencyDto {
  role: string; // 'ba', 'architect', 'developer', 'qa'
  tokensPerLoc?: number; // null for non-code roles
  locPerPrompt?: number; // null for non-code roles
  runtimePerLoc?: number; // seconds, null for non-code roles
  runtimePerToken: number; // seconds
  avgTokensPerRun: number;
  avgRuntimePerRun: number; // minutes
  runsPerStory: number;
  valueAdd: string; // qualitative description
}

export class FrameworkAgentBreakdownDto {
  frameworkId: string;
  frameworkName: string;
  sampleSize: number; // number of stories
  agentMetrics: {
    [role: string]: AgentRoleEfficiencyDto; // keyed by role
  };
}

export class TotalStoryCostComparisonDto {
  framework: string;
  breakdown: {
    ba?: { cost: number; percentOfTotal: number };
    architect?: { cost: number; percentOfTotal: number; runsAvg: number };
    developer: { cost: number; percentOfTotal: number; runsAvg: number };
    qa?: { cost: number; percentOfTotal: number };
  };
  costPerStory: number;
  totalRuntime: number; // minutes
  defectsPerStory: number;
  reworkCost: number;
  netCost: number; // including rework
}

export class PerAgentAnalyticsResponseDto {
  projectId: string;
  projectName: string;
  complexityBand: ComplexityBand;
  dateRange: DateRange;
  startDate: string;
  endDate: string;
  comparison: FrameworkAgentBreakdownDto[];
  costComparison: TotalStoryCostComparisonDto[];
  keyInsights: string[];
  recommendation: string;
  generatedAt: string;
}
