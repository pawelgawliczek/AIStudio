import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import { ValidationError } from '../../types';

export const tool: Tool = {
  name: 'find_related_use_cases',
  description: 'Find use cases related to a story. Returns use cases that are: 1) Already linked to the story, 2) Linked to other stories in the same epic, 3) Share the same component/area. Perfect for AI agents gathering context before implementing a story.',
  inputSchema: {
    type: 'object',
    properties: {
      storyId: {
        type: 'string',
        description: 'Story ID to find related use cases for',
      },
      includeEpicUseCases: {
        type: 'boolean',
        description: 'Include use cases from stories in the same epic (default: true)',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results (default: 10, max: 50)',
      },
    },
    required: ['storyId'],
  },
};

export const metadata = {
  category: 'use-cases',
  domain: 'planning',
  tags: ['use-case', 'story', 'context', 'related', 'ai-agent'],
  version: '1.0.0',
  since: '2025-11-10',
};

export async function handler(prisma: PrismaClient, params: any) {
  const { storyId, includeEpicUseCases = true, limit = 10 } = params;

  try {
    // Validate required parameters
    if (!storyId) {
      throw new ValidationError('Missing required parameter: storyId');
    }

    const resultLimit = Math.min(Math.max(1, limit || 10), 50);

    // Get the story details
    const story = await prisma.story.findUnique({
      where: { id: storyId },
      select: {
        id: true,
        key: true,
        title: true,
        description: true,
        projectId: true,
        epicId: true,
        useCaseLinks: {
          include: {
            useCase: {
              include: {
                versions: {
                  orderBy: { version: 'desc' },
                  take: 1,
                  include: {
                    createdBy: {
                      select: {
                        name: true,
                        email: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!story) {
      throw new ValidationError(`Story with ID ${storyId} not found`);
    }

    const results: any[] = [];
    const seenIds = new Set<string>();

    // 1. Use cases already linked to this story (highest priority)
    for (const link of story.useCaseLinks) {
      if (!seenIds.has(link.useCase.id)) {
        seenIds.add(link.useCase.id);
        const latestVersion = link.useCase.versions[0];
        results.push({
          id: link.useCase.id,
          key: link.useCase.key,
          title: link.useCase.title,
          area: link.useCase.area,
          summary: latestVersion?.summary,
          content: latestVersion?.content,
          version: latestVersion?.version,
          relation: link.relation,
          relevance: 'directly_linked',
          relevanceScore: 1.0,
        });
      }
    }

    // 2. Use cases from the same epic
    if (includeEpicUseCases && story.epicId && results.length < resultLimit) {
      const epicUseCases = await prisma.useCase.findMany({
        where: {
          projectId: story.projectId,
          storyLinks: {
            some: {
              story: {
                epicId: story.epicId,
                id: { not: storyId },
              },
            },
          },
        },
        include: {
          versions: {
            orderBy: { version: 'desc' },
            take: 1,
            include: {
              createdBy: {
                select: {
                  name: true,
                  email: true,
                },
              },
            },
          },
          storyLinks: {
            include: {
              story: {
                select: {
                  key: true,
                  title: true,
                },
              },
            },
          },
        },
        take: resultLimit - results.length,
      });

      for (const uc of epicUseCases) {
        if (!seenIds.has(uc.id)) {
          seenIds.add(uc.id);
          const latestVersion = uc.versions[0];
          results.push({
            id: uc.id,
            key: uc.key,
            title: uc.title,
            area: uc.area,
            summary: latestVersion?.summary,
            content: latestVersion?.content,
            version: latestVersion?.version,
            relevance: 'same_epic',
            relevanceScore: 0.8,
            linkedStories: uc.storyLinks.map((link) => ({
              key: link.story.key,
              title: link.story.title,
              relation: link.relation,
            })),
          });
        }
      }
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              story: {
                id: story.id,
                key: story.key,
                title: story.title,
              },
              resultsCount: results.length,
              useCases: results,
              context: {
                message: 'Use cases ordered by relevance: directly linked (1.0) > same epic (0.8)',
                usage: 'Use these use cases to understand requirements before implementing the story',
              },
            },
            null,
            2,
          ),
        },
      ],
    };
  } catch (error: any) {
    if (error.name === 'ValidationError') {
      throw error;
    }
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: error.message || 'Failed to find related use cases',
          }, null, 2),
        },
      ],
      isError: true,
    };
  }
}
