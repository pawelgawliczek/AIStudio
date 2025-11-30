/**
 * Remove Artifact Access Tool
 * Removes access configuration for a workflow state
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import {
  RemoveArtifactAccessParams,
  NotFoundError,
  ValidationError,
} from '../../types';
import { validateRequired, handlePrismaError } from '../../utils';

export const tool: Tool = {
  name: 'remove_artifact_access',
  description:
    'Remove access configuration for a workflow state. The state will no longer have access to the artifact.',
  inputSchema: {
    type: 'object',
    properties: {
      definitionId: {
        type: 'string',
        description: 'Artifact Definition UUID (provide this OR definitionKey + workflowId)',
      },
      definitionKey: {
        type: 'string',
        description: 'Artifact key (e.g., "ARCH_DOC"). Requires workflowId.',
      },
      workflowId: {
        type: 'string',
        description: 'Workflow UUID (required if using definitionKey)',
      },
      stateId: {
        type: 'string',
        description: 'Workflow State UUID (required)',
      },
    },
    required: ['stateId'],
  },
};

export const metadata = {
  category: 'artifacts',
  domain: 'story_runner',
  tags: ['artifact', 'access', 'permission', 'workflow', 'remove'],
  version: '1.0.0',
  since: 'ST-151',
};

export interface RemoveArtifactAccessResponse {
  success: boolean;
  definitionId: string;
  stateId: string;
  message: string;
}

export async function handler(
  prisma: PrismaClient,
  params: RemoveArtifactAccessParams,
): Promise<RemoveArtifactAccessResponse> {
  try {
    validateRequired(params, ['stateId']);

    // Resolve definition ID
    let definitionId = params.definitionId;

    if (!definitionId && params.definitionKey) {
      if (!params.workflowId) {
        throw new ValidationError(
          'workflowId is required when using definitionKey',
        );
      }

      const definition = await prisma.artifactDefinition.findFirst({
        where: {
          workflowId: params.workflowId,
          key: params.definitionKey.toUpperCase(),
        },
      });

      if (!definition) {
        throw new NotFoundError(
          'ArtifactDefinition',
          `key=${params.definitionKey} in workflow=${params.workflowId}`,
        );
      }

      definitionId = definition.id;
    }

    if (!definitionId) {
      throw new ValidationError(
        'Either definitionId or (definitionKey + workflowId) must be provided',
      );
    }

    // Check if access rule exists
    const existingAccess = await prisma.artifactAccess.findUnique({
      where: {
        definitionId_stateId: {
          definitionId,
          stateId: params.stateId,
        },
      },
      include: {
        definition: true,
        state: true,
      },
    });

    if (!existingAccess) {
      throw new NotFoundError(
        'ArtifactAccess',
        `definitionId=${definitionId}, stateId=${params.stateId}`,
      );
    }

    // Delete access rule
    await prisma.artifactAccess.delete({
      where: {
        definitionId_stateId: {
          definitionId,
          stateId: params.stateId,
        },
      },
    });

    return {
      success: true,
      definitionId,
      stateId: params.stateId,
      message: `Access removed: state "${existingAccess.state.name}" no longer has ${existingAccess.accessType} access to artifact "${existingAccess.definition.name}"`,
    };
  } catch (error: any) {
    if (error.name === 'MCPError') {
      throw error;
    }
    throw handlePrismaError(error, 'remove_artifact_access');
  }
}
