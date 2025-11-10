import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import { ValidationError } from '../../types';

export const tool: Tool = {
  name: 'search_use_cases',
  description: 'Search use cases using component/area filtering and text search. Optimized for AI agents with deterministic results based on story/epic context and component relationships.',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: {
        type: 'string',
        description: 'Project ID to search within (required)',
      },
      query: {
        type: 'string',
        description: 'Text search query (searches key, title, area). Example: "password reset"',
      },
      area: {
        type: 'string',
        description: 'Filter by single feature area/component (exact match). Example: "Authentication"',
      },
      areas: {
        type: 'array',
        items: { type: 'string' },
        description: 'Filter by multiple areas (OR logic). Example: ["Authentication", "Email Service"]',
      },
      storyId: {
        type: 'string',
        description: 'Find use cases linked to this specific story',
      },
      epicId: {
        type: 'string',
        description: 'Find use cases linked to stories in this epic',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results to return (default: 20, max: 100)',
      },
      offset: {
        type: 'number',
        description: 'Pagination offset (default: 0)',
      },
    },
    required: ['projectId'],
  },
};

export const metadata = {
  category: 'use-cases',
  domain: 'planning',
  tags: ['use-case', 'search', 'semantic', 'requirements', 'ba'],
  version: '1.0.0',
  since: '2025-11-10',
};

export async function handler(prisma: PrismaClient, params: any) {
  const { projectId, query, area, areas, storyId, epicId, limit = 20, offset = 0 } = params;

  try {
    // Validate required parameters
    if (!projectId) {
      throw new ValidationError('Missing required parameter: projectId');
    }

    // Validate limit
    const resultLimit = Math.min(Math.max(1, limit || 20), 100);

    // Build where clause for component/story/epic based search
    const where: any = {
      projectId,
    };

    // Filter by single area
    if (area) {
      where.area = area;
    }

    // Filter by multiple areas (OR logic)
    if (areas && Array.isArray(areas) && areas.length > 0) {
      where.area = { in: areas };
    }

    // Filter by story (use cases linked to this story)
    if (storyId) {
      where.storyLinks = {
        some: {
          storyId,
        },
      };
    }

    // Filter by epic (use cases linked to stories in this epic)
    if (epicId) {
      where.storyLinks = {
        some: {
          story: {
            epicId,
          },
        },
      };
    }

    // Text search across key, title, area
    if (query) {
      where.OR = [
        { key: { contains: query, mode: 'insensitive' } },
        { title: { contains: query, mode: 'insensitive' } },
        { area: { contains: query, mode: 'insensitive' } },
      ];
    }

    const useCases = await prisma.useCase.findMany({
      where,
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
                status: true,
              },
            },
          },
        },
      },
      skip: offset,
      take: resultLimit,
      orderBy: { updatedAt: 'desc' },
    });

    // Format results for AI agent
    const formattedResults = useCases.map((uc) => {
      const latestVersion = uc.versions[0];
      return {
        id: uc.id,
        key: uc.key,
        title: uc.title,
        area: uc.area,
        summary: latestVersion?.summary,
        content: latestVersion?.content,
        version: latestVersion?.version,
        linkedStories: uc.storyLinks.map((link: any) => ({
          storyId: link.storyId,
          key: link.story.key,
          title: link.story.title,
          status: link.story.status,
          relation: link.relation,
        })),
        updatedAt: uc.updatedAt,
      };
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              filters: {
                projectId,
                query: query || null,
                area: area || null,
                areas: areas || null,
                storyId: storyId || null,
                epicId: epicId || null,
              },
              pagination: {
                offset,
                limit: resultLimit,
                returned: formattedResults.length,
              },
              useCases: formattedResults,
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
            error: error.message || 'Failed to search use cases',
          }, null, 2),
        },
      ],
      isError: true,
    };
  }
}
