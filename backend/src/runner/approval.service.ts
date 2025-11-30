import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ApprovalStatus, ApprovalResolution, ReExecutionMode, Prisma } from '@prisma/client';

/**
 * Approval request data structure
 * ST-148: Approval Gates - Human-in-the-Loop
 */
export interface ApprovalRequestData {
  id: string;
  workflowRunId: string;
  stateId: string;
  projectId: string;
  stateName: string;
  stateOrder: number;
  requestedBy: string;
  requestedAt: Date;
  status: ApprovalStatus;
  contextSummary: string | null;
  artifactKeys: string[];
  tokensUsed: number;
  resolvedAt: Date | null;
  resolvedBy: string | null;
  resolution: ApprovalResolution | null;
  reason: string | null;
  reExecutionMode: ReExecutionMode | null;
  feedback: string | null;
  editedArtifacts: string[];
}

/**
 * Create approval request parameters
 */
export interface CreateApprovalParams {
  workflowRunId: string;
  stateId: string;
  projectId: string;
  stateName: string;
  stateOrder: number;
  requestedBy: string;
  contextSummary?: string;
  artifactKeys?: string[];
  tokensUsed?: number;
}

/**
 * Response to approval parameters
 */
export interface RespondToApprovalParams {
  runId: string;
  action: 'approve' | 'rerun' | 'reject';
  decidedBy: string;
  feedback?: string;
  rejectMode?: 'cancel' | 'pause';
  reason?: string;
  notes?: string;
}

/**
 * Pending approvals filter
 */
export interface PendingApprovalsFilter {
  projectId?: string;
  workflowId?: string;
  runId?: string;
  page?: number;
  pageSize?: number;
}

/**
 * Approval Service
 * Provides approval gate operations for Story Runner
 * ST-148: Approval Gates - Human-in-the-Loop
 */
