/**
 * List Artifacts Tool
 * Lists artifacts for a workflow run with optional filtering
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import {
  ListArtifactsParams,
  ArtifactResponse,
  NotFoundError,
  PaginatedResponse,
} from '../../types';
import { validateRequired, handlePrismaError } from '../../utils';
import { formatArtifact } from './upload_artifact';

export const tool: Tool = {
  name: 'list_artifacts',
  description: 'List artifacts for a workflow run. Filter by definitionKey or type.',
  inputSchema: {
    type: 'object',
    properties: {
      workflowRunId: {
        type: 'string',
        description: 'Workflow Run UUID (required)',
      },
      definitionKey: {
        type: 'string',
        description: 'Filter by artifact definition key (optional)',
      },
      type: {
        type: 'string',
        enum: ['markdown', 'json', 'code', 'report', 'image', 'other'],
        description: 'Filter by artifact type (optional)',
      },
      includeContent: {
        type: 'boolean',
        description: 'Include full content in response (default: false for list)',
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
    required: ['workflowRunId'],
  },
};

export const metadata = {
  category: 'artifacts',
  domain: 'story_runner',
  tags: ['artifact', 'list', 'workflow'],
  version: '1.0.0',
  since: 'ST-151',
};

export async function handler(
  prisma: PrismaClient,
  params: ListArtifactsParams,
): Promise<PaginatedResponse<ArtifactResponse>> {
  try {
    validateRequired(params, ['workflowRunId']);

    // Verify workflow run exists
    const workflowRun = await prisma.workflowRun.findUnique({
      where: { id: params.workflowRunId },
    });

    if (!workflowRun) {
      throw new NotFoundError('WorkflowRun', params.workflowRunId);
    }

    // Build where clause
    const where: any = {
      workflowRunId: params.workflowRunId,
    };

    // Filter by definition key
    if (params.definitionKey) {
      const definition = await prisma.artifactDefinition.findFirst({
        where: {
          workflowId: workflowRun.workflowId,
          key: params.definitionKey.toUpperCase(),
        },
      });

      if (!definition) {
        throw new NotFoundError(
          'ArtifactDefinition',
          `key=${params.definitionKey}`,
        );
      }

      where.definitionId = definition.id;
    }

    // Filter by type
    if (params.type) {
      where.definition = {
        type: params.type,
      };
    }

    // Pagination
    const page = Math.max(1, params.page || 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize || 20));
    const skip = (page - 1) * pageSize;

    // Get total count
    const total = await prisma.artifact.count({ where });

    // Get artifacts
    const artifacts = await prisma.artifact.findMany({
      where,
      include: {
        definition: true,
        createdByComponent: true,
      },
      orderBy: [
        { definition: { key: 'asc' } },
        { version: 'desc' },
      ],
      skip,
      take: pageSize,
    });

    const totalPages = Math.ceil(total / pageSize);

    // Format artifacts, optionally excluding content
    const data = artifacts.map((artifact) => {
      const formatted = formatArtifact(artifact);
      if (params.includeContent !== true) {
        formatted.content = `[${formatted.size} bytes]`;
      }
      return formatted;
    });

    return {
      data,
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
    throw handlePrismaError(error, 'list_artifacts');
  }
}
