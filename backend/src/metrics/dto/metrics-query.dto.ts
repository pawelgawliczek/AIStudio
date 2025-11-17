import { Type } from 'class-transformer';
import { IsOptional, IsString, IsDateString, IsEnum, IsInt, Min, Max } from 'class-validator';

export enum TimeGranularity {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
}

export class MetricsQueryDto {
  @IsOptional()
  @IsString()
  workflowId?: string;

  @IsOptional()
  @IsString()
  componentId?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsEnum(TimeGranularity)
  granularity?: TimeGranularity;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  businessComplexity?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  technicalComplexity?: number;
}

export class WorkflowComparisonDto {
  @IsString()
  workflow1Id: string;

  @IsString()
  workflow2Id: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
