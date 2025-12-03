/**
 * Get Story Tool
 * Retrieves details for a specific story by ID with optional related data
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import { storyFetchCommand } from '../../truncation-utils';
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
      responseMode: {
        type: 'string',
        enum: ['minimal', 'standard', 'full'],
        description:
          'Response detail level for token efficiency. minimal=key fields only (id, key, title, status, type), standard=all fields without relations (default), full=everything including all related data',
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

    const formatted = formatStory(
      story,
      params.includeSubtasks || params.includeUseCases || params.includeCommits,
    );

    // Apply responseMode filtering for token efficiency
    const responseMode = params.responseMode || 'standard';

    if (responseMode === 'minimal') {
      // Return only key fields for token efficiency
      const minimalFields = ['id', 'key', 'title', 'status', 'type', 'summary'];
      const minimal: any = {};
      const omittedFields: string[] = [];

      for (const field of minimalFields) {
        minimal[field] = (formatted as any)[field];
      }

      // Track omitted fields
      for (const key of Object.keys(formatted)) {
        if (!minimalFields.includes(key) && (formatted as any)[key] !== undefined) {
          omittedFields.push(key);
        }
      }

      minimal._responseMode = {
        mode: 'minimal',
        omittedFields,
        fetchCommand: storyFetchCommand(formatted.id, 'responseMode: full'),
      };

      return minimal as StoryResponse;
    }

    if (responseMode === 'full') {
      // Force include all related data
      if (!params.includeSubtasks || !params.includeUseCases || !params.includeCommits) {
        // Re-fetch with all relations if not already included
        const fullStory = await prisma.story.findUnique({
          where: { id: params.storyId },
          include: {
            subtasks: { orderBy: { createdAt: 'asc' } },
            useCaseLinks: {
              include: {
                useCase: {
                  include: {
                    versions: { orderBy: { version: 'desc' }, take: 1 },
                  },
                },
              },
            },
            commits: {
              include: { files: true },
              orderBy: { timestamp: 'desc' },
              take: 10,
            },
          },
        });

        if (fullStory) {
          const fullFormatted = formatStory(fullStory, true);
          (fullFormatted as any)._responseMode = { mode: 'full' };
          return fullFormatted;
        }
      }

      (formatted as any)._responseMode = { mode: 'full' };
      return formatted;
    }

    // Standard mode - return as-is
    return formatted;
  } catch (error: any) {
    if (error.name === 'MCPError') {
      throw error;
    }
    throw handlePrismaError(error, 'get_story');
  }
}
