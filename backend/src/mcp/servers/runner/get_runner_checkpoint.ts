/**
 * Get Runner Checkpoint Tool
 * Retrieve detailed checkpoint data for a workflow run
 *
 * ST-145: Story Runner - Terminal First Implementation
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';

export const tool: Tool = {
  name: 'get_runner_checkpoint',
  description: `Get the detailed checkpoint data for a Story Runner execution.

Returns full checkpoint including:
- Current state and phase (pre/agent/post)
- Completed and skipped states
- Master session ID (for resume)
- Resource usage counters
- Last error details

**Usage:**
\`\`\`typescript
get_runner_checkpoint({ runId: "uuid-here" })
\`\`\``,
  inputSchema: {
    type: 'object',
    properties: {
      runId: {
        type: 'string',
        description: 'WorkflowRun ID to query (required)',
      },
    },
    required: ['runId'],
  },
};

export const metadata = {
  category: 'runner',
  domain: 'Story Runner',
  tags: ['runner', 'checkpoint', 'recovery', 'debugging'],
  version: '1.0.0',
  since: '2025-11-29',
};

interface RunnerCheckpoint {
  version: number;
  runId: string;
  workflowId: string;
  storyId?: string;
  currentStateId: string;
  currentPhase: 'pre' | 'agent' | 'post';
  completedStates: string[];
  skippedStates: string[];
  masterSessionId: string;
  resourceUsage: {
    tokensUsed: number;
    agentSpawns: number;
    stateTransitions: number;
    durationMs: number;
  };
  lastError?: {
    message: string;
    stateId: string;
    phase: string;
    timestamp: string;
  };
  checkpointedAt: string;
  runStartedAt: string;
}

export async function handler(prisma: PrismaClient, params: {
  runId: string;
}) {
  const { runId } = params;

  // Get workflow run
  const run = await prisma.workflowRun.findUnique({
    where: { id: runId },
    include: {
      workflow: {
        include: {
          states: {
            orderBy: { order: 'asc' },
            select: {
              id: true,
              name: true,
              order: true,
            },
          },
        },
      },
    },
  });

  if (!run) {
    throw new Error(`WorkflowRun not found: ${runId}`);
  }

  // Extract checkpoint from metadata
  const metadata = run.metadata as Record<string, unknown> | null;
  const checkpoint = metadata?.checkpoint as RunnerCheckpoint | undefined;

  if (!checkpoint) {
    return {
      success: true,
      runId,
      hasCheckpoint: false,
      message: `No checkpoint found for run ${runId}. The runner may not have started yet or checkpoint was cleared.`,
      runStatus: run.status,
    };
  }

  // Build state mapping for better readability
  const stateMap = new Map(run.workflow.states.map(s => [s.id, s]));

  const formatState = (stateId: string) => {
    const state = stateMap.get(stateId);
    return state ? `${state.name} (order: ${state.order})` : stateId;
  };

  // Format duration
  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  return {
    success: true,
    runId,
    hasCheckpoint: true,

    checkpoint: {
      version: checkpoint.version,
      workflowId: checkpoint.workflowId,
      storyId: checkpoint.storyId,

      currentExecution: {
        stateId: checkpoint.currentStateId,
        stateName: formatState(checkpoint.currentStateId),
        phase: checkpoint.currentPhase,
      },

      masterSessionId: checkpoint.masterSessionId,

      progress: {
        completedStates: checkpoint.completedStates.map(formatState),
        skippedStates: checkpoint.skippedStates.map(formatState),
        completedCount: checkpoint.completedStates.length,
        skippedCount: checkpoint.skippedStates.length,
        totalStates: run.workflow.states.length,
      },

      resourceUsage: {
        ...checkpoint.resourceUsage,
        durationFormatted: formatDuration(checkpoint.resourceUsage.durationMs),
      },

      lastError: checkpoint.lastError,

      timing: {
        runStartedAt: checkpoint.runStartedAt,
        checkpointedAt: checkpoint.checkpointedAt,
        checkpointAge: `${Math.round((Date.now() - new Date(checkpoint.checkpointedAt).getTime()) / 1000)}s ago`,
      },
    },

    // Raw checkpoint for advanced debugging
    rawCheckpoint: checkpoint,
  };
}
