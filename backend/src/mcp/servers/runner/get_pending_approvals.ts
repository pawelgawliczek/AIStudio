/**
 * Get Pending Approvals Tool
 * List pending approval requests with optional filters
 *
 * ST-148: Approval Gates - Human-in-the-Loop
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient, Prisma } from '@prisma/client';

export const tool: Tool = {
  name: 'get_pending_approvals',
  description: `List pending approval requests awaiting human decision.

**Filters:**
- \`projectId\`: Filter by project
- \`workflowId\`: Filter by workflow (team)
- \`runId\`: Filter by specific workflow run

**Returns:**
- List of pending approvals with story context
- Waiting time in minutes for each
- Pagination support

**Example - All pending for project:**
\`\`\`typescript
get_pending_approvals({
  projectId: "uuid-here"
})
\`\`\`

**Example - Specific run:**
\`\`\`typescript
get_pending_approvals({
  runId: "uuid-here"
})
\`\`\``,
  inputSchema: {
    type: 'object',
    properties: {
      projectId: {
        type: 'string',
        description: 'Filter by project UUID',
      },
      workflowId: {
        type: 'string',
        description: 'Filter by workflow/team UUID',
      },
      runId: {
        type: 'string',
        description: 'Filter by workflow run UUID',
      },
      page: {
        type: 'number',
        description: 'Page number (default: 1)',
      },
      pageSize: {
        type: 'number',
        description: 'Items per page (default: 20, max: 100)',
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
    projectId?: string;
    workflowId?: string;
    runId?: string;
    page?: number;
    pageSize?: number;
  }
) {
  const page = params.page || 1;
  const pageSize = Math.min(params.pageSize || 20, 100);
  const skip = (page - 1) * pageSize;

  const where: Prisma.ApprovalRequestWhereInput = {
    status: 'pending',
  };

  if (params.projectId) {
    where.projectId = params.projectId;
  }

  if (params.runId) {
    where.workflowRunId = params.runId;
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
    requestedBy: approval.requestedBy,
    requestedAt: approval.requestedAt.toISOString(),
    waitingMinutes: Math.floor((now.getTime() - approval.requestedAt.getTime()) / 60000),
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

  return {
    success: true,
    approvals: mappedApprovals,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
    summary: {
      pendingCount: total,
      oldestWaitingMinutes: mappedApprovals.length > 0 ? mappedApprovals[0].waitingMinutes : 0,
    },
  };
}
