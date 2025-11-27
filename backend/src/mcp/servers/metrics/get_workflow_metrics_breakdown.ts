/**
 * Get Team Metrics Breakdown Tool
 * Aggregated metrics across all components in a team run with grouping options
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';

export const tool: Tool = {
  name: 'get_team_metrics_breakdown',
  description:
    'Get aggregated metrics across all components in a team run. Supports grouping by component, tool usage, or time slices.',
  inputSchema: {
    type: 'object',
    properties: {
      teamRunId: {
        type: 'string',
        description: 'Team run ID (UUID)',
      },
      groupBy: {
        type: 'string',
        enum: ['component', 'tool', 'status'],
        description: 'Group metrics by component, tool usage, or status (default: component)',
      },
      includeTimeline: {
        type: 'boolean',
        description: 'Include execution timeline (default: false)',
      },
    },
    required: ['teamRunId'],
  },
};

export const metadata = {
  category: 'metrics',
  domain: 'Agent Performance',
  tags: ['team', 'metrics', 'aggregation', 'breakdown', 'ST-27'],
  version: '1.0.0',
  since: '2025-11-17',
};

interface ToolBreakdownEntry {
  calls: number;
  errors: number;
  avgDuration: number;
  totalDuration: number;
}

interface CostBreakdownEntry {
  input: number;
  output: number;
  cache: number;
  total: number;
}

export async function handler(prisma: PrismaClient, params: any) {
  if (!params.workflowRunId) {
    throw new Error('workflowRunId is required');
  }

  const groupBy = params.groupBy || 'component';
  const includeTimeline = params.includeTimeline === true;

  const workflowRun = await prisma.workflowRun.findUnique({
    where: { id: params.workflowRunId },
    include: {
      workflow: {
        select: {
          id: true,
          name: true,
        },
      },
      story: {
        select: {
          key: true,
          title: true,
        },
      },
      componentRuns: {
        orderBy: { executionOrder: 'asc' },
        include: {
          component: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  });

  if (!workflowRun) {
    throw new Error(`Workflow run with ID ${params.workflowRunId} not found`);
  }

  // Calculate overall metrics
  const overallMetrics = {
    totalComponents: workflowRun.componentRuns.length,
    completedComponents: workflowRun.componentRuns.filter((cr) => cr.status === 'completed').length,
    failedComponents: workflowRun.componentRuns.filter((cr) => cr.status === 'failed').length,
    totalTokens: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCacheRead: 0,
    totalCacheWrite: 0,
    totalCacheHits: 0,
    totalCacheMisses: 0,
    avgCacheHitRate: 0,
    totalCost: 0,
    totalDurationSeconds: 0,
    totalLinesAdded: 0,
    totalLinesDeleted: 0,
    totalLinesModified: 0,
    avgTokensPerSecond: 0,
    avgTimeToFirstToken: 0,
  };

  // Aggregate tool usage across all components
  const aggregatedTools: Record<string, ToolBreakdownEntry> = {};

  // Aggregate cost breakdown
  const aggregatedCost: CostBreakdownEntry = {
    input: 0,
    output: 0,
    cache: 0,
    total: 0,
  };

  // Process each component run
  const componentBreakdown: any[] = [];
  const timeline: any[] = [];

  // ST-110: cacheHitRateSum removed - cache metrics no longer tracked
  let tokensPerSecondSum = 0;
  let timeToFirstTokenSum = 0;
  const metricsCount = 0;

  for (const cr of workflowRun.componentRuns) {
    // Token aggregation (ST-110: Cache metrics removed)
    overallMetrics.totalTokens += cr.totalTokens || 0;
    overallMetrics.totalInputTokens += cr.tokensInput || 0;
    overallMetrics.totalOutputTokens += cr.tokensOutput || 0;
    // ST-110: Cache metrics removed - now using /context command

    // Cost aggregation
    overallMetrics.totalCost += cr.cost || 0;
    if (cr.costBreakdown) {
      const cost = cr.costBreakdown as unknown as CostBreakdownEntry;
      aggregatedCost.input += cost.input || 0;
      aggregatedCost.output += cost.output || 0;
      aggregatedCost.cache += cost.cache || 0;
      aggregatedCost.total += cost.total || 0;
    }

    // Duration
    overallMetrics.totalDurationSeconds += cr.durationSeconds || 0;

    // Code impact
    overallMetrics.totalLinesAdded += cr.linesAdded || 0;
    overallMetrics.totalLinesDeleted += cr.linesDeleted || 0;
    overallMetrics.totalLinesModified += cr.linesModified || 0;

    // Throughput
    if (cr.tokensPerSecond) {
      tokensPerSecondSum += cr.tokensPerSecond;
    }
    if (cr.timeToFirstToken) {
      timeToFirstTokenSum += cr.timeToFirstToken;
    }

    // Tool breakdown aggregation
    if (cr.toolBreakdown) {
      const tools = cr.toolBreakdown as unknown as Record<string, ToolBreakdownEntry>;
      for (const [toolName, stats] of Object.entries(tools)) {
        if (!aggregatedTools[toolName]) {
          aggregatedTools[toolName] = { calls: 0, errors: 0, avgDuration: 0, totalDuration: 0 };
        }
        aggregatedTools[toolName].calls += stats.calls;
        aggregatedTools[toolName].errors += stats.errors;
        aggregatedTools[toolName].totalDuration += stats.totalDuration || 0;
      }
    }

    // Component breakdown
    if (groupBy === 'component') {
      componentBreakdown.push({
        componentId: cr.componentId,
        componentName: cr.component.name,
        status: cr.status,
        tokens: cr.totalTokens || 0,
        cost: cr.cost || 0,
        durationSeconds: cr.durationSeconds || 0,
        // ST-110: cacheHitRate removed - now using /context command
        linesChanged:
          (cr.linesAdded || 0) + (cr.linesDeleted || 0) + (cr.linesModified || 0),
        tokensPerSecond: cr.tokensPerSecond || 0,
      });
    }

    // Timeline
    if (includeTimeline && cr.startedAt) {
      timeline.push({
        componentName: cr.component.name,
        status: cr.status,
        startedAt: cr.startedAt.toISOString(),
        finishedAt: cr.finishedAt?.toISOString(),
        durationSeconds: cr.durationSeconds || 0,
      });
    }
  }

  // Calculate averages (ST-110: avgCacheHitRate removed)
  overallMetrics.avgCacheHitRate = 0;
  overallMetrics.avgTokensPerSecond =
    metricsCount > 0 ? tokensPerSecondSum / metricsCount : 0;
  overallMetrics.avgTimeToFirstToken =
    metricsCount > 0 ? timeToFirstTokenSum / metricsCount : 0;

  // Calculate average tool durations
  for (const [toolName, stats] of Object.entries(aggregatedTools)) {
    stats.avgDuration = stats.calls > 0 ? stats.totalDuration / stats.calls : 0;
  }

  const response: any = {
    workflowRunId: params.workflowRunId,
    workflowName: workflowRun.workflow.name,
    storyKey: workflowRun.story?.key,
    storyTitle: workflowRun.story?.title,
    status: workflowRun.status,
    startedAt: workflowRun.startedAt?.toISOString(),
    completedAt: (workflowRun as any).completedAt?.toISOString(),

    // Overall metrics
    overall: overallMetrics,

    // Cost breakdown
    costBreakdown: aggregatedCost,

    // ST-110: Cache performance removed - now using /context command for token tracking
    cachePerformance: {
      totalHits: 0,
      totalMisses: 0,
      avgHitRate: 0,
      tokensSaved: 0,
      cacheEfficiency: 0,
    },

    // Code impact summary
    codeImpact: {
      totalLinesAdded: overallMetrics.totalLinesAdded,
      totalLinesDeleted: overallMetrics.totalLinesDeleted,
      totalLinesModified: overallMetrics.totalLinesModified,
      netLinesChanged:
        overallMetrics.totalLinesAdded -
        overallMetrics.totalLinesDeleted +
        overallMetrics.totalLinesModified,
    },
  };

  // Add grouped data based on groupBy parameter
  if (groupBy === 'component') {
    response.breakdown = componentBreakdown;
  } else if (groupBy === 'tool') {
    response.breakdown = Object.entries(aggregatedTools).map(([name, stats]) => ({
      toolName: name,
      ...stats,
    }));
  } else if (groupBy === 'status') {
    response.breakdown = {
      completed: workflowRun.componentRuns.filter((cr) => cr.status === 'completed').length,
      failed: workflowRun.componentRuns.filter((cr) => cr.status === 'failed').length,
      running: workflowRun.componentRuns.filter((cr) => cr.status === 'running').length,
      pending: workflowRun.componentRuns.filter((cr) => cr.status === 'pending').length,
    };
  }

  if (includeTimeline) {
    response.timeline = timeline;
  }

  return response;
}

function calculateWorkflowCacheEfficiency(
  hits: number,
  misses: number,
  tokensSaved: number,
): number {
  const total = hits + misses;
  if (total === 0) return 0;
  const hitRate = hits / total;
  const savingsBonus = Math.min(tokensSaved / 50000, 0.3); // Up to 30% bonus for tokens saved
  return Math.min((hitRate + savingsBonus) * 100, 100);
}
