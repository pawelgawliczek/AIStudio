/**
 * Get Agent Tool
 * Get single component with version history and usage stats
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import { VersioningService, VersionHistoryItem } from '../../../services/versioning.service';
import { NotFoundError } from '../../types';
import { validateRequired, handlePrismaError } from '../../utils';

export interface GetComponentParams {
  componentId: string;
}

export interface GetComponentResponse {
  component: any;
  versionHistory: VersionHistoryItem[];
  usageStats: {
    workflowCount: number;
    totalRuns: number;
    lastUsedAt: string | null;
  };
}


// ALIASING: Component → Agent (ST-109)
export const tool: Tool = {
  name: 'get_agent',
  description: 'Get single agent with version history and usage stats',
    inputSchema: {
    type: 'object',
    properties: {
      componentId: {
        type: 'string',
        description: 'Component UUID (required)',
      },
    },
    required: ['componentId'],
  },
};

export const metadata = {
  category: 'versioning',
  domain: 'Version Management',
  tags: ['agent', 'get', 'version', 'history'],
  version: '1.0.0',
  since: '2025-11-26',
};

export async function handler(
  prisma: PrismaClient,
  params: GetComponentParams,
): Promise<GetComponentResponse> {
  try {
    validateRequired(params as unknown as Record<string, unknown>, ['componentId']);

    // Fetch component with related data
    const component = await prisma.component.findUnique({
      where: { id: params.componentId },
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

    // Get version history using VersioningService
    const versioningService = new VersioningService(prisma as any);
    const versionHistory = await versioningService.getVersionHistory('component', params.componentId);

    // Get last used timestamp from component runs
    const lastRun = await prisma.componentRun.findFirst({
      where: { componentId: params.componentId },
      orderBy: { startedAt: 'desc' },
      select: { startedAt: true },
    });

    return {
      component: {
        id: component.id,
        projectId: component.projectId,
        project: component.project,
        name: component.name,
        description: component.description,
        inputInstructions: component.inputInstructions,
        operationInstructions: component.operationInstructions,
        outputInstructions: component.outputInstructions,
        config: component.config,
        tools: component.tools,
        tags: component.tags,
        onFailure: component.onFailure,
        active: component.active,
        version: component.version,
        versionMajor: component.versionMajor,
        versionMinor: component.versionMinor,
        versionLabel: `${component.versionMajor}.${component.versionMinor}`,
        parentId: component.parentId,
        parent: component.parent,
        children: component.children,
        isDeprecated: component.isDeprecated,
        deprecatedAt: component.deprecatedAt?.toISOString() || null,
        changeDescription: component.changeDescription,
        createdFromVersion: component.createdFromVersion,
        instructionsChecksum: component.instructionsChecksum,
        configChecksum: component.configChecksum,
        createdAt: component.createdAt.toISOString(),
        updatedAt: component.updatedAt.toISOString(),
      },
      versionHistory,
      usageStats: {
        workflowCount: 0, // Deprecated: Coordinators are now components with 'coordinator' tag
        totalRuns: component._count.componentRuns,
        lastUsedAt: lastRun?.startedAt.toISOString() || null,
      },
    };
  } catch (error: any) {
    if (error.name === 'MCPError') {
      throw error;
    }
    throw handlePrismaError(error, 'get_component');
  }
}
