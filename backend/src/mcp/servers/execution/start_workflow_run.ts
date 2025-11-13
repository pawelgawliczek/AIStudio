import { PrismaClient } from '@prisma/client';
import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const tool: Tool = {
  name: 'start_workflow_run',
  description: 'Initialize a new workflow execution run. Returns a runId for tracking component executions. Use this at the start of every workflow execution.',
  inputSchema: {
    type: 'object',
    properties: {
      workflowId: {
        type: 'string',
        description: 'Workflow ID from database (required)',
      },
      triggeredBy: {
        type: 'string',
        description: 'User ID or system identifier that triggered the workflow (required)',
      },
      context: {
        type: 'object',
        description: 'Workflow context data (e.g., prNumber, storyId, branch, etc.)',
      },
    },
    required: ['workflowId', 'triggeredBy'],
  },
};

export const metadata = {
  category: 'execution',
  domain: 'Workflow Execution',
  tags: ['workflow', 'execution', 'tracking', 'coordinator'],
  version: '1.0.0',
  since: '2025-11-13',
};

export async function handler(prisma: PrismaClient, params: any) {
  // Validate required fields
  if (!params.workflowId) {
    throw new Error('workflowId is required');
  }
  if (!params.triggeredBy) {
    throw new Error('triggeredBy is required');
  }

  // Verify workflow exists and get coordinator info
  const workflow = await prisma.workflow.findUnique({
    where: { id: params.workflowId },
    include: {
      coordinator: true,
      project: true,
    },
  });

  if (!workflow) {
    throw new Error(`Workflow with ID ${params.workflowId} not found`);
  }

  if (!workflow.active) {
    throw new Error(`Workflow ${workflow.name} is not active. Please activate it first.`);
  }

  // Get component IDs from coordinator
  const componentIds = workflow.coordinator.componentIds || [];

  // Create WorkflowRun record
  const workflowRun = await prisma.workflowRun.create({
    data: {
      workflowId: params.workflowId,
      coordinatorId: workflow.coordinatorId,
      projectId: workflow.projectId,
      status: 'running',
      context: params.context || {},
      triggeredBy: params.triggeredBy,
      startedAt: new Date(),
    },
    include: {
      workflow: true,
      coordinator: true,
    },
  });

  // Get component details
  const components = await prisma.component.findMany({
    where: {
      id: { in: componentIds },
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
    workflowName: workflow.name,
    coordinatorId: workflowRun.coordinatorId,
    coordinatorName: workflow.coordinator.name,
    coordinatorStrategy: workflow.coordinator.decisionStrategy,
    components: components.map((c, index) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      order: index + 1,
    })),
    status: workflowRun.status,
    startedAt: workflowRun.startedAt.toISOString(),
    context: workflowRun.context,
    message: `Workflow "${workflow.name}" started successfully. Run ID: ${workflowRun.id}`,
  };
}
