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
      fields: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Specific fields to return for token efficiency. Default: all. Options: id, projectId, title, description, status, priority, createdAt, updatedAt, storyCount',
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
    validateRequired(params as unknown as Record<string, unknown>, ['projectId']);

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

    // Valid epic fields that can be requested
    const validEpicFields = new Set([
      'id', 'projectId', 'key', 'title', 'description', 'status',
      'priority', 'createdAt', 'updatedAt', 'storyCount',
    ]);

    // Format epics with optional field filtering
    const formattedEpics = epics.map((e: any) => {
      const formatted = formatEpic(e, true);

      // Apply field filtering if specified
      if (params.fields && params.fields.length > 0) {
        const requestedFields = new Set(params.fields.filter(f => validEpicFields.has(f)));
        const filteredEpic: any = {};
        const omittedFields: string[] = [];

        // Always include id for reference
        filteredEpic.id = formatted.id;

        for (const field of validEpicFields) {
          if (requestedFields.has(field)) {
            filteredEpic[field] = (formatted as any)[field];
          } else if (field !== 'id' && (formatted as any)[field] !== undefined) {
            omittedFields.push(field);
          }
        }

        if (omittedFields.length > 0) {
          filteredEpic._fieldSelection = {
            requested: Array.from(requestedFields),
            omitted: omittedFields,
            fetchCommand: `get_epic({ epicId: '${formatted.id}' })`,
          };
        }

        return filteredEpic;
      }

      return formatted;
    });

    return {
      data: formattedEpics,
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
