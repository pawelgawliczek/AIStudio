/**
 * Set Breakpoint Tool
 * Add a breakpoint to pause Story Runner execution at a specific state
 *
 * ST-146: Breakpoint System - Pause/Resume/Step Control
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient, BreakpointPosition, Prisma } from '@prisma/client';

export const tool: Tool = {
  name: 'set_breakpoint',
  description: `Add a breakpoint to pause Story Runner execution at a specific state.

Breakpoints can be set to pause:
- **before**: Pause before the state's agent executes
- **after**: Pause after the state completes (including post-execution instructions)

**State Identification:**
You can identify the target state using any of:
- stateId: Direct UUID reference
- stateName: State name (e.g., "analysis", "implementation")
- stateOrder: Execution order (1, 2, 3...)

**Conditional Breakpoints:**
Use the condition parameter with MongoDB-style operators:
- \`{ "tokenCount": { "$gt": 10000 } }\` - Pause if tokens exceed 10k
- \`{ "agentSpawns": { "$gte": 5 } }\` - Pause if 5+ agents spawned
- \`{ "$and": [...] }\` - Combine conditions

**Usage:**
\`\`\`typescript
// By state name
set_breakpoint({
  runId: "uuid-here",
  stateName: "implementation",
  position: "before"
})

// With condition
set_breakpoint({
  runId: "uuid-here",
  stateId: "state-uuid",
  position: "after",
  condition: { "tokenCount": { "$gt": 50000 } }
})
\`\`\``,
  inputSchema: {
    type: 'object',
    properties: {
      runId: {
        type: 'string',
        description: 'WorkflowRun ID (required)',
      },
      stateId: {
        type: 'string',
        description: 'WorkflowState UUID (provide this OR stateName OR stateOrder)',
      },
      stateName: {
        type: 'string',
        description: 'State name (e.g., "analysis"). Requires runId for lookup.',
      },
      stateOrder: {
        type: 'number',
        description: 'Execution order (1-indexed). Requires runId for lookup.',
      },
      position: {
        type: 'string',
        enum: ['before', 'after'],
        description: 'When to pause: "before" (pre-agent) or "after" (post-agent). Default: "before"',
      },
      condition: {
        type: 'object',
        description: 'Optional JSON condition for conditional breakpoints',
      },
    },
    required: ['runId'],
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
  runId: string;
  stateId?: string;
  stateName?: string;
  stateOrder?: number;
  position?: 'before' | 'after';
  condition?: Record<string, unknown>;
}) {
  const { runId, stateId, stateName, stateOrder, position = 'before', condition } = params;

  // Validate at least one state identifier provided
  if (!stateId && !stateName && stateOrder === undefined) {
    throw new Error('Must provide stateId, stateName, or stateOrder');
  }

  // Get workflow run with workflow info
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

  // Resolve state ID
  let resolvedStateId: string;
  let resolvedStateName: string;
  let resolvedStateOrder: number;

  if (stateId) {
    // Direct state ID lookup
    const state = run.workflow.states.find(s => s.id === stateId);
    if (!state) {
      throw new Error(`State ${stateId} not found in workflow ${run.workflowId}`);
    }
    resolvedStateId = state.id;
    resolvedStateName = state.name;
    resolvedStateOrder = state.order;
  } else if (stateName) {
    // Lookup by name
    const state = run.workflow.states.find(s => s.name.toLowerCase() === stateName.toLowerCase());
    if (!state) {
      throw new Error(`State '${stateName}' not found in workflow. Available states: ${run.workflow.states.map(s => s.name).join(', ')}`);
    }
    resolvedStateId = state.id;
    resolvedStateName = state.name;
    resolvedStateOrder = state.order;
  } else {
    // Lookup by order (1-indexed)
    const state = run.workflow.states.find(s => s.order === stateOrder);
    if (!state) {
      throw new Error(`State at order ${stateOrder} not found. Workflow has ${run.workflow.states.length} states.`);
    }
    resolvedStateId = state.id;
    resolvedStateName = state.name;
    resolvedStateOrder = state.order;
  }

  // Check if breakpoint already exists (upsert behavior)
  const existingBreakpoint = await prisma.runnerBreakpoint.findUnique({
    where: {
      workflowRunId_stateId_position: {
        workflowRunId: runId,
        stateId: resolvedStateId,
        position: position as BreakpointPosition,
      },
    },
  });

  let result;
  let status: 'created' | 'reactivated' | 'updated';

  if (existingBreakpoint) {
    if (existingBreakpoint.isActive && !condition) {
      // Already active with no condition change
      return {
        success: true,
        status: 'already_exists',
        breakpointId: existingBreakpoint.id,
        stateName: resolvedStateName,
        stateOrder: resolvedStateOrder,
        position,
        isActive: true,
        condition: existingBreakpoint.condition,
        message: `Breakpoint already exists at ${position} ${resolvedStateName}`,
      };
    }

    // Reactivate or update condition
    result = await prisma.runnerBreakpoint.update({
      where: { id: existingBreakpoint.id },
      data: {
        isActive: true,
        condition: condition ? (condition as Prisma.InputJsonValue) : existingBreakpoint.condition,
        hitAt: null, // Reset hit timestamp on reactivation
      },
    });
    status = existingBreakpoint.isActive ? 'updated' : 'reactivated';
  } else {
    // Create new breakpoint
    result = await prisma.runnerBreakpoint.create({
      data: {
        workflowRunId: runId,
        stateId: resolvedStateId,
        position: position as BreakpointPosition,
        isActive: true,
        condition: condition ? (condition as Prisma.InputJsonValue) : undefined,
        isTemporary: false,
      },
    });
    status = 'created';
  }

  // Update breakpointsModifiedAt in run metadata for sync
  await prisma.workflowRun.update({
    where: { id: runId },
    data: {
      metadata: {
        ...(run.metadata as Record<string, unknown> || {}),
        breakpointsModifiedAt: new Date().toISOString(),
      },
    },
  });

  return {
    success: true,
    status,
    breakpointId: result.id,
    stateName: resolvedStateName,
    stateOrder: resolvedStateOrder,
    position,
    isActive: true,
    condition: result.condition,
    message: `Breakpoint ${status} at ${position} ${resolvedStateName}`,
    note: 'Use list_breakpoints to see all breakpoints. Use clear_breakpoint to remove.',
  };
}
