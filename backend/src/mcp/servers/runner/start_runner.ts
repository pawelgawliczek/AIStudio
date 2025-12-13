/**
 * Start Runner Tool
 * Launches the Story Runner for a workflow run via laptop orchestrator
 *
 * ST-145: Story Runner - Terminal First Implementation
 * ST-187: Added story key resolution support
 * ST-195: Updated to use laptop orchestrator instead of Docker
 *         Now calls the backend REST endpoint which triggers laptop agent
 *         via HTTP call (MCP runs as standalone process, cannot access NestJS services)
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import { resolveStory, isStoryKey, isUUID } from '../../shared/resolve-identifiers';

export const tool: Tool = {
  name: 'start_runner',
  description: 'Start Docker Runner for autonomous workflow execution. Requires runId and workflowId.',
  inputSchema: {
    type: 'object',
    properties: {
      runId: {
        type: 'string',
        description: 'WorkflowRun ID to execute (required)',
      },
      workflowId: {
        type: 'string',
        description: 'Workflow ID (required)',
      },
      story: {
        type: 'string',
        description: 'Story key (e.g., ST-123) or UUID for context (optional)',
      },
      storyId: {
        type: 'string',
        description: 'Story UUID (deprecated - use story param)',
      },
      triggeredBy: {
        type: 'string',
        description: 'User/agent that triggered the run (default: "mcp-tool")',
      },
      detached: {
        type: 'boolean',
        description: 'Run in background (default: true)',
      },
    },
    required: ['runId', 'workflowId'],
  },
};

export const metadata = {
  category: 'runner',
  domain: 'Story Runner',
  tags: ['runner', 'start', 'workflow', 'laptop-orchestrator'],
  version: '2.0.0',
  since: '2025-11-29',
};

export async function handler(prisma: PrismaClient, params: {
  runId: string;
  workflowId: string;
  story?: string;
  storyId?: string;
  triggeredBy?: string;
  detached?: boolean;
}) {
  const { runId, workflowId, triggeredBy = 'mcp-tool' } = params;

  // ST-187: Resolve story key to UUID if provided
  let storyId: string | undefined;
  const storyInput = params.story || params.storyId;

  if (storyInput) {
    if (isStoryKey(storyInput)) {
      const story = await resolveStory(prisma, storyInput);
      if (!story) {
        throw new Error(`Story not found: ${storyInput}`);
      }
      storyId = story.id;
    } else if (isUUID(storyInput)) {
      storyId = storyInput;
    } else {
      throw new Error(`Invalid story identifier: ${storyInput}. Use story key (ST-123) or UUID.`);
    }
  }

  // Validate workflow exists
  const workflow = await prisma.workflow.findUnique({
    where: { id: workflowId },
    include: {
      states: true,
    },
  });

  if (!workflow) {
    throw new Error(`Workflow not found: ${workflowId}`);
  }

  if (workflow.states.length === 0) {
    throw new Error(`Workflow has no states defined: ${workflowId}`);
  }

  // Validate run exists
  const run = await prisma.workflowRun.findUnique({
    where: { id: runId },
  });

  if (!run) {
    throw new Error(`WorkflowRun not found: ${runId}`);
  }

  // ST-195: Call the backend REST endpoint via HTTP
  // MCP runs as standalone process, cannot access NestJS services directly
  // The REST endpoint triggers laptop orchestrator via RunnerControlService
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';

  try {
    const response = await fetch(`${backendUrl}/api/runner/${runId}/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        workflowId,
        storyId,
        triggeredBy,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Backend API error (${response.status}): ${errorText}`);
    }

    const result = await response.json() as {
      success: boolean;
      runId: string;
      status: string;
      message?: string;
      jobId?: string;
      agentId?: string;
    };

    return {
      success: result.success,
      runId: result.runId,
      workflowId,
      storyId,
      status: result.status,
      message: result.message,
      jobId: result.jobId,
      agentId: result.agentId,
    };
  } catch (error) {
    // If HTTP call fails, provide helpful error message
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Check if it's a connection error (backend not reachable)
    if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('fetch failed')) {
      throw new Error(
        `Cannot connect to backend at ${backendUrl}. ` +
        `Ensure backend is running and BACKEND_URL is set correctly. ` +
        `Original error: ${errorMessage}`
      );
    }

    throw error;
  }
}
