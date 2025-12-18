/**
 * Delete Workflow State Tool
 * Deletes a workflow state with safety checks and auto-reorder
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import {
  DeleteWorkflowStateParams,
  DeleteWorkflowStateResponse,
  NotFoundError,
  ValidationError,
} from '../../types';
import { validateRequired, handlePrismaError } from '../../utils';

export const tool: Tool = {
  name: 'delete_workflow_state',
  description:
    'Delete a workflow state. Blocks if any WorkflowRun is currently at this state. Auto-normalizes remaining state orders after deletion.',
  inputSchema: {
    type: 'object',
    properties: {
      workflowStateId: {
        type: 'string',
        description: 'Workflow State UUID (required)',
      },
      confirm: {
        type: 'boolean',
        description: 'Must be true to confirm deletion (required)',
      },
    },
    required: ['workflowStateId', 'confirm'],
  },
};

export const metadata = {
  category: 'workflow_states',
  domain: 'story_runner',
  tags: ['workflow', 'state', 'delete', 'story-runner'],
  version: '1.0.0',
  since: 'ST-144',
};

export async function handler(
  prisma: PrismaClient,
  params: DeleteWorkflowStateParams,
): Promise<DeleteWorkflowStateResponse> {
  try {
    validateRequired(params as unknown as Record<string, unknown>, ['workflowStateId', 'confirm']);

    // Safety gate
    if (params.confirm !== true) {
      throw new ValidationError(
        'Deletion not confirmed. Set confirm: true to proceed.',
      );
    }

    // Verify state exists
    const existingState = await prisma.workflowState.findUnique({
      where: { id: params.workflowStateId },
      include: {
        _count: {
          select: {
            breakpointsAtState: true,
            workflowRunsAtState: true,
          },
        },
      },
    });

    if (!existingState) {
      throw new NotFoundError('WorkflowState', params.workflowStateId);
    }

    // Block deletion if any WorkflowRun is currently at this state
    if (existingState._count.workflowRunsAtState > 0) {
      throw new ValidationError(
        `Cannot delete state "${existingState.name}": ${existingState._count.workflowRunsAtState} workflow run(s) are currently at this state. ` +
          `Complete or cancel the runs before deleting the state.`,
      );
    }

    const workflowId = existingState.workflowId;
    const deletedOrder = existingState.order;
    const breakpointsCount = existingState._count.breakpointsAtState;

    // Perform deletion and reorder in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Delete breakpoints first (cascade would handle this, but let's be explicit)
      await tx.runnerBreakpoint.deleteMany({
        where: { stateId: params.workflowStateId },
      });

      // Delete the state
      await tx.workflowState.delete({
        where: { id: params.workflowStateId },
      });

      // Get remaining states with order > deleted order
      const statesAfter = await tx.workflowState.findMany({
        where: {
          workflowId,
          order: { gt: deletedOrder },
        },
        orderBy: { order: 'asc' },
      });

      // Normalize orders (shift down to fill gap)
      let reorderedCount = 0;
      for (let i = 0; i < statesAfter.length; i++) {
        const newOrder = deletedOrder + i;
        if (statesAfter[i].order !== newOrder) {
          await tx.workflowState.update({
            where: { id: statesAfter[i].id },
            data: { order: newOrder },
          });
          reorderedCount++;
        }
      }

      return { reorderedCount };
    });

    return {
      id: existingState.id,
      workflowId: existingState.workflowId,
      name: existingState.name,
      order: existingState.order,
      cascadeDeleted: {
        breakpoints: breakpointsCount,
      },
      reorderedStates: result.reorderedCount,
      message: `State "${existingState.name}" deleted successfully. ${result.reorderedCount} states reordered.`,
    };
  } catch (error: any) {
    if (error.name === 'MCPError') {
      throw error;
    }
    throw handlePrismaError(error, 'delete_workflow_state');
  }
}
