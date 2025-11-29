/**
 * Pause Runner Tool
 * Pause a running Story Runner execution
 *
 * ST-145: Story Runner - Terminal First Implementation
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';

export const tool: Tool = {
  name: 'pause_runner',
  description: `Pause a running Story Runner execution.

The runner will:
1. Complete current operation (won't interrupt mid-agent)
2. Save checkpoint to database
3. Update status to 'paused'
4. Exit gracefully

Use resume_runner to continue execution later.

**Usage:**
\`\`\`typescript
pause_runner({
  runId: "uuid-here",
  reason: "Manual pause for review"
})
\`\`\``,
  inputSchema: {
    type: 'object',
    properties: {
      runId: {
        type: 'string',
        description: 'WorkflowRun ID to pause (required)',
      },
      reason: {
        type: 'string',
        description: 'Reason for pausing (optional)',
      },
    },
    required: ['runId'],
  },
};

export const metadata = {
  category: 'runner',
  domain: 'Story Runner',
  tags: ['runner', 'pause', 'control'],
  version: '1.0.0',
  since: '2025-11-29',
};

export async function handler(prisma: PrismaClient, params: {
  runId: string;
  reason?: string;
}) {
  const { runId, reason = 'Manual pause via MCP tool' } = params;

  // Get workflow run
  const run = await prisma.workflowRun.findUnique({
    where: { id: runId },
  });

  if (!run) {
    throw new Error(`WorkflowRun not found: ${runId}`);
  }

  // Check if run can be paused
  if (run.status !== 'running') {
    throw new Error(`Cannot pause run with status: ${run.status}. Only running runs can be paused.`);
  }

  if (run.isPaused) {
    return {
      success: true,
      runId,
      status: 'already_paused',
      message: `Run is already paused: ${run.pauseReason}`,
    };
  }

  // Update run status to trigger pause
  // The runner polls this status and will pause gracefully
  await prisma.workflowRun.update({
    where: { id: runId },
    data: {
      isPaused: true,
      pauseReason: reason,
      metadata: {
        ...(run.metadata as Record<string, unknown> || {}),
        pauseRequestedAt: new Date().toISOString(),
        pauseRequestedBy: 'mcp-tool',
      },
    },
  });

  return {
    success: true,
    runId,
    status: 'pause_requested',
    reason,
    message: `Pause requested for run ${runId}. The runner will pause after completing the current operation.`,
    note: 'Use get_runner_status to verify pause completion. Use resume_runner to continue.',
  };
}