@Injectable()
export class ApprovalService {
  private readonly logger = new Logger(ApprovalService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Create a new approval request for a state
   * Called when a state with requiresApproval=true completes execution
   */
  async createApprovalRequest(params: CreateApprovalParams): Promise<ApprovalRequestData> {
    this.logger.log(`Creating approval request for run ${params.workflowRunId}, state ${params.stateName}`);

    // Check if approval already exists for this run+state
    const existing = await this.prisma.approvalRequest.findUnique({
      where: {
        workflowRunId_stateId: {
          workflowRunId: params.workflowRunId,
          stateId: params.stateId,
        },
      },
    });

    if (existing) {
      // If already pending, return it
      if (existing.status === 'pending') {
        this.logger.log(`Approval request already exists and is pending: ${existing.id}`);
        return this.mapToApprovalData(existing);
      }

      // If resolved but we're creating a new one (re-execution), update it
      const updated = await this.prisma.approvalRequest.update({
        where: { id: existing.id },
        data: {
          status: 'pending',
          requestedAt: new Date(),
          requestedBy: params.requestedBy,
          contextSummary: params.contextSummary || null,
          artifactKeys: params.artifactKeys || [],
          tokensUsed: params.tokensUsed || 0,
          resolvedAt: null,
          resolvedBy: null,
          resolution: null,
          reason: null,
          reExecutionMode: null,
          feedback: null,
          editedArtifacts: [],
        },
      });
      this.logger.log(`Reset existing approval request to pending: ${updated.id}`);
      return this.mapToApprovalData(updated);
    }

    // Create new approval request
    const approvalRequest = await this.prisma.approvalRequest.create({
      data: {
        workflowRunId: params.workflowRunId,
        stateId: params.stateId,
        projectId: params.projectId,
        stateName: params.stateName,
        stateOrder: params.stateOrder,
        requestedBy: params.requestedBy,
        contextSummary: params.contextSummary || null,
        artifactKeys: params.artifactKeys || [],
        tokensUsed: params.tokensUsed || 0,
      },
    });

    this.logger.log(`Created approval request: ${approvalRequest.id}`);
    return this.mapToApprovalData(approvalRequest);
  }

  /**
   * Get pending approval for a workflow run
   * Returns the current pending approval if any
   */
  async getPendingApproval(runId: string): Promise<ApprovalRequestData | null> {
    const approval = await this.prisma.approvalRequest.findFirst({
      where: {
        workflowRunId: runId,
        status: 'pending',
      },
      orderBy: { requestedAt: 'desc' },
    });

    return approval ? this.mapToApprovalData(approval) : null;
  }

  /**
   * Get approval request by ID
   */
  async getApprovalById(requestId: string): Promise<ApprovalRequestData | null> {
    const approval = await this.prisma.approvalRequest.findUnique({
      where: { id: requestId },
    });

    return approval ? this.mapToApprovalData(approval) : null;
  }

  /**
   * Get the latest approval for a run (pending or resolved)
   * Used by runner to check for feedback on resume
   */
  async getLatestApproval(runId: string): Promise<ApprovalRequestData | null> {
    const approval = await this.prisma.approvalRequest.findFirst({
      where: { workflowRunId: runId },
      orderBy: { updatedAt: 'desc' },
    });

    return approval ? this.mapToApprovalData(approval) : null;
  }

  /**
   * Respond to a pending approval request
   * Handles approve, rerun, and reject actions
   */
  async respondToApproval(params: RespondToApprovalParams): Promise<{
    approval: ApprovalRequestData;
    shouldResume: boolean;
    shouldRerun: boolean;
    newRunStatus?: string;
  }> {
    this.logger.log(`Responding to approval for run ${params.runId}: action=${params.action}`);

    // Get pending approval
    const pendingApproval = await this.getPendingApproval(params.runId);
    if (!pendingApproval) {
      throw new NotFoundException(`No pending approval found for run ${params.runId}`);
    }

    // Get workflow run
    const workflowRun = await this.prisma.workflowRun.findUnique({
      where: { id: params.runId },
    });

    if (!workflowRun) {
      throw new NotFoundException(`Workflow run not found: ${params.runId}`);
    }

    let resolution: ApprovalResolution;
    let reExecutionMode: ReExecutionMode | null = null;
    let shouldResume = false;
    let shouldRerun = false;
    let newRunStatus: string | undefined;

    switch (params.action) {
      case 'approve':
        resolution = 'approved';
        reExecutionMode = 'none';
        shouldResume = true;
        shouldRerun = false;
        this.logger.log(`Approving state ${pendingApproval.stateName}, will resume to next state`);
        break;

      case 'rerun':
        resolution = 'approved'; // Technically approved but with modifications
        reExecutionMode = 'feedback_injection';
        shouldResume = true;
        shouldRerun = true;
        if (!params.feedback) {
          throw new BadRequestException('Feedback is required for rerun action');
        }
        this.logger.log(`Requesting rerun of state ${pendingApproval.stateName} with feedback`);
        break;

      case 'reject':
        resolution = 'rejected';
        reExecutionMode = null;
        shouldResume = false;

        if (params.rejectMode === 'pause') {
          // Keep workflow paused for manual intervention
          newRunStatus = 'paused';
          this.logger.log(`Rejecting state ${pendingApproval.stateName}, keeping workflow paused`);
        } else {
          // Cancel the workflow
          newRunStatus = 'cancelled';
          this.logger.log(`Rejecting state ${pendingApproval.stateName}, cancelling workflow`);
        }
        break;

      default:
        throw new BadRequestException(`Invalid action: ${params.action}`);
    }

    // Update approval request
    const updated = await this.prisma.approvalRequest.update({
      where: { id: pendingApproval.id },
      data: {
        status: resolution === 'rejected' ? 'rejected' : 'approved',
        resolvedAt: new Date(),
        resolvedBy: params.decidedBy,
        resolution,
        reason: params.reason || params.notes || null,
        reExecutionMode,
        feedback: params.feedback || null,
      },
    });

    // Update workflow run status if needed
    if (newRunStatus) {
      await this.prisma.workflowRun.update({
        where: { id: params.runId },
        data: {
          status: newRunStatus as any,
          ...(newRunStatus === 'cancelled' && { finishedAt: new Date() }),
        },
      });
    }

    return {
      approval: this.mapToApprovalData(updated),
      shouldResume,
      shouldRerun,
      newRunStatus,
    };
  }

  /**
   * List pending approvals with filters
   */
  async listPendingApprovals(filter: PendingApprovalsFilter): Promise<{
    approvals: Array<ApprovalRequestData & {
      storyKey?: string;
      storyTitle?: string;
      waitingMinutes: number;
    }>;
    pagination: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
  }> {
    const page = filter.page || 1;
    const pageSize = Math.min(filter.pageSize || 20, 100);
    const skip = (page - 1) * pageSize;

    const where: Prisma.ApprovalRequestWhereInput = {
      status: 'pending',
    };

    if (filter.projectId) {
      where.projectId = filter.projectId;
    }

    if (filter.runId) {
      where.workflowRunId = filter.runId;
    }

    if (filter.workflowId) {
      where.workflowRun = {
        workflowId: filter.workflowId,
      };
    }

    const [approvals, total] = await Promise.all([
      this.prisma.approvalRequest.findMany({
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
            },
          },
        },
        orderBy: { requestedAt: 'asc' },
        skip,
        take: pageSize,
      }),
      this.prisma.approvalRequest.count({ where }),
    ]);

    const now = new Date();
    const mappedApprovals = approvals.map(approval => ({
      ...this.mapToApprovalData(approval),
      storyKey: approval.workflowRun.story?.key,
      storyTitle: approval.workflowRun.story?.title,
      waitingMinutes: Math.floor((now.getTime() - approval.requestedAt.getTime()) / 60000),
    }));

    return {
      approvals: mappedApprovals,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  /**
   * Get detailed approval information
   * Includes related run and state information
   */
  async getApprovalDetails(requestId?: string, runId?: string): Promise<{
    approval: ApprovalRequestData;
    workflowRun: {
      id: string;
      status: string;
      storyKey?: string;
      storyTitle?: string;
      startedAt: Date;
    };
    state: {
      id: string;
      name: string;
      order: number;
      requiresApproval: boolean;
    };
  } | null> {
    let approval;

    if (requestId) {
      approval = await this.prisma.approvalRequest.findUnique({
        where: { id: requestId },
        include: {
          workflowRun: {
            include: {
              story: {
                select: { key: true, title: true },
              },
            },
          },
          state: {
            select: {
              id: true,
              name: true,
              order: true,
              requiresApproval: true,
            },
          },
        },
      });
    } else if (runId) {
      approval = await this.prisma.approvalRequest.findFirst({
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
            },
          },
          state: {
            select: {
              id: true,
              name: true,
              order: true,
              requiresApproval: true,
            },
          },
        },
        orderBy: { requestedAt: 'desc' },
      });
    }

    if (!approval) {
      return null;
    }

    return {
      approval: this.mapToApprovalData(approval),
      workflowRun: {
        id: approval.workflowRun.id,
        status: approval.workflowRun.status,
        storyKey: approval.workflowRun.story?.key,
        storyTitle: approval.workflowRun.story?.title,
        startedAt: approval.workflowRun.startedAt,
      },
      state: approval.state,
    };
  }

  /**
   * Cancel pending approval (when workflow is cancelled externally)
   */
  async cancelPendingApproval(runId: string): Promise<void> {
    const pending = await this.getPendingApproval(runId);
    if (pending) {
      await this.prisma.approvalRequest.update({
        where: { id: pending.id },
        data: {
          status: 'cancelled',
          resolution: 'cancelled',
          resolvedAt: new Date(),
        },
      });
      this.logger.log(`Cancelled pending approval ${pending.id} for run ${runId}`);
    }
  }

  /**
   * Map Prisma model to approval data structure
   */
  private mapToApprovalData(approval: any): ApprovalRequestData {
    return {
      id: approval.id,
      workflowRunId: approval.workflowRunId,
      stateId: approval.stateId,
      projectId: approval.projectId,
      stateName: approval.stateName,
      stateOrder: approval.stateOrder,
      requestedBy: approval.requestedBy,
      requestedAt: approval.requestedAt,
      status: approval.status,
      contextSummary: approval.contextSummary,
      artifactKeys: approval.artifactKeys,
      tokensUsed: approval.tokensUsed,
      resolvedAt: approval.resolvedAt,
      resolvedBy: approval.resolvedBy,
      resolution: approval.resolution,
      reason: approval.reason,
      reExecutionMode: approval.reExecutionMode,
      feedback: approval.feedback,
      editedArtifacts: approval.editedArtifacts,
    };
  }
}
