/**
 * Manage Breakpoints Tool
 * Consolidated tool for managing Story Runner breakpoints
 *
 * ST-187: MCP Tool Optimization & Step Commands
 *
 * Consolidates: set_breakpoint, clear_breakpoint, list_breakpoints
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient, BreakpointPosition, Prisma } from '@prisma/client';
import { resolveRunId } from '../../shared/resolve-identifiers';

export const tool: Tool = {
  name: 'manage_breakpoints',
  description: 'Set/clear/list breakpoints: action=set adds breakpoint, action=clear removes, action=list shows all.',
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
      action: {
        type: 'string',
        enum: ['set', 'clear', 'list'],
        description: 'Action to perform: set, clear, or list',
      },
      // State identification (for set/clear)
      stateId: {
        type: 'string',
        description: 'WorkflowState UUID',
      },
      stateName: {
        type: 'string',
        description: 'State name (e.g., "analysis", "implementation")',
      },
      stateOrder: {
        type: 'number',
        description: 'Execution order (1-indexed)',
      },
      position: {
        type: 'string',
        enum: ['before', 'after'],
        description: 'When to pause: "before" (pre-agent) or "after" (post-agent). Default: "before"',
      },
      // For set action
      condition: {
        type: 'object',
        description: 'Optional JSON condition for conditional breakpoints',
      },
      // For clear action
      breakpointId: {
        type: 'string',
        description: 'Specific breakpoint UUID to clear',
      },
      clearAll: {
        type: 'boolean',
        description: 'Clear ALL breakpoints for the run',
      },
      // For list action
      includeInactive: {
        type: 'boolean',
        description: 'Include cleared/inactive breakpoints in list (default: false)',
      },
    },
    required: ['action'],
  },
};

export const metadata = {
  category: 'runner',
  domain: 'Story Runner',
  tags: ['runner', 'breakpoint', 'debug', 'control', 'consolidated'],
  version: '1.0.0',
  since: '2025-12-08',
};

export async function handler(prisma: PrismaClient, params: {
  story?: string;
  runId?: string;
  action: 'set' | 'clear' | 'list';
  stateId?: string;
  stateName?: string;
  stateOrder?: number;
  position?: 'before' | 'after';
  condition?: Record<string, unknown>;
  breakpointId?: string;
  clearAll?: boolean;
  includeInactive?: boolean;
}) {
  const { action } = params;

  // Resolve story/runId (except when clearing by breakpointId only)
  if (params.breakpointId && action === 'clear' && !params.story && !params.runId) {
    // Special case: clearing by breakpointId doesn't need run resolution
    return handleClearByBreakpointId(prisma, params.breakpointId);
  }

  if (!params.story && !params.runId) {
    throw new Error('Either story or runId is required');
  }

  const resolved = await resolveRunId(prisma, {
    story: params.story,
    runId: params.runId,
  });
  const runId = resolved.id;
  const storyInfo = resolved.story ? {
    key: resolved.story.key,
    title: resolved.story.title,
  } : undefined;

  switch (action) {
    case 'set':
      return handleSet(prisma, runId, params, storyInfo);
    case 'clear':
      return handleClear(prisma, runId, params, storyInfo);
    case 'list':
      return handleList(prisma, runId, params, storyInfo);
    default:
      throw new Error(`Invalid action: ${action}. Must be set, clear, or list.`);
  }
}

async function handleSet(
  prisma: PrismaClient,
  runId: string,
  params: any,
  storyInfo?: { key: string; title: string }
) {
  const { stateId, stateName, stateOrder, position = 'before', condition } = params;

  // Validate at least one state identifier provided
  if (!stateId && !stateName && stateOrder === undefined) {
    throw new Error('Must provide stateId, stateName, or stateOrder for set action');
  }

  // Get workflow run with workflow info
  const run = await prisma.workflowRun.findUnique({
    where: { id: runId },
    include: {
      workflow: {
        include: {
          states: { orderBy: { order: 'asc' } },
        },
      },
    },
  });

  if (!run) {
    throw new Error(`WorkflowRun not found: ${runId}`);
  }

  // Resolve state
  const { resolvedStateId, resolvedStateName, resolvedStateOrder } = resolveState(
    run.workflow.states,
    { stateId, stateName, stateOrder }
  );

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
  let status: 'created' | 'reactivated' | 'updated' | 'already_exists';

  if (existingBreakpoint) {
    if (existingBreakpoint.isActive && !condition) {
      return {
        success: true,
        action: 'set',
        status: 'already_exists',
        breakpointId: existingBreakpoint.id,
        story: storyInfo,
        stateName: resolvedStateName,
        stateOrder: resolvedStateOrder,
        position,
        isActive: true,
        condition: existingBreakpoint.condition,
        message: `Breakpoint already exists at ${position} ${resolvedStateName}`,
      };
    }

    result = await prisma.runnerBreakpoint.update({
      where: { id: existingBreakpoint.id },
      data: {
        isActive: true,
        condition: condition ? (condition as Prisma.InputJsonValue) : (existingBreakpoint.condition ?? undefined),
        hitAt: null,
      },
    });
    status = existingBreakpoint.isActive ? 'updated' : 'reactivated';
  } else {
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

  // Update sync timestamp
  await updateBreakpointsModifiedAt(prisma, runId, run.metadata as Record<string, unknown>);

  return {
    success: true,
    action: 'set',
    status,
    breakpointId: result.id,
    runId,
    story: storyInfo,
    stateName: resolvedStateName,
    stateOrder: resolvedStateOrder,
    position,
    isActive: true,
    condition: result.condition,
    message: `Breakpoint ${status} at ${position} ${resolvedStateName}${storyInfo ? ` (${storyInfo.key})` : ''}`,
  };
}

async function handleClear(
  prisma: PrismaClient,
  runId: string,
  params: any,
  storyInfo?: { key: string; title: string }
) {
  const { breakpointId, stateId, stateName, stateOrder, position, clearAll } = params;

  // Mode 1: Clear by breakpoint ID
  if (breakpointId) {
    return handleClearByBreakpointId(prisma, breakpointId, storyInfo);
  }

  // Mode 2: Clear all breakpoints
  if (clearAll) {
    const breakpoints = await prisma.runnerBreakpoint.findMany({
      where: { workflowRunId: runId },
      include: { state: true },
    });

    if (breakpoints.length === 0) {
      return {
        success: true,
        action: 'clear',
        clearedCount: 0,
        runId,
        story: storyInfo,
        message: 'No breakpoints to clear',
      };
    }

    await prisma.runnerBreakpoint.deleteMany({
      where: { workflowRunId: runId },
    });

    const run = await prisma.workflowRun.findUnique({
      where: { id: runId },
      select: { metadata: true },
    });
    await updateBreakpointsModifiedAt(prisma, runId, run?.metadata as Record<string, unknown>);

    return {
      success: true,
      action: 'clear',
      clearedCount: breakpoints.length,
      runId,
      story: storyInfo,
      breakpoints: breakpoints.map(bp => ({
        id: bp.id,
        stateName: bp.state.name,
        position: bp.position,
      })),
      message: `Cleared ${breakpoints.length} breakpoint(s)${storyInfo ? ` for ${storyInfo.key}` : ''}`,
    };
  }

  // Mode 3: Clear by state + position
  if (!position) {
    throw new Error('Position is required when clearing by state. Use clearAll: true to clear all breakpoints.');
  }

  const run = await prisma.workflowRun.findUnique({
    where: { id: runId },
    include: {
      workflow: {
        include: {
          states: { orderBy: { order: 'asc' } },
        },
      },
    },
  });

  if (!run) {
    throw new Error(`WorkflowRun not found: ${runId}`);
  }

  const { resolvedStateId, resolvedStateName } = resolveState(
    run.workflow.states,
    { stateId, stateName, stateOrder }
  );

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
      action: 'clear',
      clearedCount: 0,
      runId,
      story: storyInfo,
      message: `No breakpoint found at ${position} ${resolvedStateName}`,
    };
  }

  await prisma.runnerBreakpoint.delete({
    where: { id: breakpoint.id },
  });

  await updateBreakpointsModifiedAt(prisma, runId, run.metadata as Record<string, unknown>);

  return {
    success: true,
    action: 'clear',
    clearedCount: 1,
    runId,
    story: storyInfo,
    breakpoints: [{
      id: breakpoint.id,
      stateName: resolvedStateName,
      position,
    }],
    message: `Cleared breakpoint at ${position} ${resolvedStateName}${storyInfo ? ` (${storyInfo.key})` : ''}`,
  };
}

async function handleClearByBreakpointId(
  prisma: PrismaClient,
  breakpointId: string,
  storyInfo?: { key: string; title: string }
) {
  const breakpoint = await prisma.runnerBreakpoint.findUnique({
    where: { id: breakpointId },
    include: { state: true },
  });

  if (!breakpoint) {
    return {
      success: true,
      action: 'clear',
      clearedCount: 0,
      story: storyInfo,
      message: 'Breakpoint not found (may have been already cleared)',
    };
  }

  await prisma.runnerBreakpoint.delete({
    where: { id: breakpointId },
  });

  const run = await prisma.workflowRun.findUnique({
    where: { id: breakpoint.workflowRunId },
    select: { metadata: true },
  });
  await updateBreakpointsModifiedAt(prisma, breakpoint.workflowRunId, run?.metadata as Record<string, unknown>);

  return {
    success: true,
    action: 'clear',
    clearedCount: 1,
    story: storyInfo,
    breakpoints: [{
      id: breakpoint.id,
      stateName: breakpoint.state.name,
      position: breakpoint.position,
    }],
    message: `Cleared breakpoint at ${breakpoint.position} ${breakpoint.state.name}`,
  };
}

async function handleList(
  prisma: PrismaClient,
  runId: string,
  params: any,
  storyInfo?: { key: string; title: string }
) {
  const { includeInactive = false } = params;

  const run = await prisma.workflowRun.findUnique({
    where: { id: runId },
    include: {
      workflow: {
        include: {
          states: { orderBy: { order: 'asc' } },
        },
      },
    },
  });

  if (!run) {
    throw new Error(`WorkflowRun not found: ${runId}`);
  }

  const whereClause = includeInactive
    ? { workflowRunId: runId }
    : { workflowRunId: runId, isActive: true };

  const breakpoints = await prisma.runnerBreakpoint.findMany({
    where: whereClause,
    include: { state: true },
    orderBy: [
      { state: { order: 'asc' } },
      { position: 'asc' },
    ],
  });

  const activeBreakpoints = breakpoints.filter(bp => bp.isActive);
  const hitBreakpoints = breakpoints.filter(bp => bp.hitAt !== null);

  return {
    success: true,
    action: 'list',
    runId,
    runStatus: run.status,
    story: storyInfo,
    totalStates: run.workflow.states.length,
    breakpoints: breakpoints.map(bp => ({
      id: bp.id,
      stateId: bp.stateId,
      stateName: bp.state.name,
      stateOrder: bp.state.order,
      position: bp.position,
      isActive: bp.isActive,
      isTemporary: bp.isTemporary,
      condition: bp.condition,
      hitAt: bp.hitAt?.toISOString() || null,
      createdAt: bp.createdAt.toISOString(),
    })),
    summary: {
      total: breakpoints.length,
      active: activeBreakpoints.length,
      inactive: breakpoints.length - activeBreakpoints.length,
      hit: hitBreakpoints.length,
    },
    message: `Found ${activeBreakpoints.length} active breakpoint(s)${storyInfo ? ` for ${storyInfo.key}` : ''}`,
  };
}

function resolveState(
  states: Array<{ id: string; name: string; order: number }>,
  params: { stateId?: string; stateName?: string; stateOrder?: number }
): { resolvedStateId: string; resolvedStateName: string; resolvedStateOrder: number } {
  const { stateId, stateName, stateOrder } = params;

  if (stateId) {
    const state = states.find(s => s.id === stateId);
    if (!state) throw new Error(`State ${stateId} not found in workflow`);
    return { resolvedStateId: state.id, resolvedStateName: state.name, resolvedStateOrder: state.order };
  }

  if (stateName) {
    const state = states.find(s => s.name.toLowerCase() === stateName.toLowerCase());
    if (!state) throw new Error(`State '${stateName}' not found. Available: ${states.map(s => s.name).join(', ')}`);
    return { resolvedStateId: state.id, resolvedStateName: state.name, resolvedStateOrder: state.order };
  }

  if (stateOrder !== undefined) {
    const state = states.find(s => s.order === stateOrder);
    if (!state) throw new Error(`State at order ${stateOrder} not found. Workflow has ${states.length} states.`);
    return { resolvedStateId: state.id, resolvedStateName: state.name, resolvedStateOrder: state.order };
  }

  throw new Error('Must provide stateId, stateName, or stateOrder');
}

async function updateBreakpointsModifiedAt(
  prisma: PrismaClient,
  runId: string,
  existingMetadata?: Record<string, unknown>
) {
  await prisma.workflowRun.update({
    where: { id: runId },
    data: {
      metadata: {
        ...(existingMetadata || {}),
        breakpointsModifiedAt: new Date().toISOString(),
      },
    },
  });
}
