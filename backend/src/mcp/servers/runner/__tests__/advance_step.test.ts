/**
 * Tests for advance_step MCP tool
 * ST-187: MCP Tool Optimization & Step Commands
 */

import { PrismaClient } from '@prisma/client';
import { handler } from '../advance_step';

describe('advance_step MCP Tool', () => {
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

  describe('Phase Transitions', () => {
    const createMockRun = (phase: string, hasComponent = false, stateIndex = 0, totalStates = 2) => {
      const states = Array.from({ length: totalStates }, (_, i) => ({
        id: `state-${i}`,
        name: `State ${i}`,
        order: i + 1,
        component: hasComponent && i === stateIndex ? { id: 'comp-1', name: 'Agent' } : null,
        preExecutionInstructions: 'Pre',
        postExecutionInstructions: 'Post',
      }));

      return {
        id: 'run-uuid',
        status: 'running',
        workflowId: 'workflow-uuid',
        storyId: 'story-uuid',
        story: { id: 'story-uuid', key: 'ST-123', title: 'Test' },
        workflow: {
          id: 'workflow-uuid',
          name: 'Test Workflow',
          states,
        },
        metadata: {
          checkpoint: {
            version: 1,
            runId: 'run-uuid',
            workflowId: 'workflow-uuid',
            currentStateId: `state-${stateIndex}`,
            currentPhase: phase,
            phaseStatus: 'pending',
            completedStates: [],
            skippedStates: [],
            phaseOutputs: {},
            resourceUsage: {
              tokensUsed: 0,
              agentSpawns: 0,
              stateTransitions: 0,
              durationMs: 0,
            },
          },
        },
      };
    };

    it('should advance from pre to agent when component exists', async () => {
      const mockRun = createMockRun('pre', true);
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);
      (mockPrisma.workflowRun.update as jest.Mock).mockResolvedValue(mockRun);

      const result: any = await handler(mockPrisma, { runId: 'run-uuid' });

      expect(result.success).toBe(true);
      expect(result.previousState.phase).toBe('pre');
      expect(result.currentState.phase).toBe('agent');
    });

    it('should advance from pre to post when no component', async () => {
      const mockRun = createMockRun('pre', false);
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);
      (mockPrisma.workflowRun.update as jest.Mock).mockResolvedValue(mockRun);

      const result: any = await handler(mockPrisma, { runId: 'run-uuid' });

      expect(result.success).toBe(true);
      expect(result.previousState.phase).toBe('pre');
      expect(result.currentState.phase).toBe('post');
    });

    it('should advance from agent to post', async () => {
      const mockRun = createMockRun('agent', true);
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);
      (mockPrisma.workflowRun.update as jest.Mock).mockResolvedValue(mockRun);

      const result: any = await handler(mockPrisma, { runId: 'run-uuid' });

      expect(result.success).toBe(true);
      expect(result.previousState.phase).toBe('agent');
      expect(result.currentState.phase).toBe('post');
    });

    it('should advance from post to next state pre', async () => {
      const mockRun = createMockRun('post', false, 0, 2);
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);
      (mockPrisma.workflowRun.update as jest.Mock).mockResolvedValue(mockRun);

      const result: any = await handler(mockPrisma, { runId: 'run-uuid' });

      expect(result.success).toBe(true);
      expect(result.previousState.phase).toBe('post');
      expect(result.currentState.id).toBe('state-1'); // Next state
      expect(result.currentState.phase).toBe('pre');
    });

    it('should complete workflow when last state post completes', async () => {
      const mockRun = createMockRun('post', false, 1, 2); // Last state
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);
      (mockPrisma.workflowRun.update as jest.Mock).mockResolvedValue(mockRun);

      const result: any = await handler(mockPrisma, { runId: 'run-uuid' });

      expect(result.success).toBe(true);
      expect(result.workflowComplete).toBe(true);
      expect(result.instructions.type).toBe('workflow_complete');
    });
  });

  describe('Output Storage', () => {
    it('should store phase output when provided', async () => {
      const mockRun = {
        id: 'run-uuid',
        status: 'running',
        workflowId: 'workflow-uuid',
        story: null,
        workflow: {
          id: 'workflow-uuid',
          name: 'Test',
          states: [
            { id: 'state-0', name: 'State 0', order: 1, component: null },
          ],
        },
        metadata: {
          checkpoint: {
            currentStateId: 'state-0',
            currentPhase: 'pre',
            phaseOutputs: {},
          },
        },
      };
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);
      (mockPrisma.workflowRun.update as jest.Mock).mockResolvedValue(mockRun);

      await handler(mockPrisma, {
        runId: 'run-uuid',
        output: { result: 'analysis complete' },
      });

      const updateCall = (mockPrisma.workflowRun.update as jest.Mock).mock.calls[0][0];
      const savedCheckpoint = updateCall.data.metadata.checkpoint;
      expect(savedCheckpoint.phaseOutputs['state-0_pre']).toEqual({ result: 'analysis complete' });
    });
  });

  describe('Skip to State', () => {
    it('should skip to specified state', async () => {
      const mockRun = {
        id: 'run-uuid',
        status: 'running',
        workflowId: 'workflow-uuid',
        story: null,
        workflow: {
          id: 'workflow-uuid',
          name: 'Test',
          states: [
            { id: 'state-0', name: 'analysis', order: 1, component: null },
            { id: 'state-1', name: 'design', order: 2, component: null },
            { id: 'state-2', name: 'implementation', order: 3, component: null },
          ],
        },
        metadata: {
          checkpoint: {
            currentStateId: 'state-0',
            currentPhase: 'pre',
            completedStates: [],
            skippedStates: [],
          },
        },
      };
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);
      (mockPrisma.workflowRun.update as jest.Mock).mockResolvedValue(mockRun);

      const result: any = await handler(mockPrisma, {
        runId: 'run-uuid',
        skipToState: 'implementation',
      });

      expect(result.success).toBe(true);
      expect(result.currentState.name).toBe('implementation');
      expect(result.currentState.phase).toBe('pre');
    });

    it('should throw error for unknown state', async () => {
      const mockRun = {
        id: 'run-uuid',
        status: 'running',
        workflowId: 'workflow-uuid',
        story: null,
        workflow: {
          id: 'workflow-uuid',
          name: 'Test',
          states: [{ id: 'state-0', name: 'analysis', order: 1 }],
        },
        metadata: { checkpoint: { currentStateId: 'state-0', currentPhase: 'pre' } },
      };
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);

      await expect(
        handler(mockPrisma, { runId: 'run-uuid', skipToState: 'unknown' })
      ).rejects.toThrow('State not found: unknown');
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
  });
});
