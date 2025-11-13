import { PrismaClient } from '@prisma/client';
import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const tool: Tool = {
  name: 'record_component_start',
  description: 'Log the start of a component execution within a workflow run. Call this before executing component logic.',
  inputSchema: {
    type: 'object',
    properties: {
      runId: {
        type: 'string',
        description: 'Workflow run ID from start_workflow_run (required)',
      },
      componentId: {
        type: 'string',
        description: 'Component ID from database (required)',
      },
      input: {
        type: 'object',
        description: 'Component input data (optional)',
      },
    },
    required: ['runId', 'componentId'],
  },
};

export const metadata = {
  category: 'execution',
  domain: 'Workflow Execution',
  tags: ['component', 'execution', 'tracking'],
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

  // Verify workflow run exists
  const workflowRun = await prisma.workflowRun.findUnique({
    where: { id: params.runId },
  });

  if (!workflowRun) {
    throw new Error(`Workflow run with ID ${params.runId} not found`);
  }

  if (workflowRun.status !== 'running') {
    throw new Error(`Workflow run ${params.runId} is not in running state. Current status: ${workflowRun.status}`);
  }

  // Verify component exists
  const component = await prisma.component.findUnique({
    where: { id: params.componentId },
  });

  if (!component) {
    throw new Error(`Component with ID ${params.componentId} not found`);
  }

  // Create ComponentRun record
  const componentRun = await prisma.componentRun.create({
    data: {
      workflowRunId: params.runId,
      componentId: params.componentId,
      status: 'running',
      inputData: params.input || {},
      startedAt: new Date(),
      userPrompts: 0,
      systemIterations: 1,
      humanInterventions: 0,
      iterationLog: [],
    },
  });

  return {
    success: true,
    componentRunId: componentRun.id,
    runId: componentRun.workflowRunId,
    componentId: componentRun.componentId,
    componentName: component.name,
    status: componentRun.status,
    startedAt: componentRun.startedAt.toISOString(),
    message: `Component "${component.name}" execution started. Component run ID: ${componentRun.id}`,
  };
}
