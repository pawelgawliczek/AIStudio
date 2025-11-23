import { IsString, IsOptional, IsNumber, Min, IsEnum, IsIn } from 'class-validator';

/**
 * Time range enum for analytics queries
 */
export type TimeRange = '7d' | '30d' | '90d' | 'all';

/**
 * DTO for analytics query parameters
 */
export class AnalyticsQueryDto {
  @IsOptional()
  @IsString()
  versionId?: string;

  @IsOptional()
  @IsIn(['7d', '30d', '90d', 'all'])
  timeRange?: TimeRange;
}

/**
 * DTO for execution history query parameters
 */
export class ExecutionHistoryQueryDto {
  @IsOptional()
  @IsString()
  versionId?: string;

  @IsOptional()
  @IsIn(['7d', '30d', '90d', 'all'])
  timeRange?: TimeRange;

  @IsOptional()
  @IsNumber()
  @Min(1)
  limit?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  offset?: number;
}

/**
 * DTO for export query parameters
 */
export class ExportQueryDto {
  @IsOptional()
  @IsIn(['csv', 'json'])
  format?: 'csv' | 'json';

  @IsOptional()
  @IsString()
  versionId?: string;

  @IsOptional()
  @IsIn(['7d', '30d', '90d', 'all'])
  timeRange?: TimeRange;
}

/**
 * Response DTOs
 */
export interface WorkflowUsage {
  workflowId: string;
  workflowName: string;
  version: string;
  lastUsed: string;
  executionCount: number;
}

export interface ExecutionHistory {
  id: string;
  workflowRunId: string;
  workflowName: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'skipped' | 'paused';
  startTime: string;
  endTime?: string;
  duration?: number;
  cost?: number;
  triggeredBy: string;
  context?: any;
}

export interface UsageMetrics {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  successRate: number;
  avgDuration: number;
  totalCost: number;
  avgCost: number;
}

export interface TimeSeriesDataPoint {
  timestamp: string;
  value: number;
  label: string;
}

export interface ComponentUsageAnalytics {
  versionId: string;
  version: string;
  metrics: UsageMetrics;
  workflowsUsing: WorkflowUsage[];
  executionHistory: ExecutionHistory[];
  executionTrend: TimeSeriesDataPoint[];
  costTrend: TimeSeriesDataPoint[];
}

export interface CoordinatorUsageAnalytics {
  versionId: string;
  version: string;
  metrics: UsageMetrics;
  workflowsUsing: WorkflowUsage[];
  executionHistory: ExecutionHistory[];
  executionTrend: TimeSeriesDataPoint[];
  costTrend: TimeSeriesDataPoint[];
  componentUsage: Array<{
    componentId: string;
    componentName: string;
    usageCount: number;
  }>;
}

export interface WorkflowUsageAnalytics {
  versionId: string;
  version: string;
  metrics: UsageMetrics;
  executionHistory: ExecutionHistory[];
  executionTrend: TimeSeriesDataPoint[];
  costTrend: TimeSeriesDataPoint[];
  componentBreakdown: Array<{
    componentId: string;
    componentName: string;
    avgDuration: number;
    avgCost: number;
    failureRate: number;
  }>;
}

export interface ComponentUsageDetail {
  componentId: string;
  componentName: string;
  usageCount: number;
}

export interface ComponentBreakdown {
  componentId: string;
  componentName: string;
  avgDuration: number;
  avgCost: number;
  failureRate: number;
}
