/**
 * Get Current Step Tool
 * Returns COMPLETE orchestration instructions for the current step
 *
 * ST-187: MCP Tool Optimization & Step Commands
 * ST-188: Enhanced to provide full workflow sequence for any LLM session
 * ST-215: Simplified agent phase to 2 steps (tracking is automatic in advance_step)
 *
 * This tool queries the Runner's checkpoint state and returns COMPLETE instructions
 * including ALL MCP tool calls needed for successful step execution.
 * Any LLM session can follow these instructions without prior context.
 *
 * Agent phase is now simplified:
 *   1. Task(spawn agent)
 *   2. advance_step(output) - auto-calls record_agent_complete
 *
 * (Previously was 4 steps with manual record_agent_start/complete calls)
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import { resolveRunId, resolveStory, ResolvedStory } from '../../shared/resolve-identifiers';
import { buildTaskPrompt, deriveSubagentType } from '../../shared/task-prompt-builder';

export const tool: Tool = {
  name: 'get_current_step',
  description: 'Get orchestration instructions for current phase. Returns workflowSequence with exact MCP calls.',
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

type InstructionType = 'pre_execution' | 'agent_spawn' | 'post_execution' | 'approval_required' | 'workflow_complete' | 'workflow_paused' | 'workflow_failed' | 'no_active_run';

// ST-188: Workflow step types for complete orchestration guidance
type WorkflowStepType = 'manual' | 'mcp_tool' | 'agent_spawn' | 'approval_gate' | 'question_handler';

interface WorkflowStep {
  step: number;
  type: WorkflowStepType;
  description: string;
  // For manual steps
  instructions?: string;
  // For MCP tool calls
  tool?: string;
  parameters?: Record<string, unknown>;
  // For agent spawn steps
  agentConfig?: {
    subagentType: string;
    model: string;
    prompt: string;
    componentId: string;
    componentName: string;
    tools: string[];
  };
  // Notes for the orchestrator
  notes?: string;
}

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
  // ST-273: Enforcement data for hooks
  enforcement?: {
    allowedSubagentTypes: string[];
    requiredComponentName: string;
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

  // Try to resolve story key or runId
  let resolved;
  try {
    resolved = await resolveRunId(prisma, {
      story: params.story,
      runId: params.runId,
    });
  } catch (error) {
    // ST-188: Handle case where no active run exists for the story
    // Return workflow sequence to guide user to start a new workflow
    if (params.story && error instanceof Error && error.message.includes('No active workflow run')) {
      return buildNoActiveRunResponse(prisma, params.story);
    }
    throw error;
  }
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
                  executionType: true,
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

  // Handle different run statuses with complete workflow sequences
  if (run.status === 'completed') {
    return buildResponse(run, resolved.story, checkpoint, {
      type: 'workflow_complete',
      content: 'Workflow has completed successfully. All states have been executed.',
    }, {
      tool: 'update_team_status',
      parameters: { runId, status: 'completed' },
      hint: 'Mark workflow as completed if not already done.',
    }, [{
      step: 1,
      type: 'mcp_tool',
      description: 'Finalize workflow completion',
      tool: 'update_team_status',
      parameters: { runId, status: 'completed', summary: 'All states executed successfully.' },
      notes: 'Workflow is already complete. Call this to finalize status if needed.',
    }]);
  }

  if (run.status === 'failed') {
    return buildResponse(run, resolved.story, checkpoint, {
      type: 'workflow_failed',
      content: `Workflow failed: ${run.errorMessage || 'Unknown error'}. Use repeat_step to retry or cancel_runner to abort.`,
    }, {
      tool: 'repeat_step',
      parameters: { runId },
      hint: 'Retry the failed step or cancel the workflow.',
    }, [{
      step: 1,
      type: 'mcp_tool',
      description: 'Option A: Retry the failed step',
      tool: 'repeat_step',
      parameters: { story: run.story?.key || runId, reason: 'Retry after failure' },
      notes: 'Resets current step to try again. Optionally add feedback for improved results.',
    }, {
      step: 2,
      type: 'mcp_tool',
      description: 'Option B: Cancel the workflow',
      tool: 'cancel_runner',
      parameters: { story: run.story?.key || runId, reason: 'Cancelled after failure' },
      notes: 'Alternative: Cancel workflow if retry is not desired.',
    }]);
  }

  if (run.status === 'cancelled') {
    throw new Error('Workflow was cancelled. Cannot get current step.');
  }

  if (run.status === 'pending') {
    // Run hasn't started yet - need to initialize checkpoint
    const firstState = run.workflow.states[0];
    return buildResponse(run, resolved.story, undefined, {
      type: 'pre_execution',
      content: firstState
        ? `Workflow not started. First state: ${firstState.name}. Pre-execution instructions: ${firstState.preExecutionInstructions || 'None'}`
        : 'Workflow has no states defined.',
    }, {
      tool: 'advance_step',
      parameters: { runId },
      hint: 'Call advance_step to initialize and start the workflow.',
    }, [{
      step: 1,
      type: 'mcp_tool',
      description: 'Initialize workflow and start execution',
      tool: 'advance_step',
      parameters: { story: run.story?.key || runId },
      notes: 'Initializes checkpoint at first state. Call this to begin workflow execution.',
    }]);
  }

  if (run.isPaused && run.pauseReason?.includes('approval')) {
    return buildResponse(run, resolved.story, checkpoint, {
      type: 'approval_required',
      content: `Workflow is paused awaiting approval: ${run.pauseReason}`,
    }, {
      tool: 'respond_to_approval',
      parameters: { runId },
      hint: 'Wait for human approval via respond_to_approval tool.',
    }, [{
      step: 1,
      type: 'approval_gate',
      description: 'Wait for human approval',
      tool: 'respond_to_approval',
      parameters: { runId, action: 'approve', decidedBy: '{{USER_ID}}' },
      notes: 'Human must approve via UI or this tool. Options: approve, rerun (with feedback), reject.',
    }]);
  }

  if (run.isPaused) {
    return buildResponse(run, resolved.story, checkpoint, {
      type: 'workflow_paused',
      content: `Workflow is paused: ${run.pauseReason || 'No reason specified'}`,
    }, {
      tool: 'resume_runner',
      parameters: { runId },
      hint: 'Resume the workflow to continue execution.',
    }, [{
      step: 1,
      type: 'mcp_tool',
      description: 'Resume paused workflow',
      tool: 'resume_runner',
      parameters: { runId },
      notes: 'Continues workflow from checkpoint. Use advance_step after resuming.',
    }]);
  }

  // Running state - get current step instructions
  // Handle case where run was just started (status='running') but checkpoint not yet initialized
  // This happens when start_team_run is called but advance_step hasn't been called yet
  if (!checkpoint?.currentStateId) {
    const firstState = run.workflow.states[0];
    return buildResponse(run, resolved.story, undefined, {
      type: 'pre_execution',
      content: firstState
        ? `Workflow started but not initialized. First state: ${firstState.name}. Call advance_step to initialize the checkpoint and begin execution.`
        : 'Workflow has no states defined.',
    }, {
      tool: 'advance_step',
      parameters: { story: run.story?.key || runId },
      hint: 'Call advance_step to initialize the workflow checkpoint and start execution.',
    }, [{
      step: 1,
      type: 'mcp_tool',
      description: 'Initialize workflow checkpoint and start execution',
      tool: 'advance_step',
      parameters: { story: run.story?.key || runId },
      notes: 'The workflow was started but the checkpoint was not initialized. Call advance_step to create the checkpoint at the first state.',
    }]);
  }

  const currentState = run.workflow.states.find(s => s.id === checkpoint.currentStateId);
  if (!currentState) {
    throw new Error(`Current state ${checkpoint.currentStateId} not found in workflow`);
  }

  const phase = checkpoint.currentPhase || 'pre';
  const phaseStatus = checkpoint.phaseStatus || 'pending';

  // ST-188: Build COMPLETE workflow sequence for the current phase
  // This provides ALL MCP tool calls needed so ANY session can execute
  const workflowSequence: WorkflowStep[] = [];
  let instructions: StepInstructions;
  let nextAction: NextAction;

  switch (phase) {
    case 'pre':
      instructions = {
        type: 'pre_execution',
        content: currentState.preExecutionInstructions || 'No pre-execution instructions. Proceed to advance_step.',
      };

      // Step 1: Execute pre-execution instructions (manual)
      if (currentState.preExecutionInstructions) {
        workflowSequence.push({
          step: 1,
          type: 'manual',
          description: 'Execute pre-execution instructions',
          instructions: currentState.preExecutionInstructions,
          notes: 'Execute these instructions before advancing to the agent phase.',
        });
      }

      // Step 2: Advance to agent phase
      workflowSequence.push({
        step: workflowSequence.length + 1,
        type: 'mcp_tool',
        description: 'Advance to agent phase',
        tool: 'advance_step',
        parameters: { story: run.story?.key || runId },
        notes: 'This will move to the agent phase (or post phase if no agent assigned).',
      });

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

        workflowSequence.push({
          step: 1,
          type: 'mcp_tool',
          description: 'No agent assigned - advance to post phase',
          tool: 'advance_step',
          parameters: { story: run.story?.key || runId },
          notes: 'No agent assigned to this state, advance directly to post-execution.',
        });

        nextAction = {
          tool: 'advance_step',
          parameters: { runId },
          hint: 'Call advance_step to proceed to post-execution.',
        };
      } else {
        const config = currentState.component.config as Record<string, unknown> || {};
        const componentId = currentState.component.id;
        const componentName = currentState.component.name;
        const componentTools = (currentState.component.tools as string[]) || [];
        const componentModel = (config.modelId as string) || 'claude-sonnet-4-20250514';
        const executionType = currentState.component.executionType || 'custom';

        // ST-289: Build agent prompt using centralized builder
        // Includes component instructions, previous outputs, and artifact access
        const agentPrompt = await buildTaskPrompt(
          prisma,
          currentState,
          runId,
          run.story?.id || ''
        );

        // ST-289: Derive subagent type using centralized function
        const subagentType = deriveSubagentType(executionType, componentName);

        // ST-273: Derive allowed subagent types for enforcement
        // Map derived subagent type to enforcement array
        const allowedSubagentTypes = [subagentType];

        // ST-306: When agentConfig is successfully built with assembled prompt,
        // only include minimal component fields (not redundant raw instructions)
        instructions = {
          type: 'agent_spawn',
          content: `Spawn the ${componentName} agent with the following instructions.`,
          component: {
            id: componentId,
            name: componentName,
            tools: componentTools,
            model: componentModel,
            // ST-306: Omit raw instruction fields when agentPrompt is built
            // These are already assembled in workflowSequence[].agentConfig.prompt
          },
          // ST-273: Enforcement data for hooks
          enforcement: {
            allowedSubagentTypes,
            requiredComponentName: componentName,
          },
        };

        // ST-278: Check if this is a code-modifying component (requires orchestrator-driven commit)
        const isCodeModifyingComponent = ['Implementer', 'Developer', 'Tester', 'Reviewer'].includes(componentName);

        // ST-215: Simplified 2-step agent execution workflow (3-step for code-modifying components)
        // Agent tracking (record_agent_start/complete) is now AUTOMATIC in advance_step
        // Step 1: Spawn the agent via Task tool
        workflowSequence.push({
          step: 1,
          type: 'agent_spawn',
          description: `Spawn ${componentName} agent via Task tool`,
          agentConfig: {
            subagentType,
            model: componentModel,
            prompt: agentPrompt,
            componentId,
            componentName,
            tools: componentTools,
          },
          notes: `⚠️ MUST use Task tool - DO NOT do the work yourself! You are the orchestrator.

Execute:
\`\`\`
Task({
  subagent_type: "${subagentType}",
  model: "${componentModel}",
  prompt: <agentConfig.prompt VERBATIM>
})
\`\`\`

DO NOT add exploration findings, story context, or any other modifications to the prompt.
The workflow system provides complete context - pass agentConfig.prompt EXACTLY as provided.

Agent tracking is AUTOMATIC - advance_step handles record_agent_start/complete internally.`,
        });

        // ST-278: Step 2 (for code-modifying components only): Commit changes
        if (isCodeModifyingComponent) {
          // Get project path for commit command
          let projectPath = '/opt/stack/AIStudio'; // Default fallback
          if (run.story?.id) {
            // Will be resolved at runtime via worktree
            projectPath = '{{WORKTREE_PATH}}';
          }

          workflowSequence.push({
            step: 2,
            type: 'mcp_tool',
            description: `Commit ${componentName} changes`,
            tool: 'exec-command',
            parameters: {
              command: `git add -A && git commit -m "feat(${run.story?.key || 'workflow'}): ${componentName} phase\n\nChanges made by ${componentName} agent.\n\nCo-Authored-By: ${componentName} Agent <noreply@vibestudio.ai>"`,
              cwd: projectPath,
            },
            notes: `Orchestrator-driven commit for accurate per-phase LOC tracking. This commit captures ${componentName} work before advancing to next phase. The agent itself does NOT commit - orchestrator handles this.`,
          });
        }

        // Step 3 (or 2 for non-code components): Advance to post phase (auto-completes agent tracking)
        workflowSequence.push({
          step: isCodeModifyingComponent ? 3 : 2,
          type: 'mcp_tool',
          description: 'Advance to post-execution phase (auto-completes agent tracking)',
          tool: 'advance_step',
          parameters: {
            story: run.story?.key || runId,
            output: '{{AGENT_OUTPUT}}', // Agent output - used for tracking and context
          },
          notes: `Replace {{AGENT_OUTPUT}} with actual output from Task agent.

advance_step AUTOMATICALLY:
- Records agent completion with metrics
- Auto-generates componentSummary from output (or provide explicit componentSummary param)
- Stores output for workflow context

Optional params for better tracking:
- componentSummary: Structured JSON object (preferred) or string
  Format: {
    version: "1.0",
    status: "success" | "partial" | "blocked" | "failed",
    summary: "1-2 sentence description (max 200 chars)",
    keyOutputs: ["bullet 1", "bullet 2", ...], // max 5
    nextAgentHints: ["hint for next agent", ...], // max 3
    artifactsProduced: ["ARCH_DOC", ...],
    errors: ["error msg", ...] // max 3
  }
- agentStatus: "completed" (default) or "failed"
- errorMessage: "error details if agentStatus is failed"

Status meanings:
- success: work completed fully
- partial: some work done, but incomplete
- blocked: couldn't proceed due to external blocker
- failed: encountered errors during execution`,
        });

        nextAction = {
          tool: 'Task',
          parameters: { subagent_type: subagentType, model: componentModel },
          hint: 'Spawn the agent via Task tool. advance_step handles tracking automatically.',
        };
      }
      break;

    case 'post':
      instructions = {
        type: 'post_execution',
        content: currentState.postExecutionInstructions || 'No post-execution instructions. Proceed to advance_step.',
      };

      // Step 1: Execute post-execution instructions (manual)
      if (currentState.postExecutionInstructions) {
        workflowSequence.push({
          step: 1,
          type: 'manual',
          description: 'Execute post-execution instructions',
          instructions: currentState.postExecutionInstructions,
          notes: 'Execute these instructions after agent completion.',
        });
      }

      // Check if this state requires approval
      if (currentState.requiresApproval) {
        instructions = {
          type: 'approval_required',
          content: `State "${currentState.name}" requires approval before proceeding. ${currentState.postExecutionInstructions || ''}`,
        };

        workflowSequence.push({
          step: workflowSequence.length + 1,
          type: 'approval_gate',
          description: 'Wait for human approval',
          tool: 'respond_to_approval',
          parameters: { runId },
          notes: 'Workflow pauses here. Human must approve via UI or respond_to_approval tool before continuing.',
        });

        nextAction = {
          tool: 'respond_to_approval',
          parameters: { runId },
          hint: 'Wait for human approval before continuing.',
        };
      } else {
        workflowSequence.push({
          step: workflowSequence.length + 1,
          type: 'mcp_tool',
          description: 'Advance to next state',
          tool: 'advance_step',
          parameters: { story: run.story?.key || runId },
          notes: 'Moves to next state in workflow or completes workflow if this was the last state.',
        });

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

  return buildResponse(run, resolved.story, checkpoint, instructions, nextAction, workflowSequence);
}

function buildResponse(
  run: any,
  story: ResolvedStory | undefined,
  checkpoint: RunnerCheckpoint | undefined,
  instructions: StepInstructions,
  nextAction: NextAction,
  workflowSequence: WorkflowStep[] = []
) {
  const currentState = checkpoint?.currentStateId
    ? run.workflow.states.find((s: any) => s.id === checkpoint.currentStateId)
    : run.workflow.states[0];

  const completedCount = checkpoint?.completedStates?.length || 0;
  const skippedCount = checkpoint?.skippedStates?.length || 0;
  const totalStates = run.workflow.states.length;
  const phase = checkpoint?.currentPhase || 'pre';
  const stateName = currentState?.name || 'unknown';

  // ST-190: Build prominent message to guide LLM to follow workflowSequence
  const stepCount = workflowSequence.length;
  let message: string;
  if (stepCount > 0) {
    const stepDescriptions = workflowSequence.map(s => `${s.step}. ${s.description}`).join(', ');
    message = `⚠️ EXECUTE ${stepCount} STEPS IN ORDER: ${stepDescriptions}. Follow the workflowSequence below - each step has exact MCP tool calls or instructions.`;
  } else {
    message = `Currently in ${stateName} state, ${phase} phase. Check instructions for what to do.`;
  }

  return {
    success: true,

    // ST-190: Prominent message at TOP of response to guide LLM behavior
    // This is the FIRST thing the LLM should read and follow
    message,

    // ST-188: COMPLETE WORKFLOW SEQUENCE
    // This is the KEY output - provides ALL steps needed for this phase
    // Any LLM session can follow these steps to complete the current phase
    // ⚠️ IMPORTANT: Execute these steps IN ORDER - do not skip steps!
    workflowSequence,

    runId: run.id,

    // Current position
    currentState: currentState ? {
      id: currentState.id,
      name: currentState.name,
      order: currentState.order,
      phase,
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

    // Legacy: Single instruction (kept for backwards compatibility)
    instructions,

    // Legacy: Next action hint (kept for backwards compatibility)
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

/**
 * ST-188: Build response when no active run exists for a story
 * Returns workflow sequence guiding user to start a new workflow
 */
