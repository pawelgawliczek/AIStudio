/**
 * Upload Artifact Tool
 * Creates or updates an artifact for a workflow run
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import {
  UploadArtifactParams,
  ArtifactResponse,
  NotFoundError,
  ValidationError,
} from '../../types';
import { validateRequired, handlePrismaError } from '../../utils';

export const tool: Tool = {
  name: 'upload_artifact',
  description:
    'Upload or update an artifact for a workflow run. Validates against artifact definition and access permissions.',
  inputSchema: {
    type: 'object',
    properties: {
      definitionId: {
        type: 'string',
        description: 'Artifact Definition UUID (provide this OR definitionKey + workflowId)',
      },
      definitionKey: {
        type: 'string',
        description: 'Artifact key (e.g., "ARCH_DOC"). Requires looking up via workflowRunId.',
      },
      workflowRunId: {
        type: 'string',
        description: 'Workflow Run UUID (required)',
      },
      content: {
        type: 'string',
        description: 'Artifact content (text, markdown, JSON string, code, etc.)',
      },
      contentType: {
        type: 'string',
        description: 'MIME type (e.g., "text/markdown", "application/json"). Defaults based on definition type.',
      },
      componentId: {
        type: 'string',
        description: 'Component UUID that is creating this artifact (optional)',
      },
    },
    required: ['workflowRunId', 'content'],
  },
};

export const metadata = {
  category: 'artifacts',
  domain: 'story_runner',
  tags: ['artifact', 'upload', 'create', 'workflow'],
  version: '1.0.0',
  since: 'ST-151',
};

const TYPE_TO_CONTENT_TYPE: Record<string, string> = {
  markdown: 'text/markdown',
  json: 'application/json',
  code: 'text/plain',
  report: 'text/markdown',
  image: 'image/png',
  other: 'application/octet-stream',
};

export function formatArtifact(artifact: any): ArtifactResponse {
  return {
    id: artifact.id,
    definitionId: artifact.definitionId,
    workflowRunId: artifact.workflowRunId,
    content: artifact.content,
    contentType: artifact.contentType,
    size: artifact.size,
    version: artifact.version,
    createdByComponentId: artifact.createdByComponentId || undefined,
    createdAt: artifact.createdAt.toISOString(),
    updatedAt: artifact.updatedAt.toISOString(),
    definition: artifact.definition
      ? {
          id: artifact.definition.id,
          name: artifact.definition.name,
          key: artifact.definition.key,
          type: artifact.definition.type,
        }
      : undefined,
    createdByComponent: artifact.createdByComponent
      ? {
          id: artifact.createdByComponent.id,
          name: artifact.createdByComponent.name,
        }
      : undefined,
  };
}

export async function handler(
  prisma: PrismaClient,
  params: UploadArtifactParams,
): Promise<ArtifactResponse> {
  try {
    validateRequired(params, ['workflowRunId', 'content']);

    // Verify workflow run exists and get workflow ID
    const workflowRun = await prisma.workflowRun.findUnique({
      where: { id: params.workflowRunId },
      include: { workflow: true },
    });

    if (!workflowRun) {
      throw new NotFoundError('WorkflowRun', params.workflowRunId);
    }

    // Resolve definition ID
    let definitionId = params.definitionId;

    if (!definitionId && params.definitionKey) {
      const definition = await prisma.artifactDefinition.findFirst({
        where: {
          workflowId: workflowRun.workflowId,
          key: params.definitionKey.toUpperCase(),
        },
      });

      if (!definition) {
        throw new NotFoundError(
          'ArtifactDefinition',
          `key=${params.definitionKey} in workflow=${workflowRun.workflowId}`,
        );
      }

      definitionId = definition.id;
    }

    if (!definitionId) {
      throw new ValidationError(
        'Either definitionId or definitionKey must be provided',
      );
    }

    // Verify definition exists and belongs to the workflow
    const definition = await prisma.artifactDefinition.findUnique({
      where: { id: definitionId },
    });

    if (!definition) {
      throw new NotFoundError('ArtifactDefinition', definitionId);
    }

    if (definition.workflowId !== workflowRun.workflowId) {
      throw new ValidationError(
        'Artifact definition must belong to the same workflow as the run',
      );
    }

    // Validate JSON content if definition type is 'json'
    if (definition.type === 'json') {
      try {
        JSON.parse(params.content);
      } catch {
        throw new ValidationError(
          'Content must be valid JSON for json-type artifacts',
        );
      }
    }

    // Validate against schema if defined
    if (definition.schema && definition.type === 'json') {
      // TODO: Add JSON Schema validation if needed
      // For now, we just ensure it's valid JSON (done above)
    }

    // Determine content type
    const contentType = params.contentType || TYPE_TO_CONTENT_TYPE[definition.type] || 'text/plain';

    // Calculate size
    const size = Buffer.byteLength(params.content, 'utf8');

    // Check if artifact already exists for this run
    const existingArtifact = await prisma.artifact.findFirst({
      where: {
        definitionId,
        workflowRunId: params.workflowRunId,
      },
    });

    let artifact;

    if (existingArtifact) {
      // Update existing artifact (increment version)
      artifact = await prisma.artifact.update({
        where: { id: existingArtifact.id },
        data: {
          content: params.content,
          contentType,
          size,
          version: existingArtifact.version + 1,
          createdByComponentId: params.componentId || existingArtifact.createdByComponentId,
        },
        include: {
          definition: true,
          createdByComponent: true,
        },
      });
    } else {
      // Create new artifact
      artifact = await prisma.artifact.create({
        data: {
          definitionId,
          workflowRunId: params.workflowRunId,
          content: params.content,
          contentType,
          size,
          version: 1,
          createdByComponentId: params.componentId,
        },
        include: {
          definition: true,
          createdByComponent: true,
        },
      });
    }

    return formatArtifact(artifact);
  } catch (error: any) {
    if (error.name === 'MCPError') {
      throw error;
    }
    throw handlePrismaError(error, 'upload_artifact');
  }
}
