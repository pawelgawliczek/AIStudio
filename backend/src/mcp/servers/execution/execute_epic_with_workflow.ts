/**
 * Execute Epic with Team Tool
 * Batch execution of all stories in an epic
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import { handler as executeStoryHandler } from './execute_story_with_workflow.js';

export const tool: Tool = {
  name: 'execute_epic_with_team',
  description:
    'Execute all stories in an epic using a team. Supports sequential or parallel execution modes.',
  inputSchema: {
    type: 'object',
    properties: {
      epicId: {
        type: 'string',
        description: 'Epic UUID (required)',
      },
      teamId: {
        type: 'string',
        description: 'Team UUID to use for all stories (required)',
      },
      mode: {
        type: 'string',
        enum: ['sequential', 'parallel'],
        description: 'Execution mode: sequential (one at a time) or parallel (all at once). Default: sequential',
      },
      abortOnError: {
        type: 'boolean',
        description: 'Stop epic execution if any story fails (only for sequential mode). Default: false',
      },
      storyStatus: {
        type: 'array',
        items: { type: 'string' },
        description: 'Filter stories by status (e.g., ["planning", "analysis"]). Default: all non-done stories',
      },
      triggeredBy: {
        type: 'string',
        description: 'User ID or identifier (defaults to "mcp-user")',
      },
    },
    required: ['epicId', 'teamId'],
  },
};

export const metadata = {
  category: 'execution',
  domain: 'Team Execution',
  tags: ['team', 'epic', 'batch', 'execution'],
  version: '1.0.0',
  since: '2025-11-14',
};

export async function handler(prisma: PrismaClient, params: any) {
  // Validate required fields
  if (!params.epicId) {
    throw new Error('epicId is required');
  }
  if (!params.workflowId) {
    throw new Error('workflowId is required');
  }

  const mode = params.mode || 'sequential';
  const abortOnError = params.abortOnError || false;
  const triggeredBy = params.triggeredBy || 'mcp-user';

  // Verify epic exists
  const epic = await prisma.epic.findUnique({
    where: { id: params.epicId },
    select: {
      id: true,
      key: true,
      title: true,
      projectId: true,
    },
  });

  if (!epic) {
    throw new Error(`Epic with ID ${params.epicId} not found`);
  }

  // Verify workflow exists
  const workflow = await prisma.workflow.findUnique({
    where: { id: params.workflowId },
    select: {
      id: true,
      name: true,
      projectId: true,
      active: true,
    },
  });

  if (!workflow) {
    throw new Error(`Workflow with ID ${params.workflowId} not found`);
  }

  if (!workflow.active) {
    throw new Error(
      `Workflow "${workflow.name}" is not active. Please activate it before executing epics.`,
    );
  }

  // Check if workflow belongs to the same project as epic
  if (workflow.projectId !== epic.projectId) {
    throw new Error(
      `Workflow "${workflow.name}" does not belong to the same project as epic ${epic.key}`,
    );
  }

  // Build story filter
  const storyWhere: any = {
    epicId: epic.id,
    status: { not: 'done' }, // Exclude completed stories by default
  };

  // Apply custom story status filter if provided
  if (params.storyStatus && Array.isArray(params.storyStatus) && params.storyStatus.length > 0) {
    storyWhere.status = { in: params.storyStatus };
  }

  // Fetch stories to execute
  const stories = await prisma.story.findMany({
    where: storyWhere,
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      key: true,
      title: true,
      status: true,
    },
  });

  if (stories.length === 0) {
    return {
      success: true,
      epic: {
        id: epic.id,
        key: epic.key,
        title: epic.title,
      },
      workflow: {
        id: workflow.id,
        name: workflow.name,
      },
      mode,
      runs: [],
      summary: {
        total: 0,
        started: 0,
        failed: 0,
        skipped: 0,
      },
      message: `No eligible stories found in epic ${epic.key} for execution.`,
    };
  }

  const runs: any[] = [];
  let failedCount = 0;
  let skippedCount = 0;

  if (mode === 'sequential') {
    // Sequential execution: execute stories one at a time
    for (const story of stories) {
      try {
        const result = await executeStoryHandler(prisma, {
          storyId: story.id,
          workflowId: workflow.id,
          triggeredBy,
          context: {
            epicId: epic.id,
            epicKey: epic.key,
            batchExecution: true,
            mode: 'sequential',
          },
        });

        runs.push({
          storyId: story.id,
          storyKey: story.key,
          storyTitle: story.title,
          runId: result.runId,
          status: 'started',
          error: null,
        });
      } catch (error: any) {
        failedCount++;

        runs.push({
          storyId: story.id,
          storyKey: story.key,
          storyTitle: story.title,
          runId: null,
          status: 'failed',
          error: error.message,
        });

        // Abort on error if flag is set
        if (abortOnError) {
          // Mark remaining stories as skipped
          const remainingStories = stories.slice(runs.length);
          for (const remainingStory of remainingStories) {
            skippedCount++;
            runs.push({
              storyId: remainingStory.id,
              storyKey: remainingStory.key,
              storyTitle: remainingStory.title,
              runId: null,
              status: 'skipped',
              error: `Skipped due to previous failure (abortOnError=true)`,
            });
          }
          break;
        }
      }
    }
  } else {
    // Parallel execution: start all at once
    const results = await Promise.allSettled(
      stories.map((story) =>
        executeStoryHandler(prisma, {
          storyId: story.id,
          workflowId: workflow.id,
          triggeredBy,
          context: {
            epicId: epic.id,
            epicKey: epic.key,
            batchExecution: true,
            mode: 'parallel',
          },
        }),
      ),
    );

    stories.forEach((story, index) => {
      const result = results[index];

      if (result.status === 'fulfilled') {
        runs.push({
          storyId: story.id,
          storyKey: story.key,
          storyTitle: story.title,
          runId: result.value.runId,
          status: 'started',
          error: null,
        });
      } else {
        failedCount++;
        runs.push({
          storyId: story.id,
          storyKey: story.key,
          storyTitle: story.title,
          runId: null,
          status: 'failed',
          error: result.reason?.message || 'Unknown error',
        });
      }
    });
  }

  const startedCount = runs.filter((r) => r.status === 'started').length;

  return {
    success: true,
    epic: {
      id: epic.id,
      key: epic.key,
      title: epic.title,
    },
    workflow: {
      id: workflow.id,
      name: workflow.name,
    },
    mode,
    runs,
    summary: {
      total: stories.length,
      started: startedCount,
      failed: failedCount,
      skipped: skippedCount,
    },
    message: `Epic ${epic.key} execution: ${startedCount}/${stories.length} stories started successfully using workflow "${workflow.name}" (${mode} mode).`,
  };
}
