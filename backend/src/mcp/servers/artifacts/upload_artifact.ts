/**
 * Upload Artifact Tool
 * Creates or updates story-scoped artifacts with version history (ST-214)
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';
import {
  UploadArtifactParams,
  ArtifactResponse,
  NotFoundError,
  ValidationError,
} from '../../types';
import { validateRequired, handlePrismaError } from '../../utils';

export const tool: Tool = {
  name: 'upload_artifact',
  description: 'Create or update artifact. Requires workflowRunId and definitionKey, plus content.',
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
    storyId: artifact.storyId,
    workflowRunId: artifact.workflowRunId || undefined,
    lastUpdatedRunId: artifact.lastUpdatedRunId || undefined,
    content: artifact.content,
    contentHash: artifact.contentHash || undefined,
    contentType: artifact.contentType,
    size: artifact.size,
    currentVersion: artifact.currentVersion,
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

// ST-214: Per-story quotas
const MAX_ARTIFACTS_PER_STORY = 100;
const MAX_TOTAL_SIZE_PER_STORY = 50 * 1024 * 1024; // 50MB

function calculateSHA256(content: string): string {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

export async function handler(
  prisma: PrismaClient,
  params: UploadArtifactParams,
): Promise<ArtifactResponse> {
  try {
    validateRequired(params, ['workflowRunId', 'content']);

    // Verify workflow run exists and get workflow ID + story
    const workflowRun = await prisma.workflowRun.findUnique({
      where: { id: params.workflowRunId },
      include: {
        workflow: { include: { project: true } },
        story: true,
      },
    });

    if (!workflowRun) {
      throw new NotFoundError('WorkflowRun', params.workflowRunId);
    }

    if (!workflowRun.storyId) {
      throw new ValidationError('WorkflowRun must be associated with a story');
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

    // ST-214: Authorization - verify story belongs to same project as workflow
    if (workflowRun.story?.projectId !== workflowRun.workflow.projectId) {
      throw new ValidationError(
        'Story must belong to the same project as the workflow',
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

    // Calculate size and hash (ST-214: SHA256 for deduplication)
    const size = Buffer.byteLength(params.content, 'utf8');
    const contentHash = calculateSHA256(params.content);

    // ST-214: Check story-scoped artifact existence
    const existingArtifact = await prisma.artifact.findFirst({
      where: {
        definitionId,
        storyId: workflowRun.storyId,
      },
      include: {
        versions: {
          orderBy: { version: 'desc' },
          take: 1,
        },
      },
    });

    // ST-214: Hash deduplication - skip if content unchanged
    if (existingArtifact && existingArtifact.contentHash === contentHash) {
      return formatArtifact(existingArtifact);
    }

    // ST-214: Quota checks before creating new version
    if (!existingArtifact) {
      const storyArtifactCount = await prisma.artifact.count({
        where: { storyId: workflowRun.storyId },
      });

      if (storyArtifactCount >= MAX_ARTIFACTS_PER_STORY) {
        throw new ValidationError(
          `Story has reached maximum of ${MAX_ARTIFACTS_PER_STORY} artifacts`,
        );
      }
    }

    const storyTotalSize = await prisma.artifact.aggregate({
      where: { storyId: workflowRun.storyId },
      _sum: { size: true },
    });

    const currentTotalSize = storyTotalSize._sum.size || 0;
    if (currentTotalSize + size > MAX_TOTAL_SIZE_PER_STORY) {
      throw new ValidationError(
        `Story would exceed maximum total size of ${MAX_TOTAL_SIZE_PER_STORY} bytes`,
      );
    }

    // ST-214: Use transaction for atomic version creation
    const artifact = await prisma.$transaction(async (tx) => {
      let result;

      if (existingArtifact) {
        // Update existing artifact
        const newVersion = existingArtifact.currentVersion + 1;

        result = await tx.artifact.update({
          where: { id: existingArtifact.id },
          data: {
            content: params.content,
            contentHash,
            contentType,
            size,
            currentVersion: newVersion,
            lastUpdatedRunId: params.workflowRunId,
            workflowRunId: params.workflowRunId,
            createdByComponentId: params.componentId || existingArtifact.createdByComponentId,
          },
          include: {
            definition: true,
            createdByComponent: true,
          },
        });

        // Create version history entry
        await tx.artifactVersion.create({
          data: {
            artifactId: existingArtifact.id,
            version: newVersion,
            workflowRunId: params.workflowRunId,
            content: params.content,
            contentHash,
            contentType,
            size,
            createdByComponentId: params.componentId,
          },
        });
      } else {
        // Create new artifact
        result = await tx.artifact.create({
          data: {
            definitionId,
            storyId: workflowRun.storyId,
            workflowRunId: params.workflowRunId,
            lastUpdatedRunId: params.workflowRunId,
            content: params.content,
            contentHash,
            contentType,
            size,
            currentVersion: 1,
            createdByComponentId: params.componentId,
          },
          include: {
            definition: true,
            createdByComponent: true,
          },
        });

        // Create initial version history entry
        await tx.artifactVersion.create({
          data: {
            artifactId: result.id,
            version: 1,
            workflowRunId: params.workflowRunId,
            content: params.content,
            contentHash,
            contentType,
            size,
            createdByComponentId: params.componentId,
          },
        });
      }

      return result;
    });

    return formatArtifact(artifact);
  } catch (error: any) {
    if (error.name === 'MCPError') {
      throw error;
    }
    throw handlePrismaError(error, 'upload_artifact');
  }
}
