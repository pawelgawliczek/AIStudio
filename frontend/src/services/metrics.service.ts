import { apiClient } from './api.client';

export enum TimeGranularity {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
}

export interface MetricsQuery {
  workflowId?: string;
  componentId?: string;
  startDate?: string;
  endDate?: string;
  granularity?: TimeGranularity;
  businessComplexity?: number;
  technicalComplexity?: number;
}

export interface AggregatedMetrics {
  periodStart: string;
  periodEnd: string;
  granularity: string;
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  successRate: number;
  avgDuration?: number;
  totalDuration?: number;
  minDuration?: number;
  maxDuration?: number;
  avgTokens?: number;
  totalTokens?: number;
  avgTokensInput?: number;
  avgTokensOutput?: number;
  avgTokensPerLoc?: number;
  totalLoc?: number;
  avgLocPerStory?: number;
  avgLocPerPrompt?: number;
  testsAdded?: number;
  avgRuntimePerLoc?: number;
  avgRuntimePerToken?: number;
  avgPromptsPerRun?: number;
  avgIterationsPerRun?: number;
  avgCost?: number;
  totalCost?: number;
  defectsPerStory?: number;
  codeChurnPercent?: number;
  testCoverage?: number;
}

export interface WorkflowMetrics extends AggregatedMetrics {
  workflowId: string;
  workflowName: string;
  workflowVersion?: string;
}

export interface ComponentMetrics extends AggregatedMetrics {
  componentId: string;
  componentName: string;
  avgRunsPerWorkflow?: number;
}

export interface TrendDataPoint {
  date: string;
  value: number;
  metric: string;
}

export interface TrendsResponse {
  metric: string;
  dataPoints: TrendDataPoint[];
  trend: 'UP' | 'DOWN' | 'STABLE';
  changePercent: number;
}

export interface WorkflowComparison {
  workflow1Id: string;
  workflow2Id: string;
  startDate?: string;
  endDate?: string;
}

export interface WorkflowComparisonResponse {
  workflow1: WorkflowMetrics;
  workflow2: WorkflowMetrics;
  comparison: {
    tokensDiff: number;
    costDiff: number;
    durationDiff: number;
    locDiff: number;
    efficiencyDiff: number;
    winner: 'workflow1' | 'workflow2' | 'tie';
  };
}

export interface WeeklyAggregation {
  weekNumber: number;
  year: number;
  weekStart: string;
  weekEnd: string;
  storiesCompleted: number;
  workflows: WorkflowMetrics[];
  aggregated: AggregatedMetrics;
}

class MetricsService {
  async getWorkflowMetrics(
    projectId: string,
    query?: MetricsQuery,
  ): Promise<WorkflowMetrics[]> {
    const params: any = {};
    if (query?.workflowId) params.workflowId = query.workflowId;
    if (query?.startDate) params.startDate = query.startDate;
    if (query?.endDate) params.endDate = query.endDate;
    if (query?.granularity) params.granularity = query.granularity;
    if (query?.businessComplexity !== undefined) params.businessComplexity = query.businessComplexity.toString();
    if (query?.technicalComplexity !== undefined) params.technicalComplexity = query.technicalComplexity.toString();

    const response = await apiClient.get(
      `/projects/${projectId}/metrics/workflows`,
      { params }
    );
    return response.data;
  }

  async getComponentMetrics(
    projectId: string,
    query?: MetricsQuery,
  ): Promise<ComponentMetrics[]> {
    const params: any = {};
    if (query?.componentId) params.componentId = query.componentId;
    if (query?.startDate) params.startDate = query.startDate;
    if (query?.endDate) params.endDate = query.endDate;
    if (query?.granularity) params.granularity = query.granularity;
    if (query?.businessComplexity !== undefined) params.businessComplexity = query.businessComplexity.toString();
    if (query?.technicalComplexity !== undefined) params.technicalComplexity = query.technicalComplexity.toString();

    const response = await apiClient.get(
      `/projects/${projectId}/metrics/components`,
      { params }
    );
    return response.data;
  }

  async getTrends(
    projectId: string,
    query?: MetricsQuery,
  ): Promise<TrendsResponse[]> {
    const params: any = {};
    if (query?.workflowId) params.workflowId = query.workflowId;
    if (query?.startDate) params.startDate = query.startDate;
    if (query?.endDate) params.endDate = query.endDate;
    if (query?.granularity) params.granularity = query.granularity;
    if (query?.businessComplexity !== undefined) params.businessComplexity = query.businessComplexity.toString();
    if (query?.technicalComplexity !== undefined) params.technicalComplexity = query.technicalComplexity.toString();

    const response = await apiClient.get(
      `/projects/${projectId}/metrics/trends`,
      { params }
    );
    return response.data;
  }

  async compareWorkflows(
    projectId: string,
    comparison: WorkflowComparison,
  ): Promise<WorkflowComparisonResponse> {
    const response = await apiClient.post(
      `/projects/${projectId}/metrics/comparisons`,
      comparison
    );
    return response.data;
  }

  async getWeeklyAggregations(
    projectId: string,
    weeks: number = 8,
    businessComplexity?: number,
    technicalComplexity?: number,
  ): Promise<WeeklyAggregation[]> {
    const params: any = { weeks: weeks.toString() };
    if (businessComplexity !== undefined) params.businessComplexity = businessComplexity.toString();
    if (technicalComplexity !== undefined) params.technicalComplexity = technicalComplexity.toString();

    const response = await apiClient.get(
      `/projects/${projectId}/metrics/weekly`,
      { params }
    );
    return response.data;
  }
}

export const metricsService = new MetricsService();
