/**
 * Delete Artifact Definition Tool
 * Deletes an artifact definition with cascade delete
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import {
  DeleteArtifactDefinitionParams,
  DeleteArtifactDefinitionResponse,
  NotFoundError,
  ValidationError,
} from '../../types';
import { validateRequired, handlePrismaError } from '../../utils';

export const tool: Tool = {
  name: 'delete_artifact_definition',
  description:
    'Delete an artifact definition. Cascade deletes all artifacts and access rules. Requires confirm: true parameter for safety.',
  inputSchema: {
    type: 'object',
    properties: {
      definitionId: {
        type: 'string',
        description: 'Artifact Definition UUID (required)',
      },
      confirm: {
        type: 'boolean',
        description: 'Must be set to true to confirm deletion (required)',
      },
    },
    required: ['definitionId', 'confirm'],
  },
};

export const metadata = {
  category: 'artifacts',
  domain: 'story_runner',
  tags: ['artifact', 'definition', 'delete', 'workflow'],
  version: '1.0.0',
  since: 'ST-151',
};

export async function handler(
  prisma: PrismaClient,
  params: DeleteArtifactDefinitionParams,
): Promise<DeleteArtifactDefinitionResponse> {
  try {
    validateRequired(params, ['definitionId', 'confirm']);

    if (!params.confirm) {
      throw new ValidationError(
        'Deletion requires confirm: true. This will cascade delete all artifacts and access rules.',
      );
    }

    // Verify definition exists and get counts
    const existing = await prisma.artifactDefinition.findUnique({
      where: { id: params.definitionId },
      include: {
        _count: {
          select: {
            artifacts: true,
            accessRules: true,
          },
        },
      },
    });

    if (!existing) {
      throw new NotFoundError('ArtifactDefinition', params.definitionId);
    }

    const cascadeDeleted = {
      artifacts: existing._count.artifacts,
      accessRules: existing._count.accessRules,
    };

    // Delete definition (cascade deletes artifacts and access rules via FK)
    await prisma.artifactDefinition.delete({
      where: { id: params.definitionId },
    });

    return {
      id: existing.id,
      key: existing.key,
      name: existing.name,
      cascadeDeleted,
      message: `Artifact definition "${existing.name}" (${existing.key}) deleted successfully. ` +
        `Cascade deleted: ${cascadeDeleted.artifacts} artifacts, ${cascadeDeleted.accessRules} access rules.`,
    };
  } catch (error: any) {
    if (error.name === 'MCPError') {
      throw error;
    }
    throw handlePrismaError(error, 'delete_artifact_definition');
  }
}
