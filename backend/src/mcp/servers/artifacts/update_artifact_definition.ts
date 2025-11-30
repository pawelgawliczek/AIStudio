/**
 * Update Artifact Definition Tool
 * Updates an existing artifact definition
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import {
  UpdateArtifactDefinitionParams,
  ArtifactDefinitionResponse,
  NotFoundError,
  ValidationError,
} from '../../types';
import { validateRequired, handlePrismaError } from '../../utils';
import { formatArtifactDefinition } from './create_artifact_definition';

const VALID_ARTIFACT_TYPES = ['markdown', 'json', 'code', 'report', 'image', 'other'];

export const tool: Tool = {
  name: 'update_artifact_definition',
  description:
    'Update an existing artifact definition. Supports partial updates - only provided fields will be modified.',
  inputSchema: {
    type: 'object',
    properties: {
      definitionId: {
        type: 'string',
        description: 'Artifact Definition UUID (required)',
      },
      name: {
        type: 'string',
        description: 'Human-readable name (optional)',
      },
      description: {
        type: 'string',
        description: 'Description of the artifact purpose (optional)',
      },
      type: {
        type: 'string',
        enum: VALID_ARTIFACT_TYPES,
        description: 'Artifact type (optional)',
      },
      schema: {
        type: ['object', 'null'],
        description: 'JSON Schema for validation. Pass null to clear. (optional)',
      },
      isMandatory: {
        type: 'boolean',
        description: 'If true, artifact is required for workflow completion (optional)',
      },
    },
    required: ['definitionId'],
  },
};

export const metadata = {
  category: 'artifacts',
  domain: 'story_runner',
  tags: ['artifact', 'definition', 'update', 'workflow'],
  version: '1.0.0',
  since: 'ST-151',
};

export async function handler(
  prisma: PrismaClient,
  params: UpdateArtifactDefinitionParams,
): Promise<ArtifactDefinitionResponse> {
  try {
    validateRequired(params, ['definitionId']);

    // Verify definition exists
    const existing = await prisma.artifactDefinition.findUnique({
      where: { id: params.definitionId },
    });

    if (!existing) {
      throw new NotFoundError('ArtifactDefinition', params.definitionId);
    }

    // Validate type if provided
    if (params.type && !VALID_ARTIFACT_TYPES.includes(params.type)) {
      throw new ValidationError(
        `Invalid artifact type "${params.type}". Must be one of: ${VALID_ARTIFACT_TYPES.join(', ')}`,
      );
    }

    // Build update data
    const updateData: Record<string, any> = {};

    if (params.name !== undefined) {
      updateData.name = params.name;
    }

    if (params.description !== undefined) {
      updateData.description = params.description;
    }

    if (params.type !== undefined) {
      updateData.type = params.type;
    }

    if (params.schema !== undefined) {
      updateData.schema = params.schema === null ? null : params.schema;
    }

    if (params.isMandatory !== undefined) {
      updateData.isMandatory = params.isMandatory;
    }

    // Check if there are any updates
    if (Object.keys(updateData).length === 0) {
      throw new ValidationError('No fields provided for update');
    }

    // Update definition
    const definition = await prisma.artifactDefinition.update({
      where: { id: params.definitionId },
      data: updateData,
      include: {
        accessRules: {
          include: {
            state: true,
          },
        },
        _count: {
          select: { artifacts: true },
        },
      },
    });

    return formatArtifactDefinition(definition, true);
  } catch (error: any) {
    if (error.name === 'MCPError') {
      throw error;
    }
    throw handlePrismaError(error, 'update_artifact_definition');
  }
}
