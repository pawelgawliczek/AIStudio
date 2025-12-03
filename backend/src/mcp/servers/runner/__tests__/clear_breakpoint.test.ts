/**
 * Tests for clear_breakpoint MCP tool
 * ST-146: Breakpoint System - Pause/Resume/Step Control
 */

import { PrismaClient } from '@prisma/client';
import { handler } from '../clear_breakpoint';

describe('clear_breakpoint MCP Tool', () => {
  let mockPrisma: jest.Mocked<PrismaClient>;

  beforeEach(() => {
    mockPrisma = {
      workflowRun: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      runnerBreakpoint: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
    } as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const mockWorkflowRun = {
    id: 'run-123',
    metadata: {},
    workflow: {
      states: [
        { id: 'state-1', name: 'analysis', order: 1 },
        { id: 'state-2', name: 'implementation', order: 2 },
      ],
    },
  };

  describe('Clear by Breakpoint ID', () => {
    it('should clear specific breakpoint', async () => {
      (mockPrisma.runnerBreakpoint.findUnique as jest.Mock).mockResolvedValue({
        id: 'bp-123',
        workflowRunId: 'run-123',
        position: 'before',
        state: { name: 'analysis' },
      });
      (mockPrisma.runnerBreakpoint.delete as jest.Mock).mockResolvedValue({});
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue({ metadata: {} });
      (mockPrisma.workflowRun.update as jest.Mock).mockResolvedValue({});

      const result = await handler(mockPrisma, { breakpointId: 'bp-123' });

      expect(result.success).toBe(true);
      expect(result.clearedCount).toBe(1);
      expect(result.breakpoints).toHaveLength(1);
      expect(result.breakpoints[0].stateName).toBe('analysis');
    });

    it('should return success with count=0 for non-existent breakpoint (idempotent)', async () => {
      (mockPrisma.runnerBreakpoint.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await handler(mockPrisma, { breakpointId: 'nonexistent' });

      expect(result.success).toBe(true);
      expect(result.clearedCount).toBe(0);
      expect(result.message).toContain('not found');
    });
  });

  describe('Clear All for Run', () => {
    it('should clear all breakpoints for a run', async () => {
      (mockPrisma.runnerBreakpoint.findMany as jest.Mock).mockResolvedValue([
        { id: 'bp-1', position: 'before', state: { name: 'analysis' } },
        { id: 'bp-2', position: 'after', state: { name: 'implementation' } },
      ]);
      (mockPrisma.runnerBreakpoint.deleteMany as jest.Mock).mockResolvedValue({ count: 2 });
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue({ metadata: {} });
      (mockPrisma.workflowRun.update as jest.Mock).mockResolvedValue({});

      const result = await handler(mockPrisma, { runId: 'run-123', clearAll: true });

      expect(result.success).toBe(true);
      expect(result.clearedCount).toBe(2);
      expect(result.breakpoints).toHaveLength(2);
    });

    it('should return success with count=0 if no breakpoints exist', async () => {
      (mockPrisma.runnerBreakpoint.findMany as jest.Mock).mockResolvedValue([]);

      const result = await handler(mockPrisma, { runId: 'run-123', clearAll: true });

      expect(result.success).toBe(true);
      expect(result.clearedCount).toBe(0);
      expect(result.message).toBe('No breakpoints to clear');
    });
  });

  describe('Clear by State + Position', () => {
    it('should clear breakpoint by state name and position', async () => {
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockWorkflowRun);
      (mockPrisma.runnerBreakpoint.findUnique as jest.Mock).mockResolvedValue({
        id: 'bp-123',
        position: 'before',
      });
      (mockPrisma.runnerBreakpoint.delete as jest.Mock).mockResolvedValue({});
      (mockPrisma.workflowRun.update as jest.Mock).mockResolvedValue({});

      const result = await handler(mockPrisma, {
        runId: 'run-123',
        stateName: 'analysis',
        position: 'before',
      });

      expect(result.success).toBe(true);
      expect(result.clearedCount).toBe(1);
    });

    it('should clear breakpoint by stateId and position', async () => {
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockWorkflowRun);
      (mockPrisma.runnerBreakpoint.findUnique as jest.Mock).mockResolvedValue({
        id: 'bp-123',
        position: 'after',
      });
      (mockPrisma.runnerBreakpoint.delete as jest.Mock).mockResolvedValue({});
      (mockPrisma.workflowRun.update as jest.Mock).mockResolvedValue({});

      const result = await handler(mockPrisma, {
        runId: 'run-123',
        stateId: 'state-1',
        position: 'after',
      });

      expect(result.success).toBe(true);
      expect(result.clearedCount).toBe(1);
    });

    it('should return success with count=0 if breakpoint not found at location', async () => {
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockWorkflowRun);
      (mockPrisma.runnerBreakpoint.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await handler(mockPrisma, {
        runId: 'run-123',
        stateName: 'analysis',
        position: 'before',
      });

      expect(result.success).toBe(true);
      expect(result.clearedCount).toBe(0);
    });
  });

  describe('Validation', () => {
    it('should throw error if no runId or breakpointId provided', async () => {
      await expect(
        handler(mockPrisma, {})
      ).rejects.toThrow('Must provide breakpointId OR runId with state info or clearAll');
    });

    it('should throw error if position missing for state-based clear', async () => {
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockWorkflowRun);

      await expect(
        handler(mockPrisma, { runId: 'run-123', stateName: 'analysis' })
      ).rejects.toThrow('Position is required when clearing by state');
    });

    it('should throw error if run not found', async () => {
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        handler(mockPrisma, { runId: 'run-123', stateName: 'analysis', position: 'before' })
      ).rejects.toThrow('WorkflowRun not found');
    });

    it('should throw error if state not found', async () => {
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockWorkflowRun);

      await expect(
        handler(mockPrisma, { runId: 'run-123', stateName: 'nonexistent', position: 'before' })
      ).rejects.toThrow("State 'nonexistent' not found in workflow");
    });
  });

  describe('Metadata Update', () => {
    it('should update breakpointsModifiedAt when clearing', async () => {
      (mockPrisma.runnerBreakpoint.findUnique as jest.Mock).mockResolvedValue({
        id: 'bp-123',
        workflowRunId: 'run-123',
        position: 'before',
        state: { name: 'analysis' },
      });
      (mockPrisma.runnerBreakpoint.delete as jest.Mock).mockResolvedValue({});
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue({ metadata: {} });
      (mockPrisma.workflowRun.update as jest.Mock).mockResolvedValue({});

      await handler(mockPrisma, { breakpointId: 'bp-123' });

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
