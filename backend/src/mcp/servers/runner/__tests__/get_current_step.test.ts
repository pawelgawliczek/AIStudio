/**
 * Tests for get_current_step MCP tool
 * ST-187: MCP Tool Optimization & Step Commands
 */

import { PrismaClient } from '@prisma/client';
import { handler } from '../get_current_step';

describe('get_current_step MCP Tool', () => {
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

  describe('Story Key Resolution', () => {
    it('should resolve story key to active run', async () => {
      const mockStory = { id: 'story-uuid', key: 'ST-123', title: 'Test' };
      const mockRun = {
        id: 'run-uuid',
        status: 'running',
        isPaused: false,
        storyId: 'story-uuid',
        story: { id: 'story-uuid', key: 'ST-123', title: 'Test', summary: null, status: 'impl' },
        workflow: {
          id: 'workflow-uuid',
          name: 'Test Workflow',
          states: [
            {
              id: 'state-1',
              name: 'analysis',
              order: 1,
              component: null,
              preExecutionInstructions: 'Prepare context',
              postExecutionInstructions: null,
              requiresApproval: false,
            },
          ],
        },
        metadata: {
          checkpoint: {
            currentStateId: 'state-1',
            currentPhase: 'pre',
            phaseStatus: 'pending',
            completedStates: [],
            skippedStates: [],
          },
        },
      };

      (mockPrisma.story.findFirst as jest.Mock).mockResolvedValue(mockStory);
      (mockPrisma.workflowRun.findFirst as jest.Mock).mockResolvedValue(mockRun);
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);

      const result: any = await handler(mockPrisma, { story: 'ST-123' });

      expect(result.success).toBe(true);
      expect(result.runId).toBe('run-uuid');
      expect(result.story.key).toBe('ST-123');
    });
  });

  describe('Phase Instructions', () => {
    const createMockRun = (phase: string, stateConfig: any = {}) => ({
      id: 'run-uuid',
      status: 'running',
      isPaused: false,
      storyId: 'story-uuid',
      story: { id: 'story-uuid', key: 'ST-123', title: 'Test', summary: null, status: 'impl' },
      workflow: {
        id: 'workflow-uuid',
        name: 'Test Workflow',
        states: [{
          id: 'state-1',
          name: 'analysis',
          order: 1,
          preExecutionInstructions: 'Pre instructions',
          postExecutionInstructions: 'Post instructions',
          requiresApproval: false,
          component: null,
          ...stateConfig,
        }],
      },
      metadata: {
        checkpoint: {
          currentStateId: 'state-1',
          currentPhase: phase,
          phaseStatus: 'pending',
          completedStates: [],
          skippedStates: [],
        },
      },
    });

    it('should return pre_execution instructions for pre phase', async () => {
      const mockRun = createMockRun('pre');
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);

      const result: any = await handler(mockPrisma, { runId: 'run-uuid' });

      expect(result.instructions.type).toBe('pre_execution');
      expect(result.instructions.content).toBe('Pre instructions');
      expect(result.nextAction.tool).toBe('advance_step');
    });

    it('should return agent_spawn instructions for agent phase with component', async () => {
      const mockRun = createMockRun('agent', {
        component: {
          id: 'comp-1',
          name: 'Architect',
          tools: ['Read', 'Grep'],
          config: { modelId: 'claude-sonnet-4-20250514' },
          inputInstructions: 'Read the code',
          operationInstructions: 'Analyze it',
          outputInstructions: 'Provide summary',
        },
      });
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);

      const result: any = await handler(mockPrisma, { runId: 'run-uuid' });

      expect(result.instructions.type).toBe('agent_spawn');
      expect(result.instructions.component).toBeDefined();
      expect(result.instructions.component.name).toBe('Architect');
      expect(result.instructions.component.tools).toEqual(['Read', 'Grep']);
      // ST-215: Simplified 2-step workflow (agent tracking is automatic)
      expect(result.nextAction.tool).toBe('Task');
      expect(result.nextAction.hint).toContain('advance_step handles tracking automatically');
      expect(result.workflowSequence).toBeDefined();
      expect(result.workflowSequence.length).toBe(2);
      // Step 1: Spawn agent via Task tool
      expect(result.workflowSequence[0].type).toBe('agent_spawn');
      expect(result.workflowSequence[0].notes).toContain('Task tool');
      // Step 2: advance_step (auto-completes tracking)
      expect(result.workflowSequence[1].tool).toBe('advance_step');
      expect(result.workflowSequence[1].notes).toContain('AUTOMATIC');
    });

    it('should return post_execution instructions for post phase', async () => {
      const mockRun = createMockRun('post');
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);

      const result: any = await handler(mockPrisma, { runId: 'run-uuid' });

      expect(result.instructions.type).toBe('post_execution');
      expect(result.instructions.content).toBe('Post instructions');
      expect(result.nextAction.tool).toBe('advance_step');
    });

    it('should return approval_required for post phase with requiresApproval', async () => {
      const mockRun = createMockRun('post', { requiresApproval: true });
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);

      const result: any = await handler(mockPrisma, { runId: 'run-uuid' });

      expect(result.instructions.type).toBe('approval_required');
      expect(result.nextAction.tool).toBe('respond_to_approval');
    });
  });

  describe('Workflow Status Handling', () => {
    it('should handle completed workflow', async () => {
      const mockRun = {
        id: 'run-uuid',
        status: 'completed',
        isPaused: false,
        story: null,
        workflow: { id: 'w-1', name: 'Test', states: [] },
        metadata: {},
      };
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);

      const result: any = await handler(mockPrisma, { runId: 'run-uuid' });

      expect(result.instructions.type).toBe('workflow_complete');
    });

    it('should handle failed workflow', async () => {
      const mockRun = {
        id: 'run-uuid',
        status: 'failed',
        errorMessage: 'Something went wrong',
        isPaused: false,
        story: null,
        workflow: { id: 'w-1', name: 'Test', states: [] },
        metadata: {},
      };
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);

      const result: any = await handler(mockPrisma, { runId: 'run-uuid' });

      expect(result.instructions.type).toBe('workflow_failed');
      expect(result.nextAction.tool).toBe('repeat_step');
    });

    it('should handle paused workflow awaiting approval', async () => {
      const mockRun = {
        id: 'run-uuid',
        status: 'running',
        isPaused: true,
        pauseReason: 'approval required',
        story: null,
        workflow: { id: 'w-1', name: 'Test', states: [] },
        metadata: {},
      };
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);

      const result: any = await handler(mockPrisma, { runId: 'run-uuid' });

      expect(result.instructions.type).toBe('approval_required');
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

  describe('Progress Tracking', () => {
    it('should calculate progress correctly', async () => {
      const mockRun = {
        id: 'run-uuid',
        status: 'running',
        isPaused: false,
        story: null,
        workflow: {
          id: 'w-1',
          name: 'Test',
          states: [
            { id: 's-1', name: 'State 1', order: 1, component: null },
            { id: 's-2', name: 'State 2', order: 2, component: null },
            { id: 's-3', name: 'State 3', order: 3, component: null },
          ],
        },
        metadata: {
          checkpoint: {
            currentStateId: 's-2',
            currentPhase: 'pre',
            completedStates: ['s-1'],
            skippedStates: [],
          },
        },
      };
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);

      const result: any = await handler(mockPrisma, { runId: 'run-uuid' });

      expect(result.progress.stateIndex).toBe(2);
      expect(result.progress.totalStates).toBe(3);
      expect(result.progress.completedStates).toEqual(['s-1']);
      expect(result.progress.percentComplete).toBe(33); // 1/3 = 33%
    });
  });
});
