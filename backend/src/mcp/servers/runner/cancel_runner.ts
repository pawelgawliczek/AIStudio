/**
 * Cancel Runner Tool
 * Cancel a running or paused Story Runner execution
 *
 * ST-145: Story Runner - Terminal First Implementation
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';

export const tool: Tool = {
  name: 'cancel_runner',
  description: `Cancel a running or paused Story Runner execution.

The runner will:
1. Stop all execution immediately
2. Save final checkpoint
3. Update status to 'cancelled'
4. Clean up resources

Cancelled runs cannot be resumed.

**Usage:**
\`\`\`typescript
cancel_runner({
  runId: "uuid-here",
  reason: "No longer needed"
})
\`\`\``,
  inputSchema: {
    type: 'object',
    properties: {
      runId: {
        type: 'string',
        description: 'WorkflowRun ID to cancel (required)',
      },
      reason: {
        type: 'string',
        description: 'Reason for cancellation (optional)',
      },
    },
    required: ['runId'],
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
  runId: string;
  reason?: string;
}) {
  const { runId, reason = 'Cancelled via MCP tool' } = params;

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
    status: 'cancelled',
    reason,
    message: `Run ${runId} has been cancelled.`,
    previousStatus: run.status,
  };
}
