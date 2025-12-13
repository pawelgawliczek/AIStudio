/**
 * Get Approvals Tool
 * Consolidated tool for querying approval requests
 *
 * ST-187: MCP Tool Optimization & Step Commands
 *
 * Consolidates: get_pending_approvals, get_approval_details
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient, Prisma } from '@prisma/client';
import { resolveRunId } from '../../shared/resolve-identifiers';

export const tool: Tool = {
  name: 'get_approvals',
  description: 'Query approvals: action=list for pending list, action=details for specific approval. Consolidates get_pending_approvals and get_approval_details.',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['list', 'details'],
        description: 'Action to perform: list or details',
      },
      // Story/run identification
      story: {
        type: 'string',
        description: 'Story key (e.g., ST-123) or UUID - resolves to active workflow run',
      },
      runId: {
        type: 'string',
        description: 'WorkflowRun ID (alternative to story)',
      },
      // For details action
      requestId: {
        type: 'string',
        description: 'Approval request UUID (direct lookup)',
      },
      // For list action - filters
      projectId: {
        type: 'string',
        description: 'Filter by project UUID',
      },
      workflowId: {
        type: 'string',
        description: 'Filter by workflow/team UUID',
      },
      status: {
        type: 'string',
        enum: ['pending', 'approved', 'rejected', 'all'],
        description: 'Filter by status (default: pending for list, all for details)',
      },
      // Pagination (for list action)
      page: {
        type: 'number',
        description: 'Page number (default: 1)',
      },
      pageSize: {
        type: 'number',
        description: 'Items per page (default: 20, max: 100)',
      },
    },
    required: ['action'],
  },
};

export const metadata = {
  category: 'runner',
  domain: 'Approval Gates',
  tags: ['runner', 'approval', 'human-in-the-loop', 'consolidated'],
  version: '1.0.0',
  since: '2025-12-08',
};

export async function handler(prisma: PrismaClient, params: {
  action: 'list' | 'details';
  story?: string;
  runId?: string;
  requestId?: string;
  projectId?: string;
  workflowId?: string;
  status?: 'pending' | 'approved' | 'rejected' | 'all';
  page?: number;
  pageSize?: number;
}) {
  const { action } = params;

  switch (action) {
    case 'list':
      return handleList(prisma, params);
    case 'details':
      return handleDetails(prisma, params);
    default:
      throw new Error(`Invalid action: ${action}. Must be list or details.`);
  }
}

async function handleList(
  prisma: PrismaClient,
  params: {
    story?: string;
    runId?: string;
    projectId?: string;
    workflowId?: string;
    status?: 'pending' | 'approved' | 'rejected' | 'all';
    page?: number;
    pageSize?: number;
  }
) {
  const page = params.page || 1;
  const pageSize = Math.min(params.pageSize || 20, 100);
  const skip = (page - 1) * pageSize;
  const statusFilter = params.status || 'pending';

  const where: Prisma.ApprovalRequestWhereInput = {};

  // Status filter
  if (statusFilter !== 'all') {
    where.status = statusFilter;
  }

  // Resolve story to runId if provided
  if (params.story || params.runId) {
    try {
      const resolved = await resolveRunId(prisma, {
        story: params.story,
        runId: params.runId,
      });
      where.workflowRunId = resolved.id;
    } catch {
      // If no active run, return empty list
      return {
        success: true,
        action: 'list',
        approvals: [],
        pagination: {
          page,
          pageSize,
          total: 0,
          totalPages: 0,
        },
        summary: {
          pendingCount: 0,
          oldestWaitingMinutes: 0,
        },
        message: `No active workflow run found for story ${params.story || params.runId}`,
      };
    }
  }

  if (params.projectId) {
    where.projectId = params.projectId;
  }

  if (params.workflowId) {
    where.workflowRun = {
      workflowId: params.workflowId,
    };
  }

  const [approvals, total] = await Promise.all([
    prisma.approvalRequest.findMany({
      where,
      include: {
        workflowRun: {
          include: {
            story: {
              select: {
                key: true,
                title: true,
              },
            },
            workflow: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: { requestedAt: 'asc' },
      skip,
      take: pageSize,
    }),
    prisma.approvalRequest.count({ where }),
  ]);

  const now = new Date();
  const mappedApprovals = approvals.map(approval => ({
    id: approval.id,
    runId: approval.workflowRunId,
    stateId: approval.stateId,
    stateName: approval.stateName,
    stateOrder: approval.stateOrder,
    status: approval.status,
    requestedBy: approval.requestedBy,
    requestedAt: approval.requestedAt.toISOString(),
    waitingMinutes: approval.status === 'pending'
      ? Math.floor((now.getTime() - approval.requestedAt.getTime()) / 60000)
      : null,
    resolvedAt: approval.resolvedAt?.toISOString() || null,
    resolvedBy: approval.resolvedBy,
    resolution: approval.resolution,
    contextSummary: approval.contextSummary,
    artifactKeys: approval.artifactKeys,
    tokensUsed: approval.tokensUsed,
    story: approval.workflowRun.story
      ? {
          key: approval.workflowRun.story.key,
          title: approval.workflowRun.story.title,
        }
      : null,
    workflow: approval.workflowRun.workflow
      ? {
          name: approval.workflowRun.workflow.name,
        }
      : null,
  }));

  const pendingApprovals = mappedApprovals.filter(a => a.status === 'pending');

  return {
    success: true,
    action: 'list',
    approvals: mappedApprovals,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
    summary: {
      pendingCount: pendingApprovals.length,
      oldestWaitingMinutes: pendingApprovals.length > 0 ? pendingApprovals[0].waitingMinutes : 0,
    },
  };
}

async function handleDetails(
  prisma: PrismaClient,
  params: {
    story?: string;
    runId?: string;
    requestId?: string;
  }
) {
  if (!params.requestId && !params.story && !params.runId) {
    throw new Error('Either requestId, story, or runId is required for details action');
  }

  let approval;

  if (params.requestId) {
    // Direct lookup by approval ID
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
  } else {
    // Resolve story/runId and find pending approval
    const resolved = await resolveRunId(prisma, {
      story: params.story,
      runId: params.runId,
    });

    approval = await prisma.approvalRequest.findFirst({
      where: {
        workflowRunId: resolved.id,
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
        action: 'details',
        found: false,
        message: `No pending approval found for ${params.story || params.runId}`,
      };
    }
  }

  const now = new Date();
  const waitingMinutes = approval.status === 'pending'
    ? Math.floor((now.getTime() - approval.requestedAt.getTime()) / 60000)
    : null;

  return {
    success: true,
    action: 'details',
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
