/**
 * Advance Step Tool
 * Mark current phase complete and advance to next logical phase
 *
 * ST-187: MCP Tool Optimization & Step Commands
 * ST-215: Automatic Agent Tracking - auto-calls record_agent_start/complete
 *
 * Phase transitions:
 *   pre  → agent (if component exists) - AUTO: calls startAgentTracking
 *   pre  → post  (if no component)
 *   agent → post - AUTO: calls completeAgentTracking
 *   post → next_state.pre (or workflow_complete)
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import { resolveRunId } from '../../shared/resolve-identifiers';
import {
  startAgentTracking,
  completeAgentTracking,
  generateComponentSummary,
  StartAgentResult,
  CompleteAgentResult,
} from '../../shared/agent-tracking';

export const tool: Tool = {
  name: 'advance_step',
  description: 'Complete current phase, move to next. Agent tracking is AUTOMATIC (calls record_agent_start/complete).',
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
      output: {
        type: 'object',
        description: 'Output from current phase (stored for context). For agent phase, this is the agent output.',
      },
      skipToState: {
        type: 'string',
        description: 'State name or ID to skip to (for error recovery)',
      },
      // ST-215: New params for agent tracking
      componentSummary: {
        type: 'string',
        description: 'Summary of agent work. Auto-generated if not provided.',
      },
      agentStatus: {
        type: 'string',
        enum: ['completed', 'failed'],
        description: 'Agent status when advancing from agent phase. Default: completed.',
      },
      errorMessage: {
        type: 'string',
        description: 'Error message if agentStatus is failed.',
      },
    },
  },
};

export const metadata = {
  category: 'runner',
  domain: 'Story Runner',
  tags: ['runner', 'step', 'advance', 'execution'],
  version: '1.0.0',
  since: '2025-12-08',
};

interface RunnerCheckpoint {
  version: number;
  runId: string;
  workflowId: string;
  currentStateId: string;
  currentPhase: 'pre' | 'agent' | 'post';
  phaseStatus: 'pending' | 'in_progress' | 'completed';
  completedStates: string[];
  skippedStates: string[];
  phaseOutputs: Record<string, unknown>;
  resourceUsage: {
    tokensUsed: number;
    agentSpawns: number;
    stateTransitions: number;
    durationMs: number;
  };
  checkpointedAt: string;
  runStartedAt: string;
}

// ST-215: Agent tracking result for response
interface AgentTrackingResult {
  action: 'started' | 'completed' | null;
  componentRunId?: string;
  componentName?: string;
  success: boolean;
  warning?: string;
}

export async function handler(prisma: PrismaClient, params: {
  story?: string;
  runId?: string;
  output?: Record<string, unknown>;
  skipToState?: string;
  // ST-215: New params for agent tracking
  componentSummary?: string;
  agentStatus?: 'completed' | 'failed';
  errorMessage?: string;
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
    },
  });

  if (!run) {
    throw new Error(`WorkflowRun not found: ${runId}`);
  }

  // Validate run status
  if (run.status === 'completed') {
    throw new Error('Workflow already completed. Cannot advance.');
  }

  if (run.status === 'cancelled') {
    throw new Error('Workflow was cancelled. Cannot advance.');
  }

  if (run.status === 'failed' && !params.skipToState) {
    throw new Error('Workflow failed. Use repeat_step to retry or cancel_runner to abort.');
  }

  // Get current checkpoint
  const metadata = run.metadata as Record<string, unknown> | null;
  let checkpoint = (metadata?.checkpoint || {}) as Partial<RunnerCheckpoint>;

  // Initialize checkpoint if not exists
  if (!checkpoint.currentStateId) {
    const firstState = run.workflow.states[0];
    if (!firstState) {
      throw new Error('Workflow has no states defined.');
    }

    checkpoint = {
      version: 1,
      runId: run.id,
      workflowId: run.workflowId,
      currentStateId: firstState.id,
      currentPhase: 'pre',
      phaseStatus: 'pending',
      completedStates: [],
      skippedStates: [],
      phaseOutputs: {},
      resourceUsage: {
        tokensUsed: 0,
        agentSpawns: 0,
        stateTransitions: 0,
        durationMs: 0,
      },
      checkpointedAt: new Date().toISOString(),
      runStartedAt: new Date().toISOString(),
    };
  }

  // Handle skipToState
  if (params.skipToState) {
    const targetState = run.workflow.states.find(
      s => s.id === params.skipToState || s.name.toLowerCase() === params.skipToState?.toLowerCase()
    );

    if (!targetState) {
      throw new Error(`State not found: ${params.skipToState}`);
    }

    // Mark skipped states
    const currentIndex = run.workflow.states.findIndex(s => s.id === checkpoint.currentStateId);
    const targetIndex = run.workflow.states.findIndex(s => s.id === targetState.id);

    if (targetIndex > currentIndex) {
      // Skipping forward
      for (let i = currentIndex; i < targetIndex; i++) {
        const stateId = run.workflow.states[i].id;
        if (!checkpoint.completedStates?.includes(stateId) && !checkpoint.skippedStates?.includes(stateId)) {
          checkpoint.skippedStates = [...(checkpoint.skippedStates || []), stateId];
        }
      }
    }

    checkpoint.currentStateId = targetState.id;
    checkpoint.currentPhase = 'pre';
    checkpoint.phaseStatus = 'pending';
    checkpoint.resourceUsage = {
      ...(checkpoint.resourceUsage || { tokensUsed: 0, agentSpawns: 0, stateTransitions: 0, durationMs: 0 }),
      stateTransitions: (checkpoint.resourceUsage?.stateTransitions || 0) + 1,
    };

    // Save checkpoint
    await saveCheckpoint(prisma, runId, checkpoint, metadata);

    return buildAdvanceResponse(run, checkpoint, targetState, null);
  }

  // Normal advancement
  const currentStateId = checkpoint.currentStateId!;
  const currentPhase = checkpoint.currentPhase || 'pre';
  const currentState = run.workflow.states.find(s => s.id === currentStateId);

  if (!currentState) {
    throw new Error(`Current state ${currentStateId} not found in workflow`);
  }

  // Store phase output if provided
  if (params.output) {
    const outputKey = `${currentStateId}_${currentPhase}`;
    checkpoint.phaseOutputs = {
      ...(checkpoint.phaseOutputs || {}),
      [outputKey]: params.output,
    };
  }

  // Calculate next phase/state
  let nextPhase: 'pre' | 'agent' | 'post';
  let nextStateId = currentStateId;
  let workflowComplete = false;

  // ST-215: Track agent start/complete automatically
  let agentTrackingResult: AgentTrackingResult | null = null;

  const previousState = { name: currentState.name, phase: currentPhase };

  switch (currentPhase) {
    case 'pre':
      if (currentState.component) {
        // Has component - go to agent phase
        // ST-215: AUTO - Call startAgentTracking
        try {
          const startResult = await startAgentTracking(prisma, {
            runId: run.id,
            componentId: currentState.component.id,
            input: params.output, // Pre-phase output can be agent input
          });

          agentTrackingResult = {
            action: 'started',
            componentRunId: startResult.componentRunId,
            componentName: startResult.componentName || currentState.component.name,
            success: startResult.success,
            warning: startResult.warning || startResult.error,
          };

          if (!startResult.success) {
            console.warn(`[advance_step] Agent tracking start failed: ${startResult.error}`);
          }
        } catch (error: any) {
          agentTrackingResult = {
            action: 'started',
            componentName: currentState.component.name,
            success: false,
            warning: `Failed to start agent tracking: ${error.message}`,
          };
          console.warn(`[advance_step] ${agentTrackingResult.warning}`);
        }

        nextPhase = 'agent';
        checkpoint.resourceUsage = {
          ...(checkpoint.resourceUsage || { tokensUsed: 0, agentSpawns: 0, stateTransitions: 0, durationMs: 0 }),
          agentSpawns: (checkpoint.resourceUsage?.agentSpawns || 0) + 1,
        };
      } else {
        // No component - skip agent, go to post
        nextPhase = 'post';
      }
      break;

    case 'agent':
      // Agent done - go to post
      // ST-215: AUTO - Call completeAgentTracking
      if (currentState.component) {
        try {
          // Generate summary if not provided
          const summary =
            params.componentSummary ||
            generateComponentSummary(params.output, currentState.component.name);

          const completeResult = await completeAgentTracking(prisma, {
            runId: run.id,
            componentId: currentState.component.id,
            output: params.output,
            status: params.agentStatus || 'completed',
            componentSummary: summary,
            errorMessage: params.errorMessage,
          });

          agentTrackingResult = {
            action: 'completed',
            componentRunId: completeResult.componentRunId,
            componentName: completeResult.componentName || currentState.component.name,
            success: completeResult.success,
            warning: completeResult.warning || completeResult.error,
          };

          if (!completeResult.success) {
            console.warn(`[advance_step] Agent tracking complete failed: ${completeResult.error}`);
          }
        } catch (error: any) {
          agentTrackingResult = {
            action: 'completed',
            componentName: currentState.component.name,
            success: false,
            warning: `Failed to complete agent tracking: ${error.message}`,
          };
          console.warn(`[advance_step] ${agentTrackingResult.warning}`);
        }
      }

      nextPhase = 'post';
      break;

    case 'post':
      // Post done - move to next state or complete
      const currentIndex = run.workflow.states.findIndex(s => s.id === currentStateId);
      const nextState = run.workflow.states[currentIndex + 1];

      // Mark current state as completed
      if (!checkpoint.completedStates?.includes(currentStateId)) {
        checkpoint.completedStates = [...(checkpoint.completedStates || []), currentStateId];
      }

      if (nextState) {
        nextStateId = nextState.id;
        nextPhase = 'pre';
        checkpoint.resourceUsage = {
          ...(checkpoint.resourceUsage || { tokensUsed: 0, agentSpawns: 0, stateTransitions: 0, durationMs: 0 }),
          stateTransitions: (checkpoint.resourceUsage?.stateTransitions || 0) + 1,
        };
      } else {
        // No more states - workflow complete
        workflowComplete = true;
        nextPhase = 'post'; // Keep as post
      }
      break;

    default:
      throw new Error(`Unknown phase: ${currentPhase}`);
  }

  // Update checkpoint
  checkpoint.currentStateId = nextStateId;
  checkpoint.currentPhase = nextPhase;
  checkpoint.phaseStatus = 'pending';
  checkpoint.checkpointedAt = new Date().toISOString();

  // Save checkpoint
  await saveCheckpoint(prisma, runId, checkpoint, metadata, workflowComplete);

  // Get the next state object
  const nextStateObj = run.workflow.states.find(s => s.id === nextStateId);

  return buildAdvanceResponse(run, checkpoint, nextStateObj, previousState, workflowComplete, agentTrackingResult);
}

async function saveCheckpoint(
  prisma: PrismaClient,
  runId: string,
  checkpoint: Partial<RunnerCheckpoint>,
  existingMetadata: Record<string, unknown> | null,
  workflowComplete = false
) {
  const updateData: Record<string, unknown> = {
    metadata: {
      ...(existingMetadata || {}),
      checkpoint,
    },
  };

  if (workflowComplete) {
    updateData.status = 'completed';
    updateData.finishedAt = new Date();
  }

  await prisma.workflowRun.update({
    where: { id: runId },
    data: updateData,
  });
}

function buildAdvanceResponse(
  run: any,
  checkpoint: Partial<RunnerCheckpoint>,
  currentState: any,
  previousState: { name: string; phase: string } | null,
  workflowComplete = false,
  agentTracking: AgentTrackingResult | null = null,
) {
  const totalStates = run.workflow.states.length;
  const completedCount = checkpoint.completedStates?.length || 0;
  const skippedCount = checkpoint.skippedStates?.length || 0;

  // Build instructions for new step
  let instructions: any;
  let nextAction: any;

  if (workflowComplete) {
    instructions = {
      type: 'workflow_complete',
      content: 'All states have been executed. Workflow completed successfully.',
    };
    nextAction = {
      tool: 'update_team_status',
      parameters: { runId: run.id, status: 'completed' },
      hint: 'Update workflow status to completed.',
    };
  } else {
    const phase = checkpoint.currentPhase || 'pre';

    switch (phase) {
      case 'pre':
        instructions = {
          type: 'pre_execution',
          content: currentState?.preExecutionInstructions || 'No pre-execution instructions. Proceed to advance_step.',
        };
        nextAction = {
          tool: 'advance_step',
          parameters: { runId: run.id },
          hint: 'Call advance_step when pre-execution is complete.',
        };
        break;

      case 'agent':
        if (!currentState?.component) {
          instructions = {
            type: 'post_execution',
            content: 'No agent assigned. Proceeding to post-execution.',
          };
        } else {
          instructions = {
            type: 'agent_spawn',
            content: `Spawn the ${currentState.component.name} agent.`,
            component: {
              id: currentState.component.id,
              name: currentState.component.name,
            },
          };
        }
        nextAction = {
          tool: 'advance_step',
          parameters: { runId: run.id, output: {} },
          hint: 'Call advance_step with output when complete.',
        };
        break;

      case 'post':
        instructions = {
          type: 'post_execution',
          content: currentState?.postExecutionInstructions || 'No post-execution instructions. Proceed to advance_step.',
        };
        nextAction = {
          tool: 'advance_step',
          parameters: { runId: run.id },
          hint: 'Call advance_step to proceed to next state.',
        };
        break;
    }
  }

  return {
    success: true,
    runId: run.id,

    // What we advanced from
    previousState,

    // What we advanced to
    currentState: currentState ? {
      id: currentState.id,
      name: currentState.name,
      order: currentState.order,
      phase: checkpoint.currentPhase,
    } : null,

    // Progress
    progress: {
      completedStates: completedCount,
      skippedStates: skippedCount,
      totalStates,
      percentComplete: totalStates > 0
        ? Math.round(((completedCount + skippedCount) / totalStates) * 100)
        : 0,
    },

    // New instructions (same as get_current_step would return)
    instructions,

    nextAction,

    // Workflow completion flag
    workflowComplete,

    // Story context
    story: run.story ? {
      key: run.story.key,
      title: run.story.title,
    } : undefined,

    // ST-215: Agent tracking result
    agentTracking: agentTracking || undefined,

    // ST-215: Warnings collection (for non-fatal issues)
    warnings: agentTracking?.warning
      ? { agentTracking: agentTracking.warning }
      : undefined,

    message: workflowComplete
      ? 'Workflow completed successfully.'
      : `Advanced from ${previousState?.name || 'start'}:${previousState?.phase || 'pre'} to ${currentState?.name}:${checkpoint.currentPhase}`,
  };
}
