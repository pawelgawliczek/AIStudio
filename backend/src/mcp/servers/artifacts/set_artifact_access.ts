/**
 * Set Artifact Access Tool
 * Configures which workflow states can access which artifacts
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import {
  SetArtifactAccessParams,
  ArtifactAccessResponse,
  NotFoundError,
  ValidationError,
} from '../../types';
import { validateRequired, handlePrismaError } from '../../utils';

const VALID_ACCESS_TYPES = ['read', 'write', 'required'];

export const tool: Tool = {
  name: 'set_artifact_access',
  description:
    'Configure which workflow states can access an artifact. Access types: read (can consume), write (can produce), required (must consume).',
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
      accessType: {
        type: 'string',
        enum: VALID_ACCESS_TYPES,
        description: 'Access type: "read", "write", or "required"',
      },
    },
    required: ['stateId', 'accessType'],
  },
};

export const metadata = {
  category: 'artifacts',
  domain: 'story_runner',
  tags: ['artifact', 'access', 'permission', 'workflow'],
  version: '1.0.0',
  since: 'ST-151',
};

export function formatArtifactAccess(access: any): ArtifactAccessResponse {
  return {
    id: access.id,
    definitionId: access.definitionId,
    stateId: access.stateId,
    accessType: access.accessType,
    createdAt: access.createdAt.toISOString(),
    state: access.state
      ? {
          id: access.state.id,
          name: access.state.name,
          order: access.state.order,
        }
      : undefined,
    definition: access.definition
      ? {
          id: access.definition.id,
          name: access.definition.name,
          key: access.definition.key,
        }
      : undefined,
  };
}

export async function handler(
  prisma: PrismaClient,
  params: SetArtifactAccessParams,
): Promise<ArtifactAccessResponse> {
  try {
    validateRequired(params as unknown as Record<string, unknown>, ['stateId', 'accessType']);

    // Validate access type
    if (!VALID_ACCESS_TYPES.includes(params.accessType)) {
      throw new ValidationError(
        `Invalid access type "${params.accessType}". Must be one of: ${VALID_ACCESS_TYPES.join(', ')}`,
      );
    }

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

    // Verify definition exists
    const definition = await prisma.artifactDefinition.findUnique({
      where: { id: definitionId },
    });

    if (!definition) {
      throw new NotFoundError('ArtifactDefinition', definitionId);
    }

    // Verify state exists and belongs to the same workflow
    const state = await prisma.workflowState.findUnique({
      where: { id: params.stateId },
    });

    if (!state) {
      throw new NotFoundError('WorkflowState', params.stateId);
    }

    if (state.workflowId !== definition.workflowId) {
      throw new ValidationError(
        'State must belong to the same workflow as the artifact definition',
      );
    }

    // Upsert access rule (create or update if exists)
    const access = await prisma.artifactAccess.upsert({
      where: {
        definitionId_stateId: {
          definitionId,
          stateId: params.stateId,
        },
      },
      create: {
        definitionId,
        stateId: params.stateId,
        accessType: params.accessType,
      },
      update: {
        accessType: params.accessType,
      },
      include: {
        state: true,
        definition: true,
      },
    });

    return formatArtifactAccess(access);
  } catch (error: any) {
    if (error.name === 'MCPError') {
      throw error;
    }
    throw handlePrismaError(error, 'set_artifact_access');
  }
}
