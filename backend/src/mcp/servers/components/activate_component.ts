/**
 * Activate Component Tool
 * Sets component active=true and returns updated component
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import { NotFoundError } from '../../types';
import { validateRequired, handlePrismaError } from '../../utils';

export interface ActivateComponentParams {
  componentId: string;
}

export interface ComponentResponse {
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
  name: 'activate_component',
  description: 'Activate a component by setting active=true',
  inputSchema: {
    type: 'object',
    properties: {
      componentId: {
        type: 'string',
        description: 'Component UUID to activate',
      },
    },
    required: ['componentId'],
  },
};

export const metadata = {
  category: 'components',
  domain: 'workflow',
  tags: ['component', 'lifecycle', 'activation'],
  version: '1.0.0',
  since: '2025-11-21',
};

export async function handler(
  prisma: PrismaClient,
  params: ActivateComponentParams,
): Promise<ComponentResponse> {
  try {
    validateRequired(params, ['componentId']);

    const component = await prisma.component.findUnique({
      where: { id: params.componentId },
    });

    if (!component) {
      throw new NotFoundError('Component', params.componentId);
    }

    const updated = await prisma.component.update({
      where: { id: params.componentId },
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
      message: `Component '${updated.name}' activated successfully`,
    };
  } catch (error: any) {
    if (error.name === 'MCPError') throw error;
    throw handlePrismaError(error, 'activate_component');
  }
}
