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
import { formatArtifact } from './create_artifact';

export const tool: Tool = {
  name: 'get_artifact',
  description: 'Get artifact by ID, or by definitionKey + scope (storyId/epicId/workflowRunId). Optionally get specific version.',
  inputSchema: {
    type: 'object',
    properties: {
      artifactId: {
        type: 'string',
        description: 'Artifact UUID (provide this OR definitionKey + scope)',
      },
      definitionKey: {
        type: 'string',
        description: 'Artifact definition key (e.g., "ARCH_DOC", "THE_PLAN"). Requires storyId, epicId, or workflowRunId.',
      },
      storyId: {
        type: 'string',
        description: 'Story UUID (use with definitionKey for story-scoped lookup)',
      },
      epicId: {
        type: 'string',
        description: 'Epic UUID (use with definitionKey for epic-scoped lookup) - ST-362',
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
    } else if (params.definitionKey && (params.storyId || params.epicId || params.workflowRunId)) {
      // ST-362: Support story-scoped, epic-scoped, or workflowRun lookup
      let storyId: string | undefined = params.storyId;
      const epicId: string | undefined = params.epicId;
      let projectId: string;
      let workflowId: string | undefined;

      if (params.epicId) {
        // ST-362: Epic-scoped lookup
        const epic = await prisma.epic.findUnique({
          where: { id: params.epicId },
        });

        if (!epic) {
          throw new NotFoundError('Epic', params.epicId);
        }

        projectId = epic.projectId;
      } else {
        // Resolve storyId from workflowRunId if needed
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

        // Get story to find project
        const story = await prisma.story.findUnique({
          where: { id: storyId },
        });

        if (!story) {
          throw new NotFoundError('Story', storyId);
        }

        projectId = story.projectId;
        workflowId = story.assignedWorkflowId || undefined;
      }

      // ST-362: Find definition (workflow-scoped or global)
      const definition = await prisma.artifactDefinition.findFirst({
        where: {
          OR: [
            workflowId ? { workflowId, key: params.definitionKey.toUpperCase() } : {},
            { projectId, key: params.definitionKey.toUpperCase() },
          ].filter((clause) => Object.keys(clause).length > 0),
        },
        orderBy: [{ workflowId: 'desc' }], // Prefer workflow-scoped
      });

      if (!definition) {
        throw new NotFoundError(
          'ArtifactDefinition',
          `key=${params.definitionKey}`,
        );
      }

      // ST-362: Lookup artifact (story-scoped or epic-scoped)
      const whereClause = storyId
        ? { definitionId: definition.id, storyId }
        : { definitionId: definition.id, epicId };

      artifact = await prisma.artifact.findFirst({
        where: whereClause,
        include: {
          definition: true,
          createdByComponent: true,
          workflowRun: true,
          story: true,
          epic: true,
        },
      });

      if (!artifact) {
        const scope = storyId ? `story=${storyId}` : `epic=${epicId}`;
        throw new NotFoundError(
          'Artifact',
          `key=${params.definitionKey} in ${scope}`,
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
        'Either artifactId or (definitionKey + storyId/epicId/workflowRunId) must be provided',
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
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'name' in error && error.name === 'MCPError') {
      throw error;
    }
    throw handlePrismaError(error as Error, 'get_artifact');
  }
}
