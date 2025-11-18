/**
 * Execute Story with Workflow Tool
 * Trigger workflow execution for a specific story
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import { handler as startWorkflowRunHandler } from './start_workflow_run.js';

export const tool: Tool = {
  name: 'execute_story_with_workflow',
  description:
    'Execute a story using a workflow. Validates story and workflow, creates execution run, and returns runId for tracking.',
  inputSchema: {
    type: 'object',
    properties: {
      storyId: {
        type: 'string',
        description: 'Story UUID to execute',
      },
      workflowId: {
        type: 'string',
        description: 'Workflow UUID to use for execution',
      },
      triggeredBy: {
        type: 'string',
        description: 'User ID or identifier (defaults to "mcp-user")',
      },
      context: {
        type: 'object',
        description: 'Additional context data for workflow execution',
      },
      cwd: {
        type: 'string',
        description: 'Current working directory for transcript tracking (defaults to project localPath if not provided)',
      },
    },
    required: ['storyId', 'workflowId'],
  },
};

export const metadata = {
  category: 'execution',
  domain: 'Workflow Execution',
  tags: ['workflow', 'story', 'execution', 'trigger'],
  version: '1.0.0',
  since: '2025-11-14',
};

export async function handler(prisma: PrismaClient, params: any) {
  // Validate required fields
  if (!params.storyId) {
    throw new Error('storyId is required');
  }
  if (!params.workflowId) {
    throw new Error('workflowId is required');
  }

  // Verify story exists and get details
  const story = await prisma.story.findUnique({
    where: { id: params.storyId },
    include: {
      project: true,
      epic: true,
    },
  });

  if (!story) {
    throw new Error(`Story with ID ${params.storyId} not found`);
  }

  // Check if story is in a valid state for execution
  if (story.status === 'done') {
    throw new Error(
      `Cannot execute workflow on completed story ${story.key}. Story is already marked as done.`,
    );
  }

  // Verify workflow exists
  const workflow = await prisma.workflow.findUnique({
    where: { id: params.workflowId },
    include: {
      coordinator: true,
    },
  });

  if (!workflow) {
    throw new Error(`Workflow with ID ${params.workflowId} not found`);
  }

  if (!workflow.active) {
    throw new Error(
      `Workflow "${workflow.name}" is not active. Please activate it before executing stories.`,
    );
  }

  // Check if workflow belongs to the same project as story
  if (workflow.projectId !== story.projectId) {
    throw new Error(
      `Workflow "${workflow.name}" does not belong to the same project as story ${story.key}`,
    );
  }

  // Check if there's already a running workflow for this story
  const existingRun = await prisma.workflowRun.findFirst({
    where: {
      storyId: params.storyId,
      status: { in: ['running', 'pending', 'paused'] },
    },
  });

  if (existingRun) {
    throw new Error(
      `Story ${story.key} already has a running workflow execution (Run ID: ${existingRun.id}). ` +
        `Wait for it to complete or cancel it before starting a new execution.`,
    );
  }

  // Prepare context with story information
  const executionContext = {
    ...(params.context || {}),
    storyId: story.id,
    storyKey: story.key,
    storyTitle: story.title,
    epicId: story.epicId,
    epicKey: story.epic?.key,
  };

  // Start workflow run using existing handler
  // IMPORTANT: For transcript tracking, we need the HOST path where Claude Code runs,
  // not the Docker container path. The MCP server runs on the host and needs access
  // to ~/.claude/projects/<escaped-host-path>/
  // Priority order:
  // 1. params.cwd (explicit path from caller)
  // 2. story.project.hostPath (HOST filesystem path for transcript tracking)
  // 3. PROJECT_HOST_PATH env var (fallback)
  // 4. story.project.localPath (Docker path, last resort)

  // Debug logging to diagnose path resolution
  console.log('[execute_story_with_workflow] Path resolution debug:');
  console.log('  params.cwd:', params.cwd);
  console.log('  story.project.hostPath:', story.project.hostPath);
  console.log('  process.env.PROJECT_HOST_PATH:', process.env.PROJECT_HOST_PATH);
  console.log('  story.project.localPath:', story.project.localPath);

  const hostPath = params.cwd ||
                   story.project.hostPath ||
                   process.env.PROJECT_HOST_PATH ||
                   story.project.localPath;

  console.log('  final hostPath:', hostPath);

  const workflowRunResult = await startWorkflowRunHandler(prisma, {
    workflowId: params.workflowId,
    triggeredBy: params.triggeredBy || 'mcp-user',
    context: executionContext,
    cwd: hostPath, // Pass the HOST path for transcript tracking
  });

  // Update WorkflowRun to link it to the story
  await prisma.workflowRun.update({
    where: { id: workflowRunResult.runId },
    data: {
      storyId: story.id,
      epicId: story.epicId,
    },
  });

  // Update story's assigned workflow if not already set
  if (!story.assignedWorkflowId) {
    await prisma.story.update({
      where: { id: story.id },
      data: { assignedWorkflowId: workflow.id },
    });
  }

  return {
    success: true,
    runId: workflowRunResult.runId,
    story: {
      id: story.id,
      key: story.key,
      title: story.title,
      status: story.status,
      epic: story.epic
        ? {
            id: story.epic.id,
            key: story.epic.key,
            title: story.epic.title,
          }
        : null,
    },
    workflow: {
      id: workflow.id,
      name: workflow.name,
      coordinator: workflowRunResult.coordinator,
    },
    status: 'running',
    startedAt: workflowRunResult.startedAt,
    components: workflowRunResult.components,
    context: workflowRunResult.context,
    message: `Started workflow "${workflow.name}" for story ${story.key}. Run ID: ${workflowRunResult.runId}. Follow coordinator instructions to orchestrate the workflow.`,
  };
}
