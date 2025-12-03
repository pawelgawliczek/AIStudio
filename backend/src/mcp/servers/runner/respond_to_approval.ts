/**
 * Respond to Approval Tool
 * Handle human response to an approval gate (approve, rerun, reject)
 *
 * ST-148: Approval Gates - Human-in-the-Loop
 */

import { spawn } from 'child_process';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient, ApprovalResolution, ReExecutionMode } from '@prisma/client';
import { broadcastApprovalResolved } from '../../services/websocket-gateway.instance';

export const tool: Tool = {
  name: 'respond_to_approval',
  description: `Respond to a pending approval gate (approve, rerun, or reject).

**Actions:**
- \`approve\`: Continue to next state
- \`rerun\`: Re-execute current state with feedback injected into agent prompt
- \`reject\`: Cancel or pause workflow

**Behavior by action:**

| Action | Effect | WorkflowRun Status | Next Step |
|--------|--------|-------------------|-----------|
| approve | Continue to next state | Running | Runner resumes, moves to next state |
| rerun | Re-execute with feedback | Running | Runner resumes, re-executes same state |
| reject+cancel | Workflow cancelled | Cancelled | Must start new workflow run |
| reject+pause | Workflow paused | Paused | Can manually fix and resume later |

**Example - Approve:**
\`\`\`typescript
respond_to_approval({
  runId: "abc-123",
  action: "approve",
  decidedBy: "pawel"
})
\`\`\`

**Example - Rerun with feedback:**
\`\`\`typescript
respond_to_approval({
  runId: "abc-123",
  action: "rerun",
  decidedBy: "pawel",
  feedback: "Tests are failing. Fix the authentication test - mock should return 200"
})
\`\`\`

**Example - Reject but keep paused:**
\`\`\`typescript
respond_to_approval({
  runId: "abc-123",
  action: "reject",
  rejectMode: "pause",
  decidedBy: "pawel",
  reason: "Implementation doesn't meet requirements"
})
\`\`\``,
  inputSchema: {
    type: 'object',
    properties: {
      runId: {
        type: 'string',
        description: 'WorkflowRun ID (required)',
      },
      action: {
        type: 'string',
        enum: ['approve', 'rerun', 'reject'],
        description: 'Approval action (required)',
      },
      decidedBy: {
        type: 'string',
        description: 'Who made the decision (required)',
      },
      feedback: {
        type: 'string',
        description: 'Feedback instructions for rerun (required for rerun action)',
      },
      rejectMode: {
        type: 'string',
        enum: ['cancel', 'pause'],
        description: 'What to do on reject - cancel workflow or pause for manual fix (default: cancel)',
      },
      reason: {
        type: 'string',
        description: 'Reason for the decision (recommended for reject)',
      },
      notes: {
        type: 'string',
        description: 'Additional notes for audit trail',
      },
    },
    required: ['runId', 'action', 'decidedBy'],
  },
};

export const metadata = {
  category: 'runner',
  domain: 'Approval Gates',
  tags: ['runner', 'approval', 'human-in-the-loop', 'ST-148'],
  version: '1.0.0',
  since: '2025-11-30',
};

