import { PrismaClient, ComponentRun, WorkflowRun, Story, Epic } from '@prisma/client';
import { Logger } from '../utils/logger';

// ST-110: Updated token interface to use /context command breakdown
interface ComponentMetrics {
  componentId: string;
  componentName: string;
  duration: number;
  tokens: {
    input: number;
    output: number;
    // ST-110: New token breakdown from /context command
    systemPrompt: number;
    systemTools: number;
    mcpTools: number;
    memoryFiles: number;
    messages: number;
    total: number;
  };
  cost: number;
  codeImpact: {
    filesModified: number;
    linesAdded: number;
    linesDeleted: number;
    netLinesChanged: number;
  };
  interactions: {
    userPrompts: number;
    systemIterations: number;
    humanInterventions: number;
  };
  efficiency: {
    tokensPerSecond: number;
    costPerToken: number;
    linesPerToken: number;
  };
}

interface WorkflowMetrics {
  workflowRunId: string;
  storyId?: string;
  totalDuration: number;
  totalTokens: number;
  totalCost: number;
  componentsCompleted: number;
  componentsFailed: number;
  successRate: number;
  codeImpact: {
    totalFilesModified: number;
    totalLinesAdded: number;
    totalLinesDeleted: number;
    netLinesChanged: number;
  };
  componentBreakdown: Array<{
    componentId: string;
    componentName?: string;
    status: string;
    tokens: number;
    cost: number;
    duration: number;
  }>;
}

interface StoryMetrics {
  storyId: string;
  storyKey: string;
  totalRuns: number;
  totalTokens: number;
  totalCost: number;
  averageCostPerRun: number;
  mostEfficientRun: {
    runId: string;
    cost: number;
    tokens: number;
  };
  mostExpensiveRun: {
    runId: string;
    cost: number;
    tokens: number;
  };
  trends: {
    costTrend: 'increasing' | 'decreasing' | 'stable';
    efficiencyTrend: 'increasing' | 'decreasing' | 'stable';
  };
}

interface EpicMetrics {
  epicId: string;
  epicKey: string;
  totalStories: number;
  storiesWithRuns: number;
  totalTokens: number;
  totalCost: number;
  budget: number | null;
  budgetUtilization: number | null;
  storyBreakdown: Array<{
    storyKey: string;
    totalRuns: number;
    totalCost: number;
    totalTokens: number;
  }>;
  projectedCost: number;
  costByComponent: Record<string, number>;
}

interface TrendsOptions {
  window: string; // '24h', '7d', '30d', '12w'
  groupBy: 'hour' | 'day' | 'week';
}

/**
 * Service for aggregating metrics at multiple levels
 * Provides rollup calculations for components, workflows, stories, and epics
 */
export class MetricsAggregationService {
  private readonly logger = new Logger('MetricsAggregationService');

  // Claude model pricing (per 1M tokens)
  private readonly modelPricing = {
    'claude-3-opus-20240229': { input: 15.00, output: 75.00 },
    'claude-3-sonnet-20240229': { input: 3.00, output: 15.00 },
    'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
    'claude-3-5-sonnet-20241022': { input: 3.00, output: 15.00 }
  };

  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Aggregate metrics for a single component run
   */
  async aggregateComponentMetrics(componentRunId: string): Promise<ComponentMetrics> {
    const componentRun = await this.prisma.componentRun.findUnique({
      where: { id: componentRunId },
      include: { component: true }
    });

    if (!componentRun) {
      throw new Error(`Component run ${componentRunId} not found`);
    }

    const duration = componentRun.durationSeconds ||
      (componentRun.finishedAt && componentRun.startedAt
        ? Math.floor((componentRun.finishedAt.getTime() - componentRun.startedAt.getTime()) / 1000)
        : 0);

    // Total tokens = input + output only (per Anthropic API semantics)
    // Note: tokensInput already includes cache_read + cache_creation + uncached input
    // Adding tokensCacheRead/Write separately would double-count cached tokens
    // See: https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching
    const totalTokens = (componentRun.tokensInput || 0) + (componentRun.tokensOutput || 0);

    const netLinesChanged = (componentRun.linesAdded || 0) - (componentRun.linesDeleted || 0);

    return {
      componentId: componentRun.componentId,
      componentName: componentRun.component.name,
      duration,
      tokens: {
        input: componentRun.tokensInput || 0,
        output: componentRun.tokensOutput || 0,
        // ST-110: Cache metrics removed - now using /context command
        // New token breakdown fields from /context
        systemPrompt: componentRun.tokensSystemPrompt || 0,
        systemTools: componentRun.tokensSystemTools || 0,
        mcpTools: componentRun.tokensMcpTools || 0,
        memoryFiles: componentRun.tokensMemoryFiles || 0,
        messages: componentRun.tokensMessages || 0,
        total: totalTokens
      },
      cost: componentRun.cost || 0,
      codeImpact: {
        filesModified: componentRun.filesModified?.length || 0,
        linesAdded: componentRun.linesAdded || 0,
        linesDeleted: componentRun.linesDeleted || 0,
        netLinesChanged
      },
      interactions: {
        userPrompts: componentRun.userPrompts || 0,
        systemIterations: componentRun.systemIterations || 0,
        humanInterventions: componentRun.humanInterventions || 0
      },
      efficiency: {
        tokensPerSecond: duration > 0 ? totalTokens / duration : 0,
        costPerToken: totalTokens > 0 ? (componentRun.cost || 0) / totalTokens : 0,
        linesPerToken: totalTokens > 0 ? netLinesChanged / totalTokens : 0
      }
    };
  }

