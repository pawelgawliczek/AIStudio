import { apiClient } from './api.client';

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

// CoordinatorUsageAnalytics removed - coordinators no longer exist (ST-164)

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

export type TimeRange = '7d' | '30d' | '90d' | 'all';

export const analyticsService = {
  /**
   * Component Analytics
   */
  async getComponentAnalytics(
    componentId: string,
    versionId?: string,
    timeRange: TimeRange = '30d'
  ): Promise<ComponentUsageAnalytics> {
    const params: any = { timeRange };
    if (versionId) params.versionId = versionId;

    const response = await apiClient.get<ComponentUsageAnalytics>(
      `/analytics/components/${componentId}`,
      { params }
    );
    return response.data;
  },

  async getComponentExecutionHistory(
    componentId: string,
    options?: {
      versionId?: string;
      timeRange?: TimeRange;
      limit?: number;
      offset?: number;
    }
  ): Promise<ExecutionHistory[]> {
    const response = await apiClient.get<ExecutionHistory[]>(
      `/analytics/components/${componentId}/executions`,
      { params: options }
    );
    return response.data;
  },

  async getComponentWorkflowsUsing(
    componentId: string,
    versionId?: string
  ): Promise<WorkflowUsage[]> {
    const params: any = {};
    if (versionId) params.versionId = versionId;

    const response = await apiClient.get<WorkflowUsage[]>(
      `/analytics/components/${componentId}/workflows`,
      { params }
    );
    return response.data;
  },

  /**
   * Workflow Analytics
   */
  async getWorkflowAnalytics(
    workflowId: string,
    versionId?: string,
    timeRange: TimeRange = '30d'
  ): Promise<WorkflowUsageAnalytics> {
    const params: any = { timeRange };
    if (versionId) params.versionId = versionId;

    const response = await apiClient.get<WorkflowUsageAnalytics>(
      `/analytics/workflows/${workflowId}`,
      { params }
    );
    return response.data;
  },

  async getWorkflowExecutionHistory(
    workflowId: string,
    options?: {
      versionId?: string;
      timeRange?: TimeRange;
      limit?: number;
      offset?: number;
    }
  ): Promise<ExecutionHistory[]> {
    const response = await apiClient.get<ExecutionHistory[]>(
      `/analytics/workflows/${workflowId}/executions`,
      { params: options }
    );
    return response.data;
  },

  async getWorkflowComponentBreakdown(
    workflowId: string,
    versionId?: string
  ): Promise<
    Array<{
      componentId: string;
      componentName: string;
      avgDuration: number;
      avgCost: number;
      failureRate: number;
    }>
  > {
    const params: any = {};
    if (versionId) params.versionId = versionId;

    const response = await apiClient.get<
      Array<{
        componentId: string;
        componentName: string;
        avgDuration: number;
        avgCost: number;
        failureRate: number;
      }>
    >(`/analytics/workflows/${workflowId}/component-breakdown`, { params });
    return response.data;
  },

  /**
   * Export Data (ST-164: Coordinator entity type removed)
   */
  async exportExecutionHistory(
    entityType: 'component' | 'workflow',
    entityId: string,
    format: 'csv' | 'json' = 'csv',
    options?: {
      versionId?: string;
      timeRange?: TimeRange;
    }
  ): Promise<Blob> {
    const response = await apiClient.get(
      `/analytics/${entityType}s/${entityId}/export`,
      {
        params: { format, ...options },
        responseType: 'blob',
      }
    );
    return response.data;
  },

  /**
   * ST-265: Get KPI history for trend charts
   */
  async getKpiHistory(params: {
    workflowId: string;
    kpiName: string;
    days?: number;
    businessComplexity?: [number, number];
    technicalComplexity?: [number, number];
  }): Promise<{ dates: string[]; workflowValues: number[]; systemAverages: number[] }> {
    const queryParams: any = {
      workflowId: params.workflowId,
      kpiName: params.kpiName,
      days: params.days,
    };

    if (params.businessComplexity) {
      queryParams.businessComplexityMin = params.businessComplexity[0];
      queryParams.businessComplexityMax = params.businessComplexity[1];
    }

    if (params.technicalComplexity) {
      queryParams.technicalComplexityMin = params.technicalComplexity[0];
      queryParams.technicalComplexityMax = params.technicalComplexity[1];
    }

    const response = await apiClient.get<{ dates: string[]; workflowValues: number[]; systemAverages: number[] }>(
      '/agent-metrics/kpi-history',
      { params: queryParams }
    );
    return response.data;
  },
};
