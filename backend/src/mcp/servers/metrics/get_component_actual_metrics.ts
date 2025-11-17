/**
 * Get Component Actual Metrics Tool
 * Retrieve actual execution metrics for a specific component run including
 * cache performance, cost breakdown, tool usage, and throughput metrics
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';

export const tool: Tool = {
  name: 'get_component_actual_metrics',
  description:
    'Retrieve actual execution metrics for a specific component run including cache performance, cost breakdown, tool usage, and throughput. Returns comprehensive ST-27 metrics.',
  inputSchema: {
    type: 'object',
    properties: {
      componentRunId: {
        type: 'string',
        description: 'Component run ID (UUID)',
      },
      includeToolBreakdown: {
        type: 'boolean',
        description: 'Include detailed tool usage breakdown (default: true)',
      },
      includeCostBreakdown: {
        type: 'boolean',
        description: 'Include detailed cost breakdown (default: true)',
      },
      includeCodeImpact: {
        type: 'boolean',
        description: 'Include code impact metrics (default: true)',
      },
    },
    required: ['componentRunId'],
  },
};

export const metadata = {
  category: 'metrics',
  domain: 'Agent Performance',
  tags: ['metrics', 'cache', 'cost', 'performance', 'tools', 'ST-27'],
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
  currency: string;
}

export async function handler(prisma: PrismaClient, params: any) {
  if (!params.componentRunId) {
    throw new Error('componentRunId is required');
  }

  const includeToolBreakdown = params.includeToolBreakdown !== false;
  const includeCostBreakdown = params.includeCostBreakdown !== false;
  const includeCodeImpact = params.includeCodeImpact !== false;

  const componentRun = await prisma.componentRun.findUnique({
    where: { id: params.componentRunId },
    include: {
      component: {
        select: {
          id: true,
          name: true,
          description: true,
        },
      },
      workflowRun: {
        select: {
          id: true,
          storyId: true,
          story: {
            select: {
              key: true,
              title: true,
            },
          },
        },
      },
    },
  });

  if (!componentRun) {
    throw new Error(`Component run with ID ${params.componentRunId} not found`);
  }

  // Base metrics
  const response: any = {
    componentRunId: componentRun.id,
    componentName: componentRun.component.name,
    componentDescription: componentRun.component.description,
    status: componentRun.status,
    success: componentRun.success,
    storyKey: componentRun.workflowRun.story?.key,
    storyTitle: componentRun.workflowRun.story?.title,

    // Session tracking
    sessionId: componentRun.sessionId,

    // Basic execution metrics
    execution: {
      startedAt: componentRun.startedAt?.toISOString(),
      finishedAt: componentRun.finishedAt?.toISOString(),
      durationSeconds: componentRun.durationSeconds,
      retryCount: componentRun.retryCount,
      stopReason: componentRun.stopReason,
    },

    // Token metrics
    tokens: {
      input: componentRun.tokensInput,
      output: componentRun.tokensOutput,
      total: componentRun.totalTokens,
      cacheRead: componentRun.tokensCacheRead || 0,
      cacheWrite: componentRun.tokensCacheWrite || 0,
    },

    // Cache performance
    cache: {
      hits: componentRun.cacheHits || 0,
      misses: componentRun.cacheMisses || 0,
      hitRate: componentRun.cacheHitRate || 0,
      tokensSaved: componentRun.tokensCacheRead || 0,
      efficiencyScore: calculateCacheEfficiency(
        componentRun.cacheHits || 0,
        componentRun.cacheMisses || 0,
        componentRun.tokensCacheRead || 0,
      ),
    },

    // Throughput metrics
    throughput: {
      tokensPerSecond: componentRun.tokensPerSecond || 0,
      timeToFirstTokenMs: (componentRun.timeToFirstToken || 0) * 1000,
      modelId: componentRun.modelId,
      temperature: componentRun.temperature,
      maxTokens: componentRun.maxTokens,
    },

    // Quality metrics
    quality: {
      errorRate: componentRun.errorRate || 0,
      successRate: componentRun.successRate || 1.0,
      userPrompts: componentRun.userPrompts || 0,
      systemIterations: componentRun.systemIterations || 1,
      humanInterventions: componentRun.humanInterventions || 0,
    },

    // Agent behavior
    behavior: {
      contextSwitches: componentRun.contextSwitches || 0,
      explorationDepth: componentRun.explorationDepth || 0,
    },
  };

  // Add tool breakdown if requested
  if (includeToolBreakdown && componentRun.toolBreakdown) {
    const toolBreakdown = componentRun.toolBreakdown as unknown as Record<string, ToolBreakdownEntry>;
    response.toolUsage = {
      breakdown: toolBreakdown,
      totalCalls: Object.values(toolBreakdown).reduce((sum, t) => sum + t.calls, 0),
      totalErrors: Object.values(toolBreakdown).reduce((sum, t) => sum + t.errors, 0),
      mostUsedTool: getMostUsedTool(toolBreakdown),
      avgToolDuration: calculateAvgToolDuration(toolBreakdown),
    };
  }

  // Add cost breakdown if requested
  if (includeCostBreakdown && componentRun.costBreakdown) {
    const costBreakdown = componentRun.costBreakdown as unknown as CostBreakdownEntry;
    response.cost = {
      breakdown: costBreakdown,
      totalCost: costBreakdown.total || componentRun.cost || 0,
      inputCost: costBreakdown.input || 0,
      outputCost: costBreakdown.output || 0,
      cacheCost: costBreakdown.cache || 0,
      costPerToken: (costBreakdown.total || 0) / ((componentRun.totalTokens || 1) / 1000),
    };
  } else {
    response.cost = {
      totalCost: componentRun.cost || 0,
    };
  }

  // Add code impact if requested
  if (includeCodeImpact) {
    response.codeImpact = {
      linesAdded: componentRun.linesAdded || 0,
      linesDeleted: componentRun.linesDeleted || 0,
      linesModified: componentRun.linesModified || 0,
      netLinesChanged:
        (componentRun.linesAdded || 0) -
        (componentRun.linesDeleted || 0) +
        (componentRun.linesModified || 0),
      complexityBefore: componentRun.complexityBefore,
      complexityAfter: componentRun.complexityAfter,
      complexityDelta: componentRun.complexityAfter
        ? (componentRun.complexityAfter || 0) - (componentRun.complexityBefore || 0)
        : null,
      coverageBefore: componentRun.coverageBefore,
      coverageAfter: componentRun.coverageAfter,
      coverageDelta: componentRun.coverageAfter
        ? (componentRun.coverageAfter || 0) - (componentRun.coverageBefore || 0)
        : null,
      filesModified: componentRun.filesModified,
    };
  }

  // Add error info if present
  if (componentRun.errorType || componentRun.errorMessage) {
    response.error = {
      type: componentRun.errorType,
      message: componentRun.errorMessage,
    };
  }

  return response;
}

function calculateCacheEfficiency(hits: number, misses: number, tokensSaved: number): number {
  const total = hits + misses;
  if (total === 0) return 0;
  const hitRate = hits / total;
  const savingsBonus = Math.min(tokensSaved / 10000, 0.5); // Up to 50% bonus for tokens saved
  return Math.min((hitRate + savingsBonus) * 100, 100);
}

function getMostUsedTool(breakdown: Record<string, ToolBreakdownEntry>): string {
  let maxCalls = 0;
  let mostUsed = '';
  for (const [tool, stats] of Object.entries(breakdown)) {
    if (stats.calls > maxCalls) {
      maxCalls = stats.calls;
      mostUsed = tool;
    }
  }
  return mostUsed;
}

function calculateAvgToolDuration(breakdown: Record<string, ToolBreakdownEntry>): number {
  let totalDuration = 0;
  let totalCalls = 0;
  for (const stats of Object.values(breakdown)) {
    totalDuration += stats.totalDuration || 0;
    totalCalls += stats.calls;
  }
  return totalCalls > 0 ? totalDuration / totalCalls : 0;
}
