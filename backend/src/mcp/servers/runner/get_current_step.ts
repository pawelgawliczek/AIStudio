/**
 * Get Current Step Tool
 * Returns COMPLETE orchestration instructions for the current step
 *
 * ST-187: MCP Tool Optimization & Step Commands
 * ST-188: Enhanced to provide full workflow sequence for any LLM session
 *
 * This tool queries the Runner's checkpoint state and returns COMPLETE instructions
 * including ALL MCP tool calls needed for successful step execution.
 * Any LLM session can follow these instructions without prior context.
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import { resolveRunId, ResolvedStory } from '../../shared/resolve-identifiers';

export const tool: Tool = {
  name: 'get_current_step',
  description: `Returns COMPLETE orchestration instructions for the current step.

Provides ALL MCP tool calls needed for successful step execution, so ANY session
can execute the workflow without prior context.

**Workflow Sequence Returned:**

For **pre** phase:
1. Manual pre-execution instructions to execute
2. \`advance_step\` call to move to agent phase

For **agent** phase:
1. \`record_agent_start\` call with exact parameters
2. Agent spawn instructions (Task tool with component details)
3. \`record_agent_complete\` call with output
4. \`advance_step\` call to move to post phase

For **post** phase:
1. Manual post-execution instructions to execute
2. If approval required: \`respond_to_approval\` guidance
3. Otherwise: \`advance_step\` call to move to next state

**Usage:**
\`\`\`typescript
get_current_step({ story: "ST-123" })
\`\`\`

**Response includes:**
- \`currentState\`: Name, order, phase
- \`workflowSequence\`: Array of steps with exact tool calls and parameters
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
  if (!checkpoint?.currentStateId) {
    throw new Error('Run is in running state but has no checkpoint. This should not happen.');
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

        // Build agent prompt from component instructions
        const agentPrompt = [
          currentState.component.inputInstructions ? `## Input\n${currentState.component.inputInstructions}` : '',
          currentState.component.operationInstructions ? `## Task\n${currentState.component.operationInstructions}` : '',
          currentState.component.outputInstructions ? `## Output\n${currentState.component.outputInstructions}` : '',
        ].filter(Boolean).join('\n\n');

        instructions = {
          type: 'agent_spawn',
          content: `Spawn the ${componentName} agent with the following instructions.`,
          component: {
            id: componentId,
            name: componentName,
            tools: componentTools,
            model: componentModel,
            inputInstructions: currentState.component.inputInstructions || undefined,
            operationInstructions: currentState.component.operationInstructions || undefined,
            outputInstructions: currentState.component.outputInstructions || undefined,
          },
        };

        // ST-188: Complete agent execution workflow
        // Step 1: Record agent start
        workflowSequence.push({
          step: 1,
          type: 'mcp_tool',
          description: `Record start of ${componentName} agent`,
          tool: 'record_agent_start',
          parameters: {
            runId,
            componentId,
          },
          notes: 'Creates ComponentRun record. Returns componentRunId for tracking.',
        });

        // Step 2: Spawn the agent
        workflowSequence.push({
          step: 2,
          type: 'agent_spawn',
          description: `Spawn ${componentName} agent`,
          agentConfig: {
            subagentType: 'general-purpose',
            model: componentModel,
            prompt: agentPrompt,
            componentId,
            componentName,
            tools: componentTools,
          },
          notes: `Use Task tool with subagent_type="general-purpose" and model="${componentModel}". Save agent output for step 3.`,
        });

        // Step 3: Record agent completion
        workflowSequence.push({
          step: 3,
          type: 'mcp_tool',
          description: `Record completion of ${componentName} agent`,
          tool: 'record_agent_complete',
          parameters: {
            runId,
            componentId,
            output: '{{AGENT_OUTPUT}}', // Placeholder - orchestrator fills this in
            status: 'completed',
          },
          notes: 'Pass agent output from step 2. Use status="failed" with errorMessage if agent failed.',
        });

        // Step 4: Advance to post phase
        workflowSequence.push({
          step: 4,
          type: 'mcp_tool',
          description: 'Advance to post phase',
          tool: 'advance_step',
          parameters: {
            story: run.story?.key || runId,
            output: '{{AGENT_OUTPUT}}', // Same output from step 2
          },
          notes: 'Stores agent output in checkpoint for context. Moves to post-execution phase.',
        });

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

    // ST-188: COMPLETE WORKFLOW SEQUENCE
    // This is the KEY output - provides ALL steps needed for this phase
    // Any LLM session can follow these steps to complete the current phase
    workflowSequence,

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