export async function handler(
  prisma: PrismaClient,
  params: {
    runId: string;
    action: 'approve' | 'rerun' | 'reject';
    decidedBy: string;
    feedback?: string;
    rejectMode?: 'cancel' | 'pause';
    reason?: string;
    notes?: string;
  }
) {
  const { runId, action, decidedBy, feedback, rejectMode = 'cancel', reason, notes } = params;

  // Get pending approval
  const pendingApproval = await prisma.approvalRequest.findFirst({
    where: {
      workflowRunId: runId,
      status: 'pending',
    },
    include: {
      workflowRun: {
        include: {
          story: {
            select: { key: true, title: true },
          },
          project: {
            select: { id: true },
          },
        },
      },
    },
  });

  if (!pendingApproval) {
    throw new Error(`No pending approval found for run ${runId}`);
  }

  let resolution: ApprovalResolution;
  let reExecutionMode: ReExecutionMode | null = null;
  let shouldResume = false;
  let shouldRerun = false;
  let newRunStatus: string | undefined;

  switch (action) {
    case 'approve':
      resolution = 'approved';
      reExecutionMode = 'none';
      shouldResume = true;
      shouldRerun = false;
      break;

    case 'rerun':
      if (!feedback) {
        throw new Error('Feedback is required for rerun action');
      }
      resolution = 'approved'; // Technically approved but with modifications
      reExecutionMode = 'feedback_injection';
      shouldResume = true;
      shouldRerun = true;
      break;

    case 'reject':
      resolution = 'rejected';
      reExecutionMode = null;
      shouldResume = false;
      newRunStatus = rejectMode === 'pause' ? 'paused' : 'cancelled';
      break;

    default:
      throw new Error(`Invalid action: ${action}`);
  }

  // Update approval request
  const updatedApproval = await prisma.approvalRequest.update({
    where: { id: pendingApproval.id },
    data: {
      status: resolution === 'rejected' ? 'rejected' : 'approved',
      resolvedAt: new Date(),
      resolvedBy: decidedBy,
      resolution,
      reason: reason || notes || null,
      reExecutionMode,
      feedback: feedback || null,
    },
  });

  // Update workflow run status if needed
  if (newRunStatus) {
    await prisma.workflowRun.update({
      where: { id: runId },
      data: {
        status: newRunStatus as any,
        ...(newRunStatus === 'cancelled' && { finishedAt: new Date() }),
      },
    });
  }

  // Broadcast WebSocket event
  try {
    await broadcastApprovalResolved(
      runId,
      pendingApproval.workflowRun.project.id,
      {
        requestId: updatedApproval.id,
        resolution: resolution,
        resolvedBy: decidedBy,
        reExecutionMode: reExecutionMode || undefined,
        storyKey: pendingApproval.workflowRun.story?.key,
      }
    );
  } catch (error) {
    console.warn(`[ST-148] Failed to broadcast approval resolved event: ${error}`);
  }

  // If approved or rerun, trigger resume_runner
  if (shouldResume) {
    // Store rerun info in metadata if needed
    if (shouldRerun && feedback) {
      const run = await prisma.workflowRun.findUnique({
        where: { id: runId },
        select: { metadata: true },
      });
      const existingMetadata = (run?.metadata as Record<string, unknown>) || {};

      await prisma.workflowRun.update({
        where: { id: runId },
        data: {
          metadata: {
            ...existingMetadata,
            approvalFeedback: feedback,
            shouldRerunCurrentState: true,
          },
        },
      });
    }

    // Spawn resume runner (detached)
    const args = [
      'compose',
      '-f', 'runner/docker-compose.runner.yml',
      'run',
      '--rm',
      '-d',
      'runner',
      'resume',
      '--run-id', runId,
    ];

    // Wrap spawn in a promise to properly catch async errors
    const spawnPromise = new Promise<boolean>((resolve) => {
      try {
        const dockerProcess = spawn('docker', args, {
          cwd: process.env.PROJECT_PATH || '/opt/stack/AIStudio',
          stdio: 'pipe',
          detached: true,
        });

        // Handle spawn errors (e.g., Docker not available)
        dockerProcess.on('error', (err) => {
          console.warn(`[ST-148] Failed to spawn resume runner: ${err}`);
          resolve(false);
        });

        // If spawn succeeds, unref and resolve
        dockerProcess.on('spawn', () => {
          dockerProcess.unref();
          resolve(true);
        });

        // Fallback timeout - if neither event fires in 2s, consider it a failure
        setTimeout(() => resolve(false), 2000);
      } catch (err) {
        console.warn(`[ST-148] Spawn error: ${err}`);
        resolve(false);
      }
    });

    const resumeTriggered = await spawnPromise;

    if (resumeTriggered) {
      // Update run status
      await prisma.workflowRun.update({
        where: { id: runId },
        data: {
          status: 'running',
          isPaused: false,
          pauseReason: null,
        },
      });
    }

    if (!resumeTriggered) {
      // Don't fail the approval - just return that resume needs manual trigger
      return {
        success: true,
        approval: {
          id: updatedApproval.id,
          status: updatedApproval.status,
          resolution,
          resolvedBy: decidedBy,
          resolvedAt: updatedApproval.resolvedAt?.toISOString(),
        },
        action,
        shouldResume,
        shouldRerun,
        resumeTriggered: false,
        message: `Approval recorded but resume failed to trigger. Use resume_runner({ runId: "${runId}" }) manually.`,
      };
    }

    return {
      success: true,
      approval: {
        id: updatedApproval.id,
        status: updatedApproval.status,
        resolution,
        resolvedBy: decidedBy,
        resolvedAt: updatedApproval.resolvedAt?.toISOString(),
      },
      action,
      shouldResume,
      shouldRerun,
      resumeTriggered: true,
      message: shouldRerun
        ? `State "${pendingApproval.stateName}" will be re-executed with feedback. Runner resuming.`
        : `State "${pendingApproval.stateName}" approved. Runner resuming to next state.`,
    };
  }

  // Reject case - no resume
  return {
    success: true,
    approval: {
      id: updatedApproval.id,
      status: updatedApproval.status,
      resolution,
      resolvedBy: decidedBy,
      resolvedAt: updatedApproval.resolvedAt?.toISOString(),
    },
    action,
    workflowStatus: newRunStatus,
    message: rejectMode === 'pause'
      ? `State "${pendingApproval.stateName}" rejected. Workflow paused for manual intervention. Use resume_runner after fixing.`
      : `State "${pendingApproval.stateName}" rejected. Workflow cancelled.`,
  };
}
