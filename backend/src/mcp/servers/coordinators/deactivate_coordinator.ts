/**
 * Deactivate Coordinator Tool
 * Sets coordinator active=false and returns coordinator with affected workflows
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import { NotFoundError, ValidationError } from '../../types';
import { validateRequired, handlePrismaError } from '../../utils';

export interface DeactivateCoordinatorParams {
  coordinatorId: string;
  force?: boolean;
}

export interface DeactivateCoordinatorResponse {
  success: boolean;
  component: {
    id: string;
    projectId: string;
    name: string;
    active: boolean;
    version: string;
    tags: string[];
    createdAt: string;
    updatedAt: string;
  };
  affectedWorkflows: Array<{
    id: string;
    name: string;
    active: boolean;
  }>;
  message: string;
}

export const tool: Tool = {
  name: 'deactivate_coordinator',
  description: 'Deactivate a coordinator by setting active=false. Returns list of affected workflows.',
  inputSchema: {
    type: 'object',
    properties: {
      coordinatorId: {
        type: 'string',
        description: 'Coordinator UUID to deactivate',
      },
      force: {
        type: 'boolean',
        description: 'Force deactivation even if workflows exist (default: false)',
      },
    },
    required: ['coordinatorId'],
  },
};

export const metadata = {
  category: 'coordinators',
  domain: 'workflow',
  tags: ['coordinator', 'lifecycle', 'deactivation'],
  version: '1.0.0',
  since: '2025-11-21',
};

export async function handler(
  prisma: PrismaClient,
  params: DeactivateCoordinatorParams,
): Promise<DeactivateCoordinatorResponse> {
  try {
    validateRequired(params, ['coordinatorId']);

    const coordinator = await prisma.component.findUnique({
      where: { id: params.coordinatorId },
      include: {
        workflowsAsCoordinator: {
          where: { active: true },
          select: { id: true, name: true, active: true },
        },
      },
    });

    if (!coordinator) {
      throw new NotFoundError('Coordinator', params.coordinatorId);
    }

    // Validate coordinator tag
    if (!coordinator.tags.includes('coordinator')) {
      throw new ValidationError(
        `Entity ${params.coordinatorId} is not a coordinator. Use component tools instead.`
      );
    }

    // Check for active workflows if not forced
    if (!params.force && coordinator.workflowsAsCoordinator.length > 0) {
      throw new ValidationError(
        `Cannot deactivate coordinator with ${coordinator.workflowsAsCoordinator.length} active workflows. Use force=true to override.`
      );
    }

    const updated = await prisma.component.update({
      where: { id: params.coordinatorId },
      data: { active: false },
    });

    // Get all affected workflows (both active and inactive)
    const allWorkflows = await prisma.workflow.findMany({
      where: { coordinatorId: params.coordinatorId },
      select: { id: true, name: true, active: true },
    });

    return {
      success: true,
      component: {
        id: updated.id,
        projectId: updated.projectId,
        name: updated.name,
        active: updated.active,
        version: updated.version,
        tags: updated.tags,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
      affectedWorkflows: allWorkflows,
      message: `Coordinator '${updated.name}' deactivated successfully. ${allWorkflows.length} workflow(s) affected.`,
    };
  } catch (error: any) {
    if (error.name === 'MCPError') throw error;
    throw handlePrismaError(error, 'deactivate_coordinator');
  }
}
