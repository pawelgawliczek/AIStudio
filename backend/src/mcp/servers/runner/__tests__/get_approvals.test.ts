/**
 * Tests for get_approvals MCP tool
 * ST-355: Add unit tests for top 20 uncovered backend files
 */

import { PrismaClient } from '@prisma/client';
import { handler } from '../get_approvals';

describe('get_approvals MCP Tool', () => {
  let mockPrisma: jest.Mocked<PrismaClient>;

  beforeEach(() => {
    mockPrisma = {
      story: {
        findFirst: jest.fn(),
      },
      workflowRun: {
        findFirst: jest.fn(),
      },
      approvalRequest: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
      },
    } as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Input Validation', () => {
    it('should throw error for invalid action', async () => {
      await expect(
        handler(mockPrisma, { action: 'invalid' as any }),
      ).rejects.toThrow('Invalid action: invalid');
    });
  });

  describe('List Action', () => {
    it('should return list of pending approvals with default pagination', async () => {
      const mockApprovals = [
        {
          id: 'approval-1',
          workflowRunId: 'run-1',
          stateId: 'state-1',
          stateName: 'Implementation',
          stateOrder: 1,
          status: 'pending',
          requestedBy: 'system',
          requestedAt: new Date('2024-01-01T10:00:00Z'),
          resolvedAt: null,
          resolvedBy: null,
          resolution: null,
          contextSummary: 'Review implementation',
          artifactKeys: ['IMPLEMENTATION'],
          tokensUsed: 1000,
          workflowRun: {
            story: { key: 'ST-123', title: 'Test Story' },
            workflow: { name: 'Dev Workflow' },
          },
        },
      ];

      (mockPrisma.approvalRequest.findMany as jest.Mock).mockResolvedValue(
        mockApprovals,
      );
      (mockPrisma.approvalRequest.count as jest.Mock).mockResolvedValue(1);

      const result: any = await handler(mockPrisma, { action: 'list' });

      expect(result.success).toBe(true);
      expect(result.action).toBe('list');
      expect(result.approvals).toHaveLength(1);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.pageSize).toBe(20);
      expect(result.summary.pendingCount).toBe(1);
    });

    it('should filter by status', async () => {
      (mockPrisma.approvalRequest.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.approvalRequest.count as jest.Mock).mockResolvedValue(0);

      await handler(mockPrisma, { action: 'list', status: 'approved' });

      expect(mockPrisma.approvalRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'approved' }),
        }),
      );
    });

    it('should filter by projectId', async () => {
      (mockPrisma.approvalRequest.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.approvalRequest.count as jest.Mock).mockResolvedValue(0);

      await handler(mockPrisma, {
        action: 'list',
        projectId: 'project-1',
      });

      expect(mockPrisma.approvalRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ projectId: 'project-1' }),
        }),
      );
    });

    it('should filter by workflowId', async () => {
      (mockPrisma.approvalRequest.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.approvalRequest.count as jest.Mock).mockResolvedValue(0);

      await handler(mockPrisma, {
        action: 'list',
        workflowId: 'workflow-1',
      });

      expect(mockPrisma.approvalRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            workflowRun: { workflowId: 'workflow-1' },
          }),
        }),
      );
    });

    it('should resolve story to runId and filter', async () => {
      const mockStory = { id: 'story-1', key: 'ST-123' };
      const mockRun = { id: 'run-1', storyId: 'story-1', status: 'running' };

      (mockPrisma.story.findFirst as jest.Mock).mockResolvedValue(mockStory);
      (mockPrisma.workflowRun.findFirst as jest.Mock).mockResolvedValue(
        mockRun,
      );
      (mockPrisma.approvalRequest.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.approvalRequest.count as jest.Mock).mockResolvedValue(0);

      await handler(mockPrisma, { action: 'list', story: 'ST-123' });

      expect(mockPrisma.approvalRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ workflowRunId: 'run-1' }),
        }),
      );
    });

    it('should return empty list when story has no active run', async () => {
      (mockPrisma.story.findFirst as jest.Mock).mockResolvedValue(null);

      const result: any = await handler(mockPrisma, {
        action: 'list',
        story: 'ST-123',
      });

      expect(result.success).toBe(true);
      expect(result.approvals).toEqual([]);
      expect(result.pagination.total).toBe(0);
    });

    it('should handle pagination correctly', async () => {
      (mockPrisma.approvalRequest.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.approvalRequest.count as jest.Mock).mockResolvedValue(50);

      const result: any = await handler(mockPrisma, {
        action: 'list',
        page: 2,
        pageSize: 10,
      });

      expect(result.pagination.page).toBe(2);
      expect(result.pagination.pageSize).toBe(10);
      expect(result.pagination.total).toBe(50);
      expect(result.pagination.totalPages).toBe(5);
      expect(mockPrisma.approvalRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      );
    });

    it('should respect max pageSize of 100', async () => {
      (mockPrisma.approvalRequest.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.approvalRequest.count as jest.Mock).mockResolvedValue(0);

      await handler(mockPrisma, { action: 'list', pageSize: 500 });

      expect(mockPrisma.approvalRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 }),
      );
    });

    it('should calculate waiting minutes for pending approvals', async () => {
      const mockApprovals = [
        {
          id: 'approval-1',
          workflowRunId: 'run-1',
          stateId: 'state-1',
          stateName: 'Implementation',
          stateOrder: 1,
          status: 'pending',
          requestedBy: 'system',
          requestedAt: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
          resolvedAt: null,
          resolvedBy: null,
          resolution: null,
          contextSummary: null,
          artifactKeys: [],
          tokensUsed: 0,
          workflowRun: {
            story: null,
            workflow: null,
          },
        },
      ];

      (mockPrisma.approvalRequest.findMany as jest.Mock).mockResolvedValue(
        mockApprovals,
      );
      (mockPrisma.approvalRequest.count as jest.Mock).mockResolvedValue(1);

      const result: any = await handler(mockPrisma, { action: 'list' });

      expect(result.approvals[0].waitingMinutes).toBeGreaterThanOrEqual(59);
      expect(result.summary.oldestWaitingMinutes).toBeGreaterThanOrEqual(59);
    });

    it('should not calculate waiting minutes for resolved approvals', async () => {
      const mockApprovals = [
        {
          id: 'approval-1',
          workflowRunId: 'run-1',
          stateId: 'state-1',
          stateName: 'Implementation',
          stateOrder: 1,
          status: 'approved',
          requestedBy: 'system',
          requestedAt: new Date(Date.now() - 60 * 60 * 1000),
          resolvedAt: new Date(),
          resolvedBy: 'user-1',
          resolution: 'Approved',
          contextSummary: null,
          artifactKeys: [],
          tokensUsed: 0,
          workflowRun: {
            story: null,
            workflow: null,
          },
        },
      ];

      (mockPrisma.approvalRequest.findMany as jest.Mock).mockResolvedValue(
        mockApprovals,
      );
      (mockPrisma.approvalRequest.count as jest.Mock).mockResolvedValue(1);

      const result: any = await handler(mockPrisma, {
        action: 'list',
        status: 'all',
      });

      expect(result.approvals[0].waitingMinutes).toBeNull();
    });
  });

  describe('Details Action', () => {
    it('should throw error when no identifier provided', async () => {
      await expect(handler(mockPrisma, { action: 'details' })).rejects.toThrow(
        'Either requestId, story, or runId is required',
      );
    });

    it('should return approval details by requestId', async () => {
      const mockApproval = {
        id: 'approval-1',
        status: 'pending',
        stateName: 'Implementation',
        stateOrder: 1,
        requestedBy: 'system',
        requestedAt: new Date('2024-01-01T10:00:00Z'),
        contextSummary: 'Review implementation',
        artifactKeys: ['IMPLEMENTATION'],
        tokensUsed: 1000,
        resolvedAt: null,
        resolvedBy: null,
        resolution: null,
        reason: null,
        reExecutionMode: null,
        feedback: null,
        editedArtifacts: null,
        workflowRun: {
          id: 'run-1',
          status: 'running',
          startedAt: new Date('2024-01-01T09:00:00Z'),
          story: { id: 'story-1', key: 'ST-123', title: 'Test', status: 'impl' },
          workflow: { id: 'workflow-1', name: 'Dev Workflow' },
          project: { id: 'project-1', name: 'Test Project' },
        },
        state: {
          id: 'state-1',
          name: 'Implementation',
          order: 1,
          requiresApproval: true,
          preExecutionInstructions: 'Prepare',
          postExecutionInstructions: 'Review',
        },
      };

      (mockPrisma.approvalRequest.findUnique as jest.Mock).mockResolvedValue(
        mockApproval,
      );

      const result: any = await handler(mockPrisma, {
        action: 'details',
        requestId: 'approval-1',
      });

      expect(result.success).toBe(true);
      expect(result.found).toBe(true);
      expect(result.approval.id).toBe('approval-1');
      expect(result.approval.status).toBe('pending');
      expect(result.availableActions).toEqual(['approve', 'rerun', 'reject']);
    });

    it('should throw error when approval not found by requestId', async () => {
      (mockPrisma.approvalRequest.findUnique as jest.Mock).mockResolvedValue(
        null,
      );

      await expect(
        handler(mockPrisma, {
          action: 'details',
          requestId: 'approval-1',
        }),
      ).rejects.toThrow('Approval request not found: approval-1');
    });

    it('should find pending approval by story key', async () => {
      const mockStory = { id: 'story-1', key: 'ST-123' };
      const mockRun = { id: 'run-1', storyId: 'story-1', status: 'running' };
      const mockApproval = {
        id: 'approval-1',
        status: 'pending',
        stateName: 'Implementation',
        stateOrder: 1,
        requestedBy: 'system',
        requestedAt: new Date(),
        contextSummary: null,
        artifactKeys: [],
        tokensUsed: 0,
        resolvedAt: null,
        resolvedBy: null,
        resolution: null,
        reason: null,
        reExecutionMode: null,
        feedback: null,
        editedArtifacts: null,
        workflowRun: {
          id: 'run-1',
          status: 'running',
          startedAt: new Date(),
          story: { id: 'story-1', key: 'ST-123', title: 'Test', status: 'impl' },
          workflow: { id: 'workflow-1', name: 'Dev Workflow' },
          project: { id: 'project-1', name: 'Test Project' },
        },
        state: {
          id: 'state-1',
          name: 'Implementation',
          order: 1,
          requiresApproval: true,
          preExecutionInstructions: null,
          postExecutionInstructions: null,
        },
      };

      (mockPrisma.story.findFirst as jest.Mock).mockResolvedValue(mockStory);
      (mockPrisma.workflowRun.findFirst as jest.Mock).mockResolvedValue(
        mockRun,
      );
      (mockPrisma.approvalRequest.findFirst as jest.Mock).mockResolvedValue(
        mockApproval,
      );

      const result: any = await handler(mockPrisma, {
        action: 'details',
        story: 'ST-123',
      });

      expect(result.success).toBe(true);
      expect(result.found).toBe(true);
      expect(result.approval.id).toBe('approval-1');
    });

    it('should return not found when no pending approval exists', async () => {
      const mockStory = { id: 'story-1', key: 'ST-123' };
      const mockRun = { id: 'run-1', storyId: 'story-1', status: 'running' };

      (mockPrisma.story.findFirst as jest.Mock).mockResolvedValue(mockStory);
      (mockPrisma.workflowRun.findFirst as jest.Mock).mockResolvedValue(
        mockRun,
      );
      (mockPrisma.approvalRequest.findFirst as jest.Mock).mockResolvedValue(
        null,
      );

      const result: any = await handler(mockPrisma, {
        action: 'details',
        story: 'ST-123',
      });

      expect(result.success).toBe(true);
      expect(result.found).toBe(false);
      expect(result.message).toContain('No pending approval found');
    });

    it('should calculate waiting minutes for pending approval', async () => {
      const mockApproval = {
        id: 'approval-1',
        status: 'pending',
        stateName: 'Implementation',
        stateOrder: 1,
        requestedBy: 'system',
        requestedAt: new Date(Date.now() - 30 * 60 * 1000), // 30 min ago
        contextSummary: null,
        artifactKeys: [],
        tokensUsed: 0,
        resolvedAt: null,
        resolvedBy: null,
        resolution: null,
        reason: null,
        reExecutionMode: null,
        feedback: null,
        editedArtifacts: null,
        workflowRun: {
          id: 'run-1',
          status: 'running',
          startedAt: new Date(),
          story: null,
          workflow: null,
          project: null,
        },
        state: {
          id: 'state-1',
          name: 'Implementation',
          order: 1,
          requiresApproval: true,
          preExecutionInstructions: null,
          postExecutionInstructions: null,
        },
      };

      (mockPrisma.approvalRequest.findUnique as jest.Mock).mockResolvedValue(
        mockApproval,
      );

      const result: any = await handler(mockPrisma, {
        action: 'details',
        requestId: 'approval-1',
      });

      expect(result.approval.waitingMinutes).toBeGreaterThanOrEqual(29);
    });

    it('should not show available actions for resolved approval', async () => {
      const mockApproval = {
        id: 'approval-1',
        status: 'approved',
        stateName: 'Implementation',
        stateOrder: 1,
        requestedBy: 'system',
        requestedAt: new Date(),
        contextSummary: null,
        artifactKeys: [],
        tokensUsed: 0,
        resolvedAt: new Date(),
        resolvedBy: 'user-1',
        resolution: 'Approved',
        reason: null,
        reExecutionMode: null,
        feedback: null,
        editedArtifacts: null,
        workflowRun: {
          id: 'run-1',
          status: 'running',
          startedAt: new Date(),
          story: null,
          workflow: null,
          project: null,
        },
        state: {
          id: 'state-1',
          name: 'Implementation',
          order: 1,
          requiresApproval: true,
          preExecutionInstructions: null,
          postExecutionInstructions: null,
        },
      };

      (mockPrisma.approvalRequest.findUnique as jest.Mock).mockResolvedValue(
        mockApproval,
      );

      const result: any = await handler(mockPrisma, {
        action: 'details',
        requestId: 'approval-1',
      });

      expect(result.availableActions).toEqual([]);
      expect(result.hint).toContain('already resolved');
    });
  });
});
