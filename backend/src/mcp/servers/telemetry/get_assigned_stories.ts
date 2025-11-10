import { PrismaClient } from '@prisma/client';
import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const tool: Tool = {
  name: 'get_assigned_stories',
  description: 'Get stories assigned to a specific framework or agent. Useful for agents to discover their work queue.',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: {
        type: 'string',
        description: 'Project ID to search within',
      },
      frameworkId: {
        type: 'string',
        description: 'Framework ID to get assigned stories for (optional)',
      },
      status: {
        type: 'string',
        enum: [
          'backlog',
          'planning',
          'analysis',
          'architecture',
          'design',
          'implementation',
          'review',
          'qa',
          'done',
          'blocked',
        ],
        description: 'Filter by story status (optional)',
      },
      includeSubtasks: {
        type: 'boolean',
        description: 'Include subtasks in response (default: false)',
      },
      includeUseCases: {
        type: 'boolean',
        description: 'Include linked use cases (default: false)',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of stories to return (default: 20)',
      },
    },
    required: ['projectId'],
  },
};

export const metadata = {
  category: 'telemetry',
  domain: 'Story Management & Agent Assignment',
  tags: ['stories', 'assignment', 'framework', 'agent', 'work-queue'],
  version: '1.0.0',
  since: '2025-11-10',
};

export async function handler(prisma: PrismaClient, params: any) {
  // Validate required fields
  if (!params.projectId) {
    throw new Error('projectId is required');
  }

  const limit = params.limit || 20;
  const includeSubtasks = params.includeSubtasks || false;
  const includeUseCases = params.includeUseCases || false;

  // Build where clause
  const where: any = {
    projectId: params.projectId,
  };

  if (params.frameworkId) {
    where.frameworkId = params.frameworkId;
  }

  if (params.status) {
    where.status = params.status;
  }

  // Fetch stories
  const stories = await prisma.story.findMany({
    where,
    include: {
      epic: {
        select: {
          id: true,
          key: true,
          title: true,
        },
      },
      framework: {
        select: {
          id: true,
          name: true,
        },
      },
      subtasks: includeSubtasks
        ? {
            select: {
              id: true,
              title: true,
              status: true,
              assigneeType: true,
            },
          }
        : false,
      useCases: includeUseCases
        ? {
            select: {
              useCase: {
                select: {
                  id: true,
                  key: true,
                  title: true,
                  area: true,
                },
              },
              relation: true,
            },
          }
        : false,
    },
    orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    take: limit,
  });

  // Format response
  const formattedStories = stories.map((story) => ({
    id: story.id,
    key: story.key,
    title: story.title,
    description: story.description,
    status: story.status,
    type: story.type,
    priority: story.priority,
    businessComplexity: story.businessComplexity,
    technicalComplexity: story.technicalComplexity,
    estimatedTokens: story.estimatedTokens,
    components: story.components,
    layers: story.layers,
    epic: story.epic
      ? {
          id: story.epic.id,
          key: story.epic.key,
          title: story.epic.title,
        }
      : null,
    framework: story.framework
      ? {
          id: story.framework.id,
          name: story.framework.name,
        }
      : null,
    subtasks: includeSubtasks
      ? story.subtasks.map((st) => ({
          id: st.id,
          title: st.title,
          status: st.status,
          assigneeType: st.assigneeType,
        }))
      : undefined,
    useCases: includeUseCases
      ? story.useCases.map((uc) => ({
          id: uc.useCase.id,
          key: uc.useCase.key,
          title: uc.useCase.title,
          area: uc.useCase.area,
          relation: uc.relation,
        }))
      : undefined,
    createdAt: story.createdAt.toISOString(),
    updatedAt: story.updatedAt.toISOString(),
  }));

  return {
    success: true,
    count: formattedStories.length,
    stories: formattedStories,
    filters: {
      projectId: params.projectId,
      frameworkId: params.frameworkId || null,
      status: params.status || null,
    },
    message: `Found ${formattedStories.length} assigned stories`,
  };
}