  /**
   * Aggregate metrics across all components in a workflow
   */
  async aggregateWorkflowMetrics(workflowRunId: string): Promise<WorkflowMetrics> {
    const workflowRun = await this.prisma.workflowRun.findUnique({
      where: { id: workflowRunId },
      include: {
        componentRuns: {
          include: { component: true }
        }
      }
    });

    if (!workflowRun) {
      throw new Error(`Workflow run ${workflowRunId} not found`);
    }

    const componentBreakdown = workflowRun.componentRuns.map(cr => ({
      componentId: cr.componentId,
      componentName: cr.component?.name,
      status: cr.status,
      tokens: (cr.tokensInput || 0) + (cr.tokensOutput || 0), // Cache tokens tracked separately, not added to total
      cost: cr.cost || 0,
      duration: cr.durationSeconds || 0
    }));

    const totalDuration = componentBreakdown.reduce((sum, c) => sum + c.duration, 0);
    const totalTokens = componentBreakdown.reduce((sum, c) => sum + c.tokens, 0);
    const totalCost = componentBreakdown.reduce((sum, c) => sum + c.cost, 0);

    const componentsCompleted = workflowRun.componentRuns.filter(
      cr => cr.status === 'completed'
    ).length;

    const componentsFailed = workflowRun.componentRuns.filter(
      cr => cr.status === 'failed'
    ).length;

    // Aggregate unique files modified
    const allFilesModified = new Set<string>();
    let totalLinesAdded = 0;
    let totalLinesDeleted = 0;

    workflowRun.componentRuns.forEach(cr => {
      cr.filesModified?.forEach(file => allFilesModified.add(file));
      totalLinesAdded += cr.linesAdded || 0;
      totalLinesDeleted += cr.linesDeleted || 0;
    });

    return {
      workflowRunId,
      storyId: workflowRun.storyId || undefined,
      totalDuration,
      totalTokens,
      totalCost,
      componentsCompleted,
      componentsFailed,
      successRate: workflowRun.componentRuns.length > 0
        ? componentsCompleted / workflowRun.componentRuns.length
        : 0,
      codeImpact: {
        totalFilesModified: allFilesModified.size,
        totalLinesAdded,
        totalLinesDeleted,
        netLinesChanged: totalLinesAdded - totalLinesDeleted
      },
      componentBreakdown
    };
  }

