/**
 * Tests for set_breakpoint MCP tool
 * ST-146: Breakpoint System - Pause/Resume/Step Control
 */

import { PrismaClient } from '@prisma/client';
import { handler } from '../set_breakpoint';

describe('set_breakpoint MCP Tool', () => {
  let mockPrisma: jest.Mocked<PrismaClient>;

  beforeEach(() => {
    mockPrisma = {
      workflowRun: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      runnerBreakpoint: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    } as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const mockWorkflowRun = {
    id: 'run-123',
    workflowId: 'workflow-456',
    status: 'running',
    metadata: {},
    workflow: {
      id: 'workflow-456',
      name: 'Test Workflow',
      states: [
        { id: 'state-1', name: 'analysis', order: 1 },
        { id: 'state-2', name: 'implementation', order: 2 },
        { id: 'state-3', name: 'review', order: 3 },
      ],
    },
  };

  describe('Validation', () => {
    it('should throw error if run not found', async () => {
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        handler(mockPrisma, { runId: 'run-123', stateId: 'state-1' })
      ).rejects.toThrow('WorkflowRun not found');
    });

    it('should throw error if no state identifier provided', async () => {
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockWorkflowRun);

      await expect(
        handler(mockPrisma, { runId: 'run-123' })
      ).rejects.toThrow('Must provide stateId, stateName, or stateOrder');
    });

    it('should throw error if state not found by ID', async () => {
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockWorkflowRun);

      await expect(
        handler(mockPrisma, { runId: 'run-123', stateId: 'invalid-state' })
      ).rejects.toThrow('State invalid-state not found in workflow');
    });

    it('should throw error if state not found by name', async () => {
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockWorkflowRun);

      await expect(
        handler(mockPrisma, { runId: 'run-123', stateName: 'nonexistent' })
      ).rejects.toThrow("State 'nonexistent' not found in workflow");
    });

    it('should throw error if state not found by order', async () => {
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockWorkflowRun);

      await expect(
        handler(mockPrisma, { runId: 'run-123', stateOrder: 99 })
      ).rejects.toThrow('State at order 99 not found');
    });
  });

  describe('Create Breakpoint', () => {
    it('should create breakpoint by stateId', async () => {
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockWorkflowRun);
      (mockPrisma.runnerBreakpoint.findUnique as jest.Mock).mockResolvedValue(null);
      (mockPrisma.runnerBreakpoint.create as jest.Mock).mockResolvedValue({
        id: 'bp-123',
        workflowRunId: 'run-123',
        stateId: 'state-1',
        position: 'before',
        isActive: true,
        condition: null,
      });
      (mockPrisma.workflowRun.update as jest.Mock).mockResolvedValue(mockWorkflowRun);

      const result = await handler(mockPrisma, {
        runId: 'run-123',
        stateId: 'state-1',
        position: 'before',
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('created');
      expect(result.breakpointId).toBe('bp-123');
      expect(result.stateName).toBe('analysis');
      expect(result.position).toBe('before');
    });

    it('should create breakpoint by stateName (case insensitive)', async () => {
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockWorkflowRun);
      (mockPrisma.runnerBreakpoint.findUnique as jest.Mock).mockResolvedValue(null);
      (mockPrisma.runnerBreakpoint.create as jest.Mock).mockResolvedValue({
        id: 'bp-123',
        stateId: 'state-2',
        position: 'after',
        isActive: true,
        condition: null,
      });
      (mockPrisma.workflowRun.update as jest.Mock).mockResolvedValue(mockWorkflowRun);

      const result = await handler(mockPrisma, {
        runId: 'run-123',
        stateName: 'IMPLEMENTATION', // Case insensitive
        position: 'after',
      });

      expect(result.success).toBe(true);
      expect(result.stateName).toBe('implementation');
      expect(result.stateOrder).toBe(2);
    });

    it('should create breakpoint by stateOrder', async () => {
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockWorkflowRun);
      (mockPrisma.runnerBreakpoint.findUnique as jest.Mock).mockResolvedValue(null);
      (mockPrisma.runnerBreakpoint.create as jest.Mock).mockResolvedValue({
        id: 'bp-123',
        stateId: 'state-3',
        position: 'before',
        isActive: true,
        condition: null,
      });
      (mockPrisma.workflowRun.update as jest.Mock).mockResolvedValue(mockWorkflowRun);

      const result = await handler(mockPrisma, {
        runId: 'run-123',
        stateOrder: 3,
      });

      expect(result.success).toBe(true);
      expect(result.stateName).toBe('review');
      expect(result.stateOrder).toBe(3);
    });

    it('should default position to "before"', async () => {
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockWorkflowRun);
      (mockPrisma.runnerBreakpoint.findUnique as jest.Mock).mockResolvedValue(null);
      (mockPrisma.runnerBreakpoint.create as jest.Mock).mockResolvedValue({
        id: 'bp-123',
        position: 'before',
        isActive: true,
        condition: null,
      });
      (mockPrisma.workflowRun.update as jest.Mock).mockResolvedValue(mockWorkflowRun);

      const result = await handler(mockPrisma, {
        runId: 'run-123',
        stateId: 'state-1',
      });

      expect(result.position).toBe('before');
    });

    it('should create conditional breakpoint', async () => {
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockWorkflowRun);
      (mockPrisma.runnerBreakpoint.findUnique as jest.Mock).mockResolvedValue(null);

      const condition = { tokenCount: { $gt: 10000 } };
      (mockPrisma.runnerBreakpoint.create as jest.Mock).mockResolvedValue({
        id: 'bp-123',
        position: 'after',
        isActive: true,
        condition,
      });
      (mockPrisma.workflowRun.update as jest.Mock).mockResolvedValue(mockWorkflowRun);

      const result = await handler(mockPrisma, {
        runId: 'run-123',
        stateId: 'state-1',
        position: 'after',
        condition,
      });

      expect(result.success).toBe(true);
      expect(result.condition).toEqual(condition);
    });
  });

  describe('Existing Breakpoint', () => {
    it('should return already_exists for active duplicate', async () => {
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockWorkflowRun);
      (mockPrisma.runnerBreakpoint.findUnique as jest.Mock).mockResolvedValue({
        id: 'bp-existing',
        isActive: true,
        condition: null,
      });

      const result = await handler(mockPrisma, {
        runId: 'run-123',
        stateId: 'state-1',
        position: 'before',
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('already_exists');
      expect(result.breakpointId).toBe('bp-existing');
    });

    it('should reactivate inactive breakpoint', async () => {
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockWorkflowRun);
      (mockPrisma.runnerBreakpoint.findUnique as jest.Mock).mockResolvedValue({
        id: 'bp-existing',
        isActive: false,
        condition: null,
      });
      (mockPrisma.runnerBreakpoint.update as jest.Mock).mockResolvedValue({
        id: 'bp-existing',
        isActive: true,
        condition: null,
      });
      (mockPrisma.workflowRun.update as jest.Mock).mockResolvedValue(mockWorkflowRun);

      const result = await handler(mockPrisma, {
        runId: 'run-123',
        stateId: 'state-1',
        position: 'before',
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('reactivated');
    });

    it('should update condition on existing breakpoint', async () => {
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockWorkflowRun);
      (mockPrisma.runnerBreakpoint.findUnique as jest.Mock).mockResolvedValue({
        id: 'bp-existing',
        isActive: true,
        condition: null,
      });

      const newCondition = { agentSpawns: { $gte: 5 } };
      (mockPrisma.runnerBreakpoint.update as jest.Mock).mockResolvedValue({
        id: 'bp-existing',
        isActive: true,
        condition: newCondition,
      });
      (mockPrisma.workflowRun.update as jest.Mock).mockResolvedValue(mockWorkflowRun);

      const result = await handler(mockPrisma, {
        runId: 'run-123',
        stateId: 'state-1',
        position: 'before',
        condition: newCondition,
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('updated');
    });
  });

  describe('Metadata Update', () => {
    it('should update breakpointsModifiedAt in run metadata', async () => {
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockWorkflowRun);
      (mockPrisma.runnerBreakpoint.findUnique as jest.Mock).mockResolvedValue(null);
      (mockPrisma.runnerBreakpoint.create as jest.Mock).mockResolvedValue({
        id: 'bp-123',
        isActive: true,
        condition: null,
      });
      (mockPrisma.workflowRun.update as jest.Mock).mockResolvedValue(mockWorkflowRun);

      await handler(mockPrisma, {
        runId: 'run-123',
        stateId: 'state-1',
      });

      expect(mockPrisma.workflowRun.update).toHaveBeenCalledWith({
        where: { id: 'run-123' },
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            breakpointsModifiedAt: expect.any(String),
          }),
        }),
      });
    });
  });
});
