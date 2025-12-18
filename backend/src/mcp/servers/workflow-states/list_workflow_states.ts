/**
 * List Workflow States Tool
 * Lists all states for a workflow, ordered by execution order
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import {
  ListWorkflowStatesParams,
  WorkflowStateResponse,
  PaginatedResponse,
  NotFoundError,
} from '../../types';
import { formatWorkflowState, validateRequired, handlePrismaError } from '../../utils';

export const tool: Tool = {
  name: 'list_workflow_states',
  description:
    'List all states for a workflow, ordered by execution order. Supports pagination.',
  inputSchema: {
    type: 'object',
    properties: {
      workflowId: {
        type: 'string',
        description: 'Workflow UUID (required)',
      },
      page: {
        type: 'number',
        description: 'Page number (default: 1)',
      },
      pageSize: {
        type: 'number',
        description: 'Items per page (default: 20, max: 100)',
      },
      includeComponent: {
        type: 'boolean',
        description: 'Include component details in response (default: false)',
      },
    },
    required: ['workflowId'],
  },
};

export const metadata = {
  category: 'workflow_states',
  domain: 'story_runner',
  tags: ['workflow', 'state', 'list', 'story-runner'],
  version: '1.0.0',
  since: 'ST-144',
};

export async function handler(
  prisma: PrismaClient,
  params: ListWorkflowStatesParams,
): Promise<PaginatedResponse<WorkflowStateResponse>> {
  try {
    validateRequired(params as unknown as Record<string, unknown>, ['workflowId']);

    // Verify workflow exists
    const workflow = await prisma.workflow.findUnique({
      where: { id: params.workflowId },
    });

    if (!workflow) {
      throw new NotFoundError('Workflow', params.workflowId);
    }

    // Pagination
    const page = Math.max(1, params.page || 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize || 20));
    const skip = (page - 1) * pageSize;

    // Build include clause
    const includeClause: any = {};
    if (params.includeComponent) {
      includeClause.component = true;
    }

    // Get total count
    const total = await prisma.workflowState.count({
      where: { workflowId: params.workflowId },
    });

    // Get paginated states ordered by execution order
    const states = await prisma.workflowState.findMany({
      where: { workflowId: params.workflowId },
      orderBy: { order: 'asc' },
      skip,
      take: pageSize,
      include: Object.keys(includeClause).length > 0 ? includeClause : undefined,
    });

    const totalPages = Math.ceil(total / pageSize);

    return {
      data: states.map((state) =>
        formatWorkflowState(state, params.includeComponent),
      ),
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  } catch (error: any) {
    if (error.name === 'MCPError') {
      throw error;
    }
    throw handlePrismaError(error, 'list_workflow_states');
  }
}