  /**
   * Aggregate metrics across all workflow runs for a story
   */
  async aggregateStoryMetrics(storyId: string): Promise<StoryMetrics> {
    const story = await this.prisma.story.findUnique({
      where: { id: storyId },
      include: {
        workflowRuns: {
          include: {
            componentRuns: true
          }
        }
      }
    });

    if (!story) {
      throw new Error(`Story ${storyId} not found`);
    }

    const runMetrics = await Promise.all(
      story.workflowRuns.map(wr => this.aggregateWorkflowMetrics(wr.id))
    );

    const totalTokens = runMetrics.reduce((sum, rm) => sum + rm.totalTokens, 0);
    const totalCost = runMetrics.reduce((sum, rm) => sum + rm.totalCost, 0);

    // Find most efficient and expensive runs
    const sortedByCost = [...runMetrics].sort((a, b) => a.totalCost - b.totalCost);
    const mostEfficient = sortedByCost[0];
    const mostExpensive = sortedByCost[sortedByCost.length - 1];

    // Calculate trends
    const costTrend = this.calculateTrend(
      runMetrics.map(rm => ({ value: rm.totalCost, timestamp: new Date() }))
    );

    const efficiencyTrend = this.calculateTrend(
      runMetrics.map(rm => ({
        value: rm.totalTokens > 0 ? rm.totalCost / rm.totalTokens : 0,
        timestamp: new Date()
      }))
    );

    return {
      storyId,
      storyKey: story.key,
      totalRuns: story.workflowRuns.length,
      totalTokens,
      totalCost,
      averageCostPerRun: story.workflowRuns.length > 0
        ? totalCost / story.workflowRuns.length
        : 0,
      mostEfficientRun: mostEfficient ? {
        runId: mostEfficient.workflowRunId,
        cost: mostEfficient.totalCost,
        tokens: mostEfficient.totalTokens
      } : { runId: '', cost: 0, tokens: 0 },
      mostExpensiveRun: mostExpensive ? {
        runId: mostExpensive.workflowRunId,
        cost: mostExpensive.totalCost,
        tokens: mostExpensive.totalTokens
      } : { runId: '', cost: 0, tokens: 0 },
      trends: {
        costTrend,
        efficiencyTrend
      }
    };
  }

  /**
   * Aggregate metrics across all stories in an epic
   */
  async aggregateEpicMetrics(epicId: string): Promise<EpicMetrics> {
    const epic = await this.prisma.epic.findUnique({
      where: { id: epicId },
      include: {
        stories: {
          include: {
            workflowRuns: {
              include: {
                componentRuns: {
                  include: { component: true }
                }
              }
            }
          }
        }
      }
    });

    if (!epic) {
      throw new Error(`Epic ${epicId} not found`);
    }

    const storyBreakdown: Array<{
      storyKey: string;
      totalRuns: number;
      totalCost: number;
      totalTokens: number;
    }> = [];

    let totalTokens = 0;
    let totalCost = 0;
    const costByComponent: Record<string, number> = {};

    for (const story of epic.stories) {
      let storyTokens = 0;
      let storyCost = 0;

      for (const run of story.workflowRuns) {
        for (const cr of run.componentRuns) {
          // Cache tokens tracked separately, not added to total
          const tokens = (cr.tokensInput || 0) + (cr.tokensOutput || 0);
          const cost = cr.cost || 0;

          storyTokens += tokens;
          storyCost += cost;
          totalTokens += tokens;
          totalCost += cost;

          // Track cost by component type
          const componentName = cr.component.name;
          costByComponent[componentName] = (costByComponent[componentName] || 0) + cost;
        }
      }

      if (story.workflowRuns.length > 0) {
        storyBreakdown.push({
          storyKey: story.key,
          totalRuns: story.workflowRuns.length,
          totalCost: storyCost,
          totalTokens: storyTokens
        });
      }
    }

    const storiesWithRuns = storyBreakdown.length;
    const storiesWithoutRuns = epic.stories.length - storiesWithRuns;

    // Project cost for remaining stories (average cost per story * remaining stories)
    const avgCostPerStory = storiesWithRuns > 0 ? totalCost / storiesWithRuns : 0;
    const projectedCost = totalCost + (avgCostPerStory * storiesWithoutRuns);

    // Budget calculation (would need to be stored in Epic model)
    const budget = null; // TODO: Add budget field to Epic model
    const budgetUtilization = budget ? (totalCost / budget) * 100 : null;

    return {
      epicId,
      epicKey: epic.key,
      totalStories: epic.stories.length,
      storiesWithRuns,
      totalTokens,
      totalCost,
      budget,
      budgetUtilization,
      storyBreakdown,
      projectedCost,
      costByComponent
    };
  }

  /**
   * Calculate cost from token counts and model
   */
  calculateCostFromTokens(
    model: string,
    tokensInput: number,
    tokensOutput: number,
    tokensCacheRead: number = 0
  ): number {
    const pricing = this.modelPricing[model as keyof typeof this.modelPricing] ||
                   this.modelPricing['claude-3-opus-20240229'];

    // Cache reads are typically 10% of input cost
    const cacheReadCost = pricing.input * 0.1;

    const inputCost = (tokensInput / 1000000) * pricing.input;
    const outputCost = (tokensOutput / 1000000) * pricing.output;
    const cacheCost = (tokensCacheRead / 1000000) * cacheReadCost;

    return inputCost + outputCost + cacheCost;
  }

