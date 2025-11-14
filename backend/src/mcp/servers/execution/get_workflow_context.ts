import { PrismaClient } from '@prisma/client';
import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const tool: Tool = {
  name: 'get_workflow_context',
  description: 'Retrieve workflow state, coordinator instructions, component instructions, and previous component outputs for coordinator decision-making. Returns all information needed to orchestrate the workflow and spawn component agents using the Task tool.',
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

  // Get remaining component details with full instructions
  const remainingComponents = await prisma.component.findMany({
    where: {
      id: { in: remainingComponentIds },
    },
    select: {
      id: true,
      name: true,
      description: true,
      inputInstructions: true,
      operationInstructions: true,
      outputInstructions: true,
      config: true,
      tools: true,
    },
  });

  return {
    success: true,
    runId: workflowRun.id,
    workflowId: workflowRun.workflowId,
    workflowName: workflowRun.workflow.name,
    status: workflowRun.status,
    context: workflowRun.metadata,
    coordinator: {
      id: workflowRun.coordinator.id,
      name: workflowRun.coordinator.name,
      instructions: workflowRun.coordinator.coordinatorInstructions,
      strategy: workflowRun.coordinator.decisionStrategy,
      config: workflowRun.coordinator.config,
      tools: workflowRun.coordinator.tools,
      flowDiagram: workflowRun.coordinator.flowDiagram,
    },
    completedComponents: completedComponentRuns.map((cr) => ({
      componentRunId: cr.id,
      componentId: cr.componentId,
      componentName: cr.component.name,
      status: cr.status,
      input: cr.inputData,
      output: cr.outputData,
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
    })),
    remainingComponents: remainingComponents.map((c, index) => ({
      componentId: c.id,
      componentName: c.name,
      description: c.description,
      inputInstructions: c.inputInstructions,
      operationInstructions: c.operationInstructions,
      outputInstructions: c.outputInstructions,
      config: c.config,
      tools: c.tools,
      order: completedComponentRuns.length + index + 1,
    })),
    aggregatedMetrics: {
      totalTokens: workflowRun.totalTokens,
      totalCost: Number(workflowRun.estimatedCost),
      totalDuration: workflowRun.durationSeconds,
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
