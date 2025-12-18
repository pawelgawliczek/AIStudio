/**
 * Get Artifact Tool
 * Retrieves a specific artifact by ID or by definition key + run
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import { markOmitted, artifactFetchCommand } from '../../truncation-utils';
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
  description: 'Get artifact by ID, storyId+definitionKey, or workflowRunId+definitionKey. Optionally get specific version.',
  inputSchema: {
    type: 'object',
    properties: {
      artifactId: {
        type: 'string',
        description: 'Artifact UUID (provide this OR definitionKey + storyId/workflowRunId)',
      },
      definitionKey: {
        type: 'string',
        description: 'Artifact definition key (e.g., "ARCH_DOC"). Requires storyId or workflowRunId.',
      },
      storyId: {
        type: 'string',
        description: 'Story UUID (use with definitionKey for story-scoped lookup)',
      },
      workflowRunId: {
        type: 'string',
        description: 'Workflow Run UUID (use with definitionKey, will resolve to story)',
      },
      version: {
        type: 'number',
        description: 'Specific version to retrieve (default: latest)',
      },
      includeContent: {
        type: 'boolean',
        description: 'Include full content in response (default: false for token efficiency)',
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
    // ST-214: Validate version parameter
    if (params.version !== undefined && params.version < 1) {
      throw new ValidationError('Version must be >= 1');
    }

    let artifact;
    let artifactVersion;

    if (params.artifactId) {
      // Direct lookup by ID
      artifact = await prisma.artifact.findUnique({
        where: { id: params.artifactId },
        include: {
          definition: true,
          createdByComponent: true,
          workflowRun: true,
          story: true,
        },
      });

      if (!artifact) {
        throw new NotFoundError('Artifact', params.artifactId);
      }

      // ST-214: If version requested, fetch from version history
      if (params.version && params.version !== artifact.currentVersion) {
        artifactVersion = await prisma.artifactVersion.findUnique({
          where: {
            artifactId_version: {
              artifactId: params.artifactId,
              version: params.version,
            },
          },
        });

        if (!artifactVersion) {
          throw new NotFoundError(
            'ArtifactVersion',
            `artifact=${params.artifactId} version=${params.version}`,
          );
        }
      }
    } else if (params.definitionKey && (params.storyId || params.workflowRunId)) {
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
        throw new ValidationError('Could not resolve storyId');
      }

      // Get story to find workflow
      const story = await prisma.story.findUnique({
        where: { id: storyId },
      });

      if (!story) {
        throw new NotFoundError('Story', storyId);
      }

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

      // ST-214: Story-scoped lookup
      artifact = await prisma.artifact.findFirst({
        where: {
          definitionId: definition.id,
          storyId,
        },
        include: {
          definition: true,
          createdByComponent: true,
          workflowRun: true,
          story: true,
        },
      });

      if (!artifact) {
        throw new NotFoundError(
          'Artifact',
          `key=${params.definitionKey} in story=${storyId}`,
        );
      }

      // ST-214: If version requested, fetch from version history
      if (params.version && params.version !== artifact.currentVersion) {
        artifactVersion = await prisma.artifactVersion.findUnique({
          where: {
            artifactId_version: {
              artifactId: artifact.id,
              version: params.version,
            },
          },
        });

        if (!artifactVersion) {
          throw new NotFoundError(
            'ArtifactVersion',
            `artifact=${artifact.id} version=${params.version}`,
          );
        }
      }
    } else {
      throw new ValidationError(
        'Either artifactId or (definitionKey + storyId/workflowRunId) must be provided',
      );
    }

    // ST-214: If fetching a specific version, return version data instead
    if (artifactVersion) {
      const versionResponse: any = {
        id: artifactVersion.id,
        artifactId: artifactVersion.artifactId,
        version: artifactVersion.version,
        workflowRunId: artifactVersion.workflowRunId,
        content: artifactVersion.content,
        contentHash: artifactVersion.contentHash,
        contentType: artifactVersion.contentType,
        size: artifactVersion.size,
        createdByComponentId: artifactVersion.createdByComponentId,
        createdAt: artifactVersion.createdAt.toISOString(),
        definition: artifact.definition
          ? {
              id: artifact.definition.id,
              name: artifact.definition.name,
              key: artifact.definition.key,
              type: artifact.definition.type,
            }
          : undefined,
      };

      if (params.includeContent !== true) {
        const contentSize = artifactVersion.content?.length || 0;
        versionResponse.content = null;
        versionResponse._truncated = markOmitted(
          'content',
          contentSize,
          artifactFetchCommand(artifact.id),
        );
      }

      return versionResponse;
    }

    const response = formatArtifact(artifact);

    // Default: exclude content for token efficiency (BREAKING CHANGE - ST-162)
    // Content is only included when explicitly requested with includeContent: true
    if (params.includeContent !== true) {
      const contentSize = artifact.content?.length || 0;
      response.content = '';
      (response as any)._truncated = markOmitted(
        'content',
        contentSize,
        artifactFetchCommand(artifact.id),
      );
    }

    return response;
  } catch (error: any) {
    if (error.name === 'MCPError') {
      throw error;
    }
    throw handlePrismaError(error, 'get_artifact');
  }
}
