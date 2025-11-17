import { Injectable } from '@nestjs/common';
import { RunStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  AggregatedMetricsDto,
  WorkflowMetricsDto,
  ComponentMetricsDto,
  TrendsResponseDto,
  TrendDataPointDto,
  WorkflowComparisonResponseDto,
  WeeklyAggregationDto,
} from './dto/aggregated-metrics.dto';
import { MetricsQueryDto, TimeGranularity, WorkflowComparisonDto } from './dto/metrics-query.dto';

@Injectable()
export class MetricsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get aggregated workflow performance metrics
   */
  async getWorkflowMetrics(
    projectId: string,
    query: MetricsQueryDto,
  ): Promise<WorkflowMetricsDto[]> {
    const { workflowId, startDate, endDate, businessComplexity, technicalComplexity } = query;

    // Build where clause
    const where: any = {
      projectId,
      status: RunStatus.completed,
    };

    if (workflowId) {
      where.workflowId = workflowId;
    }

    if (startDate || endDate) {
      where.startedAt = {};
      if (startDate) where.startedAt.gte = new Date(startDate);
      if (endDate) where.startedAt.lte = new Date(endDate);
    }

    // Add complexity filters (filter by stories with matching complexity)
    if (businessComplexity !== undefined || technicalComplexity !== undefined) {
      where.story = {};
      if (businessComplexity !== undefined) {
        where.story.businessComplexity = businessComplexity;
      }
      if (technicalComplexity !== undefined) {
        where.story.technicalComplexity = technicalComplexity;
      }
    }

    // Fetch workflow runs with workflow details
    const runs = await this.prisma.workflowRun.findMany({
      where,
      include: {
        workflow: true,
      },
    });

    // Group by workflow
    const workflowGroups = this.groupByWorkflow(runs);

    // Calculate metrics for each workflow
    const workflowMetrics: WorkflowMetricsDto[] = [];
    for (const [wfId, wfRuns] of Object.entries(workflowGroups)) {
      const workflow = wfRuns[0].workflow;
      const metrics = await this.calculateAggregatedMetrics(wfRuns, query);

      workflowMetrics.push({
        workflowId: wfId,
        workflowName: workflow?.name || 'Unknown',
        workflowVersion: workflow?.version,
        ...metrics,
      });
    }

    return workflowMetrics;
  }

  /**
   * Get aggregated component performance metrics
   */
  async getComponentMetrics(
    projectId: string,
    query: MetricsQueryDto,
  ): Promise<ComponentMetricsDto[]> {
    const { componentId, startDate, endDate, businessComplexity, technicalComplexity } = query;

    // Build where clause for workflow runs
    const workflowRunWhere: any = {
      projectId,
      status: RunStatus.completed,
    };

    if (startDate || endDate) {
      workflowRunWhere.startedAt = {};
      if (startDate) workflowRunWhere.startedAt.gte = new Date(startDate);
      if (endDate) workflowRunWhere.startedAt.lte = new Date(endDate);
    }

    // Add complexity filters (filter by stories with matching complexity)
    if (businessComplexity !== undefined || technicalComplexity !== undefined) {
      workflowRunWhere.story = {};
      if (businessComplexity !== undefined) {
        workflowRunWhere.story.businessComplexity = businessComplexity;
      }
      if (technicalComplexity !== undefined) {
        workflowRunWhere.story.technicalComplexity = technicalComplexity;
      }
    }

    // Get completed workflow runs
    const workflowRuns = await this.prisma.workflowRun.findMany({
      where: workflowRunWhere,
      select: { id: true },
    });

    const workflowRunIds = workflowRuns.map((wr) => wr.id);

    if (workflowRunIds.length === 0) {
      return [];
    }

    // Build where clause for component runs
    const componentRunWhere: any = {
      workflowRunId: { in: workflowRunIds },
    };

    if (componentId) {
      componentRunWhere.componentId = componentId;
    }

    // Fetch component runs
    const componentRuns = await this.prisma.componentRun.findMany({
      where: componentRunWhere,
      include: {
        component: true,
      },
    });

    // Group by component
    const componentGroups = this.groupByComponent(componentRuns);

    // Calculate metrics for each component
    const componentMetrics: ComponentMetricsDto[] = [];
    for (const [compId, compRuns] of Object.entries(componentGroups)) {
      const component = compRuns[0].component;
      const metrics = this.calculateComponentMetrics(compRuns, query);

      componentMetrics.push({
        componentId: compId,
        componentName: component?.name || 'Unknown',
        avgRunsPerWorkflow: compRuns.length / workflowRunIds.length,
        ...metrics,
      });
    }

    return componentMetrics;
  }

  /**
   * Get trends over time for specific metrics
   */
  async getTrends(
    projectId: string,
    query: MetricsQueryDto,
  ): Promise<TrendsResponseDto[]> {
    const { workflowId, startDate, endDate, granularity = TimeGranularity.WEEKLY, businessComplexity, technicalComplexity } = query;

    // Build where clause
    const where: any = {
      projectId,
      status: RunStatus.completed,
    };

    if (workflowId) {
      where.workflowId = workflowId;
    }

    if (startDate || endDate) {
      where.startedAt = {};
      if (startDate) where.startedAt.gte = new Date(startDate);
      if (endDate) where.startedAt.lte = new Date(endDate);
    }

    // Add complexity filters (filter by stories with matching complexity)
    if (businessComplexity !== undefined || technicalComplexity !== undefined) {
      where.story = {};
      if (businessComplexity !== undefined) {
        where.story.businessComplexity = businessComplexity;
      }
      if (technicalComplexity !== undefined) {
        where.story.technicalComplexity = technicalComplexity;
      }
    }

    // Fetch workflow runs
    const runs = await this.prisma.workflowRun.findMany({
      where,
      orderBy: { startedAt: 'asc' },
    });

    // Group by time period
    const timePeriods = this.groupByTimePeriod(runs, granularity);

    // Calculate trends for key metrics
    const trends: TrendsResponseDto[] = [];

    // Tokens trend
    trends.push(this.calculateTrend(timePeriods, 'tokens', (runs) => {
      return runs.reduce((sum, r) => sum + (r.totalTokens || 0), 0) / runs.length;
    }));

    // LOC trend
    trends.push(this.calculateTrend(timePeriods, 'loc', (runs) => {
      return runs.reduce((sum, r) => sum + (r.totalLocGenerated || 0), 0) / runs.length;
    }));

    // Cost trend
    trends.push(this.calculateTrend(timePeriods, 'cost', (runs) => {
      return runs.reduce((sum, r) => sum + (r.estimatedCost || 0), 0) / runs.length;
    }));

    // Duration trend
    trends.push(this.calculateTrend(timePeriods, 'duration', (runs) => {
      return runs.reduce((sum, r) => sum + (r.durationSeconds || 0), 0) / runs.length;
    }));

    return trends;
  }

  /**
   * Compare two workflows
   */
  async compareWorkflows(
    projectId: string,
    comparison: WorkflowComparisonDto,
  ): Promise<WorkflowComparisonResponseDto> {
    const { workflow1Id, workflow2Id, startDate, endDate } = comparison;

    // Get metrics for both workflows
    const workflow1Metrics = await this.getWorkflowMetrics(projectId, {
      workflowId: workflow1Id,
      startDate,
      endDate,
    });

    const workflow2Metrics = await this.getWorkflowMetrics(projectId, {
      workflowId: workflow2Id,
      startDate,
      endDate,
    });

    if (workflow1Metrics.length === 0 || workflow2Metrics.length === 0) {
      throw new Error('One or both workflows have no data for the specified period');
    }

    const wf1 = workflow1Metrics[0];
    const wf2 = workflow2Metrics[0];

    // Calculate differences (percentage)
    const tokensDiff = this.calculatePercentDiff(wf1.avgTokens || 0, wf2.avgTokens || 0);
    const costDiff = this.calculatePercentDiff(wf1.avgCost || 0, wf2.avgCost || 0);
    const durationDiff = this.calculatePercentDiff(wf1.avgDuration || 0, wf2.avgDuration || 0);
    const locDiff = this.calculatePercentDiff(wf1.avgLocPerStory || 0, wf2.avgLocPerStory || 0);

    // Calculate efficiency score (lower is better for tokens, cost, duration)
    const wf1Efficiency = (wf1.avgTokensPerLoc || 0) + (wf1.avgRuntimePerLoc || 0);
    const wf2Efficiency = (wf2.avgTokensPerLoc || 0) + (wf2.avgRuntimePerLoc || 0);
    const efficiencyDiff = this.calculatePercentDiff(wf1Efficiency, wf2Efficiency);

    // Determine winner (lower cost, duration, tokens is better)
    let winner: 'workflow1' | 'workflow2' | 'tie' = 'tie';
    const score1 = (wf1.avgCost || 0) + (wf1.avgDuration || 0) / 100 + (wf1.avgTokens || 0) / 1000;
    const score2 = (wf2.avgCost || 0) + (wf2.avgDuration || 0) / 100 + (wf2.avgTokens || 0) / 1000;

    if (score1 < score2 * 0.95) winner = 'workflow1';
    else if (score2 < score1 * 0.95) winner = 'workflow2';

    return {
      workflow1: wf1,
      workflow2: wf2,
      comparison: {
        tokensDiff,
        costDiff,
        durationDiff,
        locDiff,
        efficiencyDiff,
        winner,
      },
    };
  }

  /**
   * Get weekly aggregations for the last N weeks
   */
  async getWeeklyAggregations(
    projectId: string,
    weeks: number = 8,
    query?: { businessComplexity?: number; technicalComplexity?: number },
  ): Promise<WeeklyAggregationDto[]> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - weeks * 7);

    // Build where clause
    const where: any = {
      projectId,
      status: RunStatus.completed,
      startedAt: {
        gte: startDate,
        lte: endDate,
      },
    };

    // Add complexity filters (filter by stories with matching complexity)
    if (query?.businessComplexity !== undefined || query?.technicalComplexity !== undefined) {
      where.story = {};
      if (query?.businessComplexity !== undefined) {
        where.story.businessComplexity = query.businessComplexity;
      }
      if (query?.technicalComplexity !== undefined) {
        where.story.technicalComplexity = query.technicalComplexity;
      }
    }

    // Fetch all workflow runs in the time range
    const runs = await this.prisma.workflowRun.findMany({
      where,
      include: {
        workflow: true,
        story: true,
      },
      orderBy: { startedAt: 'asc' },
    });

    // Group by week
    const weeklyGroups = this.groupByWeek(runs);

    // Calculate weekly aggregations
    const weeklyAggregations: WeeklyAggregationDto[] = [];
    for (const [weekKey, weekRuns] of Object.entries(weeklyGroups)) {
      const [year, week] = weekKey.split('-W').map(Number);
      const weekStart = this.getWeekStart(year, week);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

      // Group by workflow within the week
      const workflowGroups = this.groupByWorkflow(weekRuns);
      const workflowMetrics: WorkflowMetricsDto[] = [];

      for (const [wfId, wfRuns] of Object.entries(workflowGroups)) {
        const workflow = wfRuns[0].workflow;
        const metrics = await this.calculateAggregatedMetrics(wfRuns, {
          granularity: TimeGranularity.WEEKLY,
        });

        workflowMetrics.push({
          workflowId: wfId,
          workflowName: workflow?.name || 'Unknown',
          workflowVersion: workflow?.version,
          ...metrics,
        });
      }

      // Calculate aggregated metrics for the entire week
      const aggregated = await this.calculateAggregatedMetrics(weekRuns, {
        granularity: TimeGranularity.WEEKLY,
      });

      // Count unique stories completed
      const uniqueStories = new Set(weekRuns.map((r) => r.storyId).filter(Boolean));

      weeklyAggregations.push({
        weekNumber: week,
        year,
        weekStart: weekStart.toISOString(),
        weekEnd: weekEnd.toISOString(),
        storiesCompleted: uniqueStories.size,
        workflows: workflowMetrics,
        aggregated,
      });
    }

    return weeklyAggregations.sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.weekNumber - a.weekNumber;
    });
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private groupByWorkflow(runs: any[]): Record<string, any[]> {
    return runs.reduce((acc, run) => {
      const wfId = run.workflowId;
      if (!acc[wfId]) acc[wfId] = [];
      acc[wfId].push(run);
      return acc;
    }, {});
  }

  private groupByComponent(runs: any[]): Record<string, any[]> {
    return runs.reduce((acc, run) => {
      const compId = run.componentId;
      if (!acc[compId]) acc[compId] = [];
      acc[compId].push(run);
      return acc;
    }, {});
  }

  private groupByTimePeriod(runs: any[], granularity: TimeGranularity): Record<string, any[]> {
    return runs.reduce((acc, run) => {
      const date = new Date(run.startedAt);
      let key: string;

      switch (granularity) {
        case TimeGranularity.DAILY:
          key = date.toISOString().split('T')[0];
          break;
        case TimeGranularity.WEEKLY:
          const weekNumber = this.getWeekNumber(date);
          key = `${date.getFullYear()}-W${weekNumber}`;
          break;
        case TimeGranularity.MONTHLY:
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          break;
        default:
          key = date.toISOString().split('T')[0];
      }

      if (!acc[key]) acc[key] = [];
      acc[key].push(run);
      return acc;
    }, {});
  }

  private groupByWeek(runs: any[]): Record<string, any[]> {
    return runs.reduce((acc, run) => {
      const date = new Date(run.startedAt);
      const weekNumber = this.getWeekNumber(date);
      const key = `${date.getFullYear()}-W${weekNumber}`;

      if (!acc[key]) acc[key] = [];
      acc[key].push(run);
      return acc;
    }, {});
  }

  private async calculateAggregatedMetrics(runs: any[], query: MetricsQueryDto): Promise<AggregatedMetricsDto> {
    const totalRuns = runs.length;
    const successfulRuns = runs.filter((r) => r.status === RunStatus.completed).length;
    const failedRuns = runs.filter((r) => r.status === RunStatus.failed).length;

    // Time metrics
    const durations = runs.map((r) => r.durationSeconds || 0).filter((d) => d > 0);
    const avgDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : undefined;
    const totalDuration = durations.reduce((a, b) => a + b, 0);
    const minDuration = durations.length > 0 ? Math.min(...durations) : undefined;
    const maxDuration = durations.length > 0 ? Math.max(...durations) : undefined;

    // Token metrics
    const tokens = runs.map((r) => r.totalTokens || 0).filter((t) => t > 0);
    const avgTokens = tokens.length > 0 ? tokens.reduce((a, b) => a + b, 0) / tokens.length : undefined;
    const totalTokens = tokens.reduce((a, b) => a + b, 0);

    const tokensInput = runs.map((r) => r.totalTokensInput || 0).filter((t) => t > 0);
    const avgTokensInput = tokensInput.length > 0 ? tokensInput.reduce((a, b) => a + b, 0) / tokensInput.length : undefined;

    const tokensOutput = runs.map((r) => r.totalTokensOutput || 0).filter((t) => t > 0);
    const avgTokensOutput = tokensOutput.length > 0 ? tokensOutput.reduce((a, b) => a + b, 0) / tokensOutput.length : undefined;

    // Code metrics
    const locs = runs.map((r) => r.totalLocGenerated || 0).filter((l) => l > 0);
    const totalLoc = locs.reduce((a, b) => a + b, 0);
    const avgLocPerStory = locs.length > 0 ? totalLoc / locs.length : undefined;

    // Calculate tests added for stories in these runs
    const testsAdded = await this.calculateTestsAdded(runs);

    // Efficiency metrics
    const avgTokensPerLoc = totalLoc > 0 && totalTokens > 0 ? totalTokens / totalLoc : undefined;
    const avgRuntimePerLoc = totalLoc > 0 && totalDuration > 0 ? totalDuration / totalLoc : undefined;

    const prompts = runs.map((r) => r.totalUserPrompts || 0).filter((p) => p > 0);
    const avgPromptsPerRun = prompts.length > 0 ? prompts.reduce((a, b) => a + b, 0) / prompts.length : undefined;
    const avgLocPerPrompt = totalLoc > 0 && prompts.length > 0 ? totalLoc / prompts.reduce((a, b) => a + b, 0) : undefined;

    const iterations = runs.map((r) => r.totalIterations || 0).filter((i) => i > 0);
    const avgIterationsPerRun = iterations.length > 0 ? iterations.reduce((a, b) => a + b, 0) / iterations.length : undefined;

    const runtimePerToken = totalTokens > 0 && totalDuration > 0 ? totalDuration / totalTokens : undefined;

    // Cost metrics
    const costs = runs.map((r) => r.estimatedCost || 0).filter((c) => c > 0);
    const avgCost = costs.length > 0 ? costs.reduce((a, b) => a + b, 0) / costs.length : undefined;
    const totalCost = costs.reduce((a, b) => a + b, 0);

    // Determine period
    const dates = runs.map((r) => new Date(r.startedAt));
    const periodStart = dates.length > 0 ? new Date(Math.min(...dates.map((d) => d.getTime()))).toISOString() : new Date().toISOString();
    const periodEnd = dates.length > 0 ? new Date(Math.max(...dates.map((d) => d.getTime()))).toISOString() : new Date().toISOString();

    return {
      periodStart,
      periodEnd,
      granularity: query.granularity || 'ALL',
      totalRuns,
      successfulRuns,
      failedRuns,
      successRate: totalRuns > 0 ? (successfulRuns / totalRuns) * 100 : 0,
      avgDuration,
      totalDuration,
      minDuration,
      maxDuration,
      avgTokens,
      totalTokens,
      avgTokensInput,
      avgTokensOutput,
      avgTokensPerLoc,
      totalLoc,
      avgLocPerStory,
      avgLocPerPrompt,
      testsAdded,
      avgRuntimePerLoc,
      avgRuntimePerToken: runtimePerToken,
      avgPromptsPerRun,
      avgIterationsPerRun,
      avgCost,
      totalCost,
    };
  }

  /**
   * Calculate the number of tests added for stories in workflow runs
   * Counts test cases created during the period covered by the workflow runs
   */
  private async calculateTestsAdded(runs: any[]): Promise<number | undefined> {
    if (runs.length === 0) return undefined;

    // Get unique story IDs from runs
    const storyIds = [...new Set(runs.map((r) => r.storyId).filter(Boolean))];

    if (storyIds.length === 0) return undefined;

    // Get the time range for these runs
    const startDates = runs.map((r) => new Date(r.startedAt));
    const minDate = new Date(Math.min(...startDates.map((d) => d.getTime())));
    const maxDate = new Date(Math.max(...startDates.map((d) => d.getTime())));

    // Count test cases created during this period for use cases linked to these stories
    const testCount = await this.prisma.testCase.count({
      where: {
        useCase: {
          storyLinks: {
            some: {
              storyId: { in: storyIds },
            },
          },
        },
        createdAt: {
          gte: minDate,
          lte: maxDate,
        },
      },
    });

    return testCount > 0 ? testCount : undefined;
  }

  private calculateComponentMetrics(runs: any[], query: MetricsQueryDto): AggregatedMetricsDto {
    // Similar to calculateAggregatedMetrics but for component runs
    const totalRuns = runs.length;
    const successfulRuns = runs.filter((r) => r.success).length;
    const failedRuns = runs.filter((r) => !r.success).length;

    const durations = runs.map((r) => r.durationSeconds || 0).filter((d) => d > 0);
    const avgDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : undefined;
    const totalDuration = durations.reduce((a, b) => a + b, 0);

    const tokens = runs.map((r) => r.totalTokens || 0).filter((t) => t > 0);
    const avgTokens = tokens.length > 0 ? tokens.reduce((a, b) => a + b, 0) / tokens.length : undefined;
    const totalTokens = tokens.reduce((a, b) => a + b, 0);

    const locs = runs.map((r) => r.locGenerated || 0).filter((l) => l > 0);
    const totalLoc = locs.reduce((a, b) => a + b, 0);

    const dates = runs.map((r) => new Date(r.startedAt));
    const periodStart = dates.length > 0 ? new Date(Math.min(...dates.map((d) => d.getTime()))).toISOString() : new Date().toISOString();
    const periodEnd = dates.length > 0 ? new Date(Math.max(...dates.map((d) => d.getTime()))).toISOString() : new Date().toISOString();

    return {
      periodStart,
      periodEnd,
      granularity: query.granularity || 'ALL',
      totalRuns,
      successfulRuns,
      failedRuns,
      successRate: totalRuns > 0 ? (successfulRuns / totalRuns) * 100 : 0,
      avgDuration,
      totalDuration,
      avgTokens,
      totalTokens,
      totalLoc,
      avgTokensPerLoc: totalLoc > 0 && totalTokens > 0 ? totalTokens / totalLoc : undefined,
      avgRuntimePerLoc: totalLoc > 0 && totalDuration > 0 ? totalDuration / totalLoc : undefined,
    };
  }

  private calculateTrend(
    timePeriods: Record<string, any[]>,
    metric: string,
    valueExtractor: (runs: any[]) => number,
  ): TrendsResponseDto {
    const dataPoints: TrendDataPointDto[] = [];

    for (const [date, runs] of Object.entries(timePeriods)) {
      const value = valueExtractor(runs);
      dataPoints.push({ date, value, metric });
    }

    // Sort by date
    dataPoints.sort((a, b) => a.date.localeCompare(b.date));

    // Calculate trend
    let trend: 'UP' | 'DOWN' | 'STABLE' = 'STABLE';
    let changePercent = 0;

    if (dataPoints.length >= 2) {
      const firstValue = dataPoints[0].value;
      const lastValue = dataPoints[dataPoints.length - 1].value;

      if (firstValue > 0) {
        changePercent = ((lastValue - firstValue) / firstValue) * 100;

        if (changePercent > 5) trend = 'UP';
        else if (changePercent < -5) trend = 'DOWN';
      }
    }

    return {
      metric,
      dataPoints,
      trend,
      changePercent,
    };
  }

  private calculatePercentDiff(value1: number, value2: number): number {
    if (value1 === 0) return value2 === 0 ? 0 : 100;
    return ((value2 - value1) / value1) * 100;
  }

  private getWeekNumber(date: Date): number {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  }

  private getWeekStart(year: number, week: number): Date {
    const jan1 = new Date(year, 0, 1);
    const daysToAdd = (week - 1) * 7 - jan1.getDay() + 1;
    const weekStart = new Date(year, 0, 1 + daysToAdd);
    return weekStart;
  }
}
