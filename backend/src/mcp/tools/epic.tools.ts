/**
 * Epic Management MCP Tools
 */

import { PrismaClient } from '@prisma/client';
import {
  CreateEpicParams,
  ListEpicsParams,
  EpicResponse,
  PaginatedResponse,
  NotFoundError,
  ValidationError,
} from '../types/';
import {
  formatEpic,
  generateNextKey,
  validateRequired,
  handlePrismaError,
} from '../utils';

/**
 * Create a new epic
 */
export async function createEpic(
  prisma: PrismaClient,
  params: CreateEpicParams,
): Promise<EpicResponse> {
  try {
    validateRequired(params as unknown as Record<string, unknown>, ['projectId', 'title']);

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
        status: 'open',
        priority: params.priority ?? 0,
      },
      include: {
        _count: {
          select: { stories: true },
        },
      },
    });

    return formatEpic(epic, true);
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'name' in error && error.name === 'MCPError') {
      throw error;
    }
    throw handlePrismaError(error, 'create_epic');
  }
}

/**
 * List epics for a project with pagination
 */
export async function listEpics(
  prisma: PrismaClient,
  params: ListEpicsParams,
): Promise<PaginatedResponse<EpicResponse>> {
  try {
    validateRequired(params as unknown as Record<string, unknown>, ['projectId']);

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: params.projectId },
    });

    if (!project) {
      throw new NotFoundError('Project', params.projectId);
    }

    const page = params.page || 1;
    const pageSize = Math.min(params.pageSize || 20, 100);
    const skip = (page - 1) * pageSize;

    const whereClause: {
      projectId: string;
      status?: string;
    } = {
      projectId: params.projectId,
    };
    if (params.status) {
      whereClause.status = params.status;
    }

    // Get total count
    const total = await prisma.epic.count({ where: whereClause as any });

    // Get paginated data
    const epics = await prisma.epic.findMany({
      where: whereClause as any,
      skip,
      take: pageSize,
      include: {
        _count: {
          select: { stories: true },
        },
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });

    const totalPages = Math.ceil(total / pageSize);

    return {
      data: epics.map((e) => formatEpic(e, true)),
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'name' in error && error.name === 'MCPError') {
      throw error;
    }
    throw handlePrismaError(error, 'list_epics');
  }
}
