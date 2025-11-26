/**
 * Get Team Run Results Tool
 * Query comprehensive execution results with metrics, components, and artifacts
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';

export const tool: Tool = {
  name: 'get_team_run_results',
  description:
    'Retrieve complete execution results for a team run, including all component outputs, metrics, and artifacts.',
  inputSchema: {
    type: 'object',
    properties: {
      runId: {
        type: 'string',
        description: 'Team run ID (required)',
      },
      includeArtifacts: {
        type: 'boolean',
        description: 'Include artifact details (default: true)',
      },
      includeComponentDetails: {
        type: 'boolean',
        description: 'Include detailed component information (default: true)',
      },
    },
    required: ['runId'],
  },
};

export const metadata = {
  category: 'execution',
  domain: 'Team Execution',
  tags: ['team', 'results', 'query', 'metrics'],
  version: '1.0.0',
  since: '2025-11-14',
};

export async function handler(prisma: PrismaClient, params: any) {
  // Validate required fields
  if (!params.runId) {
    throw new Error('runId is required');
  }

  const includeArtifacts = params.includeArtifacts !== false;
  const includeComponentDetails = params.includeComponentDetails !== false;

  // Fetch workflow run with all related data
  const workflowRun = await prisma.workflowRun.findUnique({
    where: { id: params.runId },
    include: {
      workflow: {
        select: {
          id: true,
          name: true,
          description: true,
        },
      },
      coordinator: {
        select: {
          id: true,
          name: true,
          config: true,
        },
      },
      story: {
        select: {
          id: true,
          key: true,
          title: true,
          status: true,
        },
      },
      epic: {
        select: {
          id: true,
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
              description: true,
            },
          },
        },
      },
    },
  });

  if (!workflowRun) {
    throw new Error(`Workflow run with ID ${params.runId} not found`);
  }

  // Calculate summary metrics
  const completedComponents = workflowRun.componentRuns.filter(
    (cr) => cr.status === 'completed',
  ).length;
  const failedComponents = workflowRun.componentRuns.filter(
    (cr) => cr.status === 'failed',
  ).length;
  const totalComponents = workflowRun.componentRuns.length;

  const percentComplete =
    totalComponents > 0 ? Math.round((completedComponents / totalComponents) * 100) : 0;

  // Format component runs
  const components = workflowRun.componentRuns.map((cr) => {
    const componentData: any = {
      componentRunId: cr.id,
      componentId: cr.componentId,
      name: cr.component.name,
      description: cr.component.description,
      order: cr.executionOrder,
      status: cr.status,
      success: cr.success,
      startedAt: cr.startedAt?.toISOString(),
      finishedAt: cr.finishedAt?.toISOString(),
      durationSeconds: cr.durationSeconds,
    };

    if (includeComponentDetails) {
      componentData.input = cr.inputData;
      componentData.output = cr.outputData;
      componentData.outputText = cr.output;
      componentData.metrics = {
        tokensInput: cr.tokensInput,
        tokensOutput: cr.tokensOutput,
        totalTokens: cr.totalTokens,
        cost: cr.cost ? Number(cr.cost) : null,
        locGenerated: cr.locGenerated,
        filesModified: cr.filesModified,
        userPrompts: cr.userPrompts,
        systemIterations: cr.systemIterations,
        humanInterventions: cr.humanInterventions,
      };
      componentData.errorType = cr.errorType;
      componentData.errorMessage = cr.errorMessage;
      componentData.retryCount = cr.retryCount;
    }

    if (includeArtifacts && cr.artifacts) {
      componentData.artifacts = cr.artifacts;
    }

    return componentData;
  });

  // Build response
  const result = {
    success: true,
    run: {
      id: workflowRun.id,
      status: workflowRun.status,
      triggeredBy: workflowRun.triggeredBy,
      triggerType: workflowRun.triggerType,
      startedAt: workflowRun.startedAt.toISOString(),
      finishedAt: workflowRun.finishedAt?.toISOString(),
      durationSeconds: workflowRun.durationSeconds,
      errorMessage: workflowRun.errorMessage,

      workflow: workflowRun.workflow,
      coordinator: workflowRun.coordinator,

      story: workflowRun.story,
      epic: workflowRun.epic,

      metrics: {
        totalTokensInput: workflowRun.totalTokensInput,
        totalTokensOutput: workflowRun.totalTokensOutput,
        totalTokens: workflowRun.totalTokens,
        estimatedCost: workflowRun.estimatedCost ? Number(workflowRun.estimatedCost) : null,
        totalLocGenerated: workflowRun.totalLocGenerated,
        totalUserPrompts: workflowRun.totalUserPrompts,
        totalIterations: workflowRun.totalIterations,
        totalInterventions: workflowRun.totalInterventions,
        avgPromptsPerComponent: workflowRun.avgPromptsPerComponent
          ? Number(workflowRun.avgPromptsPerComponent)
          : null,
      },

      progress: {
        componentsTotal: totalComponents,
        componentsCompleted: completedComponents,
        componentsFailed: failedComponents,
        percentComplete,
      },

      components,

      coordinatorDecisions: workflowRun.coordinatorDecisions,
      coordinatorMetrics: workflowRun.coordinatorMetrics,
      context: workflowRun.metadata,
    },
    message: `Retrieved results for workflow run ${workflowRun.id}. Status: ${workflowRun.status}, Progress: ${percentComplete}%`,
  };

  return result;
}
