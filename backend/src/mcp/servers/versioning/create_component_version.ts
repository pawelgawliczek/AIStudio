/**
 * Create Agent Version Tool
 * Create minor/major version using VersioningService
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import { VersioningService } from '../../../services/versioning.service';
import { NotFoundError, ValidationError } from '../../types';
import { validateRequired, handlePrismaError } from '../../utils';

export interface CreateComponentVersionParams {
  componentId: string;
  majorVersion?: number;
  changeDescription?: string;
}


// ALIASING: Component → Agent (ST-109)
export const tool: Tool = {
  name: 'create_agent_version',
  description: 'Create minor/major version of an agent using VersioningService',
    inputSchema: {
    type: 'object',
    properties: {
      componentId: {
        type: 'string',
        description: 'Source component UUID (required)',
      },
      majorVersion: {
        type: 'number',
        description: 'If provided, creates major version (X.0). Otherwise creates minor version increment.',
      },
      changeDescription: {
        type: 'string',
        description: 'Optional change notes',
      },
    },
    required: ['componentId'],
  },
};

export const metadata = {
  category: 'versioning',
  domain: 'Version Management',
  tags: ['agent', 'create', 'version'],
  version: '1.0.0',
  since: '2025-11-26',
};

export async function handler(
  prisma: PrismaClient,
  params: CreateComponentVersionParams,
): Promise<any> {
  try {
    validateRequired(params as unknown as Record<string, unknown>, ['componentId']);

    // Check component exists
    const sourceComponent = await prisma.component.findUnique({
      where: { id: params.componentId },
    });

    if (!sourceComponent) {
      throw new NotFoundError('Component', params.componentId);
    }

    if (sourceComponent.isDeprecated) {
      throw new ValidationError('Cannot create version from deprecated component');
    }

    const versioningService = new VersioningService(prisma as any);

    let newComponent;
    if (params.majorVersion !== undefined) {
      // Create major version
      newComponent = await versioningService.createMajorVersion(
        'component',
        params.componentId,
        params.majorVersion,
        { changeDescription: params.changeDescription },
      );
    } else {
      // Create minor version
      newComponent = await versioningService.createMinorVersion(
        'component',
        params.componentId,
        { changeDescription: params.changeDescription },
      );
    }

    return {
      id: newComponent.id,
      projectId: newComponent.projectId,
      name: newComponent.name,
      description: newComponent.description,
      versionMajor: newComponent.versionMajor,
      versionMinor: newComponent.versionMinor,
      versionLabel: `${newComponent.versionMajor}.${newComponent.versionMinor}`,
      parentId: newComponent.parentId,
      createdFromVersion: newComponent.createdFromVersion,
      changeDescription: newComponent.changeDescription,
      instructionsChecksum: newComponent.instructionsChecksum,
      configChecksum: newComponent.configChecksum,
      active: newComponent.active,
      isDeprecated: newComponent.isDeprecated,
      createdAt: newComponent.createdAt.toISOString(),
      updatedAt: newComponent.updatedAt.toISOString(),
      message: `Created version ${newComponent.versionMajor}.${newComponent.versionMinor} from ${sourceComponent.versionMajor}.${sourceComponent.versionMinor}`,
    };
  } catch (error: any) {
    if (error.name === 'MCPError') {
      throw error;
    }
    // Handle NestJS BadRequestException
    if (error.name === 'BadRequestException' || error.status === 400) {
      throw new ValidationError(error.message);
    }
    throw handlePrismaError(error, 'create_component_version');
  }
}
