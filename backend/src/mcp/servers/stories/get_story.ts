/**
 * Get Story Tool
 * Retrieves details for a specific story by ID with optional related data
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import {
  GetStoryParams,
  StoryResponse,
  NotFoundError,
} from '../../types';
import {
  formatStory,
  validateRequired,
  handlePrismaError,
} from '../../utils';

export const tool: Tool = {
  name: 'get_story',
  description: 'Get details for a specific story by ID with optional related data',
  inputSchema: {
    type: 'object',
    properties: {
      storyId: {
        type: 'string',
        description: 'Story UUID',
      },
      includeSubtasks: {
        type: 'boolean',
        description: 'Include subtasks in response',
      },
      includeUseCases: {
        type: 'boolean',
        description: 'Include linked use cases in response',
      },
      includeCommits: {
        type: 'boolean',
        description: 'Include linked commits in response (last 10)',
      },
    },
    required: ['storyId'],
  },
};

export const metadata = {
  category: 'stories',
  domain: 'project_management',
  tags: ['story', 'retrieve', 'detail', 'subtasks', 'use-cases', 'commits'],
  version: '1.0.0',
  since: 'sprint-3',
};

export async function handler(
  prisma: PrismaClient,
  params: GetStoryParams,
): Promise<StoryResponse> {
  try {
    validateRequired(params, ['storyId']);

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
        take: 10, // Limit to last 10 commits
      };
    }

    const story = await prisma.story.findUnique({
      where: { id: params.storyId },
      include: Object.keys(includeClause).length > 0 ? includeClause : undefined,
    });

    if (!story) {
      throw new NotFoundError('Story', params.storyId);
    }

    return formatStory(
      story,
      params.includeSubtasks || params.includeUseCases || params.includeCommits,
    );
  } catch (error: any) {
    if (error.name === 'MCPError') {
      throw error;
    }
    throw handlePrismaError(error, 'get_story');
  }
}
