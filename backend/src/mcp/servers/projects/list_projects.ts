/**
 * List Projects Tool
 * Lists all projects with optional status filter and pagination
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import {
  ListProjectsParams,
  ProjectResponse,
  PaginatedResponse,
} from '../../types';
import {
  formatProject,
  handlePrismaError,
} from '../../utils';

export const tool: Tool = {
  name: 'list_projects',
  description: 'List all projects with optional status filter and pagination',
  inputSchema: {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        enum: ['active', 'archived'],
        description: 'Filter by project status',
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
  },
};

export const metadata = {
  category: 'projects',
  domain: 'project_management',
  tags: ['project', 'list', 'pagination', 'filter'],
  version: '2.0.0',
  since: 'sprint-3',
  updated: 'sprint-4.5',
};

export async function handler(
  prisma: PrismaClient,
  params: ListProjectsParams = {},
): Promise<PaginatedResponse<ProjectResponse>> {
  try {
    const page = params.page || 1;
    const pageSize = Math.min(params.pageSize || 20, 100);
    const skip = (page - 1) * pageSize;

    const whereClause: any = {};
    if (params.status) {
      whereClause.status = params.status;
    }

    // Get total count
    const total = await prisma.project.count({ where: whereClause });

    // Get paginated data
    const projects = await prisma.project.findMany({
      where: whereClause,
      skip,
      take: pageSize,
      include: {
        _count: {
          select: { epics: true, stories: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const totalPages = Math.ceil(total / pageSize);

    return {
      data: projects.map((p: any) => formatProject(p, true)),
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
    throw handlePrismaError(error, 'list_projects');
  }
}
