import { IsOptional, IsString, IsDateString, IsEnum } from 'class-validator';

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
