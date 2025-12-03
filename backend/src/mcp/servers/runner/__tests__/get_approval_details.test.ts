/**
 * Tests for get_approval_details MCP tool
 * ST-148: Approval Gates - Human-in-the-Loop
 */

import { PrismaClient } from '@prisma/client';
import { handler, tool } from '../get_approval_details';

describe('get_approval_details', () => {
  let mockPrisma: jest.Mocked<PrismaClient>;

  const mockApprovalWithDetails = {
    id: 'approval-123',
    workflowRunId: 'run-456',
    stateId: 'state-789',
    projectId: 'project-abc',
    stateName: 'implementation',
    stateOrder: 2,
    requestedBy: 'runner',
    requestedAt: new Date('2025-01-01T10:00:00Z'),
    status: 'pending',
    contextSummary: 'Completed implementation phase',
    artifactKeys: ['IMPL_DOC', 'ARCH_DOC'],
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
      workflowId: 'workflow-001',
      status: 'paused',
      startedAt: new Date('2025-01-01T09:00:00Z'),
      workflow: {
        id: 'workflow-001',
        name: 'Analysis Workflow',
      },
      story: {
        id: 'story-123',
        key: 'ST-123',
        title: 'Test Story',
        description: 'A test story',
      },
    },
    state: {
      id: 'state-789',
      name: 'implementation',
      order: 2,
      requiresApproval: true,
      preExecutionInstructions: 'Pre instructions',
      postExecutionInstructions: 'Post instructions',
    },
  };

  beforeEach(() => {
    mockPrisma = {
      approvalRequest: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
      },
    } as unknown as jest.Mocked<PrismaClient>;
  });

  describe('tool definition', () => {
    it('should have correct name', () => {
      expect(tool.name).toBe('get_approval_details');
    });

    it('should not require any parameters', () => {
      expect(tool.inputSchema.required).toEqual([]);
    });

    it('should have requestId and runId as optional', () => {
      const props = tool.inputSchema.properties;
      expect(props.requestId).toBeDefined();
      expect(props.runId).toBeDefined();
    });
  });

  describe('handler - lookup by requestId', () => {
    it('should return approval details by requestId', async () => {
      (mockPrisma.approvalRequest.findUnique as jest.Mock).mockResolvedValue(mockApprovalWithDetails);

      const result = await handler(mockPrisma, { requestId: 'approval-123' });

      expect(result.success).toBe(true);
      expect(result.approval.id).toBe('approval-123');
      expect(result.approval.stateName).toBe('implementation');
      expect(mockPrisma.approvalRequest.findUnique).toHaveBeenCalledWith({
        where: { id: 'approval-123' },
        include: expect.any(Object),
      });
    });

    it('should include workflow run info', async () => {
      (mockPrisma.approvalRequest.findUnique as jest.Mock).mockResolvedValue(mockApprovalWithDetails);

      const result = await handler(mockPrisma, { requestId: 'approval-123' });

      expect(result.workflowRun.id).toBe('run-456');
      expect(result.workflowRun.status).toBe('paused');
      expect(result.workflowRun.workflow.name).toBe('Analysis Workflow');
    });

    it('should include story info', async () => {
      (mockPrisma.approvalRequest.findUnique as jest.Mock).mockResolvedValue(mockApprovalWithDetails);

      const result = await handler(mockPrisma, { requestId: 'approval-123' });

      expect(result.workflowRun.story.key).toBe('ST-123');
      expect(result.workflowRun.story.title).toBe('Test Story');
    });

    it('should include state info', async () => {
      (mockPrisma.approvalRequest.findUnique as jest.Mock).mockResolvedValue(mockApprovalWithDetails);

      const result = await handler(mockPrisma, { requestId: 'approval-123' });

      expect(result.state.id).toBe('state-789');
      expect(result.state.name).toBe('implementation');
      expect(result.state.order).toBe(2);
      expect(result.state.requiresApproval).toBe(true);
    });
  });

  describe('handler - lookup by runId', () => {
    it('should return pending approval for run', async () => {
      (mockPrisma.approvalRequest.findFirst as jest.Mock).mockResolvedValue(mockApprovalWithDetails);

      const result = await handler(mockPrisma, { runId: 'run-456' });

      expect(result.success).toBe(true);
      expect(result.found).toBe(true);
      expect(result.workflowRun.id).toBe('run-456');
      expect(mockPrisma.approvalRequest.findFirst).toHaveBeenCalledWith({
        where: {
          workflowRunId: 'run-456',
          status: 'pending',
        },
        include: expect.any(Object),
        orderBy: { requestedAt: 'desc' },
      });
    });
  });

  describe('handler - error cases', () => {
    it('should throw error if no identifiers provided', async () => {
      await expect(handler(mockPrisma, {})).rejects.toThrow(
        'Either requestId or runId is required'
      );
    });

    it('should throw error if approval not found by requestId', async () => {
      (mockPrisma.approvalRequest.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        handler(mockPrisma, { requestId: 'non-existent' })
      ).rejects.toThrow('Approval request not found: non-existent');
    });

    it('should return found=false if no pending approval for runId', async () => {
      (mockPrisma.approvalRequest.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await handler(mockPrisma, { runId: 'run-456' });

      expect(result.success).toBe(true);
      expect(result.found).toBe(false);
      expect(result.message).toBe('No pending approval found for run run-456');
    });
  });

  describe('handler - calculated fields', () => {
    it('should calculate waitingMinutes', async () => {
      const recentApproval = {
        ...mockApprovalWithDetails,
        requestedAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
      };
      (mockPrisma.approvalRequest.findUnique as jest.Mock).mockResolvedValue(recentApproval);

      const result = await handler(mockPrisma, { requestId: 'approval-123' });

      expect(result.approval.waitingMinutes).toBeGreaterThanOrEqual(29);
      expect(result.approval.waitingMinutes).toBeLessThanOrEqual(31);
    });

    it('should include artifacts from artifactKeys', async () => {
      (mockPrisma.approvalRequest.findUnique as jest.Mock).mockResolvedValue(mockApprovalWithDetails);

      const result = await handler(mockPrisma, { requestId: 'approval-123' });

      expect(result.approval.artifactKeys).toEqual(['IMPL_DOC', 'ARCH_DOC']);
    });
  });

  describe('handler - story without story linked', () => {
    it('should handle run without story', async () => {
      const approvalWithoutStory = {
        ...mockApprovalWithDetails,
        workflowRun: {
          ...mockApprovalWithDetails.workflowRun,
          story: null,
        },
      };
      (mockPrisma.approvalRequest.findUnique as jest.Mock).mockResolvedValue(approvalWithoutStory);

      const result = await handler(mockPrisma, { requestId: 'approval-123' });

      expect(result.workflowRun.story).toBeNull();
    });
  });
});
