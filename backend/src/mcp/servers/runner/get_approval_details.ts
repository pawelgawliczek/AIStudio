/**
 * Get Approval Details Tool
 * Get detailed information about a specific approval request
 *
 * ST-148: Approval Gates - Human-in-the-Loop
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';

export const tool: Tool = {
  name: 'get_approval_details',
  description: 'Get approval details by requestId or runId. Returns status, context, and available actions.',
  inputSchema: {
    type: 'object',
    properties: {
      requestId: {
        type: 'string',
        description: 'Approval request UUID (direct lookup)',
      },
      runId: {
        type: 'string',
        description: 'Workflow run UUID (gets pending approval for this run)',
      },
    },
    required: [],
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
    requestId?: string;
    runId?: string;
  }
) {
  if (!params.requestId && !params.runId) {
    throw new Error('Either requestId or runId is required');
  }

  let approval;

  if (params.requestId) {
    approval = await prisma.approvalRequest.findUnique({
      where: { id: params.requestId },
      include: {
        workflowRun: {
          include: {
            story: {
              select: {
                id: true,
                key: true,
                title: true,
                status: true,
              },
            },
            workflow: {
              select: {
                id: true,
                name: true,
              },
            },
            project: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        state: {
          select: {
            id: true,
            name: true,
            order: true,
            requiresApproval: true,
            preExecutionInstructions: true,
            postExecutionInstructions: true,
          },
        },
      },
    });
  } else if (params.runId) {
    approval = await prisma.approvalRequest.findFirst({
      where: {
        workflowRunId: params.runId,
        status: 'pending',
      },
      include: {
        workflowRun: {
          include: {
            story: {
              select: {
                id: true,
                key: true,
                title: true,
                status: true,
              },
            },
            workflow: {
              select: {
                id: true,
                name: true,
              },
            },
            project: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        state: {
          select: {
            id: true,
            name: true,
            order: true,
            requiresApproval: true,
            preExecutionInstructions: true,
            postExecutionInstructions: true,
          },
        },
      },
      orderBy: { requestedAt: 'desc' },
    });
  }

  if (!approval) {
    if (params.requestId) {
      throw new Error(`Approval request not found: ${params.requestId}`);
    } else {
      return {
        success: true,
        found: false,
        message: `No pending approval found for run ${params.runId}`,
      };
    }
  }

  const now = new Date();
  const waitingMinutes = approval.status === 'pending'
    ? Math.floor((now.getTime() - approval.requestedAt.getTime()) / 60000)
    : null;

  return {
    success: true,
    found: true,
    approval: {
      id: approval.id,
      status: approval.status,
      stateName: approval.stateName,
      stateOrder: approval.stateOrder,
      requestedBy: approval.requestedBy,
      requestedAt: approval.requestedAt.toISOString(),
      waitingMinutes,
      contextSummary: approval.contextSummary,
      artifactKeys: approval.artifactKeys,
      tokensUsed: approval.tokensUsed,
      // Resolution (if resolved)
      resolvedAt: approval.resolvedAt?.toISOString() || null,
      resolvedBy: approval.resolvedBy,
      resolution: approval.resolution,
      reason: approval.reason,
      reExecutionMode: approval.reExecutionMode,
      feedback: approval.feedback,
      editedArtifacts: approval.editedArtifacts,
    },
    workflowRun: {
      id: approval.workflowRun.id,
      status: approval.workflowRun.status,
      startedAt: approval.workflowRun.startedAt.toISOString(),
      story: approval.workflowRun.story,
      workflow: approval.workflowRun.workflow,
      project: approval.workflowRun.project,
    },
    state: approval.state,
    // Actions available based on status
    availableActions: approval.status === 'pending'
      ? ['approve', 'rerun', 'reject']
      : [],
    hint: approval.status === 'pending'
      ? 'Use respond_to_approval({ runId, action, decidedBy }) to approve, rerun with feedback, or reject'
      : `Approval already resolved: ${approval.resolution}`,
  };
}
