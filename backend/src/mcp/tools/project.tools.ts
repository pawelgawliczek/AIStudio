/**
 * Project Management MCP Tools
 */

import { PrismaClient } from '@prisma/client';
import {
  BootstrapProjectParams,
  CreateProjectParams,
  ListProjectsParams,
  GetProjectParams,
  ProjectResponse,
  NotFoundError,
  ValidationError,
} from '../types';
import {
  formatProject,
  validateRequired,
  handlePrismaError,
  getSystemUserId,
} from '../utils';

/**
 * Bootstrap a new project with default structure
 * This creates a project with initial epic and framework configuration
 */
export async function bootstrapProject(
  prisma: PrismaClient,
  params: BootstrapProjectParams,
): Promise<{
  project: ProjectResponse;
  defaultEpic: any;
  defaultFramework: any;
  message: string;
}> {
  try {
    validateRequired(params, ['name']);

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

/**
 * Create a new project
 */
export async function createProject(
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

/**
 * List all projects
 */
export async function listProjects(
  prisma: PrismaClient,
  params: ListProjectsParams = {},
): Promise<ProjectResponse[]> {
  try {
    const projects = await prisma.project.findMany({
      where: {
        ...(params.status && { status: params.status }),
      },
      include: {
        _count: {
          select: { epics: true, stories: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return projects.map((p: any) => formatProject(p, true));
  } catch (error: any) {
    throw handlePrismaError(error, 'list_projects');
  }
}

/**
 * Get a single project by ID
 */
export async function getProject(
  prisma: PrismaClient,
  params: GetProjectParams,
): Promise<ProjectResponse> {
  try {
    validateRequired(params, ['projectId']);

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
