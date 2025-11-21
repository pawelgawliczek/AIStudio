/**
 * Activate Coordinator Tool
 * Sets coordinator active=true and returns updated coordinator
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import { NotFoundError, ValidationError } from '../../types';
import { validateRequired, handlePrismaError } from '../../utils';

export interface ActivateCoordinatorParams {
  coordinatorId: string;
}

export interface CoordinatorResponse {
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
  message: string;
}

export const tool: Tool = {
  name: 'activate_coordinator',
  description: 'Activate a coordinator by setting active=true',
  inputSchema: {
    type: 'object',
    properties: {
      coordinatorId: {
        type: 'string',
        description: 'Coordinator UUID to activate',
      },
    },
    required: ['coordinatorId'],
  },
};

export const metadata = {
  category: 'coordinators',
  domain: 'workflow',
  tags: ['coordinator', 'lifecycle', 'activation'],
  version: '1.0.0',
  since: '2025-11-21',
};

export async function handler(
  prisma: PrismaClient,
  params: ActivateCoordinatorParams,
): Promise<CoordinatorResponse> {
  try {
    validateRequired(params, ['coordinatorId']);

    const coordinator = await prisma.component.findUnique({
      where: { id: params.coordinatorId },
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

    const updated = await prisma.component.update({
      where: { id: params.coordinatorId },
      data: { active: true },
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
      message: `Coordinator '${updated.name}' activated successfully`,
    };
  } catch (error: any) {
    if (error.name === 'MCPError') throw error;
    throw handlePrismaError(error, 'activate_coordinator');
  }
}
