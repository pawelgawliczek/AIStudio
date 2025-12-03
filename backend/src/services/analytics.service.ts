import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  TimeRange,
  WorkflowUsage,
  ExecutionHistory,
  UsageMetrics,
  TimeSeriesDataPoint,
  ComponentUsageAnalytics,
  CoordinatorUsageAnalytics,
  WorkflowUsageAnalytics,
  ComponentUsageDetail,
  ComponentBreakdown,
} from '../dtos/analytics.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Calculate date threshold based on time range
   */
  private getTimeRangeDate(timeRange?: TimeRange): Date | null {
    if (!timeRange || timeRange === 'all') return null;

    const now = new Date();
    const daysMap = { '7d': 7, '30d': 30, '90d': 90 };
    const days = daysMap[timeRange];

    const date = new Date(now);
    date.setDate(date.getDate() - days);
    return date;
  }

  /**
   * Build time range filter for Prisma queries
   */
  private buildTimeRangeFilter(timeRange?: TimeRange) {
    const date = this.getTimeRangeDate(timeRange);
    return date ? { gte: date } : undefined;
  }

  /**
   * Get component analytics
   */
  async getComponentAnalytics(
    componentId: string,
    versionId?: string,
    timeRange?: TimeRange,
  ): Promise<ComponentUsageAnalytics> {
    this.logger.log(`Getting analytics for component ${componentId}, version: ${versionId}, range: ${timeRange}`);

    // Verify component exists
    const component = await this.prisma.component.findUnique({
      where: { id: versionId || componentId },
    });

    if (!component) {
      throw new NotFoundException(`Component ${versionId || componentId} not found`);
    }

    const targetVersionId = versionId || componentId;
    const version = `${component.versionMajor}.${component.versionMinor}`;

    // Get execution history
    const executionHistory = await this.getComponentExecutionHistory(
      componentId,
      versionId,
      timeRange,
    );

    // Calculate metrics from execution history
    const metrics = this.calculateMetrics(executionHistory);

    // Get workflows using this component
    const workflowsUsing = await this.getWorkflowsUsingComponent(componentId, versionId);

    // Generate trends
    const executionTrend = this.generateExecutionTrend(executionHistory, timeRange);
    const costTrend = this.generateCostTrend(executionHistory, timeRange);

    return {
      versionId: targetVersionId,
      version,
      metrics,
      workflowsUsing,
      executionHistory: executionHistory.slice(0, 10), // Latest 10
      executionTrend,
      costTrend,
    };
  }

  /**
   * Get coordinator analytics
   */
  async getCoordinatorAnalytics(
    coordinatorId: string,
    versionId?: string,
    timeRange?: TimeRange,
  ): Promise<CoordinatorUsageAnalytics> {
    this.logger.log(`Getting analytics for coordinator ${coordinatorId}, version: ${versionId}, range: ${timeRange}`);

    // Verify coordinator exists
    const coordinator = await this.prisma.component.findUnique({
      where: { id: versionId || coordinatorId },
    });

    if (!coordinator) {
      throw new NotFoundException(`Coordinator ${versionId || coordinatorId} not found`);
    }

    const targetVersionId = versionId || coordinatorId;
    const version = `${coordinator.versionMajor}.${coordinator.versionMinor}`;

    // Get workflow runs (coordinators execute workflows)
    const executionHistory = await this.getCoordinatorExecutionHistory(
      coordinatorId,
      versionId,
      timeRange,
    );

    const metrics = this.calculateMetrics(executionHistory);
    const workflowsUsing = await this.getWorkflowsUsingCoordinator(coordinatorId, versionId);
    const componentUsage = await this.getCoordinatorComponentUsage(coordinatorId, versionId);

    const executionTrend = this.generateExecutionTrend(executionHistory, timeRange);
    const costTrend = this.generateCostTrend(executionHistory, timeRange);

    return {
      versionId: targetVersionId,
      version,
      metrics,
      workflowsUsing,
      executionHistory: executionHistory.slice(0, 10),
      executionTrend,
      costTrend,
      componentUsage,
    };
  }

  /**
   * Get workflow analytics
   */
  async getWorkflowAnalytics(
    workflowId: string,
    versionId?: string,
    timeRange?: TimeRange,
  ): Promise<WorkflowUsageAnalytics> {
    this.logger.log(`Getting analytics for workflow ${workflowId}, version: ${versionId}, range: ${timeRange}`);

    // Verify workflow exists
    const workflow = await this.prisma.workflow.findUnique({
      where: { id: versionId || workflowId },
    });

    if (!workflow) {
      throw new NotFoundException(`Workflow ${versionId || workflowId} not found`);
    }

    const targetVersionId = versionId || workflowId;
    const version = `${workflow.versionMajor}.${workflow.versionMinor}`;

    const executionHistory = await this.getWorkflowExecutionHistory(
      workflowId,
      versionId,
      timeRange,
    );

    const metrics = this.calculateMetrics(executionHistory);
    const componentBreakdown = await this.getWorkflowComponentBreakdown(workflowId, versionId);

    const executionTrend = this.generateExecutionTrend(executionHistory, timeRange);
    const costTrend = this.generateCostTrend(executionHistory, timeRange);

    return {
      versionId: targetVersionId,
      version,
      metrics,
      executionHistory: executionHistory.slice(0, 10),
      executionTrend,
      costTrend,
      componentBreakdown,
    };
  }

  /**
   * Get component execution history
   */
  async getComponentExecutionHistory(
    componentId: string,
    versionId?: string,
    timeRange?: TimeRange,
    limit: number = 100,
    offset: number = 0,
  ): Promise<ExecutionHistory[]> {
    const targetId = versionId || componentId;
    const timeFilter = this.buildTimeRangeFilter(timeRange);

    const runs = await this.prisma.componentRun.findMany({
      where: {
        componentId: targetId,
        ...(timeFilter && { startedAt: timeFilter }),
      },
      include: {
        workflowRun: {
          include: {
            workflow: true,
          },
        },
      },
      orderBy: { startedAt: 'desc' },
      take: limit,
      skip: offset,
    });

    return runs.map((run) => this.mapComponentRunToExecutionHistory(run));
  }

  /**
   * Get coordinator execution history
   * @deprecated ST-164: Coordinators are deprecated. This method is kept for backwards compatibility but returns empty array.
   */
  async getCoordinatorExecutionHistory(
    coordinatorId: string,
    versionId?: string,
    timeRange?: TimeRange,
    limit: number = 100,
    offset: number = 0,
  ): Promise<ExecutionHistory[]> {
    // ST-164: Coordinators are deprecated, return empty array
    this.logger.warn('getCoordinatorExecutionHistory called but coordinators are deprecated (ST-164)');
    return [];
  }

  /**
   * Get workflow execution history
   */
  async getWorkflowExecutionHistory(
    workflowId: string,
    versionId?: string,
    timeRange?: TimeRange,
    limit: number = 100,
    offset: number = 0,
  ): Promise<ExecutionHistory[]> {
    const targetId = versionId || workflowId;
    const timeFilter = this.buildTimeRangeFilter(timeRange);

    const runs = await this.prisma.workflowRun.findMany({
      where: {
        workflowId: targetId,
        ...(timeFilter && { startedAt: timeFilter }),
      },
      include: {
        workflow: true,
      },
      orderBy: { startedAt: 'desc' },
      take: limit,
      skip: offset,
    });

    return runs.map((run) => this.mapWorkflowRunToExecutionHistory(run));
  }

  /**
   * Get workflows using a component
   */
  async getWorkflowsUsingComponent(
    componentId: string,
    versionId?: string,
  ): Promise<WorkflowUsage[]> {
    const targetId = versionId || componentId;

    // Find workflow runs that used this component
    const componentRuns = await this.prisma.componentRun.findMany({
      where: { componentId: targetId },
      include: {
        workflowRun: {
          include: {
            workflow: true,
          },
        },
      },
      distinct: ['workflowRunId'],
    });

    // Aggregate by workflow
    const workflowMap = new Map<string, { name: string; version: string; lastUsed: Date; count: number }>();

    for (const run of componentRuns) {
      if (!run.workflowRun?.workflow) continue;

      const workflow = run.workflowRun.workflow;
      const key = workflow.id;

      if (workflowMap.has(key)) {
        const existing = workflowMap.get(key)!;
        existing.count++;
        if (run.startedAt > existing.lastUsed) {
          existing.lastUsed = run.startedAt;
        }
      } else {
        workflowMap.set(key, {
          name: workflow.name,
          version: `${workflow.versionMajor}.${workflow.versionMinor}`,
          lastUsed: run.startedAt,
          count: 1,
        });
      }
    }

    return Array.from(workflowMap.entries()).map(([workflowId, data]) => ({
      workflowId,
      workflowName: data.name,
      version: data.version,
      lastUsed: data.lastUsed.toISOString(),
      executionCount: data.count,
    }));
  }

  /**
   * Get workflows using a coordinator
   * @deprecated ST-164: Coordinators are deprecated. This method is kept for backwards compatibility but returns empty array.
   */
  async getWorkflowsUsingCoordinator(
    coordinatorId: string,
    versionId?: string,
  ): Promise<WorkflowUsage[]> {
    // ST-164: Coordinators are deprecated, return empty array
    this.logger.warn('getWorkflowsUsingCoordinator called but coordinators are deprecated (ST-164)');
    return [];
  }

  /**
   * Get component usage by coordinator
   * @deprecated ST-164: Coordinators are deprecated. This method is kept for backwards compatibility but returns empty array.
   */
  async getCoordinatorComponentUsage(
    coordinatorId: string,
    versionId?: string,
  ): Promise<ComponentUsageDetail[]> {
    // ST-164: Coordinators are deprecated, return empty array
    this.logger.warn('getCoordinatorComponentUsage called but coordinators are deprecated (ST-164)');
    return [];
  }

  /**
   * Get component breakdown for workflow
   */
  async getWorkflowComponentBreakdown(
    workflowId: string,
    versionId?: string,
  ): Promise<ComponentBreakdown[]> {
    const targetId = versionId || workflowId;

    const componentRuns = await this.prisma.componentRun.findMany({
      where: {
        workflowRun: {
          workflowId: targetId,
        },
      },
      include: {
        component: true,
      },
    });

    // Aggregate by component
    const componentMap = new Map<
      string,
      {
        name: string;
        durations: number[];
        costs: number[];
        failures: number;
        total: number;
      }
    >();

    for (const run of componentRuns) {
      if (!run.component) continue;

      const key = run.componentId;
      const duration = run.finishedAt && run.startedAt
        ? (run.finishedAt.getTime() - run.startedAt.getTime()) / 1000
        : 0;

      const cost = this.extractCost(run);
      const failed = run.status === 'failed' ? 1 : 0;

      if (componentMap.has(key)) {
        const existing = componentMap.get(key)!;
        existing.durations.push(duration);
        existing.costs.push(cost);
        existing.failures += failed;
        existing.total++;
      } else {
        componentMap.set(key, {
          name: run.component.name,
          durations: [duration],
          costs: [cost],
          failures: failed,
          total: 1,
        });
      }
    }

    return Array.from(componentMap.entries()).map(([componentId, data]) => ({
      componentId,
      componentName: data.name,
      avgDuration: this.average(data.durations),
      avgCost: this.average(data.costs),
      failureRate: (data.failures / data.total) * 100,
    }));
  }

  /**
   * Calculate usage metrics
   */
  private calculateMetrics(executionHistory: ExecutionHistory[]): UsageMetrics {
    const totalExecutions = executionHistory.length;
    const successfulExecutions = executionHistory.filter((e) => e.status === 'completed').length;
    const failedExecutions = executionHistory.filter((e) => e.status === 'failed').length;
    const successRate = totalExecutions > 0 ? (successfulExecutions / totalExecutions) * 100 : 0;

    const durations = executionHistory
      .filter((e) => e.duration !== undefined)
      .map((e) => e.duration!);
    const avgDuration = this.average(durations);

    const costs = executionHistory
      .filter((e) => e.cost !== undefined)
      .map((e) => e.cost!);
    const totalCost = costs.reduce((sum, cost) => sum + cost, 0);
    const avgCost = this.average(costs);

    return {
      totalExecutions,
      successfulExecutions,
      failedExecutions,
      successRate,
      avgDuration,
      totalCost,
      avgCost,
    };
  }

  /**
   * Generate execution trend time series
   */
  private generateExecutionTrend(
    executionHistory: ExecutionHistory[],
    timeRange?: TimeRange,
  ): TimeSeriesDataPoint[] {
    const bucketSize = this.getBucketSize(timeRange);
    const buckets = this.createTimeBuckets(bucketSize, timeRange);

    for (const execution of executionHistory) {
      const bucket = this.findBucket(buckets, bucketSize, execution.startTime);
      if (bucket) {
        bucket.value++;
      }
    }

    return buckets;
  }

  /**
   * Generate cost trend time series
   */
  private generateCostTrend(
    executionHistory: ExecutionHistory[],
    timeRange?: TimeRange,
  ): TimeSeriesDataPoint[] {
    const bucketSize = this.getBucketSize(timeRange);
    const buckets = this.createTimeBuckets(bucketSize, timeRange);

    for (const execution of executionHistory) {
      if (execution.cost !== undefined) {
        const bucket = this.findBucket(buckets, bucketSize, execution.startTime);
        if (bucket) {
          bucket.value += execution.cost;
        }
      }
    }

    return buckets;
  }

  /**
   * Helper methods
   */
  private average(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
  }

  private extractCost(run: any): number {
    // Try to extract cost from metadata or calculate from tokens
    if (run.metadata?.cost) return run.metadata.cost;
    if (run.metadata?.tokensUsed) {
      // Approximate cost calculation (adjust rates as needed)
      return (run.metadata.tokensUsed / 1000) * 0.01;
    }
    return 0;
  }

  private getBucketSize(timeRange?: TimeRange): number {
    // Return bucket size in hours
    if (!timeRange || timeRange === 'all') return 24 * 7; // 1 week buckets
    if (timeRange === '7d') return 24; // 1 day buckets
    if (timeRange === '30d') return 24; // 1 day buckets
    if (timeRange === '90d') return 24 * 7; // 1 week buckets
    return 24;
  }

  private createTimeBuckets(bucketSizeHours: number, timeRange?: TimeRange): TimeSeriesDataPoint[] {
    const now = new Date();
    const startDate = this.getTimeRangeDate(timeRange) || new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const buckets: TimeSeriesDataPoint[] = [];

    let currentDate = new Date(startDate);
    while (currentDate <= now) {
      buckets.push({
        timestamp: currentDate.toISOString(),
        value: 0,
        label: this.formatBucketLabel(currentDate, bucketSizeHours),
      });
      currentDate = new Date(currentDate.getTime() + bucketSizeHours * 60 * 60 * 1000);
    }

    return buckets;
  }

  private findBucket(
    buckets: TimeSeriesDataPoint[],
    bucketSizeHours: number,
    timestamp: string,
  ): TimeSeriesDataPoint | null {
    const date = new Date(timestamp);
    for (const bucket of buckets) {
      const bucketDate = new Date(bucket.timestamp);
      const bucketEnd = new Date(bucketDate.getTime() + bucketSizeHours * 60 * 60 * 1000);
      if (date >= bucketDate && date < bucketEnd) {
        return bucket;
      }
    }
    return null;
  }

  private formatBucketLabel(date: Date, bucketSizeHours: number): string {
    if (bucketSizeHours >= 24) {
      return date.toISOString().split('T')[0]; // YYYY-MM-DD
    }
    return date.toISOString().substring(0, 13) + ':00'; // YYYY-MM-DDTHH:00
  }

  private mapComponentRunToExecutionHistory(run: any): ExecutionHistory {
    const duration = run.finishedAt && run.startedAt
      ? (run.finishedAt.getTime() - run.startedAt.getTime()) / 1000
      : undefined;

    return {
      id: run.id,
      workflowRunId: run.workflowRunId,
      workflowName: run.workflowRun?.workflow?.name || 'Unknown',
      status: run.status,
      startTime: run.startedAt.toISOString(),
      endTime: run.finishedAt?.toISOString(),
      duration,
      cost: this.extractCost(run),
      triggeredBy: run.workflowRun?.triggeredBy || 'Unknown',
      context: run.workflowRun?.context,
    };
  }

  private mapWorkflowRunToExecutionHistory(run: any): ExecutionHistory {
    const duration = run.endTime && run.startTime
      ? (run.endTime.getTime() - run.startTime.getTime()) / 1000
      : undefined;

    return {
      id: run.id,
      workflowRunId: run.id,
      workflowName: run.workflow?.name || 'Unknown',
      status: run.status,
      startTime: run.startTime.toISOString(),
      endTime: run.endTime?.toISOString(),
      duration,
      cost: this.extractCost(run),
      triggeredBy: run.triggeredBy,
      context: run.context,
    };
  }
}
