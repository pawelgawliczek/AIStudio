/**
 * Deactivate Agent Tool
 * Sets component active=false and returns component with affected workflows
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import { NotFoundError, ValidationError } from '../../types';
import { validateRequired, handlePrismaError } from '../../utils';

export interface DeactivateComponentParams {
  componentId: string;
  force?: boolean;
}

export interface DeactivateComponentResponse {
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


// ALIASING: Component → Agent (ST-109)
export const tool: Tool = {
  name: 'deactivate_agent',
  description: 'Deactivate an agent by setting active=false. Returns list of affected teams.',
  inputSchema: {
    type: 'object',
    properties: {
      componentId: {
        type: 'string',
        description: 'Agent UUID to deactivate',
      },
    },
    required: ['componentId'],
  }
};

export const metadata = {
  category: 'components',
  domain: 'team',
  tags: ['agent', 'lifecycle', 'deactivation'],
  version: '1.0.0',
  since: '2025-11-26',
};

export async function handler(
  prisma: PrismaClient,
  params: DeactivateComponentParams,
): Promise<DeactivateComponentResponse> {
  try {
    validateRequired(params, ['componentId']);

    const component = await prisma.component.findUnique({
      where: { id: params.componentId },
      include: {
        workflowsAsCoordinator: {
          where: { active: true },
          select: { id: true, name: true, active: true },
        },
      },
    });

    if (!component) {
      throw new NotFoundError('Component', params.componentId);
    }

    // Check for active workflows if not forced
    if (!params.force && component.workflowsAsCoordinator.length > 0) {
      throw new ValidationError(
        `Cannot deactivate component with ${component.workflowsAsCoordinator.length} active workflows. Use force=true to override.`
      );
    }

    const updated = await prisma.component.update({
      where: { id: params.componentId },
      data: { active: false },
    });

    // Get all affected workflows (both active and inactive)
    const allWorkflows = await prisma.workflow.findMany({
      where: { coordinatorId: params.componentId },
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
      message: `Component '${updated.name}' deactivated successfully. ${allWorkflows.length} workflow(s) affected.`,
    };
  } catch (error: any) {
    if (error.name === 'MCPError') throw error;
    throw handlePrismaError(error, 'deactivate_component');
  }
}
