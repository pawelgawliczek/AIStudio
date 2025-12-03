/**
 * Tests for get_runner_checkpoint MCP tool
 */

import { PrismaClient } from '@prisma/client';
import { handler } from '../get_runner_checkpoint';

describe('get_runner_checkpoint MCP Tool', () => {
  let mockPrisma: jest.Mocked<PrismaClient>;

  beforeEach(() => {
    mockPrisma = {
      workflowRun: {
        findUnique: jest.fn(),
      },
    } as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Functionality', () => {
    it('should throw error if run not found', async () => {
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        handler(mockPrisma, { runId: 'run-123' })
      ).rejects.toThrow('WorkflowRun not found');
    });

    it('should return no checkpoint message when checkpoint not present', async () => {
      const mockRun = {
        id: 'run-123',
        status: 'pending',
        workflow: {
          id: 'workflow-456',
          states: [],
        },
        metadata: {},
      };

      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);

      const result = await handler(mockPrisma, { runId: 'run-123' });

      expect(result.success).toBe(true);
      expect(result.hasCheckpoint).toBe(false);
      expect(result.message).toContain('No checkpoint found');
      expect(result.runStatus).toBe('pending');
    });

    it('should return checkpoint when present', async () => {
      const checkpoint = {
        version: 1,
        runId: 'run-123',
        workflowId: 'workflow-456',
        currentStateId: 'state-2',
        currentPhase: 'agent',
        completedStates: ['state-1'],
        skippedStates: [],
        masterSessionId: 'session-abc',
        resourceUsage: {
          tokensUsed: 10000,
          agentSpawns: 3,
          stateTransitions: 5,
          durationMs: 60000,
        },
        checkpointedAt: '2025-01-01T00:10:00Z',
        runStartedAt: '2025-01-01T00:00:00Z',
      };

      const mockRun = {
        id: 'run-123',
        workflow: {
          id: 'workflow-456',
          states: [
            { id: 'state-1', name: 'State 1', order: 1 },
            { id: 'state-2', name: 'State 2', order: 2 },
          ],
        },
        metadata: { checkpoint },
      };

      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);

      const result = await handler(mockPrisma, { runId: 'run-123' });

      expect(result.success).toBe(true);
      expect(result.hasCheckpoint).toBe(true);
      expect(result.checkpoint).toBeDefined();
    });
  });

  describe('Current Execution', () => {
    it('should format current execution with state name', async () => {
      const checkpoint = {
        version: 1,
        runId: 'run-123',
        workflowId: 'workflow-456',
        currentStateId: 'state-2',
        currentPhase: 'agent',
        completedStates: ['state-1'],
        skippedStates: [],
        masterSessionId: 'session-abc',
        resourceUsage: { tokensUsed: 0, agentSpawns: 0, stateTransitions: 0, durationMs: 0 },
        checkpointedAt: '2025-01-01T00:00:00Z',
        runStartedAt: '2025-01-01T00:00:00Z',
      };

      const mockRun = {
        id: 'run-123',
        workflow: {
          id: 'workflow-456',
          states: [
            { id: 'state-1', name: 'Initialize', order: 1 },
            { id: 'state-2', name: 'Process Data', order: 2 },
          ],
        },
        metadata: { checkpoint },
      };

      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);

      const result = await handler(mockPrisma, { runId: 'run-123' });

      expect(result.checkpoint.currentExecution.stateId).toBe('state-2');
      expect(result.checkpoint.currentExecution.stateName).toBe('Process Data (order: 2)');
      expect(result.checkpoint.currentExecution.phase).toBe('agent');
    });

    it('should show master session ID', async () => {
      const checkpoint = {
        version: 1,
        runId: 'run-123',
        workflowId: 'workflow-456',
        currentStateId: 'state-1',
        currentPhase: 'pre',
        completedStates: [],
        skippedStates: [],
        masterSessionId: 'master-session-xyz',
        resourceUsage: { tokensUsed: 0, agentSpawns: 0, stateTransitions: 0, durationMs: 0 },
        checkpointedAt: '2025-01-01T00:00:00Z',
        runStartedAt: '2025-01-01T00:00:00Z',
      };

      const mockRun = {
        id: 'run-123',
        workflow: {
          id: 'workflow-456',
          states: [{ id: 'state-1', name: 'State 1', order: 1 }],
        },
        metadata: { checkpoint },
      };

      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);

      const result = await handler(mockPrisma, { runId: 'run-123' });

      expect(result.checkpoint.masterSessionId).toBe('master-session-xyz');
    });
  });

  describe('Progress Information', () => {
    it('should format completed and skipped states', async () => {
      const checkpoint = {
        version: 1,
        runId: 'run-123',
        workflowId: 'workflow-456',
        currentStateId: 'state-4',
        currentPhase: 'agent',
        completedStates: ['state-1', 'state-2'],
        skippedStates: ['state-3'],
        masterSessionId: 'session-abc',
        resourceUsage: { tokensUsed: 0, agentSpawns: 0, stateTransitions: 0, durationMs: 0 },
        checkpointedAt: '2025-01-01T00:00:00Z',
        runStartedAt: '2025-01-01T00:00:00Z',
      };

      const mockRun = {
        id: 'run-123',
        workflow: {
          id: 'workflow-456',
          states: [
            { id: 'state-1', name: 'Init', order: 1 },
            { id: 'state-2', name: 'Validate', order: 2 },
            { id: 'state-3', name: 'Optional', order: 3 },
            { id: 'state-4', name: 'Process', order: 4 },
          ],
        },
        metadata: { checkpoint },
      };

      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);

      const result = await handler(mockPrisma, { runId: 'run-123' });

      expect(result.checkpoint.progress.completedStates).toEqual([
        'Init (order: 1)',
        'Validate (order: 2)',
      ]);
      expect(result.checkpoint.progress.skippedStates).toEqual(['Optional (order: 3)']);
      expect(result.checkpoint.progress.completedCount).toBe(2);
      expect(result.checkpoint.progress.skippedCount).toBe(1);
      expect(result.checkpoint.progress.totalStates).toBe(4);
    });

    it('should handle empty completed and skipped states', async () => {
      const checkpoint = {
        version: 1,
        runId: 'run-123',
        workflowId: 'workflow-456',
        currentStateId: 'state-1',
        currentPhase: 'pre',
        completedStates: [],
        skippedStates: [],
        masterSessionId: 'session-abc',
        resourceUsage: { tokensUsed: 0, agentSpawns: 0, stateTransitions: 0, durationMs: 0 },
        checkpointedAt: '2025-01-01T00:00:00Z',
        runStartedAt: '2025-01-01T00:00:00Z',
      };

      const mockRun = {
        id: 'run-123',
        workflow: {
          id: 'workflow-456',
          states: [{ id: 'state-1', name: 'State 1', order: 1 }],
        },
        metadata: { checkpoint },
      };

      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);

      const result = await handler(mockPrisma, { runId: 'run-123' });

      expect(result.checkpoint.progress.completedStates).toEqual([]);
      expect(result.checkpoint.progress.skippedStates).toEqual([]);
      expect(result.checkpoint.progress.completedCount).toBe(0);
      expect(result.checkpoint.progress.skippedCount).toBe(0);
    });
  });

  describe('Resource Usage Formatting', () => {
    it('should format resource usage with durations', async () => {
      const checkpoint = {
        version: 1,
        runId: 'run-123',
        workflowId: 'workflow-456',
        currentStateId: 'state-1',
        currentPhase: 'agent',
        completedStates: [],
        skippedStates: [],
        masterSessionId: 'session-abc',
        resourceUsage: {
          tokensUsed: 50000,
          agentSpawns: 7,
          stateTransitions: 12,
          durationMs: 7380000, // 2h 3m
        },
        checkpointedAt: '2025-01-01T00:00:00Z',
        runStartedAt: '2025-01-01T00:00:00Z',
      };

      const mockRun = {
        id: 'run-123',
        workflow: {
          id: 'workflow-456',
          states: [{ id: 'state-1', name: 'State 1', order: 1 }],
        },
        metadata: { checkpoint },
      };

      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);

      const result = await handler(mockPrisma, { runId: 'run-123' });

      expect(result.checkpoint.resourceUsage.tokensUsed).toBe(50000);
      expect(result.checkpoint.resourceUsage.agentSpawns).toBe(7);
      expect(result.checkpoint.resourceUsage.stateTransitions).toBe(12);
      expect(result.checkpoint.resourceUsage.durationMs).toBe(7380000);
      expect(result.checkpoint.resourceUsage.durationFormatted).toBe('2h 3m 0s');
    });

    it('should format seconds only', async () => {
      const checkpoint = {
        version: 1,
        runId: 'run-123',
        workflowId: 'workflow-456',
        currentStateId: 'state-1',
        currentPhase: 'pre',
        completedStates: [],
        skippedStates: [],
        masterSessionId: 'session-abc',
        resourceUsage: {
          tokensUsed: 0,
          agentSpawns: 0,
          stateTransitions: 0,
          durationMs: 45000,
        },
        checkpointedAt: '2025-01-01T00:00:00Z',
        runStartedAt: '2025-01-01T00:00:00Z',
      };

      const mockRun = {
        id: 'run-123',
        workflow: {
          id: 'workflow-456',
          states: [{ id: 'state-1', name: 'State 1', order: 1 }],
        },
        metadata: { checkpoint },
      };

      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);

      const result = await handler(mockPrisma, { runId: 'run-123' });

      expect(result.checkpoint.resourceUsage.durationFormatted).toBe('45s');
    });
  });

  describe('Timing Information', () => {
    it('should include timing details', async () => {
      const now = new Date();
      const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);

      const checkpoint = {
        version: 1,
        runId: 'run-123',
        workflowId: 'workflow-456',
        currentStateId: 'state-1',
        currentPhase: 'agent',
        completedStates: [],
        skippedStates: [],
        masterSessionId: 'session-abc',
        resourceUsage: { tokensUsed: 0, agentSpawns: 0, stateTransitions: 0, durationMs: 0 },
        runStartedAt: '2025-01-01T00:00:00Z',
        checkpointedAt: tenMinutesAgo.toISOString(),
      };

      const mockRun = {
        id: 'run-123',
        workflow: {
          id: 'workflow-456',
          states: [{ id: 'state-1', name: 'State 1', order: 1 }],
        },
        metadata: { checkpoint },
      };

      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);

      const result = await handler(mockPrisma, { runId: 'run-123' });

      expect(result.checkpoint.timing.runStartedAt).toBe('2025-01-01T00:00:00Z');
      expect(result.checkpoint.timing.checkpointedAt).toBe(tenMinutesAgo.toISOString());
      expect(result.checkpoint.timing.checkpointAge).toMatch(/\d+s ago/);
    });
  });

  describe('Last Error', () => {
    it('should include last error when present', async () => {
      const checkpoint = {
        version: 1,
        runId: 'run-123',
        workflowId: 'workflow-456',
        currentStateId: 'state-1',
        currentPhase: 'agent',
        completedStates: [],
        skippedStates: [],
        masterSessionId: 'session-abc',
        resourceUsage: { tokensUsed: 0, agentSpawns: 0, stateTransitions: 0, durationMs: 0 },
        lastError: {
          message: 'Component execution failed',
          stateId: 'state-1',
          phase: 'agent',
          timestamp: '2025-01-01T00:05:00Z',
        },
        checkpointedAt: '2025-01-01T00:00:00Z',
        runStartedAt: '2025-01-01T00:00:00Z',
      };

      const mockRun = {
        id: 'run-123',
        workflow: {
          id: 'workflow-456',
          states: [{ id: 'state-1', name: 'State 1', order: 1 }],
        },
        metadata: { checkpoint },
      };

      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);

      const result = await handler(mockPrisma, { runId: 'run-123' });

      expect(result.checkpoint.lastError).toBeDefined();
      expect(result.checkpoint.lastError.message).toBe('Component execution failed');
    });

    it('should not include lastError when not present', async () => {
      const checkpoint = {
        version: 1,
        runId: 'run-123',
        workflowId: 'workflow-456',
        currentStateId: 'state-1',
        currentPhase: 'pre',
        completedStates: [],
        skippedStates: [],
        masterSessionId: 'session-abc',
        resourceUsage: { tokensUsed: 0, agentSpawns: 0, stateTransitions: 0, durationMs: 0 },
        checkpointedAt: '2025-01-01T00:00:00Z',
        runStartedAt: '2025-01-01T00:00:00Z',
      };

      const mockRun = {
        id: 'run-123',
        workflow: {
          id: 'workflow-456',
          states: [{ id: 'state-1', name: 'State 1', order: 1 }],
        },
        metadata: { checkpoint },
      };

      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);

      const result = await handler(mockPrisma, { runId: 'run-123' });

      expect(result.checkpoint.lastError).toBeUndefined();
    });
  });

  describe('Raw Checkpoint', () => {
    it('should include raw checkpoint for debugging', async () => {
      const checkpoint = {
        version: 1,
        runId: 'run-123',
        workflowId: 'workflow-456',
        currentStateId: 'state-1',
        currentPhase: 'pre',
        completedStates: [],
        skippedStates: [],
        masterSessionId: 'session-abc',
        resourceUsage: { tokensUsed: 0, agentSpawns: 0, stateTransitions: 0, durationMs: 0 },
        checkpointedAt: '2025-01-01T00:00:00Z',
        runStartedAt: '2025-01-01T00:00:00Z',
      };

      const mockRun = {
        id: 'run-123',
        workflow: {
          id: 'workflow-456',
          states: [{ id: 'state-1', name: 'State 1', order: 1 }],
        },
        metadata: { checkpoint },
      };

      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);

      const result = await handler(mockPrisma, { runId: 'run-123' });

      expect(result.rawCheckpoint).toEqual(checkpoint);
    });
  });
});
