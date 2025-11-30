/**
 * Get Artifact Tool
 * Retrieves a specific artifact by ID or by definition key + run
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import {
  GetArtifactParams,
  ArtifactResponse,
  NotFoundError,
  ValidationError,
} from '../../types';
import { handlePrismaError } from '../../utils';
import { formatArtifact } from './upload_artifact';

export const tool: Tool = {
  name: 'get_artifact',
  description:
    'Get a specific artifact by ID or by definition key + workflow run ID.',
  inputSchema: {
    type: 'object',
    properties: {
      artifactId: {
        type: 'string',
        description: 'Artifact UUID (provide this OR definitionKey + workflowRunId)',
      },
      definitionKey: {
        type: 'string',
        description: 'Artifact definition key (e.g., "ARCH_DOC"). Requires workflowRunId.',
      },
      workflowRunId: {
        type: 'string',
        description: 'Workflow Run UUID (required if using definitionKey)',
      },
      includeContent: {
        type: 'boolean',
        description: 'Include full content in response (default: true)',
      },
    },
    required: [],
  },
};

export const metadata = {
  category: 'artifacts',
  domain: 'story_runner',
  tags: ['artifact', 'get', 'read', 'workflow'],
  version: '1.0.0',
  since: 'ST-151',
};

export async function handler(
  prisma: PrismaClient,
  params: GetArtifactParams,
): Promise<ArtifactResponse> {
  try {
    let artifact;

    if (params.artifactId) {
      // Direct lookup by ID
      artifact = await prisma.artifact.findUnique({
        where: { id: params.artifactId },
        include: {
          definition: true,
          createdByComponent: true,
          workflowRun: true,
        },
      });

      if (!artifact) {
        throw new NotFoundError('Artifact', params.artifactId);
      }
    } else if (params.definitionKey && params.workflowRunId) {
      // Lookup by definition key and workflow run
      const workflowRun = await prisma.workflowRun.findUnique({
        where: { id: params.workflowRunId },
      });

      if (!workflowRun) {
        throw new NotFoundError('WorkflowRun', params.workflowRunId);
      }

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

      artifact = await prisma.artifact.findFirst({
        where: {
          definitionId: definition.id,
          workflowRunId: params.workflowRunId,
        },
        include: {
          definition: true,
          createdByComponent: true,
          workflowRun: true,
        },
      });

      if (!artifact) {
        throw new NotFoundError(
          'Artifact',
          `key=${params.definitionKey} in run=${params.workflowRunId}`,
        );
      }
    } else {
      throw new ValidationError(
        'Either artifactId or (definitionKey + workflowRunId) must be provided',
      );
    }

    const response = formatArtifact(artifact);

    // Optionally exclude content for metadata-only queries
    if (params.includeContent === false) {
      response.content = '[content omitted]';
    }

    return response;
  } catch (error: any) {
    if (error.name === 'MCPError') {
      throw error;
    }
    throw handlePrismaError(error, 'get_artifact');
  }
}
