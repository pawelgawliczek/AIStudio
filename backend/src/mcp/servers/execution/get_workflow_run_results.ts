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
      responseMode: {
        type: 'string',
        enum: ['minimal', 'standard', 'full'],
        description:
          'Response detail level for token efficiency. minimal=summary metrics only, standard=with component status (default), full=everything including outputs and decisions',
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

  // Response mode determines what's included
  const responseMode = params.responseMode || 'standard';

  // In minimal mode, exclude details and artifacts by default
  const includeArtifacts = responseMode === 'full' ? true : params.includeArtifacts === true;
  const includeComponentDetails =
    responseMode === 'minimal' ? false : params.includeComponentDetails !== false;

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

  // ST-147: Aggregate session telemetry across all component runs
  const totalTurns = workflowRun.componentRuns.reduce(
    (sum, cr) => sum + (cr.totalTurns || 0),
    0,
  );
  const totalManualPrompts = workflowRun.componentRuns.reduce(
    (sum, cr) => sum + (cr.manualPrompts || 0),
    0,
  );
  const totalAutoContinues = workflowRun.componentRuns.reduce(
    (sum, cr) => sum + (cr.autoContinues || 0),
    0,
  );
  const automationRate =
    totalTurns > 0 ? Math.round((totalAutoContinues / totalTurns) * 100) : 0;

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
        // ST-147: Session telemetry per component
        totalTurns: cr.totalTurns,
        manualPrompts: cr.manualPrompts,
        autoContinues: cr.autoContinues,
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
        // ST-147: Session telemetry aggregates
        totalTurns,
        totalManualPrompts,
        totalAutoContinues,
        automationRate,
      },

      progress: {
        componentsTotal: totalComponents,
        componentsCompleted: completedComponents,
        componentsFailed: failedComponents,
        percentComplete,
      },

      components,

      // Include coordinator details only in standard/full mode
      ...(responseMode !== 'minimal'
        ? {
            coordinatorDecisions: workflowRun.coordinatorDecisions,
            coordinatorMetrics: workflowRun.coordinatorMetrics,
            context: workflowRun.metadata,
          }
        : {}),
    },

    // Add responseMode metadata for token efficiency transparency
    _responseMode: {
      mode: responseMode,
      included: {
        componentDetails: includeComponentDetails,
        artifacts: includeArtifacts,
        coordinatorDecisions: responseMode !== 'minimal',
        coordinatorMetrics: responseMode !== 'minimal',
        componentOutputs: responseMode === 'full',
      },
      ...(responseMode === 'minimal'
        ? {
            omitted: ['componentDetails', 'coordinatorDecisions', 'coordinatorMetrics', 'componentOutputs'],
            fetchCommand: `get_team_run_results({ runId: '${workflowRun.id}', responseMode: 'full' })`,
          }
        : {}),
    },
    message: `Retrieved results for workflow run ${workflowRun.id}. Status: ${workflowRun.status}, Progress: ${percentComplete}%`,
  };

  return result;
}
