/**
 * Get Project Tool
 * Retrieves details for a specific project by ID
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import {
  GetProjectParams,
  ProjectResponse,
  NotFoundError,
} from '../../types';
import {
  formatProject,
  validateRequired,
  handlePrismaError,
} from '../../utils';

export const tool: Tool = {
  name: 'get_project',
  description: 'Get details for a specific project by ID',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: {
        type: 'string',
        description: 'Project UUID',
      },
    },
    required: ['projectId'],
  },
};

export const metadata = {
  category: 'projects',
  domain: 'project_management',
  tags: ['project', 'retrieve', 'detail'],
  version: '1.0.0',
  since: 'sprint-3',
};

export async function handler(
  prisma: PrismaClient,
  params: GetProjectParams,
): Promise<ProjectResponse> {
  try {
    validateRequired(params as unknown as Record<string, unknown>, ['projectId']);

    const project = await prisma.project.findUnique({
      where: { id: params.projectId },
      include: {
        _count: {
          select: { epics: true, stories: true },
        },
      },
    });

    if (!project) {
      throw new NotFoundError('Project', params.projectId);
    }

    return formatProject(project, true);
  } catch (error: any) {
    if (error.name === 'MCPError') {
      throw error;
    }
    throw handlePrismaError(error, 'get_project');
  }
}
