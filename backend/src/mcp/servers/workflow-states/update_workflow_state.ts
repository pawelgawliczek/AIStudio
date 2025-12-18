/**
 * Update Workflow State Tool
 * Updates an existing workflow state
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import {
  UpdateWorkflowStateParams,
  WorkflowStateResponse,
  NotFoundError,
  ValidationError,
} from '../../types';
import { formatWorkflowState, validateRequired, handlePrismaError } from '../../utils';

export const tool: Tool = {
  name: 'update_workflow_state',
  description:
    'Update an existing workflow state. Supports partial updates - only provided fields will be modified.',
  inputSchema: {
    type: 'object',
    properties: {
      workflowStateId: {
        type: 'string',
        description: 'Workflow State UUID (required)',
      },
      name: {
        type: 'string',
        description: 'New state name (optional)',
      },
      order: {
        type: 'number',
        description:
          'New execution order (optional). For bulk reordering, use reorder_workflow_states instead.',
      },
      componentId: {
        type: ['string', 'null'],
        description: 'Agent/Component UUID (optional). Pass null to clear.',
      },
      preExecutionInstructions: {
        type: ['string', 'null'],
        description: 'Instructions before agent execution (optional). Pass null to clear.',
      },
      postExecutionInstructions: {
        type: ['string', 'null'],
        description: 'Instructions after agent completion (optional). Pass null to clear.',
      },
      requiresApproval: {
        type: 'boolean',
        description: 'Require human approval before next state (optional)',
      },
      mandatory: {
        type: 'boolean',
        description: 'Must complete successfully to proceed (optional)',
      },
      runLocation: {
        type: 'string',
        enum: ['local', 'laptop'],
        description:
          'ST-150: Where to execute the agent - "local" (KVM Docker) or "laptop" (remote agent)',
      },
      offlineFallback: {
        type: 'string',
        enum: ['pause', 'skip', 'fail'],
        description:
          'ST-150: What to do if laptop agent is offline - "pause" (wait), "skip" (continue), "fail" (abort)',
      },
    },
    required: ['workflowStateId'],
  },
};

export const metadata = {
  category: 'workflow_states',
  domain: 'story_runner',
  tags: ['workflow', 'state', 'update', 'story-runner'],
  version: '1.0.0',
  since: 'ST-144',
};

export async function handler(
  prisma: PrismaClient,
  params: UpdateWorkflowStateParams,
): Promise<WorkflowStateResponse> {
  try {
    validateRequired(params as unknown as Record<string, unknown>, ['workflowStateId']);

    // Verify state exists
    const existingState = await prisma.workflowState.findUnique({
      where: { id: params.workflowStateId },
    });

    if (!existingState) {
      throw new NotFoundError('WorkflowState', params.workflowStateId);
    }

    // Validate order if provided
    if (params.order !== undefined) {
      if (!Number.isInteger(params.order) || params.order < 1) {
        throw new ValidationError('Order must be a positive integer (1, 2, 3...)');
      }

      // Check for duplicate order (excluding current state)
      const existingByOrder = await prisma.workflowState.findFirst({
        where: {
          workflowId: existingState.workflowId,
          order: params.order,
          id: { not: params.workflowStateId },
        },
      });

      if (existingByOrder) {
        throw new ValidationError(
          `State with order ${params.order} already exists in this workflow. ` +
            `Use reorder_workflow_states for bulk order changes.`,
        );
      }
    }

    // Check for duplicate name if provided (excluding current state)
    if (params.name !== undefined) {
      const existingByName = await prisma.workflowState.findFirst({
        where: {
          workflowId: existingState.workflowId,
          name: params.name,
          id: { not: params.workflowStateId },
        },
      });

      if (existingByName) {
        throw new ValidationError(
          `State with name "${params.name}" already exists in this workflow`,
        );
      }
    }

    // Verify component exists if provided (and not null)
    if (params.componentId !== undefined && params.componentId !== null) {
      const component = await prisma.component.findUnique({
        where: { id: params.componentId },
      });

      if (!component) {
        throw new NotFoundError('Component', params.componentId);
      }
    }

    // Build update data (only include provided fields)
    const updateData: any = {};

    if (params.name !== undefined) {
      updateData.name = params.name;
    }
    if (params.order !== undefined) {
      updateData.order = params.order;
    }
    if (params.componentId !== undefined) {
      updateData.componentId = params.componentId; // null clears the field
    }
    if (params.preExecutionInstructions !== undefined) {
      updateData.preExecutionInstructions = params.preExecutionInstructions;
    }
    if (params.postExecutionInstructions !== undefined) {
      updateData.postExecutionInstructions = params.postExecutionInstructions;
    }
    if (params.requiresApproval !== undefined) {
      updateData.requiresApproval = params.requiresApproval;
    }
    if (params.mandatory !== undefined) {
      updateData.mandatory = params.mandatory;
    }

    // ST-150: runLocation and offlineFallback
    if (params.runLocation !== undefined) {
      if (!['local', 'laptop'].includes(params.runLocation)) {
        throw new ValidationError('runLocation must be "local" or "laptop"');
      }
      updateData.runLocation = params.runLocation;
    }
    if (params.offlineFallback !== undefined) {
      if (!['pause', 'skip', 'fail'].includes(params.offlineFallback)) {
        throw new ValidationError('offlineFallback must be "pause", "skip", or "fail"');
      }
      updateData.offlineFallback = params.offlineFallback;
    }

    // Update state
    const updatedState = await prisma.workflowState.update({
      where: { id: params.workflowStateId },
      data: updateData,
      include: {
        component: true,
      },
    });

    return formatWorkflowState(updatedState as any, !!updatedState.componentId);
  } catch (error: any) {
    if (error.name === 'MCPError') {
      throw error;
    }
    throw handlePrismaError(error, 'update_workflow_state');
  }
}
