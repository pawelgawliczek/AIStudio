/**
 * Tests for step_runner MCP tool
 * ST-146: Breakpoint System - Pause/Resume/Step Control
 */

import { PrismaClient } from '@prisma/client';
import { handler } from '../step_runner';

describe('step_runner MCP Tool', () => {
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

  const createMockRun = (status: string, isPaused: boolean, currentStateId?: string) => ({
    id: 'run-123',
    status,
    isPaused,
    metadata: currentStateId ? {
      checkpoint: {
        currentStateId,
        completedStates: [],
      },
    } : null,
    workflow: {
      states: [
        { id: 'state-1', name: 'analysis', order: 1 },
        { id: 'state-2', name: 'implementation', order: 2 },
        { id: 'state-3', name: 'review', order: 3 },
      ],
    },
  });

  describe('Validation', () => {
    it('should throw error if run not found', async () => {
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        handler(mockPrisma, { runId: 'run-123' })
      ).rejects.toThrow('WorkflowRun not found');
    });

    it('should throw error if run is pending', async () => {
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(
        createMockRun('pending', false)
      );

      await expect(
        handler(mockPrisma, { runId: 'run-123' })
      ).rejects.toThrow('Run is pending. Use start_runner to begin execution');
    });

    it('should throw error if run is running and not paused', async () => {
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(
        createMockRun('running', false, 'state-1')
      );

      await expect(
        handler(mockPrisma, { runId: 'run-123' })
      ).rejects.toThrow('Run is actively running. Use pause_runner first');
    });

    it('should throw error if run is completed', async () => {
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(
        createMockRun('completed', false)
      );

      await expect(
        handler(mockPrisma, { runId: 'run-123' })
      ).rejects.toThrow('Run has completed');
    });

    it('should throw error if run is failed', async () => {
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(
        createMockRun('failed', false)
      );

      await expect(
        handler(mockPrisma, { runId: 'run-123' })
      ).rejects.toThrow('Run has failed');
    });

    it('should throw error if run is cancelled', async () => {
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(
        createMockRun('cancelled', false)
      );

      await expect(
        handler(mockPrisma, { runId: 'run-123' })
      ).rejects.toThrow('Run was cancelled');
    });

    it('should throw error if no checkpoint exists', async () => {
      const run = createMockRun('paused', true);
      run.metadata = null;
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(run);

      await expect(
        handler(mockPrisma, { runId: 'run-123' })
      ).rejects.toThrow('Run has no checkpoint');
    });
  });

  describe('Step with Next State', () => {
    it('should create temp breakpoint and resume', async () => {
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(
        createMockRun('paused', true, 'state-1')
      );
      (mockPrisma.runnerBreakpoint.findUnique as jest.Mock).mockResolvedValue(null);
      (mockPrisma.runnerBreakpoint.create as jest.Mock).mockResolvedValue({
        id: 'temp-bp-123',
      });
      (mockPrisma.workflowRun.update as jest.Mock).mockResolvedValue({});

      const result = await handler(mockPrisma, { runId: 'run-123' });

      expect(result.success).toBe(true);
      expect(result.status).toBe('stepping');
      expect(result.currentState.name).toBe('analysis');
      expect(result.nextState.name).toBe('implementation');
      expect(result.tempBreakpointId).toBe('temp-bp-123');
      expect(result.willPauseAt).toBe('before implementation');
    });

    it('should create temp breakpoint with isTemporary=true', async () => {
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(
        createMockRun('paused', true, 'state-1')
      );
      (mockPrisma.runnerBreakpoint.findUnique as jest.Mock).mockResolvedValue(null);
      (mockPrisma.runnerBreakpoint.create as jest.Mock).mockResolvedValue({ id: 'temp-bp' });
      (mockPrisma.workflowRun.update as jest.Mock).mockResolvedValue({});

      await handler(mockPrisma, { runId: 'run-123' });

      expect(mockPrisma.runnerBreakpoint.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          stateId: 'state-2',
          position: 'before',
          isTemporary: true,
          isActive: true,
        }),
      });
    });

    it('should reuse existing breakpoint and mark as temporary', async () => {
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(
        createMockRun('paused', true, 'state-1')
      );
      (mockPrisma.runnerBreakpoint.findUnique as jest.Mock).mockResolvedValue({
        id: 'existing-bp',
        isTemporary: false,
      });
      (mockPrisma.runnerBreakpoint.update as jest.Mock).mockResolvedValue({ id: 'existing-bp' });
      (mockPrisma.workflowRun.update as jest.Mock).mockResolvedValue({});

      const result = await handler(mockPrisma, { runId: 'run-123' });

      expect(result.tempBreakpointId).toBe('existing-bp');
      expect(mockPrisma.runnerBreakpoint.update).toHaveBeenCalledWith({
        where: { id: 'existing-bp' },
        data: expect.objectContaining({
          isActive: true,
          isTemporary: true,
          hitAt: null,
        }),
      });
    });

    it('should clear isPaused flag when stepping', async () => {
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(
        createMockRun('paused', true, 'state-1')
      );
      (mockPrisma.runnerBreakpoint.findUnique as jest.Mock).mockResolvedValue(null);
      (mockPrisma.runnerBreakpoint.create as jest.Mock).mockResolvedValue({ id: 'temp-bp' });
      (mockPrisma.workflowRun.update as jest.Mock).mockResolvedValue({});

      await handler(mockPrisma, { runId: 'run-123' });

      expect(mockPrisma.workflowRun.update).toHaveBeenCalledWith({
        where: { id: 'run-123' },
        data: expect.objectContaining({
          isPaused: false,
          pauseReason: null,
        }),
      });
    });
  });

  describe('Step at Final State', () => {
    it('should step to completion at final state', async () => {
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(
        createMockRun('paused', true, 'state-3') // Final state
      );
      (mockPrisma.workflowRun.update as jest.Mock).mockResolvedValue({});

      const result = await handler(mockPrisma, { runId: 'run-123' });

      expect(result.success).toBe(true);
      expect(result.status).toBe('stepping_to_completion');
      expect(result.currentState.name).toBe('review');
      expect(result.nextState).toBeNull();
      expect(result.willPauseAt).toBe('completion');
    });

    it('should not create temp breakpoint at final state', async () => {
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(
        createMockRun('paused', true, 'state-3')
      );
      (mockPrisma.workflowRun.update as jest.Mock).mockResolvedValue({});

      await handler(mockPrisma, { runId: 'run-123' });

      expect(mockPrisma.runnerBreakpoint.create).not.toHaveBeenCalled();
    });
  });

  describe('Metadata Updates', () => {
    it('should update metadata with step info', async () => {
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(
        createMockRun('paused', true, 'state-1')
      );
      (mockPrisma.runnerBreakpoint.findUnique as jest.Mock).mockResolvedValue(null);
      (mockPrisma.runnerBreakpoint.create as jest.Mock).mockResolvedValue({ id: 'temp-bp' });
      (mockPrisma.workflowRun.update as jest.Mock).mockResolvedValue({});

      await handler(mockPrisma, { runId: 'run-123' });

      expect(mockPrisma.workflowRun.update).toHaveBeenCalledWith({
        where: { id: 'run-123' },
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            breakpointsModifiedAt: expect.any(String),
            stepRequestedAt: expect.any(String),
            stepBreakpointId: 'temp-bp',
          }),
        }),
      });
    });
  });
});
