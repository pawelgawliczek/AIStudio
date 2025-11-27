/**
 * Create Project Manager Version Tool
 * Create minor/major version of a coordinator
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import { VersioningService } from '../../../services/versioning.service';
import { NotFoundError, ValidationError } from '../../types';
import { validateRequired, handlePrismaError } from '../../utils';

export interface CreateCoordinatorVersionParams {
  coordinatorId: string;
  majorVersion?: number;
  changeDescription?: string;
}


// ALIASING: Coordinator → Project Manager (ST-109)
export const tool: Tool = {
  name: 'create_project_manager_version',
  description: 'Create minor/major version of a project manager',
    inputSchema: {
    type: 'object',
    properties: {
      coordinatorId: {
        type: 'string',
        description: 'Source coordinator UUID (required)',
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
    required: ['coordinatorId'],
  },
};

export const metadata = {
  category: 'versioning',
  domain: 'Version Management',
  tags: ['project-manager', 'create', 'version'],
  version: '1.0.0',
  since: '2025-11-26',
};

export async function handler(
  prisma: PrismaClient,
  params: CreateCoordinatorVersionParams,
): Promise<any> {
  try {
    validateRequired(params, ['coordinatorId']);

    // Check coordinator exists and is actually a coordinator
    const sourceCoordinator = await prisma.component.findUnique({
      where: { id: params.coordinatorId },
    });

    if (!sourceCoordinator) {
      throw new NotFoundError('Coordinator', params.coordinatorId);
    }

    if (!sourceCoordinator.tags.includes('coordinator')) {
      throw new ValidationError(`Entity ${params.coordinatorId} is not a coordinator (missing 'coordinator' tag)`);
    }

    if (sourceCoordinator.isDeprecated) {
      throw new ValidationError('Cannot create version from deprecated coordinator');
    }

    const versioningService = new VersioningService(prisma as any);

    let newCoordinator;
    if (params.majorVersion !== undefined) {
      // Create major version
      newCoordinator = await versioningService.createMajorVersion(
        'component',
        params.coordinatorId,
        params.majorVersion,
        { changeDescription: params.changeDescription },
      );
    } else {
      // Create minor version
      newCoordinator = await versioningService.createMinorVersion(
        'component',
        params.coordinatorId,
        { changeDescription: params.changeDescription },
      );
    }

    return {
      id: newCoordinator.id,
      projectId: newCoordinator.projectId,
      name: newCoordinator.name,
      description: newCoordinator.description,
      coordinatorInstructions: (newCoordinator as any).coordinatorInstructions,
      decisionStrategy: (newCoordinator as any).decisionStrategy,
      versionMajor: newCoordinator.versionMajor,
      versionMinor: newCoordinator.versionMinor,
      versionLabel: `${newCoordinator.versionMajor}.${newCoordinator.versionMinor}`,
      parentId: newCoordinator.parentId,
      createdFromVersion: newCoordinator.createdFromVersion,
      changeDescription: newCoordinator.changeDescription,
      instructionsChecksum: newCoordinator.instructionsChecksum,
      configChecksum: newCoordinator.configChecksum,
      active: newCoordinator.active,
      isDeprecated: newCoordinator.isDeprecated,
      tags: (newCoordinator as any).tags,
      createdAt: newCoordinator.createdAt.toISOString(),
      updatedAt: newCoordinator.updatedAt.toISOString(),
      message: `Created coordinator version ${newCoordinator.versionMajor}.${newCoordinator.versionMinor} from ${sourceCoordinator.versionMajor}.${sourceCoordinator.versionMinor}`,
    };
  } catch (error: any) {
    if (error.name === 'MCPError') {
      throw error;
    }
    // Handle NestJS BadRequestException
    if (error.name === 'BadRequestException' || error.status === 400) {
      throw new ValidationError(error.message);
    }
    throw handlePrismaError(error, 'create_coordinator_version');
  }
}
