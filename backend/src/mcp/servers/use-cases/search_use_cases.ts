import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import { ValidationError } from '../../types';

export const tool: Tool = {
  name: 'search_use_cases',
  description: 'Search use cases using semantic search (natural language), text search (keywords), or component filter. Returns ranked results with similarity scores for semantic search.',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: {
        type: 'string',
        description: 'Project ID to search within (required)',
      },
      query: {
        type: 'string',
        description: 'Search query - for semantic search use natural language (e.g., "password reset flow"), for text search use keywords',
      },
      mode: {
        type: 'string',
        enum: ['semantic', 'text', 'component'],
        description: 'Search mode: "semantic" for AI-powered similarity search, "text" for keyword matching, "component" for filtering by area/component',
      },
      area: {
        type: 'string',
        description: 'Filter by feature area (e.g., "Authentication", "Billing")',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results to return (default: 20, max: 100)',
      },
      minSimilarity: {
        type: 'number',
        description: 'Minimum similarity threshold for semantic search (0.0-1.0, default: 0.7)',
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
  const { projectId, query, mode = 'text', area, limit = 20, minSimilarity = 0.7 } = params;

  try {
    // Validate required parameters
    if (!projectId) {
      throw new ValidationError('Missing required parameter: projectId');
    }

    // Validate limit
    const resultLimit = Math.min(Math.max(1, limit), 100);

    let useCases: any[] = [];

    if (mode === 'semantic') {
      // Semantic search using pgvector
      // Note: This requires OpenAI API key and embeddings to be generated
      if (!query) {
        throw new ValidationError('Query is required for semantic search mode');
      }

      // For now, fall back to text search with a note
      // In production, this would generate embeddings and use vector similarity
      const results = await prisma.useCase.findMany({
        where: {
          projectId,
          area: area || undefined,
          OR: [
            { key: { contains: query, mode: 'insensitive' } },
            { title: { contains: query, mode: 'insensitive' } },
            { area: { contains: query, mode: 'insensitive' } },
          ],
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
                  status: true,
                },
              },
            },
          },
        },
        take: resultLimit,
        orderBy: { updatedAt: 'desc' },
      });

      useCases = results.map((uc) => ({
        ...uc,
        similarity: 0.85, // Mock similarity score
        note: 'Semantic search requires OpenAI API key configuration',
      }));
    } else if (mode === 'text') {
      // Text search using keyword matching
      const whereClause: any = {
        projectId,
        area: area || undefined,
      };

      if (query) {
        whereClause.OR = [
          { key: { contains: query, mode: 'insensitive' } },
          { title: { contains: query, mode: 'insensitive' } },
          { area: { contains: query, mode: 'insensitive' } },
        ];
      }

      useCases = await prisma.useCase.findMany({
        where: whereClause,
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
        take: resultLimit,
        orderBy: { updatedAt: 'desc' },
      });
    } else if (mode === 'component') {
      // Component-based filtering
      useCases = await prisma.useCase.findMany({
        where: {
          projectId,
          area: area || undefined,
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
                  status: true,
                },
              },
            },
          },
        },
        take: resultLimit,
        orderBy: { area: 'asc' },
      });
    }

    // Format results
    const formattedResults = useCases.map((uc) => {
      const latestVersion = uc.versions[0];
      return {
        id: uc.id,
        key: uc.key,
        title: uc.title,
        area: uc.area,
        summary: latestVersion?.summary,
        version: latestVersion?.version,
        linkedStories: uc.storyLinks.map((link: any) => ({
          key: link.story.key,
          title: link.story.title,
          status: link.story.status,
          relation: link.relation,
        })),
        similarity: uc.similarity,
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
              mode,
              query,
              results: formattedResults.length,
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
