import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import { truncateWithMetadata, teamRunResultsFetchCommand } from '../../truncation-utils';
import { buildMasterSessionInstructions, ComponentInfo } from './master-session-instructions';

export const tool: Tool = {
  name: 'get_team_context',
  description: 'Retrieve team state, project manager instructions, agent instructions, and previous agent outputs for project manager decision-making. Returns all information needed to orchestrate the team and spawn agent tasks using the Task tool.',
  inputSchema: {
    type: 'object',
    properties: {
      runId: {
        type: 'string',
        description: 'Team run ID (required)',
      },
      truncateOutputs: {
        type: 'number',
        description:
          'Truncate component outputs to N characters for token efficiency (default: unlimited, recommended: 500)',
      },
    },
    required: ['runId'],
  },
};

export const metadata = {
  category: 'execution',
  domain: 'Team Execution',
  tags: ['team', 'context', 'project-manager', 'decision'],
  version: '1.0.0',
  since: '2025-11-26',
};

export async function handler(prisma: PrismaClient, params: any) {
  // Validate required fields
  if (!params.runId) {
    throw new Error('runId is required');
  }

  // Get workflow run
  const workflowRun = await prisma.workflowRun.findUnique({
    where: { id: params.runId },
    include: {
      workflow: true,
    },
  });

  if (!workflowRun) {
    throw new Error(`Workflow run with ID ${params.runId} not found`);
  }

  // Get all component runs (completed and failed)
  const completedComponentRuns = await prisma.componentRun.findMany({
    where: {
      workflowRunId: params.runId,
      status: { in: ['completed', 'failed'] },
    },
    include: {
      component: true,
    },
    orderBy: {
      startedAt: 'asc',
    },
  });

  // Get workflow's component IDs to determine remaining components
  const componentAssignments = (workflowRun.workflow.componentAssignments as any) || [];
  const workflowComponentIds = Array.isArray(componentAssignments)
    ? componentAssignments.map((assignment: any) => assignment.componentId).filter(Boolean)
    : [];
  const completedComponentIds = completedComponentRuns.map((cr) => cr.componentId);
  const remainingComponentIds = workflowComponentIds.filter((id) => !completedComponentIds.includes(id));

  // Get remaining component references (WITHOUT full instructions - use get_component_instructions for those)
  const remainingComponents = await prisma.component.findMany({
    where: {
      id: { in: remainingComponentIds },
    },
    select: {
      id: true,
      name: true,
      description: true,
      config: true,
      tools: true,
      onFailure: true,
    },
  });

  return {
    success: true,
    runId: workflowRun.id,
    workflowId: workflowRun.workflowId,
    workflowName: workflowRun.workflow.name,
    status: workflowRun.status,
    context: workflowRun.metadata,
    completedComponents: completedComponentRuns.map((cr) => {
      // Truncate outputs if truncateOutputs parameter is set
      let output = cr.outputData;
      let outputTruncated = undefined;

      if (params.truncateOutputs && cr.outputData) {
        const truncated = truncateWithMetadata(
          cr.outputData,
          params.truncateOutputs,
          'output',
          teamRunResultsFetchCommand(params.runId),
        );
        output = truncated.value;
        outputTruncated = truncated.truncationInfo;
      }

      return {
        componentRunId: cr.id,
        componentId: cr.componentId,
        componentName: cr.component.name,
        status: cr.status,
        input: cr.inputData,
        output,
        _truncated: outputTruncated,
        metrics: {
          tokensUsed: cr.totalTokens,
          durationSeconds: cr.durationSeconds,
          costUsd: Number(cr.cost),
          linesOfCode: cr.locGenerated,
          userPrompts: cr.userPrompts,
          systemIterations: cr.systemIterations,
          humanInterventions: cr.humanInterventions,
        },
        startedAt: cr.startedAt.toISOString(),
        completedAt: cr.finishedAt?.toISOString(),
        errorMessage: cr.errorMessage,
      };
    }),
    remainingComponents: remainingComponents.map((c, index) => ({
      componentId: c.id,
      componentName: c.name,
      description: c.description,
      config: c.config,
      tools: c.tools,
      onFailure: c.onFailure,
      order: completedComponentRuns.length + index + 1,
    })),
    aggregatedMetrics: {
      totalTokens: workflowRun.totalTokens,
      totalCost: Number(workflowRun.estimatedCost),
      totalDuration: workflowRun.durationSeconds,
      totalUserPrompts: workflowRun.totalUserPrompts,
      totalIterations: workflowRun.totalIterations,
      componentsCompleted: completedComponentRuns.length,
      componentsTotal: workflowComponentIds.length,
      percentComplete: workflowComponentIds.length
        ? Math.round((completedComponentRuns.length / workflowComponentIds.length) * 100)
        : 0,
    },
    // ST-167: Master session instructions for orchestrator
    masterSessionInstructions: buildMasterSessionInstructions({
      runId: workflowRun.id,
      workflowId: workflowRun.workflowId,
      workflowName: workflowRun.workflow.name,
      components: [
        // Completed components
        ...completedComponentRuns.map((cr, index) => ({
          componentId: cr.componentId,
          componentName: cr.component.name,
          description: cr.component.description || null,
          order: index + 1,
          status: cr.status as 'completed' | 'failed',
        })),
        // Remaining components
        ...remainingComponents.map((c, index) => ({
          componentId: c.id,
          componentName: c.name,
          description: c.description,
          order: completedComponentRuns.length + index + 1,
          status: 'pending' as const,
        })),
      ],
      storyContext: {
        storyId: (workflowRun.metadata as any)?.storyId,
        storyKey: (workflowRun.metadata as any)?.storyKey,
        title: (workflowRun.metadata as any)?.title,
      },
    }),
    message: `Workflow context retrieved. ${completedComponentRuns.length}/${workflowComponentIds.length} components completed.`,
  };
}
