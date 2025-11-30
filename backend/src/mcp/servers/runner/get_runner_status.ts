/**
 * Get Runner Status Tool
 * Query the current status of a Story Runner execution
 *
 * ST-145: Story Runner - Terminal First Implementation
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';

export const tool: Tool = {
  name: 'get_runner_status',
  description: `Get the current status of a Story Runner execution.

Returns:
- Runner state (initializing, executing, paused, completed, failed)
- Current state being executed
- Resource usage (tokens, agents, duration)
- Checkpoint information
- Warnings if approaching limits

**Usage:**
\`\`\`typescript
get_runner_status({ runId: "uuid-here" })
\`\`\``,
  inputSchema: {
    type: 'object',
    properties: {
      runId: {
        type: 'string',
        description: 'WorkflowRun ID to query (required)',
      },
      includeCheckpoint: {
        type: 'boolean',
        description: 'Include full checkpoint data (default: false)',
      },
    },
    required: ['runId'],
  },
};

export const metadata = {
  category: 'runner',
  domain: 'Story Runner',
  tags: ['runner', 'status', 'monitoring'],
  version: '1.0.0',
  since: '2025-11-29',
};

// ST-147: Turn counts for telemetry
interface TurnCounts {
  totalTurns: number;
  manualPrompts: number;
  autoContinues: number;
}

// ST-147: Decision record for audit trail
interface DecisionRecord {
  timestamp: string;
  stateId: string;
  stateName: string;
  decisionType: string;
  reason: string;
  outcome: string;
  metadata?: Record<string, unknown>;
}

// ST-147: Session telemetry
interface SessionTelemetry {
  runnerTranscriptPath?: string;
  runnerTokensInput: number;
  runnerTokensOutput: number;
  totalRunnerTokens: number;
  turns: TurnCounts;
  resumeSummary?: string;
  artifacts: string[];
  decisionHistory: DecisionRecord[];
}

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
  // ST-147: Session telemetry
  telemetry?: SessionTelemetry;
  lastError?: {
    message: string;
    stateId: string;
    phase: string;
    timestamp: string;
  };
  checkpointedAt: string;
  runStartedAt: string;
}

interface RunnerStatus {
  state: string;
  currentStateId?: string;
  resourceUsage: {
    tokensUsed: number;
    agentSpawns: number;
    stateTransitions: number;
    durationMs: number;
  };
  warnings?: string[];
}

export async function handler(prisma: PrismaClient, params: {
  runId: string;
  includeCheckpoint?: boolean;
}) {
  const { runId, includeCheckpoint = false } = params;

  // Get workflow run with related data
  const run = await prisma.workflowRun.findUnique({
    where: { id: runId },
    include: {
      workflow: {
        include: {
          states: {
            orderBy: { order: 'asc' },
            include: {
              component: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      },
      story: {
        select: {
          id: true,
          key: true,
          title: true,
        },
      },
      componentRuns: {
        orderBy: { startedAt: 'desc' },
        take: 5,
        include: {
          component: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  });

  if (!run) {
    throw new Error(`WorkflowRun not found: ${runId}`);
  }

  // Extract metadata
  const metadata = run.metadata as Record<string, unknown> | null;
  const checkpoint = metadata?.checkpoint as RunnerCheckpoint | undefined;
  const lastStatus = metadata?.lastStatus as RunnerStatus | undefined;

  // Calculate progress
  const totalStates = run.workflow.states.length;
  const completedStates = checkpoint?.completedStates?.length || 0;
  const skippedStates = checkpoint?.skippedStates?.length || 0;
  const progress = totalStates > 0 ? ((completedStates + skippedStates) / totalStates) * 100 : 0;

  // Get current state info
  let currentState = null;
  if (checkpoint?.currentStateId) {
    currentState = run.workflow.states.find(s => s.id === checkpoint.currentStateId);
  }

  // Build resource usage summary
  const resourceUsage = checkpoint?.resourceUsage || lastStatus?.resourceUsage || {
    tokensUsed: run.totalTokens || 0,
    agentSpawns: 0,
    stateTransitions: 0,
    durationMs: run.durationSeconds ? run.durationSeconds * 1000 : 0,
  };

  // Format duration
  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  // Build response
  const response: Record<string, unknown> = {
    success: true,
    runId: run.id,
    status: run.status,
    isPaused: run.isPaused,
    pauseReason: run.pauseReason,

    workflow: {
      id: run.workflow.id,
      name: run.workflow.name,
      totalStates,
    },

    story: run.story,

    progress: {
      completedStates,
      skippedStates,
      totalStates,
      percentage: Math.round(progress),
    },

    currentExecution: currentState ? {
      stateId: currentState.id,
      stateName: currentState.name,
      phase: checkpoint?.currentPhase || 'unknown',
      componentName: currentState.component?.name,
    } : null,

    resourceUsage: {
      ...resourceUsage,
      durationFormatted: formatDuration(resourceUsage.durationMs),
    },

    lastError: checkpoint?.lastError,

    recentComponentRuns: run.componentRuns.map(cr => ({
      id: cr.id,
      componentName: cr.component?.name,
      status: cr.status,
      startedAt: cr.startedAt?.toISOString(),
      completedAt: cr.finishedAt?.toISOString(),
    })),

    timing: {
      startedAt: run.startedAt?.toISOString(),
      finishedAt: run.finishedAt?.toISOString(),
      lastCheckpoint: checkpoint?.checkpointedAt,
    },

    // ST-147: Session telemetry summary (always included)
    telemetry: checkpoint?.telemetry ? {
      runnerTokens: {
        input: checkpoint.telemetry.runnerTokensInput,
        output: checkpoint.telemetry.runnerTokensOutput,
        total: checkpoint.telemetry.totalRunnerTokens,
      },
      turns: checkpoint.telemetry.turns,
      decisionCount: checkpoint.telemetry.decisionHistory.length,
      artifactCount: checkpoint.telemetry.artifacts.length,
      hasResumeSummary: !!checkpoint.telemetry.resumeSummary,
    } : {
      // Fallback to WorkflowRun fields if no checkpoint telemetry
      runnerTokens: {
        input: run.runnerTokensInput || 0,
        output: run.runnerTokensOutput || 0,
        total: run.totalRunnerTokens || 0,
      },
      turns: {
        totalTurns: run.totalTurns || 0,
        manualPrompts: run.totalManualPrompts || 0,
        autoContinues: (run.totalTurns || 0) - (run.totalManualPrompts || 0),
      },
      decisionCount: 0,
      artifactCount: 0,
      hasResumeSummary: !!run.resumeSummary,
    },
  };

  if (includeCheckpoint && checkpoint) {
    response.checkpoint = checkpoint;
  }

  // ST-147: Include full telemetry when includeCheckpoint is true
  if (includeCheckpoint && checkpoint?.telemetry) {
    response.fullTelemetry = {
      runnerTranscriptPath: checkpoint.telemetry.runnerTranscriptPath,
      resumeSummary: checkpoint.telemetry.resumeSummary,
      artifacts: checkpoint.telemetry.artifacts,
      decisionHistory: checkpoint.telemetry.decisionHistory,
    };
  }

  // Add warnings if present
  if (lastStatus?.warnings && lastStatus.warnings.length > 0) {
    response.warnings = lastStatus.warnings;
  }

  return response;
}
