/**
 * Clear Breakpoint Tool
 * Remove breakpoints from a Story Runner execution
 *
 * ST-146: Breakpoint System - Pause/Resume/Step Control
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient, BreakpointPosition } from '@prisma/client';

export const tool: Tool = {
  name: 'clear_breakpoint',
  description: `Remove breakpoints from a Story Runner execution.

**Clearing Options:**
1. By breakpoint ID (most precise)
2. By state + position (convenient for single breakpoint)
3. Clear all breakpoints for a run

**Usage:**
\`\`\`typescript
// By breakpoint ID
clear_breakpoint({ breakpointId: "uuid-here" })

// By state name + position
clear_breakpoint({
  runId: "uuid-here",
  stateName: "implementation",
  position: "before"
})

// Clear all breakpoints for a run
clear_breakpoint({
  runId: "uuid-here",
  clearAll: true
})
\`\`\``,
  inputSchema: {
    type: 'object',
    properties: {
      breakpointId: {
        type: 'string',
        description: 'Specific breakpoint UUID to clear',
      },
      runId: {
        type: 'string',
        description: 'WorkflowRun ID (required for state-based or clearAll)',
      },
      stateId: {
        type: 'string',
        description: 'State UUID',
      },
      stateName: {
        type: 'string',
        description: 'State name',
      },
      stateOrder: {
        type: 'number',
        description: 'Execution order',
      },
      position: {
        type: 'string',
        enum: ['before', 'after'],
        description: 'Breakpoint position (required for state-based clearing)',
      },
      clearAll: {
        type: 'boolean',
        description: 'Clear ALL breakpoints for the run (requires runId)',
      },
    },
    required: [],
  },
};

export const metadata = {
  category: 'runner',
  domain: 'Story Runner',
  tags: ['runner', 'breakpoint', 'debug', 'control'],
  version: '1.0.0',
  since: '2025-11-30',
};

export async function handler(prisma: PrismaClient, params: {
  breakpointId?: string;
  runId?: string;
  stateId?: string;
  stateName?: string;
  stateOrder?: number;
  position?: 'before' | 'after';
  clearAll?: boolean;
}) {
  const { breakpointId, runId, stateId, stateName, stateOrder, position, clearAll } = params;

  // Mode 1: Clear by breakpoint ID
  if (breakpointId) {
    const breakpoint = await prisma.runnerBreakpoint.findUnique({
      where: { id: breakpointId },
      include: { state: true },
    });

    if (!breakpoint) {
      // Idempotent - no error if not found
      return {
        success: true,
        clearedCount: 0,
        message: 'Breakpoint not found (may have been already cleared)',
      };
    }

    await prisma.runnerBreakpoint.delete({
      where: { id: breakpointId },
    });

    // Update sync timestamp
    await updateBreakpointsModifiedAt(prisma, breakpoint.workflowRunId);

    return {
      success: true,
      clearedCount: 1,
      breakpoints: [{
        id: breakpoint.id,
        stateName: breakpoint.state.name,
        position: breakpoint.position,
      }],
      message: `Cleared breakpoint at ${breakpoint.position} ${breakpoint.state.name}`,
    };
  }

  // Mode 2 & 3 require runId
  if (!runId) {
    throw new Error('Must provide breakpointId OR runId with state info or clearAll');
  }

  // Mode 2: Clear all breakpoints for run
  if (clearAll) {
    const breakpoints = await prisma.runnerBreakpoint.findMany({
      where: { workflowRunId: runId },
      include: { state: true },
    });

    if (breakpoints.length === 0) {
      return {
        success: true,
        clearedCount: 0,
        message: 'No breakpoints to clear',
      };
    }

    await prisma.runnerBreakpoint.deleteMany({
      where: { workflowRunId: runId },
    });

    // Update sync timestamp
    await updateBreakpointsModifiedAt(prisma, runId);

    return {
      success: true,
      clearedCount: breakpoints.length,
      breakpoints: breakpoints.map(bp => ({
        id: bp.id,
        stateName: bp.state.name,
        position: bp.position,
      })),
      message: `Cleared ${breakpoints.length} breakpoint(s)`,
    };
  }

  // Mode 3: Clear by state + position
  if (!position) {
    throw new Error('Position is required when clearing by state. Use clearAll: true to clear all breakpoints.');
  }

  // Resolve state ID
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

  let resolvedStateId: string;
  let resolvedStateName: string;

  if (stateId) {
    const state = run.workflow.states.find(s => s.id === stateId);
    if (!state) {
      throw new Error(`State ${stateId} not found in workflow`);
    }
    resolvedStateId = state.id;
    resolvedStateName = state.name;
  } else if (stateName) {
    const state = run.workflow.states.find(s => s.name.toLowerCase() === stateName.toLowerCase());
    if (!state) {
      throw new Error(`State '${stateName}' not found in workflow`);
    }
    resolvedStateId = state.id;
    resolvedStateName = state.name;
  } else if (stateOrder !== undefined) {
    const state = run.workflow.states.find(s => s.order === stateOrder);
    if (!state) {
      throw new Error(`State at order ${stateOrder} not found`);
    }
    resolvedStateId = state.id;
    resolvedStateName = state.name;
  } else {
    throw new Error('Must provide stateId, stateName, or stateOrder');
  }

  // Find and delete the breakpoint
  const breakpoint = await prisma.runnerBreakpoint.findUnique({
    where: {
      workflowRunId_stateId_position: {
        workflowRunId: runId,
        stateId: resolvedStateId,
        position: position as BreakpointPosition,
      },
    },
  });

  if (!breakpoint) {
    return {
      success: true,
      clearedCount: 0,
      message: `No breakpoint found at ${position} ${resolvedStateName}`,
    };
  }

  await prisma.runnerBreakpoint.delete({
    where: { id: breakpoint.id },
  });

  // Update sync timestamp
  await updateBreakpointsModifiedAt(prisma, runId);

  return {
    success: true,
    clearedCount: 1,
    breakpoints: [{
      id: breakpoint.id,
      stateName: resolvedStateName,
      position,
    }],
    message: `Cleared breakpoint at ${position} ${resolvedStateName}`,
  };
}

/**
 * Update breakpointsModifiedAt in run metadata for runner sync
 */
async function updateBreakpointsModifiedAt(prisma: PrismaClient, runId: string) {
  const run = await prisma.workflowRun.findUnique({
    where: { id: runId },
    select: { metadata: true },
  });

  await prisma.workflowRun.update({
    where: { id: runId },
    data: {
      metadata: {
        ...(run?.metadata as Record<string, unknown> || {}),
        breakpointsModifiedAt: new Date().toISOString(),
      },
    },
  });
}
