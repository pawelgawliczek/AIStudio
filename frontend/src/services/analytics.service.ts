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
   * Coordinator Analytics
   */
  async getCoordinatorAnalytics(
    coordinatorId: string,
    versionId?: string,
    timeRange: TimeRange = '30d'
  ): Promise<CoordinatorUsageAnalytics> {
    const params: any = { timeRange };
    if (versionId) params.versionId = versionId;

    const response = await apiClient.get<CoordinatorUsageAnalytics>(
      `/analytics/coordinators/${coordinatorId}`,
      { params }
    );
    return response.data;
  },

  async getCoordinatorExecutionHistory(
    coordinatorId: string,
    options?: {
      versionId?: string;
      timeRange?: TimeRange;
      limit?: number;
      offset?: number;
    }
  ): Promise<ExecutionHistory[]> {
    const response = await apiClient.get<ExecutionHistory[]>(
      `/analytics/coordinators/${coordinatorId}/executions`,
      { params: options }
    );
    return response.data;
  },

  async getCoordinatorWorkflowsUsing(
    coordinatorId: string,
    versionId?: string
  ): Promise<WorkflowUsage[]> {
    const params: any = {};
    if (versionId) params.versionId = versionId;

    const response = await apiClient.get<WorkflowUsage[]>(
      `/analytics/coordinators/${coordinatorId}/workflows`,
      { params }
    );
    return response.data;
  },

  async getCoordinatorComponentUsage(
    coordinatorId: string,
    versionId?: string
  ): Promise<Array<{ componentId: string; componentName: string; usageCount: number }>> {
    const params: any = {};
    if (versionId) params.versionId = versionId;

    const response = await apiClient.get<
      Array<{ componentId: string; componentName: string; usageCount: number }>
    >(`/analytics/coordinators/${coordinatorId}/components`, { params });
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
   * Export Data
   */
  async exportExecutionHistory(
    entityType: 'component' | 'coordinator' | 'workflow',
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
};
