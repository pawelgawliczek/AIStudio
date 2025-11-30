/**
 * Tests for ApprovalService
 * ST-148: Approval Gates - Human-in-the-Loop
 */

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ApprovalService, CreateApprovalParams, RespondToApprovalParams } from '../approval.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('ApprovalService', () => {
  let service: ApprovalService;
  let prisma: jest.Mocked<PrismaService>;

  const mockApproval = {
    id: 'approval-123',
    workflowRunId: 'run-456',
    stateId: 'state-789',
    projectId: 'project-abc',
    stateName: 'implementation',
    stateOrder: 2,
    requestedBy: 'runner',
    requestedAt: new Date('2025-01-01T10:00:00Z'),
    status: 'pending' as const,
    contextSummary: 'Completed implementation phase',
    artifactKeys: ['IMPL_DOC'],
    tokensUsed: 5000,
    resolvedAt: null,
    resolvedBy: null,
    resolution: null,
    reason: null,
    reExecutionMode: null,
    feedback: null,
    editedArtifacts: [],
    createdAt: new Date('2025-01-01T10:00:00Z'),
    updatedAt: new Date('2025-01-01T10:00:00Z'),
  };

  const mockWorkflowRun = {
    id: 'run-456',
    workflowId: 'workflow-001',
    status: 'paused',
    startedAt: new Date('2025-01-01T09:00:00Z'),
    story: {
      key: 'ST-123',
      title: 'Test Story',
    },
  };

  beforeEach(async () => {
    // Create mock Prisma service
    const mockPrisma = {
      approvalRequest: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      workflowRun: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApprovalService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<ApprovalService>(ApprovalService);
    prisma = module.get(PrismaService) as jest.Mocked<PrismaService>;
  });

  describe('createApprovalRequest', () => {
    const createParams: CreateApprovalParams = {
      workflowRunId: 'run-456',
      stateId: 'state-789',
      projectId: 'project-abc',
      stateName: 'implementation',
      stateOrder: 2,
      requestedBy: 'runner',
      contextSummary: 'Completed implementation phase',
      artifactKeys: ['IMPL_DOC'],
      tokensUsed: 5000,
    };

    it('should create a new approval request', async () => {
      (prisma.approvalRequest.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.approvalRequest.create as jest.Mock).mockResolvedValue(mockApproval);

      const result = await service.createApprovalRequest(createParams);

      expect(prisma.approvalRequest.findUnique).toHaveBeenCalledWith({
        where: {
          workflowRunId_stateId: {
            workflowRunId: 'run-456',
            stateId: 'state-789',
          },
        },
      });
      expect(prisma.approvalRequest.create).toHaveBeenCalledWith({
        data: {
          workflowRunId: 'run-456',
          stateId: 'state-789',
          projectId: 'project-abc',
          stateName: 'implementation',
          stateOrder: 2,
          requestedBy: 'runner',
          contextSummary: 'Completed implementation phase',
          artifactKeys: ['IMPL_DOC'],
          tokensUsed: 5000,
        },
      });
      expect(result.id).toBe('approval-123');
      expect(result.status).toBe('pending');
    });

    it('should return existing pending approval', async () => {
      (prisma.approvalRequest.findUnique as jest.Mock).mockResolvedValue(mockApproval);

      const result = await service.createApprovalRequest(createParams);

      expect(prisma.approvalRequest.create).not.toHaveBeenCalled();
      expect(result.id).toBe('approval-123');
    });

    it('should reset resolved approval to pending on re-creation', async () => {
      const resolvedApproval = {
        ...mockApproval,
        status: 'approved',
        resolution: 'approved',
        resolvedAt: new Date(),
        resolvedBy: 'user-1',
      };
      (prisma.approvalRequest.findUnique as jest.Mock).mockResolvedValue(resolvedApproval);
      (prisma.approvalRequest.update as jest.Mock).mockResolvedValue({
        ...mockApproval,
        status: 'pending',
      });

      const result = await service.createApprovalRequest(createParams);

      expect(prisma.approvalRequest.update).toHaveBeenCalledWith({
        where: { id: 'approval-123' },
        data: expect.objectContaining({
          status: 'pending',
          resolution: null,
          resolvedAt: null,
          resolvedBy: null,
          feedback: null,
        }),
      });
      expect(result.status).toBe('pending');
    });

    it('should use defaults for optional parameters', async () => {
      const minimalParams: CreateApprovalParams = {
        workflowRunId: 'run-456',
        stateId: 'state-789',
        projectId: 'project-abc',
        stateName: 'implementation',
        stateOrder: 2,
        requestedBy: 'runner',
      };

      (prisma.approvalRequest.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.approvalRequest.create as jest.Mock).mockResolvedValue(mockApproval);

      await service.createApprovalRequest(minimalParams);

      expect(prisma.approvalRequest.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          contextSummary: null,
          artifactKeys: [],
          tokensUsed: 0,
        }),
      });
    });
  });

  describe('getPendingApproval', () => {
    it('should return pending approval for run', async () => {
      (prisma.approvalRequest.findFirst as jest.Mock).mockResolvedValue(mockApproval);

      const result = await service.getPendingApproval('run-456');

      expect(prisma.approvalRequest.findFirst).toHaveBeenCalledWith({
        where: {
          workflowRunId: 'run-456',
          status: 'pending',
        },
        orderBy: { requestedAt: 'desc' },
      });
      expect(result).not.toBeNull();
      expect(result?.id).toBe('approval-123');
    });

    it('should return null if no pending approval', async () => {
      (prisma.approvalRequest.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await service.getPendingApproval('run-456');

      expect(result).toBeNull();
    });
  });

  describe('getApprovalById', () => {
    it('should return approval by ID', async () => {
      (prisma.approvalRequest.findUnique as jest.Mock).mockResolvedValue(mockApproval);

      const result = await service.getApprovalById('approval-123');

      expect(prisma.approvalRequest.findUnique).toHaveBeenCalledWith({
        where: { id: 'approval-123' },
      });
      expect(result?.id).toBe('approval-123');
    });

    it('should return null if approval not found', async () => {
      (prisma.approvalRequest.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.getApprovalById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getLatestApproval', () => {
    it('should return most recent approval for run', async () => {
      (prisma.approvalRequest.findFirst as jest.Mock).mockResolvedValue(mockApproval);

      const result = await service.getLatestApproval('run-456');

      expect(prisma.approvalRequest.findFirst).toHaveBeenCalledWith({
        where: { workflowRunId: 'run-456' },
        orderBy: { updatedAt: 'desc' },
      });
      expect(result?.id).toBe('approval-123');
    });

    it('should return null if no approvals for run', async () => {
      (prisma.approvalRequest.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await service.getLatestApproval('run-456');

      expect(result).toBeNull();
    });
  });

  describe('respondToApproval', () => {
    beforeEach(() => {
      (prisma.approvalRequest.findFirst as jest.Mock).mockResolvedValue(mockApproval);
      (prisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockWorkflowRun);
    });

    describe('approve action', () => {
      it('should approve and set shouldResume=true', async () => {
        const approvedResult = {
          ...mockApproval,
          status: 'approved',
          resolution: 'approved',
          reExecutionMode: 'none',
          resolvedAt: new Date(),
          resolvedBy: 'reviewer-1',
        };
        (prisma.approvalRequest.update as jest.Mock).mockResolvedValue(approvedResult);

        const params: RespondToApprovalParams = {
          runId: 'run-456',
          action: 'approve',
          decidedBy: 'reviewer-1',
        };

        const result = await service.respondToApproval(params);

        expect(result.shouldResume).toBe(true);
        expect(result.shouldRerun).toBe(false);
        expect(result.newRunStatus).toBeUndefined();
        expect(prisma.approvalRequest.update).toHaveBeenCalledWith({
          where: { id: 'approval-123' },
          data: expect.objectContaining({
            status: 'approved',
            resolution: 'approved',
            reExecutionMode: 'none',
            resolvedBy: 'reviewer-1',
          }),
        });
      });
    });

    describe('rerun action', () => {
      it('should set shouldRerun=true with feedback', async () => {
        const rerunResult = {
          ...mockApproval,
          status: 'approved',
          resolution: 'approved',
          reExecutionMode: 'feedback_injection',
          feedback: 'Please add error handling',
          resolvedAt: new Date(),
          resolvedBy: 'reviewer-1',
        };
        (prisma.approvalRequest.update as jest.Mock).mockResolvedValue(rerunResult);

        const params: RespondToApprovalParams = {
          runId: 'run-456',
          action: 'rerun',
          decidedBy: 'reviewer-1',
          feedback: 'Please add error handling',
        };

        const result = await service.respondToApproval(params);

        expect(result.shouldResume).toBe(true);
        expect(result.shouldRerun).toBe(true);
        expect(prisma.approvalRequest.update).toHaveBeenCalledWith({
          where: { id: 'approval-123' },
          data: expect.objectContaining({
            reExecutionMode: 'feedback_injection',
            feedback: 'Please add error handling',
          }),
        });
      });

      it('should throw BadRequestException if no feedback provided for rerun', async () => {
        const params: RespondToApprovalParams = {
          runId: 'run-456',
          action: 'rerun',
          decidedBy: 'reviewer-1',
          // no feedback
        };

        await expect(service.respondToApproval(params)).rejects.toThrow(BadRequestException);
        await expect(service.respondToApproval(params)).rejects.toThrow(
          'Feedback is required for rerun action'
        );
      });
    });

    describe('reject action', () => {
      it('should reject with cancel mode by default', async () => {
        const rejectedResult = {
          ...mockApproval,
          status: 'rejected',
          resolution: 'rejected',
          reason: 'Not meeting requirements',
          resolvedAt: new Date(),
          resolvedBy: 'reviewer-1',
        };
        (prisma.approvalRequest.update as jest.Mock).mockResolvedValue(rejectedResult);
        (prisma.workflowRun.update as jest.Mock).mockResolvedValue({});

        const params: RespondToApprovalParams = {
          runId: 'run-456',
          action: 'reject',
          decidedBy: 'reviewer-1',
          reason: 'Not meeting requirements',
        };

        const result = await service.respondToApproval(params);

        expect(result.shouldResume).toBe(false);
        expect(result.shouldRerun).toBe(false);
        expect(result.newRunStatus).toBe('cancelled');
        expect(prisma.workflowRun.update).toHaveBeenCalledWith({
          where: { id: 'run-456' },
          data: {
            status: 'cancelled',
            finishedAt: expect.any(Date),
          },
        });
      });

      it('should reject with pause mode when specified', async () => {
        const rejectedResult = {
          ...mockApproval,
          status: 'rejected',
          resolution: 'rejected',
          resolvedAt: new Date(),
          resolvedBy: 'reviewer-1',
        };
        (prisma.approvalRequest.update as jest.Mock).mockResolvedValue(rejectedResult);
        (prisma.workflowRun.update as jest.Mock).mockResolvedValue({});

        const params: RespondToApprovalParams = {
          runId: 'run-456',
          action: 'reject',
          decidedBy: 'reviewer-1',
          rejectMode: 'pause',
        };

        const result = await service.respondToApproval(params);

        expect(result.newRunStatus).toBe('paused');
        expect(prisma.workflowRun.update).toHaveBeenCalledWith({
          where: { id: 'run-456' },
          data: {
            status: 'paused',
          },
        });
      });
    });

    describe('error handling', () => {
      it('should throw NotFoundException if no pending approval', async () => {
        (prisma.approvalRequest.findFirst as jest.Mock).mockResolvedValue(null);

        const params: RespondToApprovalParams = {
          runId: 'run-456',
          action: 'approve',
          decidedBy: 'reviewer-1',
        };

        await expect(service.respondToApproval(params)).rejects.toThrow(NotFoundException);
        await expect(service.respondToApproval(params)).rejects.toThrow(
          'No pending approval found for run run-456'
        );
      });

      it('should throw NotFoundException if workflow run not found', async () => {
        (prisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(null);

        const params: RespondToApprovalParams = {
          runId: 'run-456',
          action: 'approve',
          decidedBy: 'reviewer-1',
        };

        await expect(service.respondToApproval(params)).rejects.toThrow(NotFoundException);
        await expect(service.respondToApproval(params)).rejects.toThrow('Workflow run not found');
      });

      it('should throw BadRequestException for invalid action', async () => {
        const params = {
          runId: 'run-456',
          action: 'invalid' as any,
          decidedBy: 'reviewer-1',
        };

        await expect(service.respondToApproval(params)).rejects.toThrow(BadRequestException);
        await expect(service.respondToApproval(params)).rejects.toThrow('Invalid action: invalid');
      });
    });
  });

  describe('listPendingApprovals', () => {
    const mockApprovalWithRun = {
      ...mockApproval,
      workflowRun: mockWorkflowRun,
    };

    it('should return paginated list of pending approvals', async () => {
      (prisma.approvalRequest.findMany as jest.Mock).mockResolvedValue([mockApprovalWithRun]);
      (prisma.approvalRequest.count as jest.Mock).mockResolvedValue(1);

      const result = await service.listPendingApprovals({});

      expect(result.approvals).toHaveLength(1);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.pageSize).toBe(20);
      expect(result.pagination.total).toBe(1);
      expect(result.pagination.totalPages).toBe(1);
    });

    it('should filter by projectId', async () => {
      (prisma.approvalRequest.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.approvalRequest.count as jest.Mock).mockResolvedValue(0);

      await service.listPendingApprovals({ projectId: 'project-abc' });

      expect(prisma.approvalRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            projectId: 'project-abc',
          }),
        })
      );
    });

    it('should filter by runId', async () => {
      (prisma.approvalRequest.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.approvalRequest.count as jest.Mock).mockResolvedValue(0);

      await service.listPendingApprovals({ runId: 'run-456' });

      expect(prisma.approvalRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            workflowRunId: 'run-456',
          }),
        })
      );
    });

    it('should filter by workflowId', async () => {
      (prisma.approvalRequest.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.approvalRequest.count as jest.Mock).mockResolvedValue(0);

      await service.listPendingApprovals({ workflowId: 'workflow-001' });

      expect(prisma.approvalRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            workflowRun: { workflowId: 'workflow-001' },
          }),
        })
      );
    });

    it('should include waitingMinutes in response', async () => {
      // Set requestedAt to 30 minutes ago
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
      const approvalWithOldTime = {
        ...mockApprovalWithRun,
        requestedAt: thirtyMinutesAgo,
      };
      (prisma.approvalRequest.findMany as jest.Mock).mockResolvedValue([approvalWithOldTime]);
      (prisma.approvalRequest.count as jest.Mock).mockResolvedValue(1);

      const result = await service.listPendingApprovals({});

      expect(result.approvals[0].waitingMinutes).toBeGreaterThanOrEqual(29);
      expect(result.approvals[0].waitingMinutes).toBeLessThanOrEqual(31);
    });

    it('should include story info in response', async () => {
      (prisma.approvalRequest.findMany as jest.Mock).mockResolvedValue([mockApprovalWithRun]);
      (prisma.approvalRequest.count as jest.Mock).mockResolvedValue(1);

      const result = await service.listPendingApprovals({});

      expect(result.approvals[0].storyKey).toBe('ST-123');
      expect(result.approvals[0].storyTitle).toBe('Test Story');
    });

    it('should limit pageSize to 100', async () => {
      (prisma.approvalRequest.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.approvalRequest.count as jest.Mock).mockResolvedValue(0);

      await service.listPendingApprovals({ pageSize: 200 });

      expect(prisma.approvalRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 100,
        })
      );
    });
  });

  describe('getApprovalDetails', () => {
    const mockApprovalWithDetails = {
      ...mockApproval,
      workflowRun: mockWorkflowRun,
      state: {
        id: 'state-789',
        name: 'implementation',
        order: 2,
        requiresApproval: true,
      },
    };

    it('should return approval details by requestId', async () => {
      (prisma.approvalRequest.findUnique as jest.Mock).mockResolvedValue(mockApprovalWithDetails);

      const result = await service.getApprovalDetails('approval-123');

      expect(result).not.toBeNull();
      expect(result?.approval.id).toBe('approval-123');
      expect(result?.workflowRun.storyKey).toBe('ST-123');
      expect(result?.state.requiresApproval).toBe(true);
    });

    it('should return approval details by runId', async () => {
      (prisma.approvalRequest.findFirst as jest.Mock).mockResolvedValue(mockApprovalWithDetails);

      const result = await service.getApprovalDetails(undefined, 'run-456');

      expect(result).not.toBeNull();
      expect(result?.approval.workflowRunId).toBe('run-456');
    });

    it('should return null if approval not found', async () => {
      (prisma.approvalRequest.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.getApprovalDetails('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('cancelPendingApproval', () => {
    it('should cancel pending approval', async () => {
      (prisma.approvalRequest.findFirst as jest.Mock).mockResolvedValue(mockApproval);
      (prisma.approvalRequest.update as jest.Mock).mockResolvedValue({});

      await service.cancelPendingApproval('run-456');

      expect(prisma.approvalRequest.update).toHaveBeenCalledWith({
        where: { id: 'approval-123' },
        data: {
          status: 'cancelled',
          resolution: 'cancelled',
          resolvedAt: expect.any(Date),
        },
      });
    });

    it('should do nothing if no pending approval', async () => {
      (prisma.approvalRequest.findFirst as jest.Mock).mockResolvedValue(null);

      await service.cancelPendingApproval('run-456');

      expect(prisma.approvalRequest.update).not.toHaveBeenCalled();
    });
  });
});