  /**
   * Get metrics trends over time windows
   */
  async getMetricsTrends(projectId: string, options: TrendsOptions) {
    const endDate = new Date();
    const startDate = this.getStartDate(options.window);

    const workflowRuns = await this.prisma.workflowRun.findMany({
      where: {
        projectId,
        startedAt: {
          gte: startDate,
          lte: endDate
        }
      },
      include: {
        componentRuns: true
      },
      orderBy: { startedAt: 'asc' }
    });

    const dataPoints = this.groupByTimeWindow(workflowRuns, options.groupBy);

    const totalTokens = dataPoints.reduce((sum, dp) => sum + dp.tokens, 0);
    const totalCost = dataPoints.reduce((sum, dp) => sum + dp.cost, 0);
    const averageDailyCost = totalCost / dataPoints.length;

    const peakDay = dataPoints.reduce((peak, dp) =>
      dp.cost > peak.cost ? dp : peak,
      dataPoints[0] || { date: '', cost: 0, tokens: 0 }
    );

    const trend = this.calculateTrend(
      dataPoints.map(dp => ({ value: dp.cost, timestamp: new Date(dp.date) }))
    );

    return {
      period: options.window,
      dataPoints,
      summary: {
        totalTokens,
        totalCost,
        averageDailyCost,
        peakDay: peakDay.date,
        trend
      }
    };
  }

  // Private helper methods

  private calculateTrend(
    dataPoints: Array<{ value: number; timestamp: Date }>
  ): 'increasing' | 'decreasing' | 'stable' {
    if (dataPoints.length < 2) return 'stable';

    // Simple linear regression
    const n = dataPoints.length;
    const x = dataPoints.map((_, i) => i);
    const y = dataPoints.map(dp => dp.value);

    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

    // Threshold for considering trend stable
    const threshold = 0.01 * (Math.max(...y) - Math.min(...y));

    if (Math.abs(slope) < threshold) return 'stable';
    return slope > 0 ? 'increasing' : 'decreasing';
  }

  private getStartDate(window: string): Date {
    const now = new Date();
    const match = window.match(/(\d+)([hdw])/);
    if (!match) return now;

    const [, amount, unit] = match;
    const value = parseInt(amount);

    switch (unit) {
      case 'h':
        return new Date(now.getTime() - value * 60 * 60 * 1000);
      case 'd':
        return new Date(now.getTime() - value * 24 * 60 * 60 * 1000);
      case 'w':
        return new Date(now.getTime() - value * 7 * 24 * 60 * 60 * 1000);
      default:
        return now;
    }
  }

  private groupByTimeWindow(
    runs: any[],
    groupBy: 'hour' | 'day' | 'week'
  ) {
    const groups: Record<string, { tokens: number; cost: number }> = {};

    runs.forEach(run => {
      const date = this.getGroupKey(run.startedAt, groupBy);
      if (!groups[date]) {
        groups[date] = { tokens: 0, cost: 0 };
      }

      run.componentRuns.forEach((cr: ComponentRun) => {
        // Cache tokens tracked separately, not added to total
        groups[date].tokens += (cr.tokensInput || 0) + (cr.tokensOutput || 0);
        groups[date].cost += cr.cost || 0;
      });
    });

    return Object.entries(groups).map(([date, metrics]) => ({
      date,
      ...metrics
    }));
  }

  private getGroupKey(date: Date, groupBy: 'hour' | 'day' | 'week'): string {
    const d = new Date(date);

    switch (groupBy) {
      case 'hour':
        return `${d.toISOString().slice(0, 13)}:00`;
      case 'day':
        return d.toISOString().slice(0, 10);
      case 'week': {
        // Get week number
        const firstDayOfYear = new Date(d.getFullYear(), 0, 1);
        const pastDaysOfYear = (d.getTime() - firstDayOfYear.getTime()) / 86400000;
        const weekNumber = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
        return `${d.getFullYear()}-W${weekNumber.toString().padStart(2, '0')}`;
      }
      default:
        return d.toISOString().slice(0, 10);
    }
  }
}
