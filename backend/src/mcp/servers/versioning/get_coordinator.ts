/**
 * Get Project Manager Tool
 * Get coordinator with workflow assignments
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import { VersioningService, VersionHistoryItem } from '../../../services/versioning.service';
import { NotFoundError, ValidationError } from '../../types';
import { validateRequired, handlePrismaError } from '../../utils';

export interface GetCoordinatorParams {
  coordinatorId: string;
}

export interface GetCoordinatorResponse {
  coordinator: any;
  versionHistory: VersionHistoryItem[];
  assignedWorkflows: Array<{ id: string; name: string; active: boolean }>;
}


// ALIASING: Coordinator → Project Manager (ST-109)
export const tool: Tool = {
  name: 'get_project_manager',
  description: 'Get project manager with version history and assigned teams',
    inputSchema: {
    type: 'object',
    properties: {
      coordinatorId: {
        type: 'string',
        description: 'Coordinator (Component) UUID (required)',
      },
    },
    required: ['coordinatorId'],
  },
};

export const metadata = {
  category: 'versioning',
  domain: 'Version Management',
  tags: ['project-manager', 'get', 'version', 'history'],
  version: '1.0.0',
  since: '2025-11-26',
};

export async function handler(
  prisma: PrismaClient,
  params: GetCoordinatorParams,
): Promise<GetCoordinatorResponse> {
  try {
    validateRequired(params, ['coordinatorId']);

    // Fetch coordinator (component with coordinator tag)
    const coordinator = await prisma.component.findUnique({
      where: { id: params.coordinatorId },
      include: {
        project: {
          select: { id: true, name: true },
        },
        parent: {
          select: { id: true, name: true, versionMajor: true, versionMinor: true },
        },
        children: {
          select: { id: true, name: true, versionMajor: true, versionMinor: true },
        },
        workflowsAsCoordinator: {
          select: { id: true, name: true, active: true },
        },
      },
    });

    if (!coordinator) {
      throw new NotFoundError('Coordinator', params.coordinatorId);
    }

    // Validate it's a coordinator
    if (!coordinator.tags.includes('coordinator')) {
      throw new ValidationError(`Entity ${params.coordinatorId} is not a coordinator (missing 'coordinator' tag)`);
    }

    // Get version history
    const versioningService = new VersioningService(prisma as any);
    const versionHistory = await versioningService.getVersionHistory('component', params.coordinatorId);

    return {
      coordinator: {
        id: coordinator.id,
        projectId: coordinator.projectId,
        project: coordinator.project,
        name: coordinator.name,
        description: coordinator.description,
        inputInstructions: coordinator.inputInstructions,
        operationInstructions: coordinator.operationInstructions,
        outputInstructions: coordinator.outputInstructions,
        config: coordinator.config,
        tools: coordinator.tools,
        tags: coordinator.tags,
        onFailure: coordinator.onFailure,
        active: coordinator.active,
        version: coordinator.version,
        versionMajor: coordinator.versionMajor,
        versionMinor: coordinator.versionMinor,
        versionLabel: `${coordinator.versionMajor}.${coordinator.versionMinor}`,
        parentId: coordinator.parentId,
        parent: coordinator.parent,
        children: coordinator.children,
        isDeprecated: coordinator.isDeprecated,
        deprecatedAt: coordinator.deprecatedAt?.toISOString() || null,
        changeDescription: coordinator.changeDescription,
        createdFromVersion: coordinator.createdFromVersion,
        instructionsChecksum: coordinator.instructionsChecksum,
        configChecksum: coordinator.configChecksum,
        createdAt: coordinator.createdAt.toISOString(),
        updatedAt: coordinator.updatedAt.toISOString(),
      },
      versionHistory,
      assignedWorkflows: coordinator.workflowsAsCoordinator.map((w) => ({
        id: w.id,
        name: w.name,
        active: w.active,
      })),
    };
  } catch (error: any) {
    if (error.name === 'MCPError') {
      throw error;
    }
    throw handlePrismaError(error, 'get_coordinator');
  }
}
