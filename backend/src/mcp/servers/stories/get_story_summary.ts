/**
 * Get Story Summary Tool
 * Retrieves aggregated story statistics with grouping (Sprint 4.5)
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import { ValidationError } from '../../types';
import { validateRequired, handlePrismaError } from '../../utils';

export const tool: Tool = {
  name: 'get_story_summary',
  description: 'Get aggregated story statistics grouped by status, type, epic, or complexity',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: {
        type: 'string',
        description: 'Project UUID',
      },
      groupBy: {
        type: 'string',
        enum: ['status', 'type', 'epic', 'complexity'],
        description: 'Field to group stories by',
      },
    },
    required: ['projectId', 'groupBy'],
  },
};

export const metadata = {
  category: 'stories',
  domain: 'project_management',
  tags: ['story', 'summary', 'statistics', 'aggregation', 'grouping'],
  version: '1.0.0',
  since: 'sprint-4.5',
};

export async function handler(
  prisma: PrismaClient,
  params: { projectId: string; groupBy: 'status' | 'type' | 'epic' | 'complexity' },
): Promise<any> {
  try {
    validateRequired(params, ['projectId', 'groupBy']);

    const { projectId, groupBy } = params;

    switch (groupBy) {
      case 'status': {
        const byStatus = await prisma.story.groupBy({
          by: ['status'],
          where: { projectId },
          _count: true,
          _avg: { technicalComplexity: true },
        });
        return {
          groupBy: 'status',
          summary: byStatus.map((s) => ({
            status: s.status,
            count: s._count,
            avgComplexity: s._avg.technicalComplexity,
          })),
        };
      }

      case 'type': {
        const byType = await prisma.story.groupBy({
          by: ['type'],
          where: { projectId },
          _count: true,
        });
        return {
          groupBy: 'type',
          summary: byType.map((t) => ({
            type: t.type,
            count: t._count,
          })),
        };
      }

      case 'epic': {
        const byEpic = await prisma.story.groupBy({
          by: ['epicId'],
          where: { projectId },
          _count: true,
        });
        // Enrich with epic titles
        const epicIds = byEpic.map((e) => e.epicId).filter(Boolean) as string[];
        const epics = await prisma.epic.findMany({
          where: { id: { in: epicIds } },
          select: { id: true, key: true, title: true },
        });
        const epicMap = new Map(epics.map((e) => [e.id, e]));

        return {
          groupBy: 'epic',
          summary: byEpic.map((e) => ({
            epicId: e.epicId,
            epic: e.epicId ? epicMap.get(e.epicId) : null,
            count: e._count,
          })),
        };
      }

      case 'complexity': {
        const byComplexity = await prisma.story.groupBy({
          by: ['technicalComplexity'],
          where: { projectId },
          _count: true,
        });
        return {
          groupBy: 'complexity',
          summary: byComplexity
            .filter((c) => c.technicalComplexity !== null)
            .map((c) => ({
              complexity: c.technicalComplexity,
              count: c._count,
            }))
            .sort((a, b) => (a.complexity || 0) - (b.complexity || 0)),
        };
      }

      default:
        throw new ValidationError(`Invalid groupBy: ${groupBy}`);
    }
  } catch (error: any) {
    if (error.name === 'MCPError') {
      throw error;
    }
    throw handlePrismaError(error, 'get_story_summary');
  }
}
