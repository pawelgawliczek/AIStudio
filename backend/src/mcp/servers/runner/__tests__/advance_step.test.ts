/**
 * Tests for advance_step MCP tool
 * ST-187: MCP Tool Optimization & Step Commands
 * ST-215: Automatic Agent Tracking
 */

import { PrismaClient } from '@prisma/client';
import { handler } from '../advance_step';
import * as agentTracking from '../../../shared/agent-tracking';

// Mock the agent-tracking module
jest.mock('../../../shared/agent-tracking', () => ({
  startAgentTracking: jest.fn(),
  completeAgentTracking: jest.fn(),
  generateComponentSummary: jest.fn(),
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
      (agentTracking.generateComponentSummary as jest.Mock).mockReset();
    });

    it('should auto-start agent tracking when advancing pre -> agent', async () => {
      const mockRun = createMockRunWithComponent('pre');
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);
      (mockPrisma.workflowRun.update as jest.Mock).mockResolvedValue(mockRun);
      (agentTracking.startAgentTracking as jest.Mock).mockResolvedValue({
        success: true,
        componentRunId: 'cr-123',
        componentName: 'Implementer',
        executionOrder: 1,
      });

      const result: any = await handler(mockPrisma, { runId: 'run-uuid' });

      // Verify startAgentTracking was called
      expect(agentTracking.startAgentTracking).toHaveBeenCalledWith(mockPrisma, {
        runId: 'run-uuid',
        componentId: 'comp-1',
        input: undefined,
      });

      // Verify response includes agentTracking info
      expect(result.success).toBe(true);
      expect(result.currentState.phase).toBe('agent');
      expect(result.agentTracking).toBeDefined();
      expect(result.agentTracking.action).toBe('started');
      expect(result.agentTracking.success).toBe(true);
      expect(result.agentTracking.componentRunId).toBe('cr-123');
      expect(result.agentTracking.componentName).toBe('Implementer');
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
      (agentTracking.generateComponentSummary as jest.Mock).mockReturnValue(
        'Implementer completed. Modified 3 file(s).'
      );

      const result: any = await handler(mockPrisma, {
        runId: 'run-uuid',
        output: { files: ['a.ts', 'b.ts', 'c.ts'] },
      });

      // Verify completeAgentTracking was called
      expect(agentTracking.completeAgentTracking).toHaveBeenCalledWith(mockPrisma, {
        runId: 'run-uuid',
        componentId: 'comp-1',
        output: { files: ['a.ts', 'b.ts', 'c.ts'] },
        status: 'completed',
        componentSummary: 'Implementer completed. Modified 3 file(s).',
        errorMessage: undefined,
      });

      // Verify response includes agentTracking info
      expect(result.success).toBe(true);
      expect(result.currentState.phase).toBe('post');
      expect(result.agentTracking).toBeDefined();
      expect(result.agentTracking.action).toBe('completed');
      expect(result.agentTracking.success).toBe(true);
    });

    it('should include warning when agent tracking start fails but still advance', async () => {
      const mockRun = createMockRunWithComponent('pre');
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);
      (mockPrisma.workflowRun.update as jest.Mock).mockResolvedValue(mockRun);
      (agentTracking.startAgentTracking as jest.Mock).mockResolvedValue({
        success: false,
        error: 'Database connection failed',
      });

      const result: any = await handler(mockPrisma, { runId: 'run-uuid' });

      // Phase still advances
      expect(result.success).toBe(true);
      expect(result.currentState.phase).toBe('agent');

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

    it('should auto-generate componentSummary when not provided', async () => {
      const mockRun = createMockRunWithComponent('agent');
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);
      (mockPrisma.workflowRun.update as jest.Mock).mockResolvedValue(mockRun);
      (agentTracking.completeAgentTracking as jest.Mock).mockResolvedValue({
        success: true,
        componentRunId: 'cr-123',
      });
      (agentTracking.generateComponentSummary as jest.Mock).mockReturnValue(
        'Implementer completed.'
      );

      await handler(mockPrisma, {
        runId: 'run-uuid',
        output: { status: 'done' },
      });

      // Verify generateComponentSummary was called
      expect(agentTracking.generateComponentSummary).toHaveBeenCalledWith(
        { status: 'done' },
        'Implementer'
      );

      // Verify the generated summary was passed to completeAgentTracking
      expect(agentTracking.completeAgentTracking).toHaveBeenCalledWith(
        mockPrisma,
        expect.objectContaining({
          componentSummary: 'Implementer completed.',
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

      // Verify generateComponentSummary was NOT called
      expect(agentTracking.generateComponentSummary).not.toHaveBeenCalled();

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
      (agentTracking.generateComponentSummary as jest.Mock).mockReturnValue('Failed');

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

    it('should handle exception from startAgentTracking gracefully', async () => {
      const mockRun = createMockRunWithComponent('pre');
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);
      (mockPrisma.workflowRun.update as jest.Mock).mockResolvedValue(mockRun);
      (agentTracking.startAgentTracking as jest.Mock).mockRejectedValue(
        new Error('Unexpected database error')
      );

      const result: any = await handler(mockPrisma, { runId: 'run-uuid' });

      // Phase still advances
      expect(result.success).toBe(true);
      expect(result.currentState.phase).toBe('agent');

      // Warning is included
      expect(result.agentTracking.success).toBe(false);
      expect(result.agentTracking.warning).toContain('Unexpected database error');
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

      // Should serialize structured summary before passing to completeAgentTracking
      expect(agentTracking.completeAgentTracking).toHaveBeenCalledWith(
        mockPrisma,
        expect.objectContaining({
          componentSummary: expect.stringContaining('"version":"1.0"'),
        })
      );
    });

    it('should validate structured componentSummary has required fields', async () => {
      const mockRun = createMockRunWithComponent('agent');
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);

      const invalidSummary = {
        version: '1.0',
        status: 'success',
        // Missing required 'summary' field
      };

      await expect(
        handler(mockPrisma, {
          runId: 'run-uuid',
          componentSummary: invalidSummary as any,
        })
      ).rejects.toThrow();
    });

    it('should validate status field is valid enum value', async () => {
      const mockRun = createMockRunWithComponent('agent');
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);

      const invalidStatus = {
        version: '1.0',
        status: 'invalid_status',
        summary: 'Test summary',
      };

      await expect(
        handler(mockPrisma, {
          runId: 'run-uuid',
          componentSummary: invalidStatus as any,
        })
      ).rejects.toThrow();
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
      (agentTracking.generateComponentSummary as jest.Mock).mockReturnValue(
        mockStructuredSummary
      );

      await handler(mockPrisma, {
        runId: 'run-uuid',
        output: { files: ['a.ts', 'b.ts', 'c.ts'] },
      });

      // Should call generateStructuredSummary (replaces generateComponentSummary)
      expect(agentTracking.generateComponentSummary).toHaveBeenCalledWith(
        { files: ['a.ts', 'b.ts', 'c.ts'] },
        'Implementer'
      );

      // Should serialize the structured result
      expect(agentTracking.completeAgentTracking).toHaveBeenCalledWith(
        mockPrisma,
        expect.objectContaining({
          componentSummary: expect.stringContaining('"version":"1.0"'),
        })
      );
    });

    it('should serialize structured summary with all status types', async () => {
      const mockRun = createMockRunWithComponent('agent');
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);
      (mockPrisma.workflowRun.update as jest.Mock).mockResolvedValue(mockRun);
      (agentTracking.completeAgentTracking as jest.Mock).mockResolvedValue({
        success: true,
      });

      const statuses: Array<'success' | 'partial' | 'blocked' | 'failed'> = [
        'success',
        'partial',
        'blocked',
        'failed',
      ];

      for (const status of statuses) {
        const summary = {
          version: '1.0' as const,
          status,
          summary: `Work ${status}`,
        };

        await handler(mockPrisma, {
          runId: 'run-uuid',
          componentSummary: summary,
        });

        const lastCall = (agentTracking.completeAgentTracking as jest.Mock).mock.calls.slice(
          -1
        )[0];
        const serialized = lastCall[1].componentSummary;

        expect(serialized).toContain(`"status":"${status}"`);
      }
    });

    it('should serialize structured summary with optional fields', async () => {
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
      const serialized = lastCall[1].componentSummary;
      const parsed = JSON.parse(serialized);

      expect(parsed.keyOutputs).toEqual(['Created models', 'Added migrations']);
      expect(parsed.nextAgentHints).toEqual(['Complete API endpoints', 'Add validation']);
      expect(parsed.artifactsProduced).toEqual(['ARCH_DOC', 'DB_SCHEMA']);
      expect(parsed.errors).toEqual(['Missing test coverage']);
    });

    it('should handle errors in serialization gracefully', async () => {
      const mockRun = createMockRunWithComponent('agent');
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);
      (mockPrisma.workflowRun.update as jest.Mock).mockResolvedValue(mockRun);
      (agentTracking.completeAgentTracking as jest.Mock).mockResolvedValue({
        success: true,
      });

      // Create object with circular reference (causes JSON.stringify to fail)
      const circularSummary: any = {
        version: '1.0',
        status: 'success',
        summary: 'Test',
      };
      circularSummary.circular = circularSummary;

      await expect(
        handler(mockPrisma, {
          runId: 'run-uuid',
          componentSummary: circularSummary,
        })
      ).rejects.toThrow();
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
});
