/**
 * Epic Management MCP Tools
 */

import { PrismaClient } from '@prisma/client';
import {
  CreateEpicParams,
  ListEpicsParams,
  EpicResponse,
  NotFoundError,
  ValidationError,
} from '../types';
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

/**
 * List epics for a project
 */
export async function listEpics(
  prisma: PrismaClient,
  params: ListEpicsParams,
): Promise<EpicResponse[]> {
  try {
    validateRequired(params, ['projectId']);

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: params.projectId },
    });

    if (!project) {
      throw new NotFoundError('Project', params.projectId);
    }

    const epics = await prisma.epic.findMany({
      where: {
        projectId: params.projectId,
        ...(params.status && { status: params.status }),
      },
      include: {
        _count: {
          select: { stories: true },
        },
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });

    return epics.map((e: any) => formatEpic(e, true));
  } catch (error: any) {
    if (error.name === 'MCPError') {
      throw error;
    }
    throw handlePrismaError(error, 'list_epics');
  }
}
