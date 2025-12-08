/**
 * Tests for repeat_step MCP tool
 * ST-187: MCP Tool Optimization & Step Commands
 */

import { PrismaClient } from '@prisma/client';
import { handler } from '../repeat_step';

describe('repeat_step MCP Tool', () => {
  let mockPrisma: jest.Mocked<PrismaClient>;

  beforeEach(() => {
    mockPrisma = {
      story: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
      },
      workflowRun: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    } as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Input Validation', () => {
    it('should throw error if neither story nor runId provided', async () => {
      await expect(handler(mockPrisma, {})).rejects.toThrow(
        'Either story or runId is required'
      );
    });
  });

  describe('Retry Behavior', () => {
    const createMockRun = (phase: string, status = 'running') => ({
      id: 'run-uuid',
      status,
      isPaused: false,
      storyId: 'story-uuid',
      story: { id: 'story-uuid', key: 'ST-123', title: 'Test', summary: null },
      workflow: {
        id: 'workflow-uuid',
        name: 'Test Workflow',
        states: [{
          id: 'state-1',
          name: 'analysis',
          order: 1,
          preExecutionInstructions: 'Pre instructions',
          postExecutionInstructions: 'Post instructions',
          component: null,
        }],
      },
      metadata: {
        checkpoint: {
          version: 1,
          currentStateId: 'state-1',
          currentPhase: phase,
          phaseStatus: 'pending',
          completedStates: [],
          skippedStates: [],
          retryHistory: [],
        },
      },
    });

    it('should reset phase status to pending', async () => {
      const mockRun = createMockRun('pre');
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);
      (mockPrisma.workflowRun.update as jest.Mock).mockResolvedValue(mockRun);

      const result: any = await handler(mockPrisma, { runId: 'run-uuid' });

      expect(result.success).toBe(true);
      expect(result.currentState.phaseStatus).toBe('pending');
    });

    it('should inject feedback into instructions when provided', async () => {
      const mockRun = createMockRun('pre');
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);
      (mockPrisma.workflowRun.update as jest.Mock).mockResolvedValue(mockRun);

      const result: any = await handler(mockPrisma, {
        runId: 'run-uuid',
        feedback: 'Add more error handling',
      });

      expect(result.instructions.content).toContain('RETRY FEEDBACK');
      expect(result.instructions.content).toContain('Add more error handling');
      expect(result.retry.feedback).toBe('Add more error handling');
    });

    it('should record retry in history', async () => {
      const mockRun = createMockRun('pre');
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);
      (mockPrisma.workflowRun.update as jest.Mock).mockResolvedValue(mockRun);

      await handler(mockPrisma, {
        runId: 'run-uuid',
        reason: 'Test retry',
        feedback: 'Fix the bug',
      });

      const updateCall = (mockPrisma.workflowRun.update as jest.Mock).mock.calls[0][0];
      const retryHistory = updateCall.data.metadata.checkpoint.retryHistory;
      expect(retryHistory).toHaveLength(1);
      expect(retryHistory[0].reason).toBe('Test retry');
      expect(retryHistory[0].feedback).toBe('Fix the bug');
    });

    it('should clear failed status when retrying', async () => {
      const mockRun = createMockRun('pre', 'failed');
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);
      (mockPrisma.workflowRun.update as jest.Mock).mockResolvedValue(mockRun);

      const result: any = await handler(mockPrisma, { runId: 'run-uuid' });

      expect(result.status).toBe('running');

      const updateCall = (mockPrisma.workflowRun.update as jest.Mock).mock.calls[0][0];
      expect(updateCall.data.status).toBe('running');
      expect(updateCall.data.errorMessage).toBeNull();
    });
  });

  describe('Error Handling', () => {
    it('should throw error for completed workflow', async () => {
      const mockRun = {
        id: 'run-uuid',
        status: 'completed',
        story: null,
        workflow: { id: 'w-1', name: 'Test', states: [] },
        metadata: {},
      };
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);

      await expect(handler(mockPrisma, { runId: 'run-uuid' })).rejects.toThrow(
        'Workflow already completed'
      );
    });

    it('should throw error for cancelled workflow', async () => {
      const mockRun = {
        id: 'run-uuid',
        status: 'cancelled',
        story: null,
        workflow: { id: 'w-1', name: 'Test', states: [] },
        metadata: {},
      };
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);

      await expect(handler(mockPrisma, { runId: 'run-uuid' })).rejects.toThrow(
        'Workflow was cancelled'
      );
    });

    it('should throw error when no active step to repeat', async () => {
      const mockRun = {
        id: 'run-uuid',
        status: 'running',
        story: null,
        workflow: { id: 'w-1', name: 'Test', states: [] },
        metadata: {},
      };
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);

      await expect(handler(mockPrisma, { runId: 'run-uuid' })).rejects.toThrow(
        'No active step to repeat'
      );
    });
  });
});
