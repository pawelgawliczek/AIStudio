/**
 * Tests for get_pending_approvals MCP tool
 * ST-148: Approval Gates - Human-in-the-Loop
 */

import { PrismaClient } from '@prisma/client';
import { handler, tool } from '../get_pending_approvals';

describe('get_pending_approvals', () => {
  let mockPrisma: jest.Mocked<PrismaClient>;

  const mockApproval = {
    id: 'approval-123',
    workflowRunId: 'run-456',
    stateId: 'state-789',
    projectId: 'project-abc',
    stateName: 'implementation',
    stateOrder: 2,
    requestedBy: 'runner',
    requestedAt: new Date(Date.now() - 15 * 60 * 1000), // 15 minutes ago
    status: 'pending',
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
      workflowId: 'workflow-001',
      status: 'paused',
      story: { key: 'ST-123', title: 'Test Story' },
      workflow: { name: 'Analysis Workflow' },
    },
  };

  beforeEach(() => {
    mockPrisma = {
      approvalRequest: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
    } as unknown as jest.Mocked<PrismaClient>;
  });

  describe('tool definition', () => {
    it('should have correct name', () => {
      expect(tool.name).toBe('get_pending_approvals');
    });

    it('should not require any parameters', () => {
      expect(tool.inputSchema.required).toEqual([]);
    });

    it('should have projectId, workflowId, runId, page, pageSize as optional', () => {
      const props = tool.inputSchema.properties;
      expect(props.projectId).toBeDefined();
      expect(props.workflowId).toBeDefined();
      expect(props.runId).toBeDefined();
      expect(props.page).toBeDefined();
      expect(props.pageSize).toBeDefined();
    });
  });

  describe('handler', () => {
    it('should return paginated list of pending approvals', async () => {
      (mockPrisma.approvalRequest.findMany as jest.Mock).mockResolvedValue([mockApproval]);
      (mockPrisma.approvalRequest.count as jest.Mock).mockResolvedValue(1);

      const result = await handler(mockPrisma, {});

      expect(result.success).toBe(true);
      expect(result.approvals).toHaveLength(1);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.pageSize).toBe(20);
      expect(result.pagination.total).toBe(1);
    });

    it('should include waitingMinutes in response', async () => {
      (mockPrisma.approvalRequest.findMany as jest.Mock).mockResolvedValue([mockApproval]);
      (mockPrisma.approvalRequest.count as jest.Mock).mockResolvedValue(1);

      const result = await handler(mockPrisma, {});

      expect(result.approvals[0].waitingMinutes).toBeGreaterThanOrEqual(14);
      expect(result.approvals[0].waitingMinutes).toBeLessThanOrEqual(16);
    });

    it('should include story info in response', async () => {
      (mockPrisma.approvalRequest.findMany as jest.Mock).mockResolvedValue([mockApproval]);
      (mockPrisma.approvalRequest.count as jest.Mock).mockResolvedValue(1);

      const result = await handler(mockPrisma, {});

      expect(result.approvals[0].story).toEqual({
        key: 'ST-123',
        title: 'Test Story',
      });
    });

    it('should include workflow info in response', async () => {
      (mockPrisma.approvalRequest.findMany as jest.Mock).mockResolvedValue([mockApproval]);
      (mockPrisma.approvalRequest.count as jest.Mock).mockResolvedValue(1);

      const result = await handler(mockPrisma, {});

      expect(result.approvals[0].workflow).toEqual({
        name: 'Analysis Workflow',
      });
    });

    it('should filter by projectId', async () => {
      (mockPrisma.approvalRequest.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.approvalRequest.count as jest.Mock).mockResolvedValue(0);

      await handler(mockPrisma, { projectId: 'project-abc' });

      expect(mockPrisma.approvalRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            projectId: 'project-abc',
          }),
        })
      );
    });

    it('should filter by workflowId', async () => {
      (mockPrisma.approvalRequest.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.approvalRequest.count as jest.Mock).mockResolvedValue(0);

      await handler(mockPrisma, { workflowId: 'workflow-001' });

      expect(mockPrisma.approvalRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            workflowRun: { workflowId: 'workflow-001' },
          }),
        })
      );
    });

    it('should filter by runId', async () => {
      (mockPrisma.approvalRequest.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.approvalRequest.count as jest.Mock).mockResolvedValue(0);

      await handler(mockPrisma, { runId: 'run-456' });

      expect(mockPrisma.approvalRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            workflowRunId: 'run-456',
          }),
        })
      );
    });

    it('should handle pagination', async () => {
      (mockPrisma.approvalRequest.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.approvalRequest.count as jest.Mock).mockResolvedValue(50);

      const result = await handler(mockPrisma, { page: 2, pageSize: 10 });

      expect(mockPrisma.approvalRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        })
      );
      expect(result.pagination.page).toBe(2);
      expect(result.pagination.pageSize).toBe(10);
      expect(result.pagination.totalPages).toBe(5);
    });

    it('should limit pageSize to 100', async () => {
      (mockPrisma.approvalRequest.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.approvalRequest.count as jest.Mock).mockResolvedValue(0);

      await handler(mockPrisma, { pageSize: 200 });

      expect(mockPrisma.approvalRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 100,
        })
      );
    });

    it('should return empty list when no pending approvals', async () => {
      (mockPrisma.approvalRequest.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.approvalRequest.count as jest.Mock).mockResolvedValue(0);

      const result = await handler(mockPrisma, {});

      expect(result.success).toBe(true);
      expect(result.approvals).toEqual([]);
      expect(result.pagination.total).toBe(0);
    });
  });
});
