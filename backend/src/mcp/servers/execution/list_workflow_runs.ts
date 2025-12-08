/**
 * List Team Runs Tool
 * Query execution history with filtering and pagination
 *
 * ST-187: Added story key resolution support
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import { resolveStory, isStoryKey } from '../../shared/resolve-identifiers';

export const tool: Tool = {
  name: 'list_team_runs',
  description:
    'List team execution runs with optional filtering by project, team, story, or status. Returns paginated results.',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: {
        type: 'string',
        description: 'Filter by project UUID',
      },
      teamId: {
        type: 'string',
        description: 'Filter by team UUID',
      },
      story: {
        type: 'string',
        description: 'Filter by story key (e.g., ST-123) or UUID',
      },
      storyId: {
        type: 'string',
        description: 'Filter by story UUID (deprecated - use story param)',
      },
      status: {
        type: 'string',
        enum: ['pending', 'running', 'completed', 'failed', 'cancelled', 'skipped', 'paused'],
        description: 'Filter by execution status',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results (default: 20, max: 100)',
      },
      offset: {
        type: 'number',
        description: 'Pagination offset (default: 0)',
      },
    },
    required: [],
  },
};

export const metadata = {
  category: 'execution',
  domain: 'Team Execution',
  tags: ['team', 'history', 'query', 'list'],
  version: '1.0.0',
  since: '2025-11-14',
};

export async function handler(prisma: PrismaClient, params: any) {
  // ST-187: Resolve story key to UUID if provided
  let resolvedStoryId: string | undefined;
  const storyInput = params.story || params.storyId;

  if (storyInput) {
    const story = await resolveStory(prisma, storyInput);
    if (!story) {
      throw new Error(`Story not found: ${storyInput}`);
    }
    resolvedStoryId = story.id;
  }

  // Validate that at least one filter is provided
  if (!params.projectId && !params.workflowId && !resolvedStoryId) {
    throw new Error(
      'At least one filter is required: projectId, workflowId, or story',
    );
  }

  // Build filter criteria
  const where: any = {};

  if (params.projectId) {
    where.projectId = params.projectId;
  }

  if (params.workflowId) {
    where.workflowId = params.workflowId;
  }

  if (resolvedStoryId) {
    where.storyId = resolvedStoryId;
  }

  if (params.status) {
    where.status = params.status;
  }

  // Pagination parameters
  const limit = Math.min(params.limit || 20, 100); // Max 100
  const offset = params.offset || 0;

  // Fetch total count for pagination info
  const total = await prisma.workflowRun.count({ where });

  // Fetch workflow runs with related data
  const runs = await prisma.workflowRun.findMany({
    where,
    include: {
      workflow: {
        select: {
          id: true,
          name: true,
        },
      },
      story: {
        select: {
          id: true,
          key: true,
          title: true,
        },
      },
      epic: {
        select: {
          id: true,
          key: true,
          title: true,
        },
      },
      _count: {
        select: {
          componentRuns: true,
        },
      },
    },
    orderBy: { startedAt: 'desc' },
    take: limit,
    skip: offset,
  });

  // Format results
  const formattedRuns = runs.map((run) => ({
    id: run.id,
    status: run.status,
    triggeredBy: run.triggeredBy,
    triggerType: run.triggerType,
    startedAt: run.startedAt.toISOString(),
    finishedAt: run.finishedAt?.toISOString(),
    durationSeconds: run.durationSeconds,

    workflow: run.workflow,
    story: run.story,
    epic: run.epic,

    metrics: {
      totalTokens: run.totalTokens,
      estimatedCost: run.estimatedCost ? Number(run.estimatedCost) : null,
      totalUserPrompts: run.totalUserPrompts,
      totalIterations: run.totalIterations,
    },

    componentCount: run._count.componentRuns,
    errorMessage: run.errorMessage,
  }));

  return {
    success: true,
    runs: formattedRuns,
    pagination: {
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
      nextOffset: offset + limit < total ? offset + limit : null,
    },
    message: `Found ${total} workflow run(s). Showing ${runs.length} result(s) (offset: ${offset}).`,
  };
}
