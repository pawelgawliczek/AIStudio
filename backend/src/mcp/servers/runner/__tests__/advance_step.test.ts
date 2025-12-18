/**
 * Tests for advance_step MCP tool
 * ST-187: MCP Tool Optimization & Step Commands
 * ST-215: Automatic Agent Tracking
 * ST-216: Earlier agent tracking - start when entering state, complete when leaving agent phase
 */

import { PrismaClient } from '@prisma/client';
import * as agentTracking from '../../../shared/agent-tracking';
import { handler } from '../advance_step';

// Mock the agent-tracking module
jest.mock('../../../shared/agent-tracking', () => ({
  startAgentTracking: jest.fn(),
  completeAgentTracking: jest.fn(),
  generateComponentSummary: jest.fn(),
  // ST-203: Add structured summary functions
  generateStructuredSummary: jest.fn().mockReturnValue({
    version: '1.0',
    status: 'success',
    summary: 'Auto-generated summary',
  }),
  serializeComponentSummary: jest.fn().mockImplementation((obj) => JSON.stringify(obj)),
}));

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
      componentRun: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      artifactAccess: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      artifact: {
        findFirst: jest.fn().mockResolvedValue(null),
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

  // ST-215: Automatic Agent Tracking Tests
  describe('Automatic Agent Tracking', () => {
    const createMockRunWithComponent = (phase: string) => ({
      id: 'run-uuid',
      status: 'running',
      workflowId: 'workflow-uuid',
      storyId: 'story-uuid',
      story: { id: 'story-uuid', key: 'ST-123', title: 'Test Story' },
      workflow: {
        id: 'workflow-uuid',
        name: 'Test Workflow',
        states: [
          {
            id: 'state-0',
            name: 'Implementation',
            order: 1,
            component: { id: 'comp-1', name: 'Implementer' },
            preExecutionInstructions: 'Pre instructions',
            postExecutionInstructions: 'Post instructions',
          },
          {
            id: 'state-1',
            name: 'Review',
            order: 2,
            component: null,
          },
        ],
      },
      metadata: {
        checkpoint: {
          version: 1,
          runId: 'run-uuid',
          workflowId: 'workflow-uuid',
          currentStateId: 'state-0',
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
    });

    beforeEach(() => {
      // Reset mocks
      (agentTracking.startAgentTracking as jest.Mock).mockReset();
      (agentTracking.completeAgentTracking as jest.Mock).mockReset();
      (agentTracking.generateStructuredSummary as jest.Mock).mockReset();
      (agentTracking.serializeComponentSummary as jest.Mock).mockReset();
    });

    // ST-216: startAgentTracking is now called when ENTERING a state (post→next.pre),
    // NOT when leaving pre phase (pre→agent)
    it('should NOT call startAgentTracking when advancing pre -> agent (ST-216)', async () => {
      const mockRun = createMockRunWithComponent('pre');
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);
      (mockPrisma.workflowRun.update as jest.Mock).mockResolvedValue(mockRun);

      const result: any = await handler(mockPrisma, { runId: 'run-uuid' });

      // Verify startAgentTracking was NOT called (tracking started when entering state)
      expect(agentTracking.startAgentTracking).not.toHaveBeenCalled();

      // Phase should still advance
      expect(result.success).toBe(true);
      expect(result.currentState.phase).toBe('agent');

      // No agentTracking info since we didn't start it here
      expect(result.agentTracking).toBeUndefined();
    });

    it('should auto-complete agent tracking when advancing agent -> post', async () => {
      const mockRun = createMockRunWithComponent('agent');
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);
      (mockPrisma.workflowRun.update as jest.Mock).mockResolvedValue(mockRun);
      (agentTracking.completeAgentTracking as jest.Mock).mockResolvedValue({
        success: true,
        componentRunId: 'cr-123',
        componentName: 'Implementer',
        status: 'completed',
        metrics: { durationSeconds: 30 },
      });

      // Mock generateStructuredSummary to return structured object
      const mockStructuredSummary = {
        version: '1.0',
        status: 'success',
        summary: 'Implementer completed. Modified 3 file(s).',
      };
      (agentTracking.generateStructuredSummary as jest.Mock).mockReturnValue(mockStructuredSummary);

      const result: any = await handler(mockPrisma, {
        runId: 'run-uuid',
        output: { files: ['a.ts', 'b.ts', 'c.ts'] },
      });

      // Verify completeAgentTracking was called with structured summary
      expect(agentTracking.completeAgentTracking).toHaveBeenCalledWith(mockPrisma, {
        runId: 'run-uuid',
        componentId: 'comp-1',
        output: { files: ['a.ts', 'b.ts', 'c.ts'] },
        status: 'completed',
        componentSummary: mockStructuredSummary,
        errorMessage: undefined,
      });

      // Verify response includes agentTracking info
      expect(result.success).toBe(true);
      expect(result.currentState.phase).toBe('post');
      expect(result.agentTracking).toBeDefined();
      expect(result.agentTracking.action).toBe('completed');
      expect(result.agentTracking.success).toBe(true);
    });

    // ST-216: New test for agent tracking when entering a new state
    it('should start agent tracking when advancing post -> next state pre with component', async () => {
      // Create run with current state at post, next state has component
      const mockRun = {
        id: 'run-uuid',
        status: 'running',
        workflowId: 'workflow-uuid',
        storyId: 'story-uuid',
        story: { id: 'story-uuid', key: 'ST-216', title: 'Test Story' },
        workflow: {
          id: 'workflow-uuid',
          name: 'Test Workflow',
          states: [
            {
              id: 'state-0',
              name: 'Analysis',
              order: 1,
              component: null, // First state has no component
            },
            {
              id: 'state-1',
              name: 'Implementation',
              order: 2,
              component: { id: 'comp-1', name: 'Developer' }, // Next state has component
            },
          ],
        },
        metadata: {
          checkpoint: {
            currentStateId: 'state-0',
            currentPhase: 'post', // Currently in post phase of first state
            completedStates: [],
            skippedStates: [],
          },
        },
      };

      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);
      (mockPrisma.workflowRun.update as jest.Mock).mockResolvedValue(mockRun);
      (agentTracking.startAgentTracking as jest.Mock).mockResolvedValue({
        success: true,
        componentRunId: 'cr-123',
        componentName: 'Developer',
        executionOrder: 1,
      });

      const result: any = await handler(mockPrisma, { runId: 'run-uuid' });

      // Verify startAgentTracking was called for the NEXT state's component
      expect(agentTracking.startAgentTracking).toHaveBeenCalledWith(mockPrisma, {
        runId: 'run-uuid',
        componentId: 'comp-1',
        input: undefined,
      });

      // Verify response
      expect(result.success).toBe(true);
      expect(result.currentState.id).toBe('state-1');
      expect(result.currentState.phase).toBe('pre');
      expect(result.agentTracking).toBeDefined();
      expect(result.agentTracking.action).toBe('started');
      expect(result.agentTracking.componentName).toBe('Developer');
    });

    it('should include warning when agent tracking start fails during post -> pre transition', async () => {
      const mockRun = {
        id: 'run-uuid',
        status: 'running',
        workflowId: 'workflow-uuid',
        story: null,
        workflow: {
          id: 'workflow-uuid',
          name: 'Test Workflow',
          states: [
            { id: 'state-0', name: 'State 0', order: 1, component: null },
            { id: 'state-1', name: 'State 1', order: 2, component: { id: 'comp-1', name: 'Agent' } },
          ],
        },
        metadata: {
          checkpoint: {
            currentStateId: 'state-0',
            currentPhase: 'post',
            completedStates: [],
            skippedStates: [],
          },
        },
      };

      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);
      (mockPrisma.workflowRun.update as jest.Mock).mockResolvedValue(mockRun);
      (agentTracking.startAgentTracking as jest.Mock).mockResolvedValue({
        success: false,
        error: 'Database connection failed',
      });

      const result: any = await handler(mockPrisma, { runId: 'run-uuid' });

      // Phase still advances
      expect(result.success).toBe(true);
      expect(result.currentState.id).toBe('state-1');
      expect(result.currentState.phase).toBe('pre');

      // But warning is included
      expect(result.agentTracking).toBeDefined();
      expect(result.agentTracking.action).toBe('started');
      expect(result.agentTracking.success).toBe(false);
      expect(result.agentTracking.warning).toBe('Database connection failed');
      expect(result.warnings).toBeDefined();
      expect(result.warnings.agentTracking).toBe('Database connection failed');
    });

    it('should include warning when agent tracking complete fails but still advance', async () => {
      const mockRun = createMockRunWithComponent('agent');
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);
      (mockPrisma.workflowRun.update as jest.Mock).mockResolvedValue(mockRun);
      (agentTracking.completeAgentTracking as jest.Mock).mockResolvedValue({
        success: false,
        error: 'ComponentRun not found',
      });
      (agentTracking.generateComponentSummary as jest.Mock).mockReturnValue('Auto summary');

      const result: any = await handler(mockPrisma, {
        runId: 'run-uuid',
        output: { result: 'done' },
      });

      // Phase still advances
      expect(result.success).toBe(true);
      expect(result.currentState.phase).toBe('post');

      // But warning is included
      expect(result.agentTracking).toBeDefined();
      expect(result.agentTracking.action).toBe('completed');
      expect(result.agentTracking.success).toBe(false);
      expect(result.warnings.agentTracking).toBe('ComponentRun not found');
    });

    it('should auto-generate structured summary when not provided', async () => {
      const mockRun = createMockRunWithComponent('agent');
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);
      (mockPrisma.workflowRun.update as jest.Mock).mockResolvedValue(mockRun);
      (agentTracking.completeAgentTracking as jest.Mock).mockResolvedValue({
        success: true,
        componentRunId: 'cr-123',
      });

      const mockStructuredSummary = {
        version: '1.0',
        status: 'success',
        summary: 'Implementer completed.',
      };
      (agentTracking.generateStructuredSummary as jest.Mock).mockReturnValue(mockStructuredSummary);

      await handler(mockPrisma, {
        runId: 'run-uuid',
        output: { status: 'done' },
      });

      // Verify generateStructuredSummary was called
      expect(agentTracking.generateStructuredSummary).toHaveBeenCalledWith(
        { status: 'done' },
        'Implementer',
        'success'
      );

      // Verify the generated summary was passed to completeAgentTracking
      expect(agentTracking.completeAgentTracking).toHaveBeenCalledWith(
        mockPrisma,
        expect.objectContaining({
          componentSummary: mockStructuredSummary,
        })
      );
    });

    it('should use explicit componentSummary when provided', async () => {
      const mockRun = createMockRunWithComponent('agent');
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);
      (mockPrisma.workflowRun.update as jest.Mock).mockResolvedValue(mockRun);
      (agentTracking.completeAgentTracking as jest.Mock).mockResolvedValue({
        success: true,
        componentRunId: 'cr-123',
      });

      const explicitSummary = 'Implemented 5 new API endpoints with full test coverage.';

      await handler(mockPrisma, {
        runId: 'run-uuid',
        output: { result: 'done' },
        componentSummary: explicitSummary,
      });

      // Verify generateStructuredSummary was NOT called
      expect(agentTracking.generateStructuredSummary).not.toHaveBeenCalled();

      // Verify the explicit summary was passed
      expect(agentTracking.completeAgentTracking).toHaveBeenCalledWith(
        mockPrisma,
        expect.objectContaining({
          componentSummary: explicitSummary,
        })
      );
    });

    it('should pass agentStatus=failed when specified', async () => {
      const mockRun = createMockRunWithComponent('agent');
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);
      (mockPrisma.workflowRun.update as jest.Mock).mockResolvedValue(mockRun);
      (agentTracking.completeAgentTracking as jest.Mock).mockResolvedValue({
        success: true,
        componentRunId: 'cr-123',
        status: 'failed',
      });

      const mockFailedSummary = {
        version: '1.0',
        status: 'failed',
        summary: 'Failed',
      };
      (agentTracking.generateStructuredSummary as jest.Mock).mockReturnValue(mockFailedSummary);

      await handler(mockPrisma, {
        runId: 'run-uuid',
        output: { error: 'Test failed' },
        agentStatus: 'failed',
        errorMessage: 'Tests are failing',
      });

      expect(agentTracking.completeAgentTracking).toHaveBeenCalledWith(
        mockPrisma,
        expect.objectContaining({
          status: 'failed',
          errorMessage: 'Tests are failing',
        })
      );
    });

    it('should NOT call tracking when advancing pre -> post (no component)', async () => {
      const mockRunNoComponent = {
        id: 'run-uuid',
        status: 'running',
        story: null,
        workflow: {
          id: 'w-1',
          name: 'Test',
          states: [
            {
              id: 'state-0',
              name: 'State 0',
              order: 1,
              component: null, // No component
            },
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
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRunNoComponent);
      (mockPrisma.workflowRun.update as jest.Mock).mockResolvedValue(mockRunNoComponent);

      const result: any = await handler(mockPrisma, { runId: 'run-uuid' });

      // Should skip agent phase entirely
      expect(result.currentState.phase).toBe('post');

      // No tracking should be called
      expect(agentTracking.startAgentTracking).not.toHaveBeenCalled();
      expect(agentTracking.completeAgentTracking).not.toHaveBeenCalled();

      // No agentTracking in response
      expect(result.agentTracking).toBeUndefined();
    });

    it('should handle exception from startAgentTracking gracefully during post -> pre', async () => {
      const mockRun = {
        id: 'run-uuid',
        status: 'running',
        workflowId: 'workflow-uuid',
        story: null,
        workflow: {
          id: 'workflow-uuid',
          name: 'Test Workflow',
          states: [
            { id: 'state-0', name: 'State 0', order: 1, component: null },
            { id: 'state-1', name: 'State 1', order: 2, component: { id: 'comp-1', name: 'Agent' } },
          ],
        },
        metadata: {
          checkpoint: {
            currentStateId: 'state-0',
            currentPhase: 'post',
            completedStates: [],
            skippedStates: [],
          },
        },
      };

      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);
      (mockPrisma.workflowRun.update as jest.Mock).mockResolvedValue(mockRun);
      (agentTracking.startAgentTracking as jest.Mock).mockRejectedValue(
        new Error('Unexpected database error')
      );

      const result: any = await handler(mockPrisma, { runId: 'run-uuid' });

      // Phase still advances
      expect(result.success).toBe(true);
      expect(result.currentState.id).toBe('state-1');
      expect(result.currentState.phase).toBe('pre');

      // Warning is included
      expect(result.agentTracking.success).toBe(false);
      expect(result.agentTracking.warning).toContain('Unexpected database error');
    });

    // ST-216: Test for workflow initialization with component in first state
    it('should start agent tracking on workflow initialization when first state has component', async () => {
      const mockRun = {
        id: 'run-uuid',
        status: 'running',
        workflowId: 'workflow-uuid',
        storyId: 'story-uuid',
        story: { id: 'story-uuid', key: 'ST-216', title: 'Test Story' },
        workflow: {
          id: 'workflow-uuid',
          name: 'Test Workflow',
          states: [
            {
              id: 'state-0',
              name: 'Implementation',
              order: 1,
              component: { id: 'comp-1', name: 'Developer' }, // First state has component
            },
          ],
        },
        metadata: {}, // No checkpoint yet - workflow not initialized
      };

      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);
      (mockPrisma.workflowRun.update as jest.Mock).mockResolvedValue(mockRun);
      (agentTracking.startAgentTracking as jest.Mock).mockResolvedValue({
        success: true,
        componentRunId: 'cr-123',
        componentName: 'Developer',
        executionOrder: 1,
      });

      const result: any = await handler(mockPrisma, { runId: 'run-uuid' });

      // Verify startAgentTracking was called for the first state's component
      expect(agentTracking.startAgentTracking).toHaveBeenCalledWith(mockPrisma, {
        runId: 'run-uuid',
        componentId: 'comp-1',
      });

      // Workflow should initialize at first state
      expect(result.success).toBe(true);
    });
  });

  // ST-304: spawnAgent Block Tests
  describe('spawnAgent block (ST-304)', () => {
    const createMockRunWithStory = (phase: string, hasComponent = true) => ({
      id: 'run-uuid',
      status: 'running',
      workflowId: 'workflow-uuid',
      storyId: 'story-uuid',
      story: { id: 'story-uuid', key: 'ST-304', title: 'Test Story' },
      workflow: {
        id: 'workflow-uuid',
        name: 'Test Workflow',
        states: [
          {
            id: 'state-0',
            name: 'Implementation',
            order: 1,
            component: hasComponent ? {
              id: 'comp-1',
              name: 'Developer',
              executionType: 'custom',
              inputInstructions: 'Input instructions here',
              operationInstructions: 'Operation instructions here',
              outputInstructions: 'Output instructions here',
              config: { modelId: 'claude-sonnet-4-20250514' },
              tools: ['read', 'write'],
            } : null,
            preExecutionInstructions: 'Pre-execution context',
            postExecutionInstructions: 'Post-execution context',
          },
        ],
      },
      metadata: {
        checkpoint: {
          currentStateId: 'state-0',
          currentPhase: phase,
          phaseOutputs: {},
        },
      },
    });

    it('should return spawnAgent block when entering agent phase with storyId', async () => {
      const mockRun = createMockRunWithStory('pre', true);
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);
      (mockPrisma.workflowRun.update as jest.Mock).mockResolvedValue(mockRun);

      // Mock buildTaskPrompt dependencies
      (mockPrisma as any).componentRun = {
        findMany: jest.fn().mockResolvedValue([]),
      };
      (mockPrisma as any).artifactAccess = {
        findMany: jest.fn().mockResolvedValue([]),
      };

      const result: any = await handler(mockPrisma, { runId: 'run-uuid' });

      expect(result.success).toBe(true);
      expect(result.currentState.phase).toBe('agent');

      // Verify spawnAgent block exists
      expect(result.instructions.spawnAgent).toBeDefined();
      expect(result.instructions.spawnAgent.instruction).toContain('Use the Task tool');
      expect(result.instructions.spawnAgent.task).toBeDefined();
      expect(result.instructions.spawnAgent.task.subagent_type).toBe('general-purpose');
      expect(result.instructions.spawnAgent.task.model).toBe('claude-sonnet-4-20250514');
      expect(result.instructions.spawnAgent.task.prompt).toBeDefined();
      expect(typeof result.instructions.spawnAgent.task.prompt).toBe('string');

      // Verify prompt contains component instructions
      expect(result.instructions.spawnAgent.task.prompt).toContain('Pre-execution context');
      expect(result.instructions.spawnAgent.task.prompt).toContain('Input instructions here');
      expect(result.instructions.spawnAgent.task.prompt).toContain('Operation instructions here');
      expect(result.instructions.spawnAgent.task.prompt).toContain('Output instructions here');

      // Verify componentName and componentId
      expect(result.instructions.spawnAgent.componentName).toBe('Developer');
      expect(result.instructions.spawnAgent.componentId).toBe('comp-1');
    });

    it('should NOT include redundant component fields when spawnAgent is present', async () => {
      const mockRun = createMockRunWithStory('pre', true);
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);
      (mockPrisma.workflowRun.update as jest.Mock).mockResolvedValue(mockRun);

      // Mock buildTaskPrompt dependencies
      (mockPrisma as any).componentRun = {
        findMany: jest.fn().mockResolvedValue([]),
      };
      (mockPrisma as any).artifactAccess = {
        findMany: jest.fn().mockResolvedValue([]),
      };

      const result: any = await handler(mockPrisma, { runId: 'run-uuid' });

      // When spawnAgent is present, component should NOT be present
      expect(result.instructions.spawnAgent).toBeDefined();
      expect(result.instructions.component).toBeUndefined();
    });

    it('should fallback to old structure when storyId is unavailable', async () => {
      const mockRunNoStory = {
        id: 'run-uuid',
        status: 'running',
        workflowId: 'workflow-uuid',
        storyId: null,
        story: null,
        workflow: {
          id: 'workflow-uuid',
          name: 'Test Workflow',
          states: [
            {
              id: 'state-0',
              name: 'Implementation',
              order: 1,
              component: {
                id: 'comp-1',
                name: 'Developer',
                executionType: 'custom',
                inputInstructions: 'Input instructions',
                operationInstructions: 'Operation instructions',
                outputInstructions: 'Output instructions',
                config: { modelId: 'claude-sonnet-4-20250514' },
                tools: ['read', 'write'],
              },
              preExecutionInstructions: 'Pre-execution context',
              postExecutionInstructions: 'Post-execution context',
            },
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

      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRunNoStory);
      (mockPrisma.workflowRun.update as jest.Mock).mockResolvedValue(mockRunNoStory);

      const result: any = await handler(mockPrisma, { runId: 'run-uuid' });

      expect(result.success).toBe(true);
      expect(result.currentState.phase).toBe('agent');

      // Should fallback to old component structure
      expect(result.instructions.spawnAgent).toBeUndefined();
      expect(result.instructions.component).toBeDefined();
      expect(result.instructions.component.id).toBe('comp-1');
      expect(result.instructions.component.name).toBe('Developer');
      expect(result.instructions.component.model).toBe('claude-sonnet-4-20250514');
      expect(result.instructions.component.tools).toEqual(['read', 'write']);
      expect(result.instructions.component.inputInstructions).toBe('Input instructions');
      expect(result.instructions.component.operationInstructions).toBe('Operation instructions');
      expect(result.instructions.component.outputInstructions).toBe('Output instructions');
    });

    it('should include previous component outputs in spawnAgent prompt', async () => {
      const mockRun = createMockRunWithStory('pre', true);
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);
      (mockPrisma.workflowRun.update as jest.Mock).mockResolvedValue(mockRun);

      // Mock previous component runs
      (mockPrisma as any).componentRun = {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'cr-1',
            componentSummary: '{"version":"1.0","status":"success","summary":"Explored codebase successfully"}',
            component: { name: 'Explorer' },
          },
        ]),
      };
      (mockPrisma as any).artifactAccess = {
        findMany: jest.fn().mockResolvedValue([]),
      };

      const result: any = await handler(mockPrisma, { runId: 'run-uuid' });

      // Verify prompt includes previous outputs
      expect(result.instructions.spawnAgent.task.prompt).toContain('Previous Component Outputs');
      expect(result.instructions.spawnAgent.task.prompt).toContain('Explorer');
      expect(result.instructions.spawnAgent.task.prompt).toContain('success');
    });

    it('should include artifact instructions in spawnAgent prompt', async () => {
      const mockRun = createMockRunWithStory('pre', true);
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);
      (mockPrisma.workflowRun.update as jest.Mock).mockResolvedValue(mockRun);

      // Mock artifact access rules
      (mockPrisma as any).componentRun = {
        findMany: jest.fn().mockResolvedValue([]),
      };
      (mockPrisma as any).artifactAccess = {
        findMany: jest.fn().mockResolvedValue([
          {
            accessType: 'write',
            definitionId: 'def-1',
            definition: {
              key: 'THE_PLAN',
              name: 'Implementation Plan',
              description: 'Detailed implementation plan',
            },
          },
        ]),
      };
      (mockPrisma as any).artifact = {
        findFirst: jest.fn().mockResolvedValue(null), // Artifact doesn't exist yet
      };

      const result: any = await handler(mockPrisma, { runId: 'run-uuid' });

      // Verify prompt includes artifact instructions
      expect(result.instructions.spawnAgent.task.prompt).toContain('Artifact Instructions');
      expect(result.instructions.spawnAgent.task.prompt).toContain('THE_PLAN');
      expect(result.instructions.spawnAgent.task.prompt).toContain('Implementation Plan');
      expect(result.instructions.spawnAgent.task.prompt).toContain('upload_artifact');
    });

    it('should derive correct subagent_type for native_explore', async () => {
      const mockRun = createMockRunWithStory('pre', true);
      // Change executionType to native_explore
      mockRun.workflow.states[0].component!.executionType = 'native_explore';
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);
      (mockPrisma.workflowRun.update as jest.Mock).mockResolvedValue(mockRun);

      (mockPrisma as any).componentRun = {
        findMany: jest.fn().mockResolvedValue([]),
      };
      (mockPrisma as any).artifactAccess = {
        findMany: jest.fn().mockResolvedValue([]),
      };

      const result: any = await handler(mockPrisma, { runId: 'run-uuid' });

      expect(result.instructions.spawnAgent.task.subagent_type).toBe('Explore');
    });

    it('should derive correct subagent_type for native_plan', async () => {
      const mockRun = createMockRunWithStory('pre', true);
      // Change executionType to native_plan
      mockRun.workflow.states[0].component!.executionType = 'native_plan';
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);
      (mockPrisma.workflowRun.update as jest.Mock).mockResolvedValue(mockRun);

      (mockPrisma as any).componentRun = {
        findMany: jest.fn().mockResolvedValue([]),
      };
      (mockPrisma as any).artifactAccess = {
        findMany: jest.fn().mockResolvedValue([]),
      };

      const result: any = await handler(mockPrisma, { runId: 'run-uuid' });

      expect(result.instructions.spawnAgent.task.subagent_type).toBe('Plan');
    });

    it('should still include enforcement data with spawnAgent', async () => {
      const mockRun = createMockRunWithStory('pre', true);
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);
      (mockPrisma.workflowRun.update as jest.Mock).mockResolvedValue(mockRun);

      (mockPrisma as any).componentRun = {
        findMany: jest.fn().mockResolvedValue([]),
      };
      (mockPrisma as any).artifactAccess = {
        findMany: jest.fn().mockResolvedValue([]),
      };

      const result: any = await handler(mockPrisma, { runId: 'run-uuid' });

      // Verify enforcement data is still present
      expect(result.instructions.enforcement).toBeDefined();
      expect(result.instructions.enforcement.allowedSubagentTypes).toEqual(['general-purpose']);
      expect(result.instructions.enforcement.requiredComponentName).toBe('Developer');
    });
  });

  // ST-203: Structured componentSummary Tests
  describe('Structured componentSummary (ST-203)', () => {
    const createMockRunWithComponent = (phase: string) => ({
      id: 'run-uuid',
      status: 'running',
      workflowId: 'workflow-uuid',
      storyId: 'story-uuid',
      story: { id: 'story-uuid', key: 'ST-203', title: 'Test Story' },
      workflow: {
        id: 'workflow-uuid',
        name: 'Test Workflow',
        states: [
          {
            id: 'state-0',
            name: 'Implementation',
            order: 1,
            component: { id: 'comp-1', name: 'Implementer' },
          },
        ],
      },
      metadata: {
        checkpoint: {
          currentStateId: 'state-0',
          currentPhase: phase,
          phaseOutputs: {},
        },
      },
    });

    it('should accept structured componentSummary object', async () => {
      const mockRun = createMockRunWithComponent('agent');
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);
      (mockPrisma.workflowRun.update as jest.Mock).mockResolvedValue(mockRun);
      (agentTracking.completeAgentTracking as jest.Mock).mockResolvedValue({
        success: true,
        componentRunId: 'cr-123',
      });

      const structuredSummary = {
        version: '1.0' as const,
        status: 'success' as const,
        summary: 'Implemented feature successfully',
        keyOutputs: ['Created API endpoint', 'Added unit tests'],
        artifactsProduced: ['API_SPEC'],
      };

      await handler(mockPrisma, {
        runId: 'run-uuid',
        componentSummary: structuredSummary,
      });

      // Should pass structured summary object to completeAgentTracking (it handles serialization)
      expect(agentTracking.completeAgentTracking).toHaveBeenCalledWith(
        mockPrisma,
        expect.objectContaining({
          componentSummary: structuredSummary,
        })
      );
    });

    // Note: advance_step does NOT validate componentSummary - it passes through to completeAgentTracking
    // Validation is handled by completeAgentTracking or the database layer
    it('should pass through componentSummary without validation', async () => {
      const mockRun = createMockRunWithComponent('agent');
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);
      (mockPrisma.workflowRun.update as jest.Mock).mockResolvedValue(mockRun);
      (agentTracking.completeAgentTracking as jest.Mock).mockResolvedValue({
        success: true,
      });

      const incompleteSummary = {
        version: '1.0',
        status: 'success',
        // Missing 'summary' field - but advance_step doesn't validate
      };

      // Should not throw - passes through to completeAgentTracking
      const result = await handler(mockPrisma, {
        runId: 'run-uuid',
        componentSummary: incompleteSummary as any,
      });

      expect(result.success).toBe(true);
      expect(agentTracking.completeAgentTracking).toHaveBeenCalledWith(
        mockPrisma,
        expect.objectContaining({
          componentSummary: incompleteSummary,
        })
      );
    });

    it('should auto-generate structured summary when not provided', async () => {
      const mockRun = createMockRunWithComponent('agent');
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);
      (mockPrisma.workflowRun.update as jest.Mock).mockResolvedValue(mockRun);
      (agentTracking.completeAgentTracking as jest.Mock).mockResolvedValue({
        success: true,
      });

      // Mock generateStructuredSummary to return structured object
      const mockStructuredSummary = {
        version: '1.0' as const,
        status: 'success' as const,
        summary: 'Implementer completed successfully',
        keyOutputs: ['Modified 3 files'],
      };
      (agentTracking.generateStructuredSummary as jest.Mock).mockReturnValue(
        mockStructuredSummary
      );

      await handler(mockPrisma, {
        runId: 'run-uuid',
        output: { files: ['a.ts', 'b.ts', 'c.ts'] },
      });

      // Should call generateStructuredSummary (not generateComponentSummary)
      expect(agentTracking.generateStructuredSummary).toHaveBeenCalledWith(
        { files: ['a.ts', 'b.ts', 'c.ts'] },
        'Implementer',
        'success' // status
      );

      // Should pass the structured summary to completeAgentTracking
      expect(agentTracking.completeAgentTracking).toHaveBeenCalledWith(
        mockPrisma,
        expect.objectContaining({
          componentSummary: mockStructuredSummary, // Object passed directly
        })
      );
    });

    it('should pass structured summary with all status types to completeAgentTracking', async () => {
      const statuses: Array<'success' | 'partial' | 'blocked' | 'failed'> = [
        'success',
        'partial',
        'blocked',
        'failed',
      ];

      for (const status of statuses) {
        // Reset mocks for each iteration
        jest.clearAllMocks();

        const mockRun = createMockRunWithComponent('agent');
        (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);
        (mockPrisma.workflowRun.update as jest.Mock).mockResolvedValue(mockRun);
        (agentTracking.completeAgentTracking as jest.Mock).mockResolvedValue({
          success: true,
        });

        const summary = {
          version: '1.0' as const,
          status,
          summary: `Work ${status}`,
        };

        await handler(mockPrisma, {
          runId: 'run-uuid',
          componentSummary: summary,
        });

        // Summary is now passed as object (completeAgentTracking serializes it)
        expect(agentTracking.completeAgentTracking).toHaveBeenCalledWith(
          mockPrisma,
          expect.objectContaining({
            componentSummary: summary,
          })
        );
      }
    });

    it('should pass structured summary with optional fields to completeAgentTracking', async () => {
      const mockRun = createMockRunWithComponent('agent');
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);
      (mockPrisma.workflowRun.update as jest.Mock).mockResolvedValue(mockRun);
      (agentTracking.completeAgentTracking as jest.Mock).mockResolvedValue({
        success: true,
      });

      const summaryWithOptionals = {
        version: '1.0' as const,
        status: 'partial' as const,
        summary: 'Partial implementation',
        keyOutputs: ['Created models', 'Added migrations'],
        nextAgentHints: ['Complete API endpoints', 'Add validation'],
        artifactsProduced: ['ARCH_DOC', 'DB_SCHEMA'],
        errors: ['Missing test coverage'],
      };

      await handler(mockPrisma, {
        runId: 'run-uuid',
        componentSummary: summaryWithOptionals,
      });

      const lastCall = (agentTracking.completeAgentTracking as jest.Mock).mock.calls.slice(
        -1
      )[0];
      const passedSummary = lastCall[1].componentSummary;

      // Summary is passed as object (completeAgentTracking serializes it)
      expect(passedSummary.keyOutputs).toEqual(['Created models', 'Added migrations']);
      expect(passedSummary.nextAgentHints).toEqual(['Complete API endpoints', 'Add validation']);
      expect(passedSummary.artifactsProduced).toEqual(['ARCH_DOC', 'DB_SCHEMA']);
      expect(passedSummary.errors).toEqual(['Missing test coverage']);
    });

    // Note: advance_step passes componentSummary to completeAgentTracking without serializing
    // completeAgentTracking is responsible for serialization
    it('should pass complex objects to completeAgentTracking (serialization handled there)', async () => {
      const mockRun = createMockRunWithComponent('agent');
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);
      (mockPrisma.workflowRun.update as jest.Mock).mockResolvedValue(mockRun);
      (agentTracking.completeAgentTracking as jest.Mock).mockResolvedValue({
        success: true,
      });

      const complexSummary = {
        version: '1.0' as const,
        status: 'success' as const,
        summary: 'Test with nested objects',
        keyOutputs: ['output1', 'output2'],
        nested: { deep: { value: 'test' } },
      };

      // Should not throw - passes through to completeAgentTracking
      const result = await handler(mockPrisma, {
        runId: 'run-uuid',
        componentSummary: complexSummary as any,
      });

      expect(result.success).toBe(true);
      expect(agentTracking.completeAgentTracking).toHaveBeenCalledWith(
        mockPrisma,
        expect.objectContaining({
          componentSummary: complexSummary,
        })
      );
    });

    it('should pass agentStatus parameter for backward compatibility', async () => {
      const mockRun = createMockRunWithComponent('agent');
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);
      (mockPrisma.workflowRun.update as jest.Mock).mockResolvedValue(mockRun);
      (agentTracking.completeAgentTracking as jest.Mock).mockResolvedValue({
        success: true,
      });

      const summary = {
        version: '1.0' as const,
        status: 'failed' as const,
        summary: 'Tests failed',
        errors: ['Unit tests failing'],
      };

      await handler(mockPrisma, {
        runId: 'run-uuid',
        componentSummary: summary,
        agentStatus: 'failed',
        errorMessage: 'Test execution failed',
      });

      expect(agentTracking.completeAgentTracking).toHaveBeenCalledWith(
        mockPrisma,
        expect.objectContaining({
          status: 'failed',
          errorMessage: 'Test execution failed',
        })
      );
    });
  });

  // ST-305: Transcript Sync Warning Surfacing Tests
  describe('Transcript Sync Warnings (ST-305)', () => {
    const createMockRunWithTranscriptSync = (syncStatus: string) => ({
      id: 'run-uuid',
      status: 'running',
      workflowId: 'workflow-uuid',
      storyId: 'story-uuid',
      story: { id: 'story-uuid', key: 'ST-305', title: 'Test Story' },
      workflow: {
        id: 'workflow-uuid',
        name: 'Test Workflow',
        states: [
          {
            id: 'state-0',
            name: 'Implementation',
            order: 1,
            component: { id: 'comp-1', name: 'Implementer' },
          },
        ],
      },
      metadata: {
        checkpoint: {
          currentStateId: 'state-0',
          currentPhase: 'pre',
          phaseOutputs: {},
        },
        transcriptSync: {
          status: syncStatus,
          lastAttempt: new Date().toISOString(),
          retryCount: 2,
          error: 'Agent offline',
        },
      },
    });

    it('should surface warning when transcript sync is pending', async () => {
      const mockRun = createMockRunWithTranscriptSync('pending');
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);
      (mockPrisma.workflowRun.update as jest.Mock).mockResolvedValue(mockRun);

      const result: any = await handler(mockPrisma, { runId: 'run-uuid' });

      expect(result.success).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings.transcriptSync).toBeDefined();
      expect(result.warnings.transcriptSync).toContain('pending');
    });

    it('should surface warning when transcript sync failed', async () => {
      const mockRun = createMockRunWithTranscriptSync('failed');
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);
      (mockPrisma.workflowRun.update as jest.Mock).mockResolvedValue(mockRun);

      const result: any = await handler(mockPrisma, { runId: 'run-uuid' });

      expect(result.success).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings.transcriptSync).toBeDefined();
      expect(result.warnings.transcriptSync).toContain('failed');
      expect(result.warnings.transcriptSync).toContain('Agent offline');
    });

    it('should include retry count in warning message', async () => {
      const mockRun = createMockRunWithTranscriptSync('retrying');
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);
      (mockPrisma.workflowRun.update as jest.Mock).mockResolvedValue(mockRun);

      const result: any = await handler(mockPrisma, { runId: 'run-uuid' });

      expect(result.warnings).toBeDefined();
      expect(result.warnings.transcriptSync).toContain('2'); // retry count
    });

    it('should not show warning when sync is completed', async () => {
      const mockRun = {
        id: 'run-uuid',
        status: 'running',
        workflowId: 'workflow-uuid',
        story: null,
        workflow: {
          id: 'workflow-uuid',
          name: 'Test Workflow',
          states: [
            {
              id: 'state-0',
              name: 'State',
              order: 1,
              component: null,
            },
          ],
        },
        metadata: {
          checkpoint: {
            currentStateId: 'state-0',
            currentPhase: 'pre',
          },
          transcriptSync: {
            status: 'completed',
            completedAt: new Date().toISOString(),
          },
        },
      };

      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);
      (mockPrisma.workflowRun.update as jest.Mock).mockResolvedValue(mockRun);

      const result: any = await handler(mockPrisma, { runId: 'run-uuid' });

      expect(result.success).toBe(true);
      // Should not have transcript sync warning
      if (result.warnings) {
        expect(result.warnings.transcriptSync).toBeUndefined();
      }
    });

    it('should not show warning when no transcript sync metadata exists', async () => {
      const mockRun = {
        id: 'run-uuid',
        status: 'running',
        story: null,
        workflow: {
          id: 'w-1',
          name: 'Test',
          states: [
            {
              id: 'state-0',
              name: 'State',
              order: 1,
              component: null,
            },
          ],
        },
        metadata: {
          checkpoint: {
            currentStateId: 'state-0',
            currentPhase: 'pre',
          },
          // No transcriptSync field
        },
      };

      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);
      (mockPrisma.workflowRun.update as jest.Mock).mockResolvedValue(mockRun);

      const result: any = await handler(mockPrisma, { runId: 'run-uuid' });

      expect(result.success).toBe(true);
      if (result.warnings) {
        expect(result.warnings.transcriptSync).toBeUndefined();
      }
    });

    it('should format warning message with timestamp', async () => {
      const mockRun = createMockRunWithTranscriptSync('failed');
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);
      (mockPrisma.workflowRun.update as jest.Mock).mockResolvedValue(mockRun);

      const result: any = await handler(mockPrisma, { runId: 'run-uuid' });

      expect(result.warnings.transcriptSync).toContain('failed');
      // Warning should provide actionable info
      expect(typeof result.warnings.transcriptSync).toBe('string');
      expect(result.warnings.transcriptSync.length).toBeGreaterThan(0);
    });

    it('should handle malformed transcript sync metadata gracefully', async () => {
      const mockRun = {
        id: 'run-uuid',
        status: 'running',
        story: null,
        workflow: {
          id: 'w-1',
          name: 'Test',
          states: [{ id: 'state-0', name: 'State', order: 1, component: null }],
        },
        metadata: {
          checkpoint: {
            currentStateId: 'state-0',
            currentPhase: 'pre',
          },
          transcriptSync: {
            // Malformed - missing required fields
            status: 'failed',
            // No error message, no retry count
          },
        },
      };

      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);
      (mockPrisma.workflowRun.update as jest.Mock).mockResolvedValue(mockRun);

      // Should not throw
      const result: any = await handler(mockPrisma, { runId: 'run-uuid' });

      expect(result.success).toBe(true);
      if (result.warnings?.transcriptSync) {
        expect(result.warnings.transcriptSync).toContain('failed');
      }
    });
  });
});
