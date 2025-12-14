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
  description: 'List artifacts by storyId or workflowRunId. Filter by definitionKey or type. Optionally include version counts.',
  inputSchema: {
    type: 'object',
    properties: {
      storyId: {
        type: 'string',
        description: 'Story UUID (provide this OR workflowRunId)',
      },
      workflowRunId: {
        type: 'string',
        description: 'Workflow Run UUID (will resolve to story)',
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
      includeVersionCounts: {
        type: 'boolean',
        description: 'Include version count for each artifact (default: false)',
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
    required: [],
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
    // ST-214: Resolve storyId from workflowRunId if needed
    let storyId = params.storyId;

    if (!storyId && params.workflowRunId) {
      const workflowRun = await prisma.workflowRun.findUnique({
        where: { id: params.workflowRunId },
      });

      if (!workflowRun) {
        throw new NotFoundError('WorkflowRun', params.workflowRunId);
      }

      if (!workflowRun.storyId) {
        throw new ValidationError('WorkflowRun must be associated with a story');
      }

      storyId = workflowRun.storyId;
    }

    if (!storyId) {
      throw new ValidationError('Either storyId or workflowRunId must be provided');
    }

    // Verify story exists
    const story = await prisma.story.findUnique({
      where: { id: storyId },
    });

    if (!story) {
      throw new NotFoundError('Story', storyId);
    }

    // Build where clause - ST-214: story-scoped
    const where: any = {
      storyId,
    };

    // Filter by definition key
    if (params.definitionKey) {
      if (!story.assignedWorkflowId) {
        throw new ValidationError('Story does not have an assigned workflow');
      }

      const definition = await prisma.artifactDefinition.findFirst({
        where: {
          workflowId: story.assignedWorkflowId,
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

    // Format artifacts, optionally excluding content and adding version counts
    const data = await Promise.all(
      artifacts.map(async (artifact) => {
        const formatted = formatArtifact(artifact);
        if (params.includeContent !== true) {
          formatted.content = `[${formatted.size} bytes]`;
        }

        // ST-214: Add version count if requested
        if (params.includeVersionCounts) {
          const versionCount = await prisma.artifactVersion.count({
            where: { artifactId: artifact.id },
          });
          (formatted as any).versionCount = versionCount;
        }

        return formatted;
      }),
    );

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
