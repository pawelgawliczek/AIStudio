/**
 * Create Epic Tool
 * Creates a new epic within a project
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import {
  CreateEpicParams,
  EpicResponse,
  NotFoundError,
} from '../../types';
import {
  formatEpic,
  generateNextKey,
  validateRequired,
  handlePrismaError,
} from '../../utils';

export const tool: Tool = {
  name: 'create_epic',
  description: 'Create a new epic within a project',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: {
        type: 'string',
        description: 'Project UUID',
      },
      title: {
        type: 'string',
        description: 'Epic title',
      },
      description: {
        type: 'string',
        description: 'Epic description',
      },
      priority: {
        type: 'number',
        description: 'Epic priority (higher = more important)',
      },
    },
    required: ['projectId', 'title'],
  },
};

export const metadata = {
  category: 'epics',
  domain: 'project_management',
  tags: ['epic', 'create'],
  version: '1.0.0',
  since: 'sprint-3',
};

export async function handler(
  prisma: PrismaClient,
  params: CreateEpicParams,
): Promise<EpicResponse> {
  try {
    validateRequired(params, ['projectId', 'title']);

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: params.projectId },
    });

    if (!project) {
      throw new NotFoundError('Project', params.projectId);
    }

    // Generate next epic key (e.g., EP-2, EP-3)
    const key = await generateNextKey(prisma, 'epic', params.projectId);

    // Create epic
    const epic = await prisma.epic.create({
      data: {
        projectId: params.projectId,
        key,
        title: params.title,
        description: params.description,
        status: 'planning',
        priority: params.priority ?? 0,
      },
      include: {
        _count: {
          select: { stories: true },
        },
      },
    });

    return formatEpic(epic, true);
  } catch (error: any) {
    if (error.name === 'MCPError') {
      throw error;
    }
    throw handlePrismaError(error, 'create_epic');
  }
}
