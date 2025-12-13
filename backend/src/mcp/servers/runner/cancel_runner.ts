/**
 * Cancel Runner Tool
 * Cancel a running or paused Story Runner execution
 *
 * ST-145: Story Runner - Terminal First Implementation
 * ST-187: Added story key resolution
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import { resolveRunId } from '../../shared/resolve-identifiers';

export const tool: Tool = {
  name: 'cancel_runner',
  description: 'Cancel workflow execution. Sets status to cancelled; cannot be resumed.',
  inputSchema: {
    type: 'object',
    properties: {
      story: {
        type: 'string',
        description: 'Story key (e.g., ST-123) or UUID - resolves to active workflow run',
      },
      runId: {
        type: 'string',
        description: 'WorkflowRun ID to cancel (alternative to story)',
      },
      reason: {
        type: 'string',
        description: 'Reason for cancellation (optional)',
      },
    },
  },
};

export const metadata = {
  category: 'runner',
  domain: 'Story Runner',
  tags: ['runner', 'cancel', 'control'],
  version: '1.0.0',
  since: '2025-11-29',
};

export async function handler(prisma: PrismaClient, params: {
  story?: string;
  runId?: string;
  reason?: string;
}) {
  const { reason = 'Cancelled via MCP tool' } = params;

  // ST-187: Resolve story key or runId to actual run
  if (!params.story && !params.runId) {
    throw new Error('Either story or runId is required');
  }

  const resolved = await resolveRunId(prisma, {
    story: params.story,
    runId: params.runId,
  });
  const runId = resolved.id;

  // Get workflow run
  const run = await prisma.workflowRun.findUnique({
    where: { id: runId },
  });

  if (!run) {
    throw new Error(`WorkflowRun not found: ${runId}`);
  }

  // Check if run can be cancelled
  if (['completed', 'cancelled'].includes(run.status)) {
    return {
      success: true,
      runId,
      story: resolved.story ? {
        key: resolved.story.key,
        title: resolved.story.title,
      } : undefined,
      status: run.status,
      message: `Run already ${run.status}. No action needed.`,
    };
  }

  // Update run status to cancelled
  await prisma.workflowRun.update({
    where: { id: runId },
    data: {
      status: 'cancelled',
      finishedAt: new Date(),
      errorMessage: reason,
      metadata: {
        ...(run.metadata as Record<string, unknown> || {}),
        cancelledAt: new Date().toISOString(),
        cancelledBy: 'mcp-tool',
        cancelReason: reason,
      },
    },
  });

  return {
    success: true,
    runId,
    story: resolved.story ? {
      key: resolved.story.key,
      title: resolved.story.title,
    } : undefined,
    status: 'cancelled',
    reason,
    message: `Run ${runId}${resolved.story ? ` (${resolved.story.key})` : ''} has been cancelled.`,
    previousStatus: run.status,
  };
}
