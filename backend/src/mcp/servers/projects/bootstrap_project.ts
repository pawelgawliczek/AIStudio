/**
 * Bootstrap Project Tool
 * Creates a new project with default structure, including initial epic and framework configuration
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import {
  BootstrapProjectParams,
  ProjectResponse,
  ValidationError,
} from '../../types';
import {
  formatProject,
  validateRequired,
  handlePrismaError,
  getSystemUserId,
} from '../../utils';

export const tool: Tool = {
  name: 'bootstrap_project',
  description: 'Bootstrap a new project with default epic and framework. Recommended for new projects.',
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
      defaultFramework: {
        type: 'string',
        description: 'Name for the default framework (default: "Single Agent")',
      },
    },
    required: ['name'],
  },
};

export const metadata = {
  category: 'projects',
  domain: 'project_management',
  tags: ['project', 'bootstrap', 'initialization', 'setup'],
  version: '1.0.0',
  since: 'sprint-3',
};

export async function handler(
  prisma: PrismaClient,
  params: BootstrapProjectParams,
): Promise<{
  project: ProjectResponse;
  defaultEpic: any;
  defaultFramework: any;
  message: string;
}> {
  try {
    validateRequired(params as unknown as Record<string, unknown>, ['name']);

    await getSystemUserId(prisma); // Ensure system user exists

    // Check if project already exists
    const existing = await prisma.project.findUnique({
      where: { name: params.name },
    });

    if (existing) {
      throw new ValidationError(`Project with name "${params.name}" already exists`);
    }

    // Create project with default epic and framework in a transaction
    const result = await prisma.$transaction(async (tx: any) => {
      // 1. Create project
      const project = await tx.project.create({
        data: {
          name: params.name,
          description: params.description || `AI Studio project: ${params.name}`,
          repositoryUrl: params.repositoryUrl,
          status: 'active',
        },
        include: {
          _count: {
            select: { epics: true, stories: true },
          },
        },
      });

      // 2. Create default epic
      const defaultEpic = await tx.epic.create({
        data: {
          projectId: project.id,
          key: 'EP-1',
          title: 'Initial Development',
          description: 'Default epic for initial project setup and stories',
          status: 'planning',
          priority: 1,
        },
      });

      // 3. Create default framework (simple single-agent flow)
      const defaultFramework = await tx.agentFramework.create({
        data: {
          projectId: project.id,
          name: params.defaultFramework || 'Single Agent',
          description: 'Default single-agent framework for story implementation',
          config: {
            agents: ['developer'],
            sequence: ['developer'],
            routing: 'sequential',
          },
          active: true,
        },
      });

      return { project, defaultEpic, defaultFramework };
    });

    return {
      project: formatProject(result.project, true),
      defaultEpic: {
        id: result.defaultEpic.id,
        key: result.defaultEpic.key,
        title: result.defaultEpic.title,
      },
      defaultFramework: {
        id: result.defaultFramework.id,
        name: result.defaultFramework.name,
      },
      message: `Project "${params.name}" bootstrapped successfully with default epic and framework`,
    };
  } catch (error: any) {
    if (error.name === 'MCPError') {
      throw error;
    }
    throw handlePrismaError(error, 'bootstrap_project');
  }
}
