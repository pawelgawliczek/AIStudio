/**
 * Update Epic Tool
 * Updates an existing epic (title, description, status, priority)
 * ST-317: Epic Status Management
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import {
  UpdateEpicParams,
  EpicResponse,
  NotFoundError,
} from '../../types';
import {
  formatEpic,
  validateRequired,
  handlePrismaError,
} from '../../utils';

export const tool: Tool = {
  name: 'update_epic',
  description: 'Update epic fields (title, description, status, priority)',
  inputSchema: {
    type: 'object',
    properties: {
      epicId: {
        type: 'string',
        description: 'Epic UUID',
      },
      title: {
        type: 'string',
        description: 'New epic title',
      },
      description: {
        type: 'string',
        description: 'New epic description',
      },
      status: {
        type: 'string',
        enum: ['open', 'closed', 'cancelled'],
        description: 'New epic status',
      },
      priority: {
        type: 'number',
        description: 'Epic priority (higher = more important)',
      },
    },
    required: ['epicId'],
  },
};

export const metadata = {
  category: 'epics',
  domain: 'project_management',
  tags: ['epic', 'update', 'modify', 'status'],
  version: '1.0.0',
  since: 'ST-317',
};

export async function handler(
  prisma: PrismaClient,
  params: UpdateEpicParams,
): Promise<EpicResponse> {
  try {
    validateRequired(params as unknown as Record<string, unknown>, ['epicId']);

    // Verify epic exists
    const existingEpic = await prisma.epic.findUnique({
      where: { id: params.epicId },
    });

    if (!existingEpic) {
      throw new NotFoundError('Epic', params.epicId);
    }

    // Build update data object (only include provided fields)
    const updateData: any = {};

    if (params.title !== undefined) updateData.title = params.title;
    if (params.description !== undefined) updateData.description = params.description;
    if (params.status !== undefined) updateData.status = params.status;
    if (params.priority !== undefined) updateData.priority = params.priority;

    // Update epic
    const updatedEpic = await prisma.epic.update({
      where: { id: params.epicId },
      data: updateData,
      include: {
        _count: {
          select: { stories: true },
        },
      },
    });

    return formatEpic(updatedEpic, true);
  } catch (error: any) {
    if (error.name === 'MCPError') {
      throw error;
    }
    throw handlePrismaError(error, 'update_epic');
  }
}
