/**
 * Repeat Step Tool
 * Reset and retry the current step (useful for failures or refinement)
 *
 * ST-187: MCP Tool Optimization & Step Commands
 *
 * Behavior:
 * 1. Resets current phase status to 'pending'
 * 2. Optionally injects feedback into instructions
 * 3. Returns same step instructions (like get_current_step)
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import { resolveRunId } from '../../shared/resolve-identifiers';

export const tool: Tool = {
  name: 'repeat_step',
  description: `Reset and retry the current step.

Useful for:
- Retrying after a failure
- Re-running with additional feedback
- Refining agent output

**Usage:**
\`\`\`typescript
// Simple retry
repeat_step({ story: "ST-123" })

// Retry with feedback
repeat_step({
  story: "ST-123",
  reason: "Previous output was incomplete",
  feedback: "Include error handling for edge cases. Check null values."
})
\`\`\``,
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
      reason: {
        type: 'string',
        description: 'Why repeating (for audit trail)',
      },
      feedback: {
        type: 'string',
        description: 'Instructions to inject for retry (will be prepended to phase instructions)',
      },
    },
  },
};

export const metadata = {
  category: 'runner',
  domain: 'Story Runner',
  tags: ['runner', 'step', 'repeat', 'retry', 'execution'],
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
  retryHistory?: Array<{
    timestamp: string;
    phase: string;
    stateId: string;
    reason?: string;
    feedback?: string;
  }>;
  resourceUsage: {
    tokensUsed: number;
    agentSpawns: number;
    stateTransitions: number;
    durationMs: number;
  };
  checkpointedAt: string;
  runStartedAt: string;
}

export async function handler(prisma: PrismaClient, params: {
  story?: string;
  runId?: string;
  reason?: string;
  feedback?: string;
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
        },
      },
    },
  });

  if (!run) {
    throw new Error(`WorkflowRun not found: ${runId}`);
  }

  // Validate run status
  if (run.status === 'completed') {
    throw new Error('Workflow already completed. Cannot repeat step.');
  }

  if (run.status === 'cancelled') {
    throw new Error('Workflow was cancelled. Cannot repeat step.');
  }

  // Get current checkpoint
  const metadata = run.metadata as Record<string, unknown> | null;
  const checkpoint = (metadata?.checkpoint || {}) as Partial<RunnerCheckpoint>;

  if (!checkpoint.currentStateId) {
    throw new Error('No active step to repeat. Workflow may not have started.');
  }

  const currentState = run.workflow.states.find(s => s.id === checkpoint.currentStateId);
  if (!currentState) {
    throw new Error(`Current state ${checkpoint.currentStateId} not found in workflow`);
  }

  const phase = checkpoint.currentPhase || 'pre';

  // Record retry in history
  const retryRecord = {
    timestamp: new Date().toISOString(),
    phase,
    stateId: checkpoint.currentStateId,
    reason: params.reason,
    feedback: params.feedback,
  };

  checkpoint.retryHistory = [
    ...(checkpoint.retryHistory || []),
    retryRecord,
  ];

  // Reset phase status to pending
  checkpoint.phaseStatus = 'pending';
  checkpoint.checkpointedAt = new Date().toISOString();

  // Clear pause if run was paused due to failure
  const updateData: Record<string, unknown> = {
    metadata: {
      ...(metadata || {}),
      checkpoint,
      lastRetry: retryRecord,
    },
  };

  if (run.status === 'failed') {
    updateData.status = 'running';
    updateData.errorMessage = null;
  }

  if (run.isPaused) {
    updateData.isPaused = false;
    updateData.pauseReason = null;
  }

  // Save updated checkpoint
  await prisma.workflowRun.update({
    where: { id: runId },
    data: updateData,
  });

  // Build instructions with feedback injected
  let instructions: any;
  let nextAction: any;

  const feedbackPrefix = params.feedback
    ? `**RETRY FEEDBACK:** ${params.feedback}\n\n---\n\n`
    : '';

  switch (phase) {
    case 'pre':
      instructions = {
        type: 'pre_execution',
        content: feedbackPrefix + (currentState.preExecutionInstructions || 'No pre-execution instructions.'),
        isRetry: true,
        retryCount: (checkpoint.retryHistory?.filter(r => r.stateId === checkpoint.currentStateId && r.phase === 'pre').length) || 1,
      };
      nextAction = {
        tool: 'advance_step',
        parameters: { runId },
        hint: 'Call advance_step when pre-execution is complete.',
      };
      break;

    case 'agent':
      if (!currentState.component) {
        instructions = {
          type: 'post_execution',
          content: 'No agent assigned. Proceeding to post-execution.',
        };
      } else {
        const config = currentState.component.config as Record<string, unknown> || {};

        // Inject feedback into component instructions
        const modifiedInputInstructions = params.feedback
          ? `**RETRY FEEDBACK:** ${params.feedback}\n\n---\n\n${currentState.component.inputInstructions || ''}`
          : currentState.component.inputInstructions;

        instructions = {
          type: 'agent_spawn',
          content: `${feedbackPrefix}Retry: Spawn the ${currentState.component.name} agent.`,
          component: {
            id: currentState.component.id,
            name: currentState.component.name,
            tools: (currentState.component.tools as string[]) || [],
            model: (config.modelId as string) || 'claude-sonnet-4-20250514',
            inputInstructions: modifiedInputInstructions || undefined,
            operationInstructions: currentState.component.operationInstructions || undefined,
            outputInstructions: currentState.component.outputInstructions || undefined,
          },
          isRetry: true,
          retryCount: (checkpoint.retryHistory?.filter(r => r.stateId === checkpoint.currentStateId && r.phase === 'agent').length) || 1,
        };
      }
      nextAction = {
        tool: 'advance_step',
        parameters: { runId, output: {} },
        hint: 'Call advance_step with agent output when complete.',
      };
      break;

    case 'post':
      instructions = {
        type: 'post_execution',
        content: feedbackPrefix + (currentState.postExecutionInstructions || 'No post-execution instructions.'),
        isRetry: true,
        retryCount: (checkpoint.retryHistory?.filter(r => r.stateId === checkpoint.currentStateId && r.phase === 'post').length) || 1,
      };
      nextAction = {
        tool: 'advance_step',
        parameters: { runId },
        hint: 'Call advance_step to proceed to next state.',
      };
      break;

    default:
      throw new Error(`Unknown phase: ${phase}`);
  }

  const totalStates = run.workflow.states.length;
  const completedCount = checkpoint.completedStates?.length || 0;
  const skippedCount = checkpoint.skippedStates?.length || 0;

  return {
    success: true,
    runId: run.id,

    // Current position
    currentState: {
      id: currentState.id,
      name: currentState.name,
      order: currentState.order,
      phase,
      phaseStatus: 'pending',
    },

    // Progress (unchanged)
    progress: {
      stateIndex: currentState.order,
      totalStates,
      completedStates: checkpoint.completedStates || [],
      percentComplete: totalStates > 0
        ? Math.round(((completedCount + skippedCount) / totalStates) * 100)
        : 0,
    },

    // Instructions with feedback injected
    instructions,

    nextAction,

    // Retry info
    retry: {
      reason: params.reason,
      feedback: params.feedback,
      retryCount: instructions.retryCount || 1,
      totalRetries: checkpoint.retryHistory?.length || 1,
    },

    // Context
    story: run.story ? {
      key: run.story.key,
      title: run.story.title,
    } : undefined,

    workflow: {
      id: run.workflow.id,
      name: run.workflow.name,
    },

    status: updateData.status || run.status,
    isPaused: false,

    message: `Retrying ${currentState.name}:${phase}${params.feedback ? ' with feedback' : ''}. ${params.reason || ''}`.trim(),
  };
}
