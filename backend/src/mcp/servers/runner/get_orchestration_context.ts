/**
 * Get Orchestration Context Tool
 * Returns MasterSession re-initialization context after compaction
 *
 * ST-164: Orchestration Context Recovery
 *
 * After context compaction, the MasterSession loses its role definition
 * and response format. This tool provides everything needed to re-initialize
 * the session so the Node.js Runner can continue orchestrating.
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import { buildMasterSessionInstructions, ComponentInfo } from '../execution/master-session-instructions';

export const tool: Tool = {
  name: 'get_orchestration_context',
  description: `Re-initialize MasterSession context after compaction.

**Use this tool after context compaction to restore:**
- MasterSession role and response format
- Current workflow run state
- Story context
- Checkpoint information

The Node.js Runner orchestrates the workflow. This tool restores the
MasterSession's understanding of its role so it can continue executing
pre/post instructions.

**Usage:**
\`\`\`typescript
get_orchestration_context({ runId: "uuid-here" })
\`\`\``,
  inputSchema: {
    type: 'object',
    properties: {
      runId: {
        type: 'string',
        description: 'WorkflowRun ID (required)',
      },
    },
    required: ['runId'],
  },
};

export const metadata = {
  category: 'runner',
  domain: 'Story Runner',
  tags: ['runner', 'orchestration', 'context', 'compaction', 'recovery', 'master-session'],
  version: '1.0.0',
  since: '2025-12-02',
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

export async function handler(
  prisma: PrismaClient,
  params: {
    runId: string;
  }
) {
  const { runId } = params;

  // Get workflow run with all related data
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
    },
  });

  if (!run) {
    throw new Error(`WorkflowRun not found: ${runId}`);
  }

  // Extract checkpoint from metadata
  const runMetadata = run.metadata as Record<string, unknown> | null;
  const checkpoint = runMetadata?.checkpoint as RunnerCheckpoint | undefined;

  // Get story context if available
  const storyId = (runMetadata?.storyId || checkpoint?.storyId) as string | undefined;
  let storyContext = null;
  if (storyId) {
    const story = await prisma.story.findUnique({
      where: { id: storyId },
      select: {
        id: true,
        key: true,
        title: true,
        summary: true,
        description: true,
        status: true,
        type: true,
      },
    });
    storyContext = story;
  }

  // Determine current state
  const states = run.workflow.states;
  let currentStateIndex = 0;
  let currentState = states[0];

  if (checkpoint) {
    currentStateIndex = states.findIndex((s) => s.id === checkpoint.currentStateId);
    if (currentStateIndex === -1) currentStateIndex = 0;
    currentState = states[currentStateIndex];
  }

  const completedStateIds = checkpoint?.completedStates || [];

  // Build components list from states for the shared instruction builder
  const components: ComponentInfo[] = states.map((state, index) => ({
    componentId: state.component?.id || state.id,
    componentName: state.component?.name || state.name,
    description: null,
    order: index + 1,
    status: completedStateIds.includes(state.id)
      ? 'completed' as const
      : state.id === currentState?.id
        ? 'in_progress' as const
        : 'pending' as const,
  }));

  // Build the re-initialization prompt using shared utility
  const reinitPrompt = buildMasterSessionInstructions({
    runId,
    workflowId: run.workflowId,
    workflowName: run.workflow.name,
    components,
    storyContext: storyContext ? {
      storyId: storyContext.id,
      storyKey: storyContext.key,
      title: storyContext.title,
    } : undefined,
    currentPhase: checkpoint?.currentPhase || 'pre',
    isRecovery: true,
  });

  return {
    success: true,

    // IDs for reference
    runId,
    workflowId: run.workflowId,
    workflowName: run.workflow.name,
    masterSessionId: checkpoint?.masterSessionId,

    // Current execution state
    status: run.status,
    currentState: currentState
      ? {
          id: currentState.id,
          name: currentState.name,
          order: currentState.order,
          phase: checkpoint?.currentPhase || 'pre',
          componentName: currentState.component?.name,
        }
      : null,

    // Progress
    progress: {
      currentIndex: currentStateIndex,
      totalStates: states.length,
      completedCount: completedStateIds.length,
      completedStates: completedStateIds,
    },

    // Story context
    story: storyContext,

    // Resource usage
    resourceUsage: checkpoint?.resourceUsage || {
      tokensUsed: 0,
      agentSpawns: 0,
      stateTransitions: 0,
      durationMs: 0,
    },

    // Last error if any
    lastError: checkpoint?.lastError,

    // THE KEY PART - re-initialization prompt for MasterSession
    reinitPrompt,

    // Recovery info
    _recovery: {
      command: 'get_orchestration_context',
      runId,
      slashCommand: `/orchestrate ${runId}`,
    },

    message: `MasterSession context restored for "${run.workflow.name}". Currently at state "${currentState?.name}" (${checkpoint?.currentPhase || 'pre'} phase). ${completedStateIds.length}/${states.length} states completed.`,
  };
}
