/**
 * Create Project Tool
 * Creates a new project without default structure
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import {
  CreateProjectParams,
  ProjectResponse,
  ValidationError,
} from '../../types';
import {
  formatProject,
  validateRequired,
  handlePrismaError,
} from '../../utils';

export const tool: Tool = {
  name: 'create_project',
  description: 'Create a new project without default structure. Use bootstrap_project for complete setup.',
  inputSchema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Project name (must be unique)',
      },
      description: {
        type: 'string',
        description: 'Project description',
      },
      repositoryUrl: {
        type: 'string',
        description: 'Git repository URL',
      },
    },
    required: ['name'],
  },
};

export const metadata = {
  category: 'projects',
  domain: 'project_management',
  tags: ['project', 'create'],
  version: '1.0.0',
  since: 'sprint-3',
};

export async function handler(
  prisma: PrismaClient,
  params: CreateProjectParams,
): Promise<ProjectResponse> {
  try {
    validateRequired(params, ['name']);

    // Check if project already exists
    const existing = await prisma.project.findUnique({
      where: { name: params.name },
    });

    if (existing) {
      throw new ValidationError(`Project with name "${params.name}" already exists`);
    }

    const project = await prisma.project.create({
      data: {
        name: params.name,
        description: params.description,
        repositoryUrl: params.repositoryUrl,
        status: 'active',
      },
      include: {
        _count: {
          select: { epics: true, stories: true },
        },
      },
    });

    return formatProject(project, true);
  } catch (error: any) {
    if (error.name === 'MCPError') {
      throw error;
    }
    throw handlePrismaError(error, 'create_project');
  }
}
