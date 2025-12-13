/**
 * List Breakpoints Tool
 * List breakpoints for a Story Runner execution
 *
 * ST-146: Breakpoint System - Pause/Resume/Step Control
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';

export const tool: Tool = {
  name: 'list_breakpoints',
  description: 'List breakpoints for a run. Prefer manage_breakpoints consolidated tool.',
  inputSchema: {
    type: 'object',
    properties: {
      runId: {
        type: 'string',
        description: 'WorkflowRun ID (required)',
      },
      includeInactive: {
        type: 'boolean',
        description: 'Include cleared/inactive breakpoints (default: false)',
      },
    },
    required: ['runId'],
  },
};

export const metadata = {
  category: 'runner',
  domain: 'Story Runner',
  tags: ['runner', 'breakpoint', 'debug', 'list'],
  version: '1.0.0',
  since: '2025-11-30',
};

export async function handler(prisma: PrismaClient, params: {
  runId: string;
  includeInactive?: boolean;
}) {
  const { runId, includeInactive = false } = params;

  // Get workflow run with current state info
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

  // Get breakpoints
  const whereClause = includeInactive
    ? { workflowRunId: runId }
    : { workflowRunId: runId, isActive: true };

  const breakpoints = await prisma.runnerBreakpoint.findMany({
    where: whereClause,
    include: {
      state: true,
    },
    orderBy: [
      { state: { order: 'asc' } },
      { position: 'asc' },
    ],
  });

  // Calculate summary stats
  const activeBreakpoints = breakpoints.filter(bp => bp.isActive);
  const hitBreakpoints = breakpoints.filter(bp => bp.hitAt !== null);
  const beforeBreakpoints = breakpoints.filter(bp => bp.position === 'before');
  const afterBreakpoints = breakpoints.filter(bp => bp.position === 'after');
  const temporaryBreakpoints = breakpoints.filter(bp => bp.isTemporary);
  const conditionalBreakpoints = breakpoints.filter(bp => bp.condition !== null);

  // Format breakpoints
  const formattedBreakpoints = breakpoints.map(bp => ({
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
  }));

  return {
    success: true,
    runId,
    runStatus: run.status,
    totalStates: run.workflow.states.length,
    breakpoints: formattedBreakpoints,
    summary: {
      total: breakpoints.length,
      active: activeBreakpoints.length,
      inactive: breakpoints.length - activeBreakpoints.length,
      hit: hitBreakpoints.length,
      beforeBreakpoints: beforeBreakpoints.length,
      afterBreakpoints: afterBreakpoints.length,
      temporary: temporaryBreakpoints.length,
      conditional: conditionalBreakpoints.length,
    },
    note: 'Use set_breakpoint to add, clear_breakpoint to remove.',
  };
}
