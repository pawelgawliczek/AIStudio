/**
 * Tests for list_breakpoints MCP tool
 * ST-146: Breakpoint System - Pause/Resume/Step Control
 */

import { handler } from '../list_breakpoints';
import { PrismaClient } from '@prisma/client';

describe('list_breakpoints MCP Tool', () => {
  let mockPrisma: jest.Mocked<PrismaClient>;

  beforeEach(() => {
    mockPrisma = {
      workflowRun: {
        findUnique: jest.fn(),
      },
      runnerBreakpoint: {
        findMany: jest.fn(),
      },
    } as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const mockWorkflowRun = {
    id: 'run-123',
    status: 'running',
    workflow: {
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
        handler(mockPrisma, { runId: 'run-123' })
      ).rejects.toThrow('WorkflowRun not found');
    });
  });

  describe('List Breakpoints', () => {
    it('should return empty list when no breakpoints', async () => {
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockWorkflowRun);
      (mockPrisma.runnerBreakpoint.findMany as jest.Mock).mockResolvedValue([]);

      const result = await handler(mockPrisma, { runId: 'run-123' });

      expect(result.success).toBe(true);
      expect(result.breakpoints).toHaveLength(0);
      expect(result.totalStates).toBe(3);
      expect(result.summary.total).toBe(0);
    });

    it('should return breakpoints with state info', async () => {
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockWorkflowRun);
      (mockPrisma.runnerBreakpoint.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'bp-1',
          stateId: 'state-1',
          position: 'before',
          isActive: true,
          isTemporary: false,
          condition: null,
          hitAt: null,
          createdAt: new Date('2025-01-01'),
          state: { name: 'analysis', order: 1 },
        },
        {
          id: 'bp-2',
          stateId: 'state-2',
          position: 'after',
          isActive: true,
          isTemporary: false,
          condition: { tokenCount: { $gt: 10000 } },
          hitAt: new Date('2025-01-01T12:00:00Z'),
          createdAt: new Date('2025-01-01'),
          state: { name: 'implementation', order: 2 },
        },
      ]);

      const result = await handler(mockPrisma, { runId: 'run-123' });

      expect(result.success).toBe(true);
      expect(result.breakpoints).toHaveLength(2);
      expect(result.breakpoints[0].stateName).toBe('analysis');
      expect(result.breakpoints[0].position).toBe('before');
      expect(result.breakpoints[1].condition).toBeDefined();
      expect(result.breakpoints[1].hitAt).toBeDefined();
    });

    it('should filter inactive breakpoints by default', async () => {
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockWorkflowRun);
      (mockPrisma.runnerBreakpoint.findMany as jest.Mock).mockResolvedValue([]);

      await handler(mockPrisma, { runId: 'run-123' });

      expect(mockPrisma.runnerBreakpoint.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { workflowRunId: 'run-123', isActive: true },
        })
      );
    });

    it('should include inactive breakpoints when requested', async () => {
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockWorkflowRun);
      (mockPrisma.runnerBreakpoint.findMany as jest.Mock).mockResolvedValue([]);

      await handler(mockPrisma, { runId: 'run-123', includeInactive: true });

      expect(mockPrisma.runnerBreakpoint.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { workflowRunId: 'run-123' },
        })
      );
    });
  });

  describe('Summary Statistics', () => {
    it('should calculate summary stats correctly', async () => {
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockWorkflowRun);
      (mockPrisma.runnerBreakpoint.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'bp-1',
          stateId: 'state-1',
          position: 'before',
          isActive: true,
          isTemporary: false,
          condition: null,
          hitAt: null,
          createdAt: new Date(),
          state: { name: 'analysis', order: 1 },
        },
        {
          id: 'bp-2',
          stateId: 'state-2',
          position: 'after',
          isActive: true,
          isTemporary: true,
          condition: { tokenCount: { $gt: 5000 } },
          hitAt: new Date(),
          createdAt: new Date(),
          state: { name: 'implementation', order: 2 },
        },
        {
          id: 'bp-3',
          stateId: 'state-3',
          position: 'before',
          isActive: false,
          isTemporary: false,
          condition: null,
          hitAt: null,
          createdAt: new Date(),
          state: { name: 'review', order: 3 },
        },
      ]);

      const result = await handler(mockPrisma, { runId: 'run-123', includeInactive: true });

      expect(result.summary.total).toBe(3);
      expect(result.summary.active).toBe(2);
      expect(result.summary.inactive).toBe(1);
      expect(result.summary.hit).toBe(1);
      expect(result.summary.beforeBreakpoints).toBe(2);
      expect(result.summary.afterBreakpoints).toBe(1);
      expect(result.summary.temporary).toBe(1);
      expect(result.summary.conditional).toBe(1);
    });
  });

  describe('Response Format', () => {
    it('should include run status and total states', async () => {
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockWorkflowRun);
      (mockPrisma.runnerBreakpoint.findMany as jest.Mock).mockResolvedValue([]);

      const result = await handler(mockPrisma, { runId: 'run-123' });

      expect(result.runId).toBe('run-123');
      expect(result.runStatus).toBe('running');
      expect(result.totalStates).toBe(3);
    });

    it('should format timestamps as ISO strings', async () => {
      const hitDate = new Date('2025-01-01T12:00:00Z');
      const createdDate = new Date('2025-01-01T10:00:00Z');

      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockWorkflowRun);
      (mockPrisma.runnerBreakpoint.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'bp-1',
          stateId: 'state-1',
          position: 'before',
          isActive: true,
          isTemporary: false,
          condition: null,
          hitAt: hitDate,
          createdAt: createdDate,
          state: { name: 'analysis', order: 1 },
        },
      ]);

      const result = await handler(mockPrisma, { runId: 'run-123' });

      expect(result.breakpoints[0].hitAt).toBe(hitDate.toISOString());
      expect(result.breakpoints[0].createdAt).toBe(createdDate.toISOString());
    });
  });
});
