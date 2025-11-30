/**
 * List Artifact Definitions Tool
 * Lists artifact definitions for a workflow
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import {
  ListArtifactDefinitionsParams,
  ArtifactDefinitionResponse,
  NotFoundError,
  PaginatedResponse,
} from '../../types';
import { validateRequired, handlePrismaError } from '../../utils';
import { formatArtifactDefinition } from './create_artifact_definition';

export const tool: Tool = {
  name: 'list_artifact_definitions',
  description:
    'List all artifact definitions for a workflow. Returns definitions with access rules and artifact counts.',
  inputSchema: {
    type: 'object',
    properties: {
      workflowId: {
        type: 'string',
        description: 'Workflow UUID (required)',
      },
      page: {
        type: 'number',
        description: 'Page number (default: 1)',
      },
      pageSize: {
        type: 'number',
        description: 'Items per page (default: 20, max: 100)',
      },
    },
    required: ['workflowId'],
  },
};

export const metadata = {
  category: 'artifacts',
  domain: 'story_runner',
  tags: ['artifact', 'definition', 'list', 'workflow'],
  version: '1.0.0',
  since: 'ST-151',
};

export async function handler(
  prisma: PrismaClient,
  params: ListArtifactDefinitionsParams,
): Promise<PaginatedResponse<ArtifactDefinitionResponse>> {
  try {
    validateRequired(params, ['workflowId']);

    // Verify workflow exists
    const workflow = await prisma.workflow.findUnique({
      where: { id: params.workflowId },
    });

    if (!workflow) {
      throw new NotFoundError('Workflow', params.workflowId);
    }

    // Pagination
    const page = Math.max(1, params.page || 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize || 20));
    const skip = (page - 1) * pageSize;

    // Get total count
    const total = await prisma.artifactDefinition.count({
      where: { workflowId: params.workflowId },
    });

    // Get definitions
    const definitions = await prisma.artifactDefinition.findMany({
      where: { workflowId: params.workflowId },
      include: {
        accessRules: {
          include: {
            state: true,
          },
          orderBy: { state: { order: 'asc' } },
        },
        _count: {
          select: { artifacts: true },
        },
      },
      orderBy: { createdAt: 'asc' },
      skip,
      take: pageSize,
    });

    const totalPages = Math.ceil(total / pageSize);

    return {
      data: definitions.map((d) => formatArtifactDefinition(d, true)),
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  } catch (error: any) {
    if (error.name === 'MCPError') {
      throw error;
    }
    throw handlePrismaError(error, 'list_artifact_definitions');
  }
}
