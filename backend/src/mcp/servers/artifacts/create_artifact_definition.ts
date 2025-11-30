/**
 * Create Artifact Definition Tool
 * Defines what artifacts a workflow can produce/consume
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import {
  CreateArtifactDefinitionParams,
  ArtifactDefinitionResponse,
  NotFoundError,
  ValidationError,
} from '../../types';
import { validateRequired, handlePrismaError } from '../../utils';

const VALID_ARTIFACT_TYPES = ['markdown', 'json', 'code', 'report', 'image', 'other'];

export const tool: Tool = {
  name: 'create_artifact_definition',
  description:
    'Define an artifact structure for a workflow. Artifacts are typed documents (markdown, json, code, etc.) that agents produce and consume during workflow execution.',
  inputSchema: {
    type: 'object',
    properties: {
      workflowId: {
        type: 'string',
        description: 'Workflow UUID (required)',
      },
      name: {
        type: 'string',
        description: 'Human-readable name (e.g., "Architecture Document")',
      },
      key: {
        type: 'string',
        description: 'Unique key within workflow (e.g., "ARCH_DOC"). Used for referencing.',
      },
      description: {
        type: 'string',
        description: 'Description of the artifact purpose (optional)',
      },
      type: {
        type: 'string',
        enum: VALID_ARTIFACT_TYPES,
        description: 'Artifact type: markdown, json, code, report, image, or other',
      },
      schema: {
        type: 'object',
        description: 'JSON Schema for validation (optional, for type=json)',
      },
      isMandatory: {
        type: 'boolean',
        description: 'If true, this artifact must be created for workflow to complete (default: false)',
      },
    },
    required: ['workflowId', 'name', 'key', 'type'],
  },
};

export const metadata = {
  category: 'artifacts',
  domain: 'story_runner',
  tags: ['artifact', 'definition', 'create', 'workflow'],
  version: '1.0.0',
  since: 'ST-151',
};

export function formatArtifactDefinition(
  definition: any,
  includeAccessRules = false,
): ArtifactDefinitionResponse {
  const formatted: ArtifactDefinitionResponse = {
    id: definition.id,
    workflowId: definition.workflowId,
    name: definition.name,
    key: definition.key,
    description: definition.description || undefined,
    type: definition.type,
    schema: definition.schema || undefined,
    isMandatory: definition.isMandatory,
    createdAt: definition.createdAt.toISOString(),
    updatedAt: definition.updatedAt.toISOString(),
  };

  if (includeAccessRules && definition.accessRules) {
    formatted.accessRules = definition.accessRules.map((rule: any) => ({
      id: rule.id,
      definitionId: rule.definitionId,
      stateId: rule.stateId,
      accessType: rule.accessType,
      createdAt: rule.createdAt.toISOString(),
      state: rule.state
        ? {
            id: rule.state.id,
            name: rule.state.name,
            order: rule.state.order,
          }
        : undefined,
    }));
  }

  if (definition._count?.artifacts !== undefined) {
    formatted.artifactCount = definition._count.artifacts;
  }

  return formatted;
}

export async function handler(
  prisma: PrismaClient,
  params: CreateArtifactDefinitionParams,
): Promise<ArtifactDefinitionResponse> {
  try {
    validateRequired(params, ['workflowId', 'name', 'key', 'type']);

    // Validate type
    if (!VALID_ARTIFACT_TYPES.includes(params.type)) {
      throw new ValidationError(
        `Invalid artifact type "${params.type}". Must be one of: ${VALID_ARTIFACT_TYPES.join(', ')}`,
      );
    }

    // Validate key format (alphanumeric + underscore, uppercase recommended)
    if (!/^[A-Z0-9_]+$/i.test(params.key)) {
      throw new ValidationError(
        'Artifact key must contain only letters, numbers, and underscores',
      );
    }

    // Verify workflow exists
    const workflow = await prisma.workflow.findUnique({
      where: { id: params.workflowId },
    });

    if (!workflow) {
      throw new NotFoundError('Workflow', params.workflowId);
    }

    // Check for duplicate key in workflow
    const existingByKey = await prisma.artifactDefinition.findFirst({
      where: {
        workflowId: params.workflowId,
        key: params.key,
      },
    });

    if (existingByKey) {
      throw new ValidationError(
        `Artifact definition with key "${params.key}" already exists in this workflow`,
      );
    }

    // Create artifact definition
    const definition = await prisma.artifactDefinition.create({
      data: {
        workflowId: params.workflowId,
        name: params.name,
        key: params.key.toUpperCase(), // Normalize to uppercase
        description: params.description,
        type: params.type,
        schema: params.schema ? (params.schema as any) : undefined,
        isMandatory: params.isMandatory ?? false,
      },
    });

    return formatArtifactDefinition(definition);
  } catch (error: any) {
    if (error.name === 'MCPError') {
      throw error;
    }
    throw handlePrismaError(error, 'create_artifact_definition');
  }
}
