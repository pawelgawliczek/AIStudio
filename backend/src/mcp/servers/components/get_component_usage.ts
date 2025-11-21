/**
 * Get Component Usage Tool
 * Returns usage statistics for a component
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import { NotFoundError } from '../../types';
import { validateRequired, handlePrismaError } from '../../utils';

export interface GetComponentUsageParams {
  componentId: string;
}

export interface ComponentUsageResponse {
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
  name: 'get_component_usage',
  description: 'Get usage statistics for a component including workflow count, execution count, and last used date',
  inputSchema: {
    type: 'object',
    properties: {
      componentId: {
        type: 'string',
        description: 'Component UUID to get usage for',
      },
    },
    required: ['componentId'],
  },
};

export const metadata = {
  category: 'components',
  domain: 'workflow',
  tags: ['component', 'lifecycle', 'usage', 'metrics'],
  version: '1.0.0',
  since: '2025-11-21',
};

export async function handler(
  prisma: PrismaClient,
  params: GetComponentUsageParams,
): Promise<ComponentUsageResponse> {
  try {
    validateRequired(params, ['componentId']);

    const component = await prisma.component.findUnique({
      where: { id: params.componentId },
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

    if (!component) {
      throw new NotFoundError('Component', params.componentId);
    }

    // Get last execution timestamp
    const lastRun = await prisma.componentRun.findFirst({
      where: { componentId: params.componentId },
      orderBy: { startedAt: 'desc' },
      select: { startedAt: true },
    });

    return {
      success: true,
      componentId: component.id,
      name: component.name,
      active: component.active,
      workflows: component.workflowsAsCoordinator,
      executionCount: component._count.componentRuns,
      lastUsed: lastRun?.startedAt.toISOString() || null,
      message: `Component '${component.name}' has ${component.workflowsAsCoordinator.length} workflow(s) and ${component._count.componentRuns} execution(s)`,
    };
  } catch (error: any) {
    if (error.name === 'MCPError') throw error;
    throw handlePrismaError(error, 'get_component_usage');
  }
}
