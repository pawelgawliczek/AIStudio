import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

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
  private getAuthHeaders() {
    const token = localStorage.getItem('token');
    return {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    };
  }

  async getWorkflowMetrics(
    projectId: string,
    query?: MetricsQuery,
  ): Promise<WorkflowMetrics[]> {
    const params = new URLSearchParams();
    if (query?.workflowId) params.append('workflowId', query.workflowId);
    if (query?.startDate) params.append('startDate', query.startDate);
    if (query?.endDate) params.append('endDate', query.endDate);
    if (query?.granularity) params.append('granularity', query.granularity);

    const response = await axios.get(
      `${API_BASE_URL}/api/projects/${projectId}/metrics/workflows?${params.toString()}`,
      this.getAuthHeaders(),
    );
    return response.data;
  }

  async getComponentMetrics(
    projectId: string,
    query?: MetricsQuery,
  ): Promise<ComponentMetrics[]> {
    const params = new URLSearchParams();
    if (query?.componentId) params.append('componentId', query.componentId);
    if (query?.startDate) params.append('startDate', query.startDate);
    if (query?.endDate) params.append('endDate', query.endDate);
    if (query?.granularity) params.append('granularity', query.granularity);

    const response = await axios.get(
      `${API_BASE_URL}/api/projects/${projectId}/metrics/components?${params.toString()}`,
      this.getAuthHeaders(),
    );
    return response.data;
  }

  async getTrends(
    projectId: string,
    query?: MetricsQuery,
  ): Promise<TrendsResponse[]> {
    const params = new URLSearchParams();
    if (query?.workflowId) params.append('workflowId', query.workflowId);
    if (query?.startDate) params.append('startDate', query.startDate);
    if (query?.endDate) params.append('endDate', query.endDate);
    if (query?.granularity) params.append('granularity', query.granularity);

    const response = await axios.get(
      `${API_BASE_URL}/api/projects/${projectId}/metrics/trends?${params.toString()}`,
      this.getAuthHeaders(),
    );
    return response.data;
  }

  async compareWorkflows(
    projectId: string,
    comparison: WorkflowComparison,
  ): Promise<WorkflowComparisonResponse> {
    const response = await axios.post(
      `${API_BASE_URL}/api/projects/${projectId}/metrics/comparisons`,
      comparison,
      this.getAuthHeaders(),
    );
    return response.data;
  }

  async getWeeklyAggregations(
    projectId: string,
    weeks: number = 8,
  ): Promise<WeeklyAggregation[]> {
    const response = await axios.get(
      `${API_BASE_URL}/api/projects/${projectId}/metrics/weekly?weeks=${weeks}`,
      this.getAuthHeaders(),
    );
    return response.data;
  }
}

export const metricsService = new MetricsService();
