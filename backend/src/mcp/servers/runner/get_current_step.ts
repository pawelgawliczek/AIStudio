/**
 * Get Current Step Tool
 * Returns the exact instructions for what needs to be accomplished in the current step
 *
 * ST-187: MCP Tool Optimization & Step Commands
 *
 * This tool queries the Runner's checkpoint state and returns clear instructions
 * for the current phase. It's read-only and doesn't modify execution state.
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import { resolveRunId, ResolvedStory } from '../../shared/resolve-identifiers';

export const tool: Tool = {
  name: 'get_current_step',
  description: `Returns the exact instructions for what needs to be accomplished in the current step.

Queries the Runner's checkpoint state and returns:
- Current state and phase (pre/agent/post)
- Exact instructions for what to do
- What tool to call after completing this step

**Usage:**
\`\`\`typescript
// Using story key (preferred)
get_current_step({ story: "ST-123" })

// Using run ID
get_current_step({ runId: "uuid-here" })
\`\`\`

**Response includes:**
- \`currentState\`: Name, order, phase
- \`instructions\`: What to do (type: pre_execution, agent_spawn, post_execution, approval_required, workflow_complete)
- \`nextAction\`: Tool to call after completing this step
- \`progress\`: Completed/total states`,
  inputSchema: {
    type: 'object',
    properties: {
      story: {
        type: 'string',
        description: 'Story key (e.g., ST-123) or UUID - resolves to active workflow run',
      },
      runId: {
        type: 'string',
        description: 'WorkflowRun ID (alternative to story)',
      },
    },
  },
};

export const metadata = {
  category: 'runner',
  domain: 'Story Runner',
  tags: ['runner', 'step', 'instructions', 'execution'],
  version: '1.0.0',
  since: '2025-12-08',
};

// Checkpoint structure from Runner
interface RunnerCheckpoint {
  version: number;
  runId: string;
  workflowId: string;
  storyId?: string;
  currentStateId: string;
  currentPhase: 'pre' | 'agent' | 'post';
  completedStates: string[];
  skippedStates: string[];
  phaseStatus?: 'pending' | 'in_progress' | 'completed';
  phaseOutputs?: Record<string, unknown>;
  masterSessionId?: string;
  resourceUsage?: {
    tokensUsed: number;
    agentSpawns: number;
    stateTransitions: number;
    durationMs: number;
  };
  checkpointedAt: string;
  runStartedAt: string;
}

type InstructionType = 'pre_execution' | 'agent_spawn' | 'post_execution' | 'approval_required' | 'workflow_complete' | 'workflow_paused' | 'workflow_failed';

interface StepInstructions {
  type: InstructionType;
  content: string;
  component?: {
    id: string;
    name: string;
    tools: string[];
    model: string;
    inputInstructions?: string;
    operationInstructions?: string;
    outputInstructions?: string;
  };
}

interface NextAction {
  tool: string;
  parameters: Record<string, unknown>;
  hint: string;
}

export async function handler(prisma: PrismaClient, params: {
  story?: string;
  runId?: string;
}) {
  // Validate input
  if (!params.story && !params.runId) {
    throw new Error('Either story or runId is required');
  }

  // Resolve story key or runId
  const resolved = await resolveRunId(prisma, {
    story: params.story,
    runId: params.runId,
  });
  const runId = resolved.id;

  // Get workflow run with full details
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
                  tools: true,
                  config: true,
                  inputInstructions: true,
                  operationInstructions: true,
                  outputInstructions: true,
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
          summary: true,
          status: true,
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

  // Handle different run statuses
  if (run.status === 'completed') {
    return buildResponse(run, resolved.story, checkpoint, {
      type: 'workflow_complete',
      content: 'Workflow has completed successfully. All states have been executed.',
    }, {
      tool: 'update_team_status',
      parameters: { runId, status: 'completed' },
      hint: 'Mark workflow as completed if not already done.',
    });
  }

  if (run.status === 'failed') {
    return buildResponse(run, resolved.story, checkpoint, {
      type: 'workflow_failed',
      content: `Workflow failed: ${run.errorMessage || 'Unknown error'}. Use repeat_step to retry or cancel_runner to abort.`,
    }, {
      tool: 'repeat_step',
      parameters: { runId },
      hint: 'Retry the failed step or cancel the workflow.',
    });
  }

  if (run.status === 'cancelled') {
    throw new Error('Workflow was cancelled. Cannot get current step.');
  }

  if (run.status === 'pending') {
    // Run hasn't started yet
    const firstState = run.workflow.states[0];
    return buildResponse(run, resolved.story, undefined, {
      type: 'pre_execution',
      content: firstState
        ? `Workflow not started. First state: ${firstState.name}. Pre-execution instructions: ${firstState.preExecutionInstructions || 'None'}`
        : 'Workflow has no states defined.',
    }, {
      tool: 'start_runner',
      parameters: { runId, workflowId: run.workflowId },
      hint: 'Start the workflow runner to begin execution.',
    });
  }

  if (run.isPaused && run.pauseReason?.includes('approval')) {
    return buildResponse(run, resolved.story, checkpoint, {
      type: 'approval_required',
      content: `Workflow is paused awaiting approval: ${run.pauseReason}`,
    }, {
      tool: 'respond_to_approval',
      parameters: { runId },
      hint: 'Wait for human approval via respond_to_approval tool.',
    });
  }

  if (run.isPaused) {
    return buildResponse(run, resolved.story, checkpoint, {
      type: 'workflow_paused',
      content: `Workflow is paused: ${run.pauseReason || 'No reason specified'}`,
    }, {
      tool: 'resume_runner',
      parameters: { runId },
      hint: 'Resume the workflow to continue execution.',
    });
  }

  // Running state - get current step instructions
  if (!checkpoint?.currentStateId) {
    throw new Error('Run is in running state but has no checkpoint. This should not happen.');
  }

  const currentState = run.workflow.states.find(s => s.id === checkpoint.currentStateId);
  if (!currentState) {
    throw new Error(`Current state ${checkpoint.currentStateId} not found in workflow`);
  }

  const phase = checkpoint.currentPhase || 'pre';
  const phaseStatus = checkpoint.phaseStatus || 'pending';

  // Build instructions based on current phase
  let instructions: StepInstructions;
  let nextAction: NextAction;

  switch (phase) {
    case 'pre':
      instructions = {
        type: 'pre_execution',
        content: currentState.preExecutionInstructions || 'No pre-execution instructions. Proceed to advance_step.',
      };
      nextAction = {
        tool: 'advance_step',
        parameters: { runId },
        hint: 'Call advance_step when pre-execution is complete.',
      };
      break;

    case 'agent':
      if (!currentState.component) {
        // No component - skip agent phase
        instructions = {
          type: 'post_execution',
          content: 'No agent assigned to this state. Proceeding to post-execution.',
        };
        nextAction = {
          tool: 'advance_step',
          parameters: { runId },
          hint: 'Call advance_step to proceed to post-execution.',
        };
      } else {
        const config = currentState.component.config as Record<string, unknown> || {};
        instructions = {
          type: 'agent_spawn',
          content: `Spawn the ${currentState.component.name} agent with the following instructions.`,
          component: {
            id: currentState.component.id,
            name: currentState.component.name,
            tools: (currentState.component.tools as string[]) || [],
            model: (config.modelId as string) || 'claude-sonnet-4-20250514',
            inputInstructions: currentState.component.inputInstructions || undefined,
            operationInstructions: currentState.component.operationInstructions || undefined,
            outputInstructions: currentState.component.outputInstructions || undefined,
          },
        };
        nextAction = {
          tool: 'advance_step',
          parameters: { runId, output: {} },
          hint: 'Call advance_step with agent output when the agent completes.',
        };
      }
      break;

    case 'post':
      instructions = {
        type: 'post_execution',
        content: currentState.postExecutionInstructions || 'No post-execution instructions. Proceed to advance_step.',
      };

      // Check if this state requires approval
      if (currentState.requiresApproval) {
        instructions = {
          type: 'approval_required',
          content: `State "${currentState.name}" requires approval before proceeding. ${currentState.postExecutionInstructions || ''}`,
        };
        nextAction = {
          tool: 'respond_to_approval',
          parameters: { runId },
          hint: 'Wait for human approval before continuing.',
        };
      } else {
        nextAction = {
          tool: 'advance_step',
          parameters: { runId },
          hint: 'Call advance_step to proceed to next state.',
        };
      }
      break;

    default:
      throw new Error(`Unknown phase: ${phase}`);
  }

  return buildResponse(run, resolved.story, checkpoint, instructions, nextAction);
}

function buildResponse(
  run: any,
  story: ResolvedStory | undefined,
  checkpoint: RunnerCheckpoint | undefined,
  instructions: StepInstructions,
  nextAction: NextAction
) {
  const currentState = checkpoint?.currentStateId
    ? run.workflow.states.find((s: any) => s.id === checkpoint.currentStateId)
    : run.workflow.states[0];

  const completedCount = checkpoint?.completedStates?.length || 0;
  const skippedCount = checkpoint?.skippedStates?.length || 0;
  const totalStates = run.workflow.states.length;

  return {
    success: true,
    runId: run.id,

    // Current position
    currentState: currentState ? {
      id: currentState.id,
      name: currentState.name,
      order: currentState.order,
      phase: checkpoint?.currentPhase || 'pre',
      phaseStatus: checkpoint?.phaseStatus || 'pending',
    } : null,

    // Progress
    progress: {
      stateIndex: currentState?.order || 1,
      totalStates,
      completedStates: checkpoint?.completedStates || [],
      skippedStates: checkpoint?.skippedStates || [],
      percentComplete: totalStates > 0
        ? Math.round(((completedCount + skippedCount) / totalStates) * 100)
        : 0,
    },

    // THE KEY OUTPUT: Exact instructions
    instructions,

    // What to call after completing this step
    nextAction,

    // Context
    story: story || run.story ? {
      id: story?.id || run.story?.id,
      key: story?.key || run.story?.key,
      title: story?.title || run.story?.title,
      summary: run.story?.summary,
    } : null,

    workflow: {
      id: run.workflow.id,
      name: run.workflow.name,
    },

    // Flags
    status: run.status,
    isPaused: run.isPaused,
    pauseReason: run.pauseReason,
    requiresApproval: currentState?.requiresApproval || false,

    // Resource usage
    resourceUsage: checkpoint?.resourceUsage || null,
  };
}
