/**
 * Get Version History Tool
 * Get version chain for component/coordinator/workflow
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import { NotFoundError, ValidationError } from '../../types';
import { validateRequired, handlePrismaError } from '../../utils';
import { VersioningService, VersionHistoryItem } from '../../../services/versioning.service';

export interface GetVersionHistoryParams {
  entityType: 'component' | 'workflow' | 'coordinator';
  entityId: string;
}

export const tool: Tool = {
  name: 'get_version_history',
  description: 'Get version chain for component, coordinator, or workflow (oldest to newest)',
  inputSchema: {
    type: 'object',
    properties: {
      entityType: {
        type: 'string',
        enum: ['component', 'workflow', 'coordinator'],
        description: 'Entity type (required)',
      },
      entityId: {
        type: 'string',
        description: 'Entity UUID (required)',
      },
    },
    required: ['entityType', 'entityId'],
  },
};

export const metadata = {
  category: 'versioning',
  domain: 'Version Management',
  tags: ['version', 'history', 'component', 'coordinator', 'workflow'],
  version: '1.0.0',
  since: '2025-11-21',
};

export async function handler(
  prisma: PrismaClient,
  params: GetVersionHistoryParams,
): Promise<{ entityType: string; entityId: string; entityName: string; history: VersionHistoryItem[] }> {
  try {
    validateRequired(params, ['entityType', 'entityId']);

    // Validate entity type
    if (!['component', 'workflow', 'coordinator'].includes(params.entityType)) {
      throw new ValidationError(`Invalid entityType: ${params.entityType}. Must be 'component', 'workflow', or 'coordinator'`);
    }

    // For coordinators, we treat them as components internally
    const internalEntityType = params.entityType === 'coordinator' ? 'component' : params.entityType;

    // Check entity exists and get name
    let entityName: string;
    if (internalEntityType === 'component') {
      const component = await prisma.component.findUnique({
        where: { id: params.entityId },
        select: { name: true, tags: true },
      });
      if (!component) {
        throw new NotFoundError(params.entityType === 'coordinator' ? 'Coordinator' : 'Component', params.entityId);
      }
      // If requesting coordinator, validate it has the tag
      if (params.entityType === 'coordinator' && !component.tags.includes('coordinator')) {
        throw new ValidationError(`Entity ${params.entityId} is not a coordinator (missing 'coordinator' tag)`);
      }
      entityName = component.name;
    } else {
      const workflow = await prisma.workflow.findUnique({
        where: { id: params.entityId },
        select: { name: true },
      });
      if (!workflow) {
        throw new NotFoundError('Workflow', params.entityId);
      }
      entityName = workflow.name;
    }

    // Get version history
    const versioningService = new VersioningService(prisma as any);
    const history = await versioningService.getVersionHistory(
      internalEntityType as 'component' | 'workflow',
      params.entityId,
    );

    return {
      entityType: params.entityType,
      entityId: params.entityId,
      entityName,
      history,
    };
  } catch (error: any) {
    if (error.name === 'MCPError') {
      throw error;
    }
    // Handle NestJS NotFoundException
    if (error.name === 'NotFoundException' || error.status === 404) {
      throw new NotFoundError(params.entityType, params.entityId);
    }
    throw handlePrismaError(error, 'get_version_history');
  }
}
