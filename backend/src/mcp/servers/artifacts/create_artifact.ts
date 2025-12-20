/**
 * Upload Artifact Tool
 * Creates or updates story-scoped artifacts with version history (ST-214)
 */

import * as crypto from 'crypto';
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
  name: 'create_artifact',
  description: 'Create or update story-scoped or epic-scoped artifact. Provide storyId OR epicId OR workflowRunId.',
  inputSchema: {
    type: 'object',
    properties: {
      storyId: {
        type: 'string',
        description: 'Story UUID - direct story-scoped upload (ST-214). Use this OR epicId OR workflowRunId.',
      },
      epicId: {
        type: 'string',
        description: 'Epic UUID - epic-scoped upload (ST-362). Use this OR storyId OR workflowRunId.',
      },
      definitionId: {
        type: 'string',
        description: 'Artifact Definition UUID (provide this OR definitionKey)',
      },
      definitionKey: {
        type: 'string',
        description: 'Artifact key (e.g., "THE_PLAN", "ARCH_DOC").',
      },
      workflowRunId: {
        type: 'string',
        description: 'Workflow Run UUID - derives storyId from run. Use this OR storyId OR epicId.',
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
    required: ['content'],
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
    storyId: artifact.storyId || undefined,
    epicId: artifact.epicId || undefined,
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
    validateRequired(params as unknown as Record<string, unknown>, ['content']);

    // ST-362: Support storyId OR epicId OR workflowRunId (XOR constraint)
    const scopeCount = [params.storyId, params.epicId, params.workflowRunId].filter(Boolean).length;
    if (scopeCount === 0) {
      throw new ValidationError('Either storyId, epicId, or workflowRunId must be provided');
    }
    if (scopeCount > 1 && !(params.storyId && params.workflowRunId)) {
      // Allow storyId + workflowRunId together (validation below), but not other combinations
      throw new ValidationError('Cannot provide multiple scope parameters (only storyId+workflowRunId allowed)');
    }

    let storyId: string | undefined;
    let epicId: string | undefined;
    let workflowId: string | null = null;
    let projectId: string;
    const workflowRunId: string | undefined = params.workflowRunId;

    if (params.storyId) {
      // Direct story-scoped upload (ST-214)
      const story = await prisma.story.findUnique({
        where: { id: params.storyId },
        include: { project: true },
      });

      if (!story) {
        throw new NotFoundError('Story', params.storyId);
      }

      storyId = story.id;
      projectId = story.projectId;

      // If workflowRunId also provided, validate it belongs to this story
      if (params.workflowRunId) {
        const run = await prisma.workflowRun.findUnique({
          where: { id: params.workflowRunId },
        });
        if (run && run.storyId !== storyId) {
          throw new ValidationError('WorkflowRun does not belong to the specified story');
        }
        workflowId = run?.workflowId || null;
      }
    } else if (params.epicId) {
      // ST-362: Epic-scoped upload
      const epic = await prisma.epic.findUnique({
        where: { id: params.epicId },
        include: { project: true },
      });

      if (!epic) {
        throw new NotFoundError('Epic', params.epicId);
      }

      epicId = epic.id;
      projectId = epic.projectId;
    } else {
      // Derive storyId from workflowRunId (original behavior)
      const workflowRun = await prisma.workflowRun.findUnique({
        where: { id: params.workflowRunId! },
        include: {
          workflow: { include: { project: true } },
          story: true,
        },
      });

      if (!workflowRun) {
        throw new NotFoundError('WorkflowRun', params.workflowRunId!);
      }

      if (!workflowRun.storyId) {
        throw new ValidationError('WorkflowRun must be associated with a story');
      }

      storyId = workflowRun.storyId;
      workflowId = workflowRun.workflowId;
      projectId = workflowRun.workflow.projectId;
    }

    // Resolve definition ID
    let definitionId = params.definitionId;

    if (!definitionId && params.definitionKey) {
      // ST-362: Support global definitions (projectId) and workflow-scoped definitions
      // Priority order: workflow-scoped > project-scoped (global)
      const whereClause = workflowId
        ? { workflowId, key: params.definitionKey.toUpperCase() }
        : {
            OR: [
              { workflow: { projectId }, key: params.definitionKey.toUpperCase() },
              { projectId, key: params.definitionKey.toUpperCase() }, // ST-362: Global definitions
            ],
          };

      const definition = await prisma.artifactDefinition.findFirst({
        where: whereClause,
        orderBy: [
          { workflowId: 'desc' }, // Prefer workflow-scoped over global
        ],
      });

      if (!definition) {
        throw new NotFoundError(
          'ArtifactDefinition',
          workflowId
            ? `key=${params.definitionKey} in workflow=${workflowId}`
            : `key=${params.definitionKey} in project`,
        );
      }

      definitionId = definition.id;
    }

    if (!definitionId) {
      throw new ValidationError(
        'Either definitionId or definitionKey must be provided',
      );
    }

    // Verify definition exists
    const definition = await prisma.artifactDefinition.findUnique({
      where: { id: definitionId },
      include: { workflow: true, project: true },
    });

    if (!definition) {
      throw new NotFoundError('ArtifactDefinition', definitionId);
    }

    // ST-362: Verify definition belongs to same project (workflow-scoped or global)
    const defProjectId = definition.workflow?.projectId || definition.projectId;
    if (defProjectId !== projectId) {
      throw new ValidationError(
        'Artifact definition must belong to the same project as the story/epic',
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

    // ST-362: Check artifact existence (story-scoped or epic-scoped)
    const whereClause = storyId
      ? { definitionId, storyId }
      : { definitionId, epicId };

    const existingArtifact = await prisma.artifact.findFirst({
      where: whereClause,
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

    // ST-362: Quota checks before creating new version (only for story-scoped)
    if (storyId) {
      if (!existingArtifact) {
        const storyArtifactCount = await prisma.artifact.count({
          where: { storyId },
        });

        if (storyArtifactCount >= MAX_ARTIFACTS_PER_STORY) {
          throw new ValidationError(
            `Story has reached maximum of ${MAX_ARTIFACTS_PER_STORY} artifacts`,
          );
        }
      }

      const storyTotalSize = await prisma.artifact.aggregate({
        where: { storyId },
        _sum: { size: true },
      });

      const currentTotalSize = storyTotalSize._sum.size || 0;
      if (currentTotalSize + size > MAX_TOTAL_SIZE_PER_STORY) {
        throw new ValidationError(
          `Story would exceed maximum total size of ${MAX_TOTAL_SIZE_PER_STORY} bytes`,
        );
      }
    }
    // TODO: Add epic-level quotas if needed in the future

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
            lastUpdatedRunId: workflowRunId,
            workflowRunId: workflowRunId,
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
            workflowRunId,
            content: params.content,
            contentHash,
            contentType,
            size,
            createdByComponentId: params.componentId,
          },
        });
      } else {
        // Create new artifact (ST-362: support both storyId and epicId)
        result = await tx.artifact.create({
          data: {
            definitionId,
            storyId: storyId || undefined,
            epicId: epicId || undefined,
            workflowRunId,
            lastUpdatedRunId: workflowRunId,
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
            workflowRunId,
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
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'name' in error && error.name === 'MCPError') {
      throw error;
    }
    throw handlePrismaError(error as Error, 'create_artifact');
  }
}
