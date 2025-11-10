/**
 * Get Project Summary Tool
 * Retrieves aggregated statistics for a project (Sprint 4.5)
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import { NotFoundError } from '../../types';
import { validateRequired, handlePrismaError } from '../../utils';

export const tool: Tool = {
  name: 'get_project_summary',
  description: 'Get aggregated statistics for a project (stories by status, type, epic counts)',
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
  tags: ['project', 'summary', 'statistics', 'aggregation'],
  version: '1.0.0',
  since: 'sprint-4.5',
};

export async function handler(
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
