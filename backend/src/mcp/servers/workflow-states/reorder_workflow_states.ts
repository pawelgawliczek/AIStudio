/**
 * Reorder Workflow States Tool
 * Bulk reorder states within a workflow atomically
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import {
  ReorderWorkflowStatesParams,
  WorkflowStateResponse,
  NotFoundError,
  ValidationError,
} from '../../types';
import { formatWorkflowState, validateRequired, handlePrismaError } from '../../utils';

export const tool: Tool = {
  name: 'reorder_workflow_states',
  description:
    'Bulk reorder states within a workflow. Uses atomic transaction to avoid constraint violations.',
  inputSchema: {
    type: 'object',
    properties: {
      workflowId: {
        type: 'string',
        description: 'Workflow UUID (required)',
      },
      stateOrder: {
        type: 'array',
        description: 'Array of state ID and new order pairs',
        items: {
          type: 'object',
          properties: {
            stateId: {
              type: 'string',
              description: 'Workflow State UUID',
            },
            newOrder: {
              type: 'number',
              description: 'New execution order (positive integer)',
            },
          },
          required: ['stateId', 'newOrder'],
        },
      },
    },
    required: ['workflowId', 'stateOrder'],
  },
};

export const metadata = {
  category: 'workflow_states',
  domain: 'story_runner',
  tags: ['workflow', 'state', 'reorder', 'story-runner'],
  version: '1.0.0',
  since: 'ST-144',
};

interface ReorderResult {
  success: boolean;
  workflowId: string;
  reorderedCount: number;
  states: WorkflowStateResponse[];
  message: string;
}

export async function handler(
  prisma: PrismaClient,
  params: ReorderWorkflowStatesParams,
): Promise<ReorderResult> {
  try {
    validateRequired(params as unknown as Record<string, unknown>, ['workflowId', 'stateOrder']);

    if (!Array.isArray(params.stateOrder) || params.stateOrder.length === 0) {
      throw new ValidationError('stateOrder must be a non-empty array');
    }

    // Verify workflow exists
    const workflow = await prisma.workflow.findUnique({
      where: { id: params.workflowId },
    });

    if (!workflow) {
      throw new NotFoundError('Workflow', params.workflowId);
    }

    // Validate all orders are positive integers
    for (const item of params.stateOrder) {
      if (!item.stateId || typeof item.stateId !== 'string') {
        throw new ValidationError('Each item must have a valid stateId string');
      }
      if (!Number.isInteger(item.newOrder) || item.newOrder < 1) {
        throw new ValidationError(
          `Order for state ${item.stateId} must be a positive integer, got: ${item.newOrder}`,
        );
      }
    }

    // Check for duplicate orders in the request
    const orders = params.stateOrder.map((item) => item.newOrder);
    const uniqueOrders = new Set(orders);
    if (uniqueOrders.size !== orders.length) {
      throw new ValidationError(
        'Duplicate orders detected. Each state must have a unique order.',
      );
    }

    // Verify all stateIds belong to the workflow
    const stateIds = params.stateOrder.map((item) => item.stateId);
    const existingStates = await prisma.workflowState.findMany({
      where: {
        id: { in: stateIds },
        workflowId: params.workflowId,
      },
    });

    if (existingStates.length !== stateIds.length) {
      const foundIds = new Set(existingStates.map((s) => s.id));
      const missingIds = stateIds.filter((id) => !foundIds.has(id));
      throw new ValidationError(
        `States not found or do not belong to this workflow: ${missingIds.join(', ')}`,
      );
    }

    // Perform atomic reorder using transaction
    // Strategy: First set all to negative orders (avoiding conflicts), then set to final orders
    const updatedStates = await prisma.$transaction(async (tx) => {
      // Step 1: Set all target states to negative orders (temporary, to avoid unique constraint)
      for (const item of params.stateOrder) {
        await tx.workflowState.update({
          where: { id: item.stateId },
          data: { order: -item.newOrder }, // Negative to avoid constraint
        });
      }

      // Step 2: Set to final positive orders
      for (const item of params.stateOrder) {
        await tx.workflowState.update({
          where: { id: item.stateId },
          data: { order: item.newOrder },
        });
      }

      // Fetch updated states
      return tx.workflowState.findMany({
        where: { workflowId: params.workflowId },
        orderBy: { order: 'asc' },
        include: { component: true },
      });
    });

    return {
      success: true,
      workflowId: params.workflowId,
      reorderedCount: params.stateOrder.length,
      states: updatedStates.map((state) =>
        formatWorkflowState(state as any, !!state.componentId),
      ),
      message: `Successfully reordered ${params.stateOrder.length} states in workflow`,
    };
  } catch (error: any) {
    if (error.name === 'MCPError') {
      throw error;
    }
    throw handlePrismaError(error, 'reorder_workflow_states');
  }
}
