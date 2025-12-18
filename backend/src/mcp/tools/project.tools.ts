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
  PaginatedResponse,
  NotFoundError,
  ValidationError,
} from '../types/';
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
 * List all projects with pagination
 */
export async function listProjects(
  prisma: PrismaClient,
  params: ListProjectsParams = {},
): Promise<PaginatedResponse<ProjectResponse>> {
  try {
    const page = params.page || 1;
    const pageSize = Math.min(params.pageSize || 20, 100);
    const skip = (page - 1) * pageSize;

    const whereClause: any = {};
    if (params.status) {
      whereClause.status = params.status;
    }

    // Get total count
    const total = await prisma.project.count({ where: whereClause });

    // Get paginated data
    const projects = await prisma.project.findMany({
      where: whereClause,
      skip,
      take: pageSize,
      include: {
        _count: {
          select: { epics: true, stories: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const totalPages = Math.ceil(total / pageSize);

    return {
      data: projects.map((p: any) => formatProject(p, true)),
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
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

/**
 * Get aggregated statistics for a project (Sprint 4.5)
 */
export async function getProjectSummary(
  prisma: PrismaClient,
  params: { projectId: string },
): Promise<any> {
  try {
    validateRequired(params, ['projectId']);

    const [project, storiesByStatus, storiesByType, epicStats] = await Promise.all([
      prisma.project.findUnique({ where: { id: params.projectId } }),

      // Stories by status
      prisma.story.groupBy({
        by: ['status'],
        where: { projectId: params.projectId },
        _count: true,
      }),

      // Stories by type
      prisma.story.groupBy({
        by: ['type'],
        where: { projectId: params.projectId },
        _count: true,
      }),

      // Epic statistics
      prisma.epic.findMany({
        where: { projectId: params.projectId },
        include: {
          _count: { select: { stories: true } },
        },
      }),
    ]);

    if (!project) {
      throw new NotFoundError('Project', params.projectId);
    }

    return {
      project: {
        id: project.id,
        name: project.name,
        status: project.status,
      },
      statistics: {
        storiesByStatus: Object.fromEntries(
          storiesByStatus.map((s) => [s.status, s._count])
        ),
        storiesByType: Object.fromEntries(
          storiesByType.map((t) => [t.type, t._count])
        ),
        totalEpics: epicStats.length,
        epicsWithStories: epicStats.filter((e) => e._count.stories > 0).length,
        totalStories: storiesByStatus.reduce((sum, s) => sum + s._count, 0),
      },
    };
  } catch (error: any) {
    if (error.name === 'MCPError') {
      throw error;
    }
    throw handlePrismaError(error, 'get_project_summary');
  }
}
