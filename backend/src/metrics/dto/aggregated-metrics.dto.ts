export class AggregatedMetricsDto {
  // Time period
  periodStart: string;
  periodEnd: string;
  granularity: string;

  // Counts
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  successRate: number; // percentage

  // Time metrics
  avgDuration?: number; // seconds
  totalDuration?: number;
  minDuration?: number;
  maxDuration?: number;

  // Token metrics
  avgTokens?: number;
  totalTokens?: number;
  avgTokensInput?: number;
  avgTokensOutput?: number;
  avgTokensPerLoc?: number;

  // Code metrics
  totalLoc?: number;
  avgLocPerStory?: number;
  avgLocPerPrompt?: number;

  // Efficiency metrics
  avgRuntimePerLoc?: number; // seconds per LOC
  avgRuntimePerToken?: number; // seconds per token
  avgPromptsPerRun?: number;
  avgIterationsPerRun?: number;

  // Cost metrics
  avgCost?: number;
  totalCost?: number;

  // Quality metrics (future)
  defectsPerStory?: number;
  codeChurnPercent?: number;
  testCoverage?: number;
}

export class WorkflowMetricsDto extends AggregatedMetricsDto {
  workflowId: string;
  workflowName: string;
  workflowVersion?: string;
}

export class ComponentMetricsDto extends AggregatedMetricsDto {
  componentId: string;
  componentName: string;
  avgRunsPerWorkflow?: number;
}

export class TrendDataPointDto {
  date: string;
  value: number;
  metric: string;
}

export class TrendsResponseDto {
  metric: string;
  dataPoints: TrendDataPointDto[];
  trend: 'UP' | 'DOWN' | 'STABLE';
  changePercent: number;
}

export class WorkflowComparisonResponseDto {
  workflow1: WorkflowMetricsDto;
  workflow2: WorkflowMetricsDto;
  comparison: {
    tokensDiff: number; // percentage
    costDiff: number;
    durationDiff: number;
    locDiff: number;
    efficiencyDiff: number;
    winner: 'workflow1' | 'workflow2' | 'tie';
  };
}

export class WeeklyAggregationDto {
  weekNumber: number;
  year: number;
  weekStart: string;
  weekEnd: string;
  storiesCompleted: number;
  workflows: WorkflowMetricsDto[];
  aggregated: AggregatedMetricsDto;
}
