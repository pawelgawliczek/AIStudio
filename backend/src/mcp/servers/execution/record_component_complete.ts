import { PrismaClient } from '@prisma/client';
import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const tool: Tool = {
  name: 'record_component_complete',
  description: 'Log the completion of a component execution with output and metrics. Call this after component logic finishes.',
  inputSchema: {
    type: 'object',
    properties: {
      runId: {
        type: 'string',
        description: 'Workflow run ID (required)',
      },
      componentId: {
        type: 'string',
        description: 'Component ID (required)',
      },
      output: {
        type: 'object',
        description: 'Component output data (optional)',
      },
      metrics: {
        type: 'object',
        description: 'Execution metrics',
        properties: {
          tokensUsed: {
            type: 'number',
            description: 'Total tokens used',
          },
          durationSeconds: {
            type: 'number',
            description: 'Execution duration in seconds',
          },
          userPrompts: {
            type: 'number',
            description: 'Number of user prompts/clarifications',
          },
          systemIterations: {
            type: 'number',
            description: 'Number of system iterations/refinements',
          },
          humanInterventions: {
            type: 'number',
            description: 'Number of human interventions',
          },
          linesOfCode: {
            type: 'number',
            description: 'Lines of code generated/analyzed',
          },
          filesModified: {
            type: 'number',
            description: 'Number of files modified',
          },
          costUsd: {
            type: 'number',
            description: 'Estimated cost in USD',
          },
        },
      },
      status: {
        type: 'string',
        enum: ['completed', 'failed'],
        description: 'Component execution status (default: completed)',
      },
      errorMessage: {
        type: 'string',
        description: 'Error message if status is failed',
      },
    },
    required: ['runId', 'componentId'],
  },
};

export const metadata = {
  category: 'execution',
  domain: 'Workflow Execution',
  tags: ['component', 'execution', 'tracking', 'metrics'],
  version: '1.0.0',
  since: '2025-11-13',
};

export async function handler(prisma: PrismaClient, params: any) {
  // Validate required fields
  if (!params.runId) {
    throw new Error('runId is required');
  }
  if (!params.componentId) {
    throw new Error('componentId is required');
  }

  const status = params.status || 'completed';
  if (!['completed', 'failed'].includes(status)) {
    throw new Error('status must be either "completed" or "failed"');
  }

  // Find the component run (most recent running one for this component in this workflow run)
  const componentRun = await prisma.componentRun.findFirst({
    where: {
      workflowRunId: params.runId,
      componentId: params.componentId,
      status: 'running',
    },
    orderBy: {
      startedAt: 'desc',
    },
  });

  if (!componentRun) {
    throw new Error(
      `No running component execution found for runId ${params.runId} and componentId ${params.componentId}. Did you call record_component_start first?`
    );
  }

  const metrics = params.metrics || {};
  const completedAt = new Date();
  const durationSeconds =
    metrics.durationSeconds || Math.round((completedAt.getTime() - componentRun.startedAt.getTime()) / 1000);

  // Update ComponentRun record
  const updatedComponentRun = await prisma.componentRun.update({
    where: { id: componentRun.id },
    data: {
      status,
      outputData: params.output || {},
      totalTokens: metrics.tokensUsed || null,
      durationSeconds,
      cost: metrics.costUsd || null,
      locGenerated: metrics.linesOfCode || null,
      userPrompts: metrics.userPrompts || 0,
      systemIterations: metrics.systemIterations || 1,
      humanInterventions: metrics.humanInterventions || 0,
      finishedAt: completedAt,
      errorMessage: params.errorMessage || null,
    },
    include: {
      component: true,
    },
  });

  // Update WorkflowRun aggregated metrics
  const allComponentRuns = await prisma.componentRun.findMany({
    where: {
      workflowRunId: params.runId,
      status: { in: ['completed', 'failed'] },
    },
  });

  const aggregatedMetrics = {
    totalTokens: allComponentRuns.reduce((sum, cr) => sum + (cr.totalTokens || 0), 0),
    estimatedCost: allComponentRuns.reduce((sum, cr) => sum + Number(cr.cost || 0), 0),
    durationSeconds: allComponentRuns.reduce((sum, cr) => sum + (cr.durationSeconds || 0), 0),
    totalUserPrompts: allComponentRuns.reduce((sum, cr) => sum + (cr.userPrompts || 0), 0),
    totalIterations: allComponentRuns.reduce((sum, cr) => sum + (cr.systemIterations || 0), 0),
    totalInterventions: allComponentRuns.reduce((sum, cr) => sum + (cr.humanInterventions || 0), 0),
    avgPromptsPerComponent: allComponentRuns.length
      ? allComponentRuns.reduce((sum, cr) => sum + (cr.userPrompts || 0), 0) / allComponentRuns.length
      : 0,
  };

  await prisma.workflowRun.update({
    where: { id: params.runId },
    data: {
      totalTokens: aggregatedMetrics.totalTokens || null,
      estimatedCost: aggregatedMetrics.estimatedCost || null,
      durationSeconds: aggregatedMetrics.durationSeconds || null,
      totalUserPrompts: aggregatedMetrics.totalUserPrompts || null,
      totalIterations: aggregatedMetrics.totalIterations || null,
      totalInterventions: aggregatedMetrics.totalInterventions || null,
      avgPromptsPerComponent: aggregatedMetrics.avgPromptsPerComponent || null,
    },
  });

  return {
    success: true,
    componentRunId: updatedComponentRun.id,
    runId: updatedComponentRun.workflowRunId,
    componentId: updatedComponentRun.componentId,
    componentName: updatedComponentRun.component.name,
    status: updatedComponentRun.status,
    startedAt: updatedComponentRun.startedAt.toISOString(),
    completedAt: updatedComponentRun.finishedAt?.toISOString(),
    metrics: {
      tokensUsed: updatedComponentRun.totalTokens,
      durationSeconds: updatedComponentRun.durationSeconds,
      costUsd: Number(updatedComponentRun.cost),
      linesOfCode: updatedComponentRun.locGenerated,
      userPrompts: updatedComponentRun.userPrompts,
      systemIterations: updatedComponentRun.systemIterations,
      humanInterventions: updatedComponentRun.humanInterventions,
    },
    aggregatedMetrics,
    message: `Component "${updatedComponentRun.component.name}" ${status}. Duration: ${durationSeconds}s, Tokens: ${updatedComponentRun.totalTokens || 0}`,
  };
}
