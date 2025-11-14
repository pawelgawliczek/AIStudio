/**
 * Search Stories Tool
 * Search stories by ID, key, or title with flexible matching
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import {
  StoryResponse,
} from '../../types';
import {
  formatStory,
  handlePrismaError,
} from '../../utils';

export interface SearchStoriesParams {
  projectId?: string;
  query?: string;
  storyId?: string;
  storyKey?: string;
  includeSubtasks?: boolean;
  includeUseCases?: boolean;
  includeCommits?: boolean;
  limit?: number;
}

export const tool: Tool = {
  name: 'search_stories',
  description: 'Search stories by ID, key, or title. Supports exact match (by ID/key) or fuzzy search (by title/query)',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: {
        type: 'string',
        description: 'Filter by project UUID (optional)',
      },
      query: {
        type: 'string',
        description: 'Search text to match against story title, key, or description (case-insensitive)',
      },
      storyId: {
        type: 'string',
        description: 'Exact story UUID to find',
      },
      storyKey: {
        type: 'string',
        description: 'Exact story key to find (e.g., ST-25)',
      },
      includeSubtasks: {
        type: 'boolean',
        description: 'Include subtasks in response (default: false)',
      },
      includeUseCases: {
        type: 'boolean',
        description: 'Include linked use cases in response (default: false)',
      },
      includeCommits: {
        type: 'boolean',
        description: 'Include linked commits in response (default: false)',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results (default: 10, max: 50)',
        minimum: 1,
        maximum: 50,
      },
    },
  },
};

export const metadata = {
  category: 'stories',
  domain: 'project_management',
  tags: ['story', 'search', 'find', 'query'],
  version: '1.0.0',
  since: 'sprint-5',
};

export async function handler(
  prisma: PrismaClient,
  params: SearchStoriesParams = {},
): Promise<StoryResponse[]> {
  try {
    const limit = Math.min(params.limit || 10, 50);

    // Build include clause for related data
    const includeClause: any = {};

    if (params.includeSubtasks) {
      includeClause.subtasks = {
        orderBy: { createdAt: 'asc' },
      };
    }

    if (params.includeUseCases) {
      includeClause.useCaseLinks = {
        include: {
          useCase: {
            include: {
              versions: {
                orderBy: { version: 'desc' },
                take: 1,
              },
            },
          },
        },
      };
    }

    if (params.includeCommits) {
      includeClause.commits = {
        include: {
          files: true,
        },
        orderBy: { timestamp: 'desc' },
        take: 10,
      };
    }

    // Priority 1: Search by exact ID
    if (params.storyId) {
      const story = await prisma.story.findUnique({
        where: { id: params.storyId },
        include: Object.keys(includeClause).length > 0 ? includeClause : undefined,
      });

      return story ? [formatStory(story, true)] : [];
    }

    // Priority 2: Search by exact key
    if (params.storyKey) {
      const whereClause: any = { key: params.storyKey };
      if (params.projectId) {
        whereClause.projectId = params.projectId;
      }

      const story = await prisma.story.findFirst({
        where: whereClause,
        include: Object.keys(includeClause).length > 0 ? includeClause : undefined,
      });

      return story ? [formatStory(story, true)] : [];
    }

    // Priority 3: Search by query (fuzzy match on title, key, description)
    if (params.query) {
      const whereClause: any = {
        OR: [
          { key: { contains: params.query, mode: 'insensitive' } },
          { title: { contains: params.query, mode: 'insensitive' } },
          { description: { contains: params.query, mode: 'insensitive' } },
        ],
      };

      if (params.projectId) {
        whereClause.projectId = params.projectId;
      }

      const stories = await prisma.story.findMany({
        where: whereClause,
        include: Object.keys(includeClause).length > 0 ? includeClause : undefined,
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        take: limit,
      });

      return stories.map((s: any) => formatStory(s, true));
    }

    // If no search criteria provided, return empty array
    return [];
  } catch (error: any) {
    throw handlePrismaError(error, 'search_stories');
  }
}
