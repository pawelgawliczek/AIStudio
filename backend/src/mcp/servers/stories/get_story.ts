/**
 * Get Story Tool
 * Retrieves details for a specific story by ID with optional related data
 *
 * ST-188: Added story key resolution support (accepts ST-123 or UUID)
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import { resolveStory } from '../../shared/resolve-identifiers';
import { storyFetchCommand } from '../../truncation-utils';
import {
  GetStoryParams,
  StoryResponse,
  NotFoundError,
} from '../../types';
import {
  formatStory,
  handlePrismaError,
} from '../../utils';

export const tool: Tool = {
  name: 'get_story',
  description: 'Get story details by ID or key (ST-123). For text search use search_stories; for filtered lists use list_stories.',
  inputSchema: {
    type: 'object',
    properties: {
      story: {
        type: 'string',
        description: 'Story key (e.g., ST-123) or UUID',
      },
      storyId: {
        type: 'string',
        description: 'Story UUID (deprecated - use story param instead)',
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
    required: [],  // Either story or storyId required, validated in handler
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
  params: GetStoryParams & { story?: string },
): Promise<StoryResponse> {
  try {
    // ST-188: Resolve story key or UUID
    const storyInput = (params as any).story || params.storyId;
    if (!storyInput) {
      throw new Error('Either story or storyId is required');
    }

    const resolved = await resolveStory(prisma, storyInput);
    if (!resolved) {
      throw new NotFoundError('Story', storyInput);
    }
    const storyId = resolved.id;

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
      where: { id: storyId },
      include: Object.keys(includeClause).length > 0 ? includeClause : undefined,
    });

    if (!story) {
      throw new NotFoundError('Story', storyInput);
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
          where: { id: storyId },
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
