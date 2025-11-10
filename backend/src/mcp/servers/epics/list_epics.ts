/**
 * List Epics Tool
 * Lists all epics for a project with optional status filter and pagination
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import {
  ListEpicsParams,
  EpicResponse,
  PaginatedResponse,
  NotFoundError,
} from '../../types';
import {
  formatEpic,
  validateRequired,
  handlePrismaError,
} from '../../utils';

export const tool: Tool = {
  name: 'list_epics',
  description: 'List all epics for a project with optional status filter and pagination',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: {
        type: 'string',
        description: 'Project UUID',
      },
      status: {
        type: 'string',
        enum: ['planning', 'in_progress', 'done', 'archived'],
        description: 'Filter by epic status',
      },
      page: {
        type: 'number',
        description: 'Page number (default: 1)',
        minimum: 1,
      },
      pageSize: {
        type: 'number',
        description: 'Items per page (default: 20, max: 100)',
        minimum: 1,
        maximum: 100,
      },
    },
    required: ['projectId'],
  },
};

export const metadata = {
  category: 'epics',
  domain: 'project_management',
  tags: ['epic', 'list', 'pagination', 'filter'],
  version: '2.0.0',
  since: 'sprint-3',
  updated: 'sprint-4.5',
};

export async function handler(
  prisma: PrismaClient,
  params: ListEpicsParams,
): Promise<PaginatedResponse<EpicResponse>> {
  try {
    validateRequired(params, ['projectId']);

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: params.projectId },
    });

    if (!project) {
      throw new NotFoundError('Project', params.projectId);
    }

    const page = params.page || 1;
    const pageSize = Math.min(params.pageSize || 20, 100);
    const skip = (page - 1) * pageSize;

    const whereClause: any = {
      projectId: params.projectId,
    };
    if (params.status) {
      whereClause.status = params.status;
    }

    // Get total count
    const total = await prisma.epic.count({ where: whereClause });

    // Get paginated data
    const epics = await prisma.epic.findMany({
      where: whereClause,
      skip,
      take: pageSize,
      include: {
        _count: {
          select: { stories: true },
        },
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });

    const totalPages = Math.ceil(total / pageSize);

    return {
      data: epics.map((e: any) => formatEpic(e, true)),
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
    throw handlePrismaError(error, 'list_epics');
  }
}
