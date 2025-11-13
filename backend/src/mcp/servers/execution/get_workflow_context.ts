import { PrismaClient } from '@prisma/client';
import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const tool: Tool = {
  name: 'get_workflow_context',
  description: 'Retrieve workflow state and previous component outputs for coordinator decision-making. Use this to get context before deciding the next component.',
  inputSchema: {
    type: 'object',
    properties: {
      runId: {
        type: 'string',
        description: 'Workflow run ID (required)',
      },
    },
    required: ['runId'],
  },
};

export const metadata = {
  category: 'execution',
  domain: 'Workflow Execution',
  tags: ['workflow', 'context', 'coordinator', 'decision'],
  version: '1.0.0',
  since: '2025-11-13',
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
      coordinator: true,
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

  // Get coordinator's component IDs to determine remaining components
  const coordinatorComponentIds = workflowRun.coordinator.componentIds || [];
  const completedComponentIds = completedComponentRuns.map((cr) => cr.componentId);
  const remainingComponentIds = coordinatorComponentIds.filter((id) => !completedComponentIds.includes(id));

  // Get remaining component details
  const remainingComponents = await prisma.component.findMany({
    where: {
      id: { in: remainingComponentIds },
    },
    select: {
      id: true,
      name: true,
      description: true,
    },
  });

  return {
    success: true,
    runId: workflowRun.id,
    workflowId: workflowRun.workflowId,
    workflowName: workflowRun.workflow.name,
    status: workflowRun.status,
    context: workflowRun.context,
    coordinatorStrategy: workflowRun.coordinator.decisionStrategy,
    completedComponents: completedComponentRuns.map((cr) => ({
      componentRunId: cr.id,
      componentId: cr.componentId,
      componentName: cr.component.name,
      status: cr.status,
      input: cr.input,
      output: cr.output,
      metrics: {
        tokensUsed: cr.tokensUsed,
        durationSeconds: cr.durationSeconds,
        costUsd: Number(cr.costUsd),
        linesOfCode: cr.linesOfCode,
        userPrompts: cr.userPrompts,
        systemIterations: cr.systemIterations,
        humanInterventions: cr.humanInterventions,
      },
      startedAt: cr.startedAt.toISOString(),
      completedAt: cr.completedAt?.toISOString(),
      errorMessage: cr.errorMessage,
    })),
    remainingComponents: remainingComponents.map((c, index) => ({
      componentId: c.id,
      componentName: c.name,
      description: c.description,
      order: completedComponentRuns.length + index + 1,
    })),
    aggregatedMetrics: {
      totalTokens: workflowRun.totalTokensUsed,
      totalCost: Number(workflowRun.totalCostUsd),
      totalDuration: workflowRun.totalDurationSeconds,
      totalUserPrompts: workflowRun.totalUserPrompts,
      totalIterations: workflowRun.totalIterations,
      componentsCompleted: completedComponentRuns.length,
      componentsTotal: coordinatorComponentIds.length,
      percentComplete: coordinatorComponentIds.length
        ? Math.round((completedComponentRuns.length / coordinatorComponentIds.length) * 100)
        : 0,
    },
    message: `Workflow context retrieved. ${completedComponentRuns.length}/${coordinatorComponentIds.length} components completed.`,
  };
}
