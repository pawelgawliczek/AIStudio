import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';

export const tool: Tool = {
  name: 'log_run',
  description: 'Log an agent execution run with token usage and metadata. Use this to track agent performance and costs.',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: {
        type: 'string',
        description: 'Project ID (required)',
      },
      storyId: {
        type: 'string',
        description: 'Story ID (optional - link run to a specific story)',
      },
      subtaskId: {
        type: 'string',
        description: 'Subtask ID (optional - link run to a specific subtask)',
      },
      agentId: {
        type: 'string',
        description: 'Agent ID (optional - which agent executed this)',
      },
      frameworkId: {
        type: 'string',
        description: 'Framework ID (optional - which framework was used)',
      },
      origin: {
        type: 'string',
        enum: ['mcp', 'cli', 'api', 'webhook'],
        description: 'Origin of the run (default: mcp)',
      },
      tokensInput: {
        type: 'number',
        description: 'Number of input tokens used',
      },
      tokensOutput: {
        type: 'number',
        description: 'Number of output tokens generated',
      },
      startedAt: {
        type: 'string',
        description: 'ISO 8601 timestamp when run started',
      },
      finishedAt: {
        type: 'string',
        description: 'ISO 8601 timestamp when run finished (optional)',
      },
      success: {
        type: 'boolean',
        description: 'Whether the run was successful (default: true)',
      },
      errorType: {
        type: 'string',
        description: 'Error type if run failed (optional)',
      },
      iterations: {
        type: 'number',
        description: 'Number of iterations/turns (default: 1)',
      },
      metadata: {
        type: 'object',
        description: 'Additional metadata as JSON (optional)',
      },
    },
    required: ['projectId', 'origin', 'tokensInput', 'tokensOutput', 'startedAt'],
  },
};

export const metadata = {
  category: 'telemetry',
  domain: 'Telemetry & Metrics',
  tags: ['telemetry', 'tracking', 'metrics', 'agent', 'tokens'],
  version: '1.0.0',
  since: '2025-11-10',
};

export async function handler(prisma: PrismaClient, params: any) {
  // Validate required fields
  if (!params.projectId) {
    throw new Error('projectId is required');
  }
  if (!params.origin) {
    throw new Error('origin is required');
  }
  if (typeof params.tokensInput !== 'number') {
    throw new Error('tokensInput must be a number');
  }
  if (typeof params.tokensOutput !== 'number') {
    throw new Error('tokensOutput must be a number');
  }
  if (!params.startedAt) {
    throw new Error('startedAt is required');
  }

  // Verify project exists
  const project = await prisma.project.findUnique({
    where: { id: params.projectId },
  });
  if (!project) {
    throw new Error(`Project with ID ${params.projectId} not found`);
  }

  // Create the run
  const run = await prisma.run.create({
    data: {
      projectId: params.projectId,
      storyId: params.storyId || null,
      subtaskId: params.subtaskId || null,
      agentId: params.agentId || null,
      frameworkId: params.frameworkId || null,
      origin: params.origin,
      tokensInput: params.tokensInput,
      tokensOutput: params.tokensOutput,
      startedAt: new Date(params.startedAt),
      finishedAt: params.finishedAt ? new Date(params.finishedAt) : null,
      success: params.success ?? true,
      errorType: params.errorType || null,
      iterations: params.iterations || 1,
      metadata: params.metadata || null,
    },
    include: {
      project: true,
      story: params.storyId ? true : false,
      subtask: params.subtaskId ? true : false,
      agent: params.agentId ? true : false,
      framework: params.frameworkId ? true : false,
    },
  });

  const totalTokens = run.tokensInput + run.tokensOutput;
  const durationMinutes = run.finishedAt
    ? Math.round((run.finishedAt.getTime() - run.startedAt.getTime()) / 60000)
    : null;

  return {
    success: true,
    run: {
      id: run.id,
      projectId: run.projectId,
      storyId: run.storyId,
      subtaskId: run.subtaskId,
      agentId: run.agentId,
      frameworkId: run.frameworkId,
      origin: run.origin,
      tokensInput: run.tokensInput,
      tokensOutput: run.tokensOutput,
      totalTokens,
      startedAt: run.startedAt.toISOString(),
      finishedAt: run.finishedAt?.toISOString(),
      durationMinutes,
      success: run.success,
      errorType: run.errorType,
      iterations: run.iterations,
      metadata: run.metadata,
    },
    message: `Run logged successfully. Total tokens: ${totalTokens}, Duration: ${durationMinutes || 'N/A'} minutes`,
  };
}
