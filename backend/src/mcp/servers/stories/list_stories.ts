/**
 * List Stories Tool
 * Lists stories with optional filters and pagination
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import {
  ListStoriesParams,
  StoryResponse,
  PaginatedResponse,
} from '../../types';
import {
  formatStory,
  handlePrismaError,
} from '../../utils';

export const tool: Tool = {
  name: 'list_stories',
  description: 'List stories with optional filters and pagination',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: {
        type: 'string',
        description: 'Filter by project UUID',
      },
      epicId: {
        type: 'string',
        description: 'Filter by epic UUID',
      },
      status: {
        type: 'string',
        enum: ['planning', 'analysis', 'architecture', 'design', 'impl', 'review', 'qa', 'done'],
        description: 'Filter by story status',
      },
      type: {
        type: 'string',
        enum: ['feature', 'bug', 'defect', 'chore', 'spike'],
        description: 'Filter by story type',
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
  category: 'stories',
  domain: 'project_management',
  tags: ['story', 'list', 'pagination', 'filter'],
  version: '2.0.0',
  since: 'sprint-3',
  updated: 'sprint-4.5',
};

export async function handler(
  prisma: PrismaClient,
  params: ListStoriesParams = {},
): Promise<PaginatedResponse<StoryResponse>> {
  try {
    const page = params.page || 1;
    const pageSize = Math.min(params.pageSize || 20, 100);
    const skip = (page - 1) * pageSize;

    // Build where clause dynamically
    const whereClause: any = {};

    if (params.projectId) {
      whereClause.projectId = params.projectId;
    }

    if (params.epicId) {
      whereClause.epicId = params.epicId;
    }

    if (params.status) {
      whereClause.status = params.status;
    }

    if (params.type) {
      whereClause.type = params.type;
    }

    // Get total count
    const total = await prisma.story.count({ where: whereClause });

    // Get paginated data
    const stories = await prisma.story.findMany({
      where: whereClause,
      skip,
      take: pageSize,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });

    const totalPages = Math.ceil(total / pageSize);

    return {
      data: stories.map((s: any) => formatStory(s)),
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
    throw handlePrismaError(error, 'list_stories');
  }
}
