/**
 * Advance Step Tool
 * Mark current phase complete and advance to next logical phase
 *
 * ST-187: MCP Tool Optimization & Step Commands
 * ST-215: Automatic Agent Tracking - auto-calls record_agent_start/complete
 * ST-216: Earlier agent tracking - start when entering state, complete when leaving agent phase
 *
 * Phase transitions:
 *   post → next_state.pre - AUTO: calls startAgentTracking for NEW state (if has component)
 *   pre  → agent (if component exists)
 *   pre  → post  (if no component)
 *   agent → post - AUTO: calls completeAgentTracking
 *   (workflow init) → first_state.pre - AUTO: calls startAgentTracking (if has component)
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import { ComponentSummaryStructured } from '../../../types/component-summary.types';
import {
  startAgentTracking,
  completeAgentTracking,
  generateStructuredSummary,
} from '../../shared/agent-tracking';
import { resolveRunId } from '../../shared/resolve-identifiers';
import { deriveSubagentType, buildTaskPrompt } from '../../shared/task-prompt-builder';
import { RemoteRunner } from '../../utils/remote-runner';
import {
  buildPhaseInstructions,
  buildCommitInstruction,
  buildEnforcementData,
} from './advance_step.helpers';
import {
  buildAgentInstructions,
  initializeCheckpoint,
  handleSkipToState,
  syncSpawnedAgentTranscripts,
  completeAgentTrackingForComponent,
  saveCheckpoint,
  buildAdvanceResponse,
  type RunnerCheckpoint,
  type ComponentData,
  type WorkflowStateData,
} from './advance_step.utils';

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
      // ST-203: Accept structured summary object or string
      componentSummary: {
        type: ['string', 'object'],
        description: 'Summary of agent work (structured JSON or string). Auto-generated if not provided. Format: {version: "1.0", status: "success"|"partial"|"blocked"|"failed", summary: "...", keyOutputs?: [...], nextAgentHints?: [...], artifactsProduced?: [...], errors?: [...]}',
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
  // ST-203: Accept structured object or string
  componentSummary?: string | ComponentSummaryStructured;
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
                  executionType: true,
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
  // ST-216: Track initialization to call startAgentTracking for first state
  if (!checkpoint.currentStateId) {
    const firstState = run.workflow.states[0];
    if (!firstState) {
      throw new Error('Workflow has no states defined.');
    }

    checkpoint = initializeCheckpoint(run, firstState);

    // ST-216: Start agent tracking for first state if it has a component
    // This shows the agent as "running" in the UI from the very beginning
    if (firstState.component) {
      try {
        const startResult = await startAgentTracking(prisma, {
          runId: run.id,
          componentId: firstState.component.id,
        });

        if (!startResult.success) {
          console.warn(`[advance_step] Agent tracking start failed for first state ${firstState.component.name}: ${startResult.error}`);
        } else {
          console.log(`[advance_step] Started agent tracking for first state: ${firstState.component.name}`);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.warn(`[advance_step] Failed to start agent tracking for first state: ${message}`);
      }
    }
  }

  // Handle skipToState
  if (params.skipToState) {
    const targetState = run.workflow.states.find(
      s => s.id === params.skipToState || s.name.toLowerCase() === params.skipToState?.toLowerCase()
    );

    if (!targetState) {
      throw new Error(`State not found: ${params.skipToState}`);
    }

    // Use helper to handle skip logic
    const skipResult = handleSkipToState(checkpoint, run.workflow.states, targetState.id);
    checkpoint.currentStateId = skipResult.currentStateId;
    checkpoint.currentPhase = skipResult.currentPhase;
    checkpoint.phaseStatus = skipResult.phaseStatus;
    checkpoint.skippedStates = skipResult.skippedStates;
    checkpoint.resourceUsage = skipResult.resourceUsage;

    // Save checkpoint
    await saveCheckpoint(prisma, runId, checkpoint, metadata);

    return buildAdvanceResponse(prisma, run, checkpoint, targetState, null, false, null, true, run.story?.id);
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

  // ST-278: Track if agent completed successfully (for commitBeforeAdvance logic)
  let agentWasSuccessful = true; // Default to true if no agent or agent not yet run

  const previousState = { name: currentState.name, phase: currentPhase };

  switch (currentPhase) {
    case 'pre':
      // ST-216: Agent tracking was already started when we entered this state
      // Just transition to agent phase (if component) or post phase (if no component)
      if (currentState.component) {
        // Has component - go to agent phase
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
      // ST-242: Sync spawnedAgentTranscripts from laptop before completing agent tracking
      await syncSpawnedAgentTranscripts(prisma, run);

      // ST-215: AUTO - Call completeAgentTracking
      // ST-278: Track agent status for commitBeforeAdvance logic
      if (currentState.component) {
        const trackingResult = await completeAgentTrackingForComponent(prisma, run, currentState, params);
        agentWasSuccessful = trackingResult.agentWasSuccessful;
        agentTrackingResult = {
          action: trackingResult.action,
          componentRunId: trackingResult.componentRunId,
          componentName: trackingResult.componentName,
          success: trackingResult.success,
          warning: trackingResult.warning,
        };
      }

      nextPhase = 'post';
      break;

    case 'post': {
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

        // ST-216: Start agent tracking for the NEXT state when entering its pre phase
        // This shows the agent as "running" in the UI even during pre-execution
        if (nextState.component) {
          try {
            const startResult = await startAgentTracking(prisma, {
              runId: run.id,
              componentId: nextState.component.id,
              input: params.output, // Previous state's output as context
            });

            agentTrackingResult = {
              action: 'started',
              componentRunId: startResult.componentRunId,
              componentName: startResult.componentName || nextState.component.name,
              success: startResult.success,
              warning: startResult.warning || startResult.error,
            };

            if (!startResult.success) {
              console.warn(`[advance_step] Agent tracking start failed for ${nextState.component.name}: ${startResult.error}`);
            }
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            agentTrackingResult = {
              action: 'started',
              componentName: nextState.component.name,
              success: false,
              warning: `Failed to start agent tracking: ${message}`,
            };
            console.warn(`[advance_step] ${agentTrackingResult.warning}`);
          }
        }
      } else {
        // No more states - workflow complete
        workflowComplete = true;
        nextPhase = 'post'; // Keep as post
      }
      break;
    }

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
  const nextStateObj = run.workflow.states.find(s => s.id === nextStateId) || null;

  return buildAdvanceResponse(prisma, run, checkpoint, nextStateObj, previousState, workflowComplete, agentTrackingResult, agentWasSuccessful, run.story?.id);
}
