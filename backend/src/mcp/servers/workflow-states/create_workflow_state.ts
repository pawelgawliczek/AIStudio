/**
 * Create Workflow State Tool
 * Creates a new state within a workflow for the Story Runner
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import {
  CreateWorkflowStateParams,
  WorkflowStateResponse,
  NotFoundError,
  ValidationError,
} from '../../types';
import {
  formatWorkflowState,
  validateRequired,
  handlePrismaError,
} from '../../utils';

export const tool: Tool = {
  name: 'create_workflow_state',
  description:
    'Create a new state within a workflow. States define the execution order and agent assignments for the Story Runner.',
  inputSchema: {
    type: 'object',
    properties: {
      workflowId: {
        type: 'string',
        description: 'Workflow UUID (required)',
      },
      name: {
        type: 'string',
        description:
          'State name (e.g., "analysis", "architecture", "implementation")',
      },
      order: {
        type: 'number',
        description: 'Execution order (1, 2, 3...). Must be unique within the workflow.',
      },
      componentId: {
        type: 'string',
        description: 'Agent/Component UUID to execute in this state (optional)',
      },
      preExecutionInstructions: {
        type: 'string',
        description:
          'Instructions to run before the agent executes (optional). Run by the Story Runner.',
      },
      postExecutionInstructions: {
        type: 'string',
        description:
          'Instructions to run after the agent completes (optional). Run by the Story Runner.',
      },
      requiresApproval: {
        type: 'boolean',
        description:
          'If true, requires human approval before proceeding to next state (default: false)',
      },
      mandatory: {
        type: 'boolean',
        description:
          'If true, this state must complete successfully to proceed (default: true)',
      },
      runLocation: {
        type: 'string',
        enum: ['local', 'laptop'],
        description:
          'ST-150: Where to execute the agent - "local" (KVM Docker) or "laptop" (remote agent). Default: "local"',
      },
      offlineFallback: {
        type: 'string',
        enum: ['pause', 'skip', 'fail'],
        description:
          'ST-150: What to do if laptop agent is offline - "pause" (wait), "skip" (continue), "fail" (abort). Default: "pause"',
      },
    },
    required: ['workflowId', 'name', 'order'],
  },
};

export const metadata = {
  category: 'workflow_states',
  domain: 'story_runner',
  tags: ['workflow', 'state', 'create', 'story-runner'],
  version: '1.0.0',
  since: 'ST-144',
};

export async function handler(
  prisma: PrismaClient,
  params: CreateWorkflowStateParams,
): Promise<WorkflowStateResponse> {
  try {
    validateRequired(params, ['workflowId', 'name', 'order']);

    // Validate order is a positive integer
    if (!Number.isInteger(params.order) || params.order < 1) {
      throw new ValidationError('Order must be a positive integer (1, 2, 3...)');
    }

    // Verify workflow exists
    const workflow = await prisma.workflow.findUnique({
      where: { id: params.workflowId },
    });

    if (!workflow) {
      throw new NotFoundError('Workflow', params.workflowId);
    }

    // Verify component exists if provided
    if (params.componentId) {
      const component = await prisma.component.findUnique({
        where: { id: params.componentId },
      });

      if (!component) {
        throw new NotFoundError('Component', params.componentId);
      }
    }

    // Check for duplicate name in workflow
    const existingByName = await prisma.workflowState.findFirst({
      where: {
        workflowId: params.workflowId,
        name: params.name,
      },
    });

    if (existingByName) {
      throw new ValidationError(
        `State with name "${params.name}" already exists in this workflow`,
      );
    }

    // Check for duplicate order in workflow
    const existingByOrder = await prisma.workflowState.findFirst({
      where: {
        workflowId: params.workflowId,
        order: params.order,
      },
    });

    if (existingByOrder) {
      throw new ValidationError(
        `State with order ${params.order} already exists in this workflow. ` +
          `Use reorder_workflow_states to change execution order.`,
      );
    }

    // Validate runLocation if provided
    if (params.runLocation && !['local', 'laptop'].includes(params.runLocation)) {
      throw new ValidationError('runLocation must be "local" or "laptop"');
    }

    // Validate offlineFallback if provided
    if (params.offlineFallback && !['pause', 'skip', 'fail'].includes(params.offlineFallback)) {
      throw new ValidationError('offlineFallback must be "pause", "skip", or "fail"');
    }

    // Create workflow state
    const state = await prisma.workflowState.create({
      data: {
        workflowId: params.workflowId,
        name: params.name,
        order: params.order,
        componentId: params.componentId,
        preExecutionInstructions: params.preExecutionInstructions,
        postExecutionInstructions: params.postExecutionInstructions,
        requiresApproval: params.requiresApproval ?? false,
        mandatory: params.mandatory ?? true,
        runLocation: params.runLocation ?? 'local', // ST-150
        offlineFallback: params.offlineFallback ?? 'pause', // ST-150
      },
      include: {
        component: true,
      },
    });

    return formatWorkflowState(state, !!params.componentId);
  } catch (error: any) {
    if (error.name === 'MCPError') {
      throw error;
    }
    throw handlePrismaError(error, 'create_workflow_state');
  }
}
