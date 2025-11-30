/**
 * Tests for respond_to_approval MCP tool
 * ST-148: Approval Gates - Human-in-the-Loop
 */

import { handler, tool } from '../respond_to_approval';
import { PrismaClient } from '@prisma/client';

// Mock child_process.spawn
jest.mock('child_process', () => ({
  spawn: jest.fn(() => ({
    unref: jest.fn(),
    on: jest.fn(),
    stdout: { on: jest.fn() },
    stderr: { on: jest.fn() },
  })),
}));

// Mock WebSocket broadcast
jest.mock('../../../services/websocket-gateway.instance', () => ({
  broadcastApprovalResolved: jest.fn().mockResolvedValue(undefined),
}));

describe('respond_to_approval', () => {
  let mockPrisma: jest.Mocked<PrismaClient>;

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
    workflowRun: {
      id: 'run-456',
      status: 'paused',
      project: { id: 'project-abc' },
      story: { key: 'ST-123', title: 'Test Story' },
    },
  };

  beforeEach(() => {
    mockPrisma = {
      approvalRequest: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      workflowRun: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    } as unknown as jest.Mocked<PrismaClient>;

    jest.clearAllMocks();
  });

  describe('tool definition', () => {
    it('should have correct name', () => {
      expect(tool.name).toBe('respond_to_approval');
    });

    it('should require runId, action, decidedBy', () => {
      expect(tool.inputSchema.required).toContain('runId');
      expect(tool.inputSchema.required).toContain('action');
      expect(tool.inputSchema.required).toContain('decidedBy');
    });

    it('should have action enum with approve, rerun, reject', () => {
      const actionProp = tool.inputSchema.properties.action;
      expect(actionProp.enum).toEqual(['approve', 'rerun', 'reject']);
    });
  });

  describe('approve action', () => {
    it('should approve and trigger resume', async () => {
      (mockPrisma.approvalRequest.findFirst as jest.Mock).mockResolvedValue(mockApproval);
      (mockPrisma.approvalRequest.update as jest.Mock).mockResolvedValue({
        ...mockApproval,
        status: 'approved',
        resolution: 'approved',
        resolvedAt: new Date(),
        resolvedBy: 'reviewer-1',
      });
      (mockPrisma.workflowRun.update as jest.Mock).mockResolvedValue({});

      const result = await handler(mockPrisma, {
        runId: 'run-456',
        action: 'approve',
        decidedBy: 'reviewer-1',
      });

      expect(result.success).toBe(true);
      expect(result.action).toBe('approve');
      expect(result.shouldResume).toBe(true);
      expect(result.shouldRerun).toBe(false);
      expect(result.approval.resolution).toBe('approved');

      expect(mockPrisma.approvalRequest.update).toHaveBeenCalledWith({
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
    it('should rerun with feedback injection', async () => {
      (mockPrisma.approvalRequest.findFirst as jest.Mock).mockResolvedValue(mockApproval);
      (mockPrisma.approvalRequest.update as jest.Mock).mockResolvedValue({
        ...mockApproval,
        status: 'approved',
        resolution: 'approved',
        reExecutionMode: 'feedback_injection',
        feedback: 'Add error handling',
        resolvedAt: new Date(),
        resolvedBy: 'reviewer-1',
      });
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue({
        id: 'run-456',
        metadata: {},
      });
      (mockPrisma.workflowRun.update as jest.Mock).mockResolvedValue({});

      const result = await handler(mockPrisma, {
        runId: 'run-456',
        action: 'rerun',
        decidedBy: 'reviewer-1',
        feedback: 'Add error handling',
      });

      expect(result.success).toBe(true);
      expect(result.action).toBe('rerun');
      expect(result.shouldResume).toBe(true);
      expect(result.shouldRerun).toBe(true);

      // Should store feedback in metadata
      expect(mockPrisma.workflowRun.update).toHaveBeenCalledWith({
        where: { id: 'run-456' },
        data: {
          metadata: expect.objectContaining({
            approvalFeedback: 'Add error handling',
            shouldRerunCurrentState: true,
          }),
        },
      });
    });

    it('should throw error if feedback not provided for rerun', async () => {
      (mockPrisma.approvalRequest.findFirst as jest.Mock).mockResolvedValue(mockApproval);

      await expect(
        handler(mockPrisma, {
          runId: 'run-456',
          action: 'rerun',
          decidedBy: 'reviewer-1',
          // no feedback
        })
      ).rejects.toThrow('Feedback is required for rerun action');
    });
  });

  describe('reject action', () => {
    it('should reject with cancel mode by default', async () => {
      (mockPrisma.approvalRequest.findFirst as jest.Mock).mockResolvedValue(mockApproval);
      (mockPrisma.approvalRequest.update as jest.Mock).mockResolvedValue({
        ...mockApproval,
        status: 'rejected',
        resolution: 'rejected',
        resolvedAt: new Date(),
        resolvedBy: 'reviewer-1',
      });
      (mockPrisma.workflowRun.update as jest.Mock).mockResolvedValue({});

      const result = await handler(mockPrisma, {
        runId: 'run-456',
        action: 'reject',
        decidedBy: 'reviewer-1',
        reason: 'Does not meet requirements',
      });

      expect(result.success).toBe(true);
      expect(result.action).toBe('reject');
      expect(result.workflowStatus).toBe('cancelled');
      expect(result.shouldResume).toBeUndefined();

      expect(mockPrisma.workflowRun.update).toHaveBeenCalledWith({
        where: { id: 'run-456' },
        data: {
          status: 'cancelled',
          finishedAt: expect.any(Date),
        },
      });
    });

    it('should reject with pause mode', async () => {
      (mockPrisma.approvalRequest.findFirst as jest.Mock).mockResolvedValue(mockApproval);
      (mockPrisma.approvalRequest.update as jest.Mock).mockResolvedValue({
        ...mockApproval,
        status: 'rejected',
        resolution: 'rejected',
        resolvedAt: new Date(),
        resolvedBy: 'reviewer-1',
      });
      (mockPrisma.workflowRun.update as jest.Mock).mockResolvedValue({});

      const result = await handler(mockPrisma, {
        runId: 'run-456',
        action: 'reject',
        decidedBy: 'reviewer-1',
        rejectMode: 'pause',
      });

      expect(result.workflowStatus).toBe('paused');
      expect(mockPrisma.workflowRun.update).toHaveBeenCalledWith({
        where: { id: 'run-456' },
        data: {
          status: 'paused',
        },
      });
    });
  });

  describe('error handling', () => {
    it('should throw if no pending approval', async () => {
      (mockPrisma.approvalRequest.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        handler(mockPrisma, {
          runId: 'run-456',
          action: 'approve',
          decidedBy: 'reviewer-1',
        })
      ).rejects.toThrow('No pending approval found for run run-456');
    });

    it('should throw for invalid action', async () => {
      (mockPrisma.approvalRequest.findFirst as jest.Mock).mockResolvedValue(mockApproval);

      await expect(
        handler(mockPrisma, {
          runId: 'run-456',
          action: 'invalid' as any,
          decidedBy: 'reviewer-1',
        })
      ).rejects.toThrow('Invalid action: invalid');
    });
  });
});