async function buildNoActiveRunResponse(prisma: PrismaClient, storyIdentifier: string) {
  // Look up the story to get projectId
  const story = await resolveStory(prisma, storyIdentifier);
  if (!story) {
    throw new Error(`Story not found: ${storyIdentifier}`);
  }

  // Get project details
  const project = await prisma.project.findUnique({
    where: { id: story.projectId },
    select: { id: true, name: true },
  });

  const workflowSequence: WorkflowStep[] = [
    {
      step: 1,
      type: 'mcp_tool',
      description: 'List available teams/workflows for this project',
      tool: 'list_teams',
      parameters: {
        projectId: story.projectId,
      },
      notes: `Lists all active teams (workflows) available for project "${project?.name || story.projectId}". Choose a team from the results to use in step 2.`,
    },
    {
      step: 2,
      type: 'mcp_tool',
      description: 'Start a team run for the story',
      tool: 'start_team_run',
      parameters: {
        teamId: '{{SELECTED_TEAM_ID}}', // Placeholder - user selects from step 1
        triggeredBy: 'mcp-orchestrator',
        cwd: '{{CURRENT_WORKING_DIRECTORY}}',
        sessionId: '{{SESSION_ID}}',
        transcriptPath: '{{TRANSCRIPT_PATH}}',
      },
      notes: 'Replace {{SELECTED_TEAM_ID}} with the team ID from step 1. This creates a WorkflowRun and returns runId for workflow execution.',
    },
    {
      step: 3,
      type: 'mcp_tool',
      description: 'Get current step after starting the run',
      tool: 'get_current_step',
      parameters: {
        story: story.key,
      },
      notes: 'After starting the run, call get_current_step again to get the first execution step.',
    },
  ];

  return {
    success: true,
    runId: null as any,
    noActiveRun: true,

    // Story context
    story: {
      id: story.id,
      key: story.key,
      title: story.title,
      status: story.status,
      projectId: story.projectId,
    },

    project: project ? {
      id: project.id,
      name: project.name,
    } : null,

    // Current state is null - no run exists
    currentState: null as any,

    // No progress yet
    progress: {
      stateIndex: 0,
      totalStates: 0,
      completedStates: [] as any,
      skippedStates: [] as any,
      percentComplete: 0,
    },

    // ST-188: COMPLETE WORKFLOW SEQUENCE to start a new run
    workflowSequence,

    // Instructions for the orchestrator
    instructions: {
      type: 'no_active_run' as InstructionType,
      content: `No active workflow run exists for story ${story.key}. Follow the workflow sequence to start a new run.`,
    },

    // Next action
    nextAction: {
      tool: 'list_teams',
      parameters: { projectId: story.projectId },
      hint: 'First, list available teams to choose which workflow to run.',
    },

    // Flags
    status: 'none',
    isPaused: false,
    pauseReason: null as any,
    requiresApproval: false,
    resourceUsage: null as any,

    message: `No active workflow run found for ${story.key}. Follow the workflowSequence to start a new run: 1) List available teams, 2) Start a team run, 3) Get current step.`,
  };
}
