/**
 * Step Runner Tool
 * Execute one state and pause (debugging mode using temp breakpoint)
 *
 * ST-146: Breakpoint System - Pause/Resume/Step Control
 * ST-187: Added story key resolution
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient, BreakpointPosition } from '@prisma/client';
import { resolveRunId } from '../../shared/resolve-identifiers';

export const tool: Tool = {
  name: 'step_runner',
  description: `Execute one state and pause. Used for step-by-step debugging.

Works ONLY on paused runs:
1. Creates temporary breakpoint at the next state
2. Resumes execution
3. Runner executes current state
4. Runner hits temp breakpoint at next state, pauses
5. Temp breakpoint is auto-deleted after being hit

**Prerequisites:**
- Run must be in 'paused' status
- Use pause_runner first if run is active

**Usage:**
\`\`\`typescript
// Using story key (preferred)
step_runner({ story: "ST-123" })

// Using run ID
step_runner({ runId: "uuid-here" })
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
    },
  },
};

export const metadata = {
  category: 'runner',
  domain: 'Story Runner',
  tags: ['runner', 'breakpoint', 'debug', 'step', 'control'],
  version: '1.0.0',
  since: '2025-11-30',
};

export async function handler(prisma: PrismaClient, params: {
  story?: string;
  runId?: string;
}) {
  // ST-187: Resolve story key or runId to actual run
  if (!params.story && !params.runId) {
    throw new Error('Either story or runId is required');
  }

  const resolved = await resolveRunId(prisma, {
    story: params.story,
    runId: params.runId,
  });
  const runId = resolved.id;

  // Get workflow run with full state info
  const run = await prisma.workflowRun.findUnique({
    where: { id: runId },
    include: {
      workflow: {
        include: {
          states: {
            orderBy: { order: 'asc' },
          },
        },
      },
    },
  });

  if (!run) {
    throw new Error(`WorkflowRun not found: ${runId}`);
  }

  // Validate run status
  if (run.status === 'pending') {
    throw new Error('Run is pending. Use start_runner to begin execution.');
  }

  if (run.status === 'running' && !run.isPaused) {
    throw new Error('Run is actively running. Use pause_runner first, then step_runner.');
  }

  if (run.status === 'completed') {
    throw new Error('Run has completed. Cannot step through completed execution.');
  }

  if (run.status === 'failed') {
    throw new Error('Run has failed. Use resume_runner to retry or cancel_runner to abort.');
  }

  if (run.status === 'cancelled') {
    throw new Error('Run was cancelled. Cannot step through cancelled execution.');
  }

  // Get checkpoint to find current state
  const metadata = run.metadata as Record<string, unknown> | null;
  const checkpoint = metadata?.checkpoint as {
    currentStateId?: string;
    completedStates?: string[];
  } | null;

  if (!checkpoint?.currentStateId) {
    throw new Error('Run has no checkpoint. May not have started execution yet.');
  }

  // Find current and next state
  const currentStateIndex = run.workflow.states.findIndex(s => s.id === checkpoint.currentStateId);
  if (currentStateIndex === -1) {
    throw new Error(`Current state ${checkpoint.currentStateId} not found in workflow`);
  }

  const currentState = run.workflow.states[currentStateIndex];
  const nextState = run.workflow.states[currentStateIndex + 1];

  // If no next state, we're at the last state
  if (!nextState) {
    // Clear pause to let runner complete
    await prisma.workflowRun.update({
      where: { id: runId },
      data: {
        isPaused: false,
        pauseReason: null,
        metadata: {
          ...(metadata || {}),
          stepRequestedAt: new Date().toISOString(),
        },
      },
    });

    return {
      success: true,
      status: 'stepping_to_completion',
      runId,
      story: resolved.story ? {
        key: resolved.story.key,
        title: resolved.story.title,
      } : undefined,
      currentState: {
        id: currentState.id,
        name: currentState.name,
        order: currentState.order,
      },
      nextState: null,
      willPauseAt: 'completion',
      message: `Stepping through final state: ${currentState.name}${resolved.story ? ` (${resolved.story.key})` : ''}. Run will complete after this state.`,
      note: 'Use get_runner_status to monitor progress.',
    };
  }

  // Create temporary breakpoint at next state
  // First check if one already exists
  const existingBreakpoint = await prisma.runnerBreakpoint.findUnique({
    where: {
      workflowRunId_stateId_position: {
        workflowRunId: runId,
        stateId: nextState.id,
        position: 'before' as BreakpointPosition,
      },
    },
  });

  let tempBreakpointId: string;

  if (existingBreakpoint) {
    // Reuse existing breakpoint, mark as temporary
    await prisma.runnerBreakpoint.update({
      where: { id: existingBreakpoint.id },
      data: {
        isActive: true,
        isTemporary: true,
        hitAt: null,
      },
    });
    tempBreakpointId = existingBreakpoint.id;
  } else {
    // Create new temporary breakpoint
    const newBreakpoint = await prisma.runnerBreakpoint.create({
      data: {
        workflowRunId: runId,
        stateId: nextState.id,
        position: 'before' as BreakpointPosition,
        isActive: true,
        isTemporary: true,
      },
    });
    tempBreakpointId = newBreakpoint.id;
  }

  // Clear pause flag to resume execution
  await prisma.workflowRun.update({
    where: { id: runId },
    data: {
      isPaused: false,
      pauseReason: null,
      metadata: {
        ...(metadata || {}),
        breakpointsModifiedAt: new Date().toISOString(),
        stepRequestedAt: new Date().toISOString(),
        stepBreakpointId: tempBreakpointId,
      },
    },
  });

  return {
    success: true,
    status: 'stepping',
    runId,
    story: resolved.story ? {
      key: resolved.story.key,
      title: resolved.story.title,
    } : undefined,
    currentState: {
      id: currentState.id,
      name: currentState.name,
      order: currentState.order,
    },
    nextState: {
      id: nextState.id,
      name: nextState.name,
      order: nextState.order,
    },
    tempBreakpointId,
    willPauseAt: `before ${nextState.name}`,
    message: `Stepping${resolved.story ? ` (${resolved.story.key})` : ''}: will execute ${currentState.name} and pause before ${nextState.name}`,
    note: 'Use get_runner_status to monitor progress. Temp breakpoint will auto-delete when hit.',
  };
}
