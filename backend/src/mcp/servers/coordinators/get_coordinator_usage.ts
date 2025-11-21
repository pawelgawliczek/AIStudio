/**
 * Get Coordinator Usage Tool
 * Returns usage statistics for a coordinator
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import { NotFoundError, ValidationError } from '../../types';
import { validateRequired, handlePrismaError } from '../../utils';

export interface GetCoordinatorUsageParams {
  coordinatorId: string;
}

export interface CoordinatorUsageResponse {
  success: boolean;
  componentId: string;
  name: string;
  active: boolean;
  workflows: Array<{
    id: string;
    name: string;
    active: boolean;
  }>;
  executionCount: number;
  lastUsed: string | null;
  message: string;
}

export const tool: Tool = {
  name: 'get_coordinator_usage',
  description: 'Get usage statistics for a coordinator including workflow count, execution count, and last used date',
  inputSchema: {
    type: 'object',
    properties: {
      coordinatorId: {
        type: 'string',
        description: 'Coordinator UUID to get usage for',
      },
    },
    required: ['coordinatorId'],
  },
};

export const metadata = {
  category: 'coordinators',
  domain: 'workflow',
  tags: ['coordinator', 'lifecycle', 'usage', 'metrics'],
  version: '1.0.0',
  since: '2025-11-21',
};

export async function handler(
  prisma: PrismaClient,
  params: GetCoordinatorUsageParams,
): Promise<CoordinatorUsageResponse> {
  try {
    validateRequired(params, ['coordinatorId']);

    const coordinator = await prisma.component.findUnique({
      where: { id: params.coordinatorId },
      include: {
        workflowsAsCoordinator: {
          select: { id: true, name: true, active: true },
        },
        _count: {
          select: {
            componentRuns: true,
          },
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

    // Get last execution timestamp
    const lastRun = await prisma.componentRun.findFirst({
      where: { componentId: params.coordinatorId },
      orderBy: { startedAt: 'desc' },
      select: { startedAt: true },
    });

    return {
      success: true,
      componentId: coordinator.id,
      name: coordinator.name,
      active: coordinator.active,
      workflows: coordinator.workflowsAsCoordinator,
      executionCount: coordinator._count.componentRuns,
      lastUsed: lastRun?.startedAt.toISOString() || null,
      message: `Coordinator '${coordinator.name}' has ${coordinator.workflowsAsCoordinator.length} workflow(s) and ${coordinator._count.componentRuns} execution(s)`,
    };
  } catch (error: any) {
    if (error.name === 'MCPError') throw error;
    throw handlePrismaError(error, 'get_coordinator_usage');
  }
}
