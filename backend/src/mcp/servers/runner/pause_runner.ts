/**
 * Pause Runner Tool
 * Pause a running Story Runner execution
 *
 * ST-145: Story Runner - Terminal First Implementation
 * ST-187: Added story key resolution
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import { resolveRunId } from '../../shared/resolve-identifiers';

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
// Using story key (preferred)
pause_runner({
  story: "ST-123",
  reason: "Manual pause for review"
})

// Using run ID
pause_runner({
  runId: "uuid-here",
  reason: "Manual pause for review"
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
        description: 'WorkflowRun ID to pause (alternative to story)',
      },
      reason: {
        type: 'string',
        description: 'Reason for pausing (optional)',
      },
    },
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
  story?: string;
  runId?: string;
  reason?: string;
}) {
  const { reason = 'Manual pause via MCP tool' } = params;

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
    // ST-187: Include story info if resolved from story key
    story: resolved.story ? {
      key: resolved.story.key,
      title: resolved.story.title,
    } : undefined,
    status: 'pause_requested',
    reason,
    message: `Pause requested for run ${runId}${resolved.story ? ` (${resolved.story.key})` : ''}. The runner will pause after completing the current operation.`,
    note: 'Use get_runner_status to verify pause completion. Use resume_runner to continue.',
  };
}
