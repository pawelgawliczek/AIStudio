/**
 * Tests for advance_step.ts - commitBeforeAdvance Logic (ST-278)
 *
 * TDD Implementation - These tests WILL FAIL until advance_step.ts is updated
 *
 * The feature requires advance_step to return commitBeforeAdvance instructions
 * for code-modifying components (Implementer, Developer, Tester, Reviewer).
 */

import { PrismaClient } from '@prisma/client';
import * as agentTracking from '../../../shared/agent-tracking';
import { handler } from '../advance_step';

// Mock the agent-tracking module
jest.mock('../../../shared/agent-tracking', () => ({
  startAgentTracking: jest.fn(),
  completeAgentTracking: jest.fn(),
  generateComponentSummary: jest.fn(),
  generateStructuredSummary: jest.fn().mockReturnValue({
    version: '1.0',
    status: 'success',
    summary: 'Auto-generated summary',
  }),
  serializeComponentSummary: jest.fn().mockImplementation((obj) => JSON.stringify(obj)),
}));

describe('advance_step - commitBeforeAdvance Logic (ST-278)', () => {
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

  describe('Code-Modifying Components - Return commitBeforeAdvance', () => {
    const CODE_MODIFYING_COMPONENTS = [
      { name: 'Implementer', stateName: 'implementation' },
      { name: 'Developer', stateName: 'development' },
      { name: 'Tester', stateName: 'testing' },
      { name: 'Reviewer', stateName: 'review' },
    ];

    CODE_MODIFYING_COMPONENTS.forEach(({ name, stateName }) => {
      it(`should return commitBeforeAdvance for ${name} when advancing from agent to post`, async () => {
        const mockRun = {
          id: 'run-uuid',
          status: 'running',
          workflowId: 'workflow-uuid',
          storyId: 'story-uuid',
          story: { id: 'story-uuid', key: 'ST-278', title: 'Test Feature' },
          workflow: {
            id: 'workflow-uuid',
            name: 'Dev Workflow',
            states: [
              {
                id: 'state-0',
                name: stateName,
                order: 1,
                component: { id: 'comp-1', name },
                preExecutionInstructions: 'Setup',
                postExecutionInstructions: 'Verify',
              },
            ],
          },
          metadata: {
            checkpoint: {
              version: 1,
              runId: 'run-uuid',
              workflowId: 'workflow-uuid',
              currentStateId: 'state-0',
              currentPhase: 'agent',
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

        (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);
        (mockPrisma.workflowRun.update as jest.Mock).mockResolvedValue(mockRun);
        (agentTracking.completeAgentTracking as jest.Mock).mockResolvedValue({
          success: true,
        });

        // THIS TEST WILL FAIL - advance_step doesn't return commitBeforeAdvance yet
        const result: any = await handler(mockPrisma, {
          runId: 'run-uuid',
          output: { files: ['test.ts'] },
        });

        expect(result.success).toBe(true);
        expect(result.currentState.phase).toBe('post');

        // Should include commitBeforeAdvance instructions
        expect(result.commitBeforeAdvance).toBeDefined();
        expect(result.commitBeforeAdvance.tool).toBe('exec-command');
        expect(result.commitBeforeAdvance.parameters).toEqual(
          expect.objectContaining({
            command: expect.stringContaining('git commit'),
          })
        );
        expect(result.commitBeforeAdvance.description).toContain('Commit');
        expect(result.commitBeforeAdvance.description).toContain(name);
      });
    });
  });

  describe('Non-Code-Modifying Components - No commitBeforeAdvance', () => {
    const NON_CODE_COMPONENTS = [
      { name: 'Explorer', stateName: 'exploration' },
      { name: 'Architect', stateName: 'architecture' },
      { name: 'PM', stateName: 'planning' },
    ];

    NON_CODE_COMPONENTS.forEach(({ name, stateName }) => {
      it(`should NOT return commitBeforeAdvance for ${name}`, async () => {
        const mockRun = {
          id: 'run-uuid',
          status: 'running',
          workflowId: 'workflow-uuid',
          storyId: 'story-uuid',
          story: { id: 'story-uuid', key: 'ST-278', title: 'Test' },
          workflow: {
            id: 'workflow-uuid',
            name: 'Dev Workflow',
            states: [
              {
                id: 'state-0',
                name: stateName,
                order: 1,
                component: { id: 'comp-1', name },
                preExecutionInstructions: 'Setup',
                postExecutionInstructions: 'Verify',
              },
            ],
          },
          metadata: {
            checkpoint: {
              currentStateId: 'state-0',
              currentPhase: 'agent',
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

        (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);
        (mockPrisma.workflowRun.update as jest.Mock).mockResolvedValue(mockRun);
        (agentTracking.completeAgentTracking as jest.Mock).mockResolvedValue({
          success: true,
        });

        // THIS TEST WILL FAIL if commitBeforeAdvance is incorrectly returned for non-code components
        const result: any = await handler(mockPrisma, {
          runId: 'run-uuid',
          output: { analysis: 'complete' },
        });

        expect(result.success).toBe(true);
        expect(result.currentState.phase).toBe('post');

        // Should NOT include commitBeforeAdvance
        expect(result.commitBeforeAdvance).toBeUndefined();
      });
    });
  });

  describe('commitBeforeAdvance Structure', () => {
    it('should include correct parameters in commitBeforeAdvance', async () => {
      const mockRun = {
        id: 'run-uuid',
        status: 'running',
        workflowId: 'workflow-uuid',
        storyId: 'story-uuid',
        story: { id: 'story-uuid', key: 'ST-278', title: 'Add authentication' },
        workflow: {
          id: 'workflow-uuid',
          name: 'Dev Workflow',
          states: [
            {
              id: 'state-0',
              name: 'implementation',
              order: 1,
              component: { id: 'comp-1', name: 'Implementer' },
            },
          ],
        },
        metadata: {
          checkpoint: {
            currentStateId: 'state-0',
            currentPhase: 'agent',
            completedStates: [],
            skippedStates: [],
          },
        },
      };

      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);
      (mockPrisma.workflowRun.update as jest.Mock).mockResolvedValue(mockRun);
      (agentTracking.completeAgentTracking as jest.Mock).mockResolvedValue({
        success: true,
      });

      const result: any = await handler(mockPrisma, {
        runId: 'run-uuid',
        output: { files: ['auth.ts'] },
      });

      expect(result.commitBeforeAdvance).toEqual({
        tool: 'exec-command',
        parameters: expect.objectContaining({
          command: expect.stringMatching(/git add -A.*&&.*git commit/),
          // ST-289: cwd uses placeholder that gets resolved at runtime
          cwd: expect.stringMatching(/{{WORKTREE_PATH}}|worktrees|AIStudio/),
        }),
        description: expect.stringContaining('Implementer'),
      });
    });

    it('should include story key in commit message', async () => {
      const mockRun = {
        id: 'run-uuid',
        status: 'running',
        workflowId: 'workflow-uuid',
        storyId: 'story-uuid',
        story: { id: 'story-uuid', key: 'ST-278', title: 'Feature X' },
        workflow: {
          id: 'workflow-uuid',
          name: 'Dev Workflow',
          states: [
            {
              id: 'state-0',
              name: 'implementation',
              order: 1,
              component: { id: 'comp-1', name: 'Developer' },
            },
          ],
        },
        metadata: {
          checkpoint: {
            currentStateId: 'state-0',
            currentPhase: 'agent',
            completedStates: [],
            skippedStates: [],
          },
        },
      };

      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);
      (mockPrisma.workflowRun.update as jest.Mock).mockResolvedValue(mockRun);
      (agentTracking.completeAgentTracking as jest.Mock).mockResolvedValue({
        success: true,
      });

      // THIS TEST WILL FAIL - advance_step doesn't include story key in commit yet
      const result: any = await handler(mockPrisma, {
        runId: 'run-uuid',
        output: { files: ['feature.ts'] },
      });

      expect(result.commitBeforeAdvance).toBeDefined();
      expect(result.commitBeforeAdvance.parameters.command).toContain('ST-278');
    });

    it('should include component name in commit message', async () => {
      const mockRun = {
        id: 'run-uuid',
        status: 'running',
        workflowId: 'workflow-uuid',
        storyId: 'story-uuid',
        story: { id: 'story-uuid', key: 'ST-278', title: 'Feature X' },
        workflow: {
          id: 'workflow-uuid',
          name: 'Dev Workflow',
          states: [
            {
              id: 'state-0',
              name: 'testing',
              order: 1,
              component: { id: 'comp-1', name: 'Tester' },
            },
          ],
        },
        metadata: {
          checkpoint: {
            currentStateId: 'state-0',
            currentPhase: 'agent',
            completedStates: [],
            skippedStates: [],
          },
        },
      };

      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);
      (mockPrisma.workflowRun.update as jest.Mock).mockResolvedValue(mockRun);
      (agentTracking.completeAgentTracking as jest.Mock).mockResolvedValue({
        success: true,
      });

      // THIS TEST WILL FAIL - advance_step doesn't include component name yet
      const result: any = await handler(mockPrisma, {
        runId: 'run-uuid',
        output: { tests: 'pass' },
      });

      expect(result.commitBeforeAdvance).toBeDefined();
      expect(result.commitBeforeAdvance.parameters.command).toContain('Tester');
    });
  });

  describe('Edge Cases', () => {
    it('should not return commitBeforeAdvance when advancing from pre to agent', async () => {
      const mockRun = {
        id: 'run-uuid',
        status: 'running',
        workflowId: 'workflow-uuid',
        story: null,
        workflow: {
          id: 'workflow-uuid',
          name: 'Dev Workflow',
          states: [
            {
              id: 'state-0',
              name: 'implementation',
              order: 1,
              component: { id: 'comp-1', name: 'Implementer' },
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

      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);
      (mockPrisma.workflowRun.update as jest.Mock).mockResolvedValue(mockRun);
      (agentTracking.startAgentTracking as jest.Mock).mockResolvedValue({
        success: true,
      });

      const result: any = await handler(mockPrisma, { runId: 'run-uuid' });

      expect(result.success).toBe(true);
      expect(result.currentState.phase).toBe('agent');

      // Should NOT return commitBeforeAdvance when entering agent phase
      expect(result.commitBeforeAdvance).toBeUndefined();
    });

    it('should not return commitBeforeAdvance when advancing from agent to post for failed agent', async () => {
      const mockRun = {
        id: 'run-uuid',
        status: 'running',
        workflowId: 'workflow-uuid',
        storyId: 'story-uuid',
        story: { id: 'story-uuid', key: 'ST-278', title: 'Test' },
        workflow: {
          id: 'workflow-uuid',
          name: 'Dev Workflow',
          states: [
            {
              id: 'state-0',
              name: 'implementation',
              order: 1,
              component: { id: 'comp-1', name: 'Implementer' },
            },
          ],
        },
        metadata: {
          checkpoint: {
            currentStateId: 'state-0',
            currentPhase: 'agent',
            completedStates: [],
            skippedStates: [],
          },
        },
      };

      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);
      (mockPrisma.workflowRun.update as jest.Mock).mockResolvedValue(mockRun);
      (agentTracking.completeAgentTracking as jest.Mock).mockResolvedValue({
        success: true,
      });

      const result: any = await handler(mockPrisma, {
        runId: 'run-uuid',
        output: { error: 'failed' },
        agentStatus: 'failed',
      });

      expect(result.success).toBe(true);

      // Should NOT return commitBeforeAdvance for failed agents
      // (no code changes to commit)
      expect(result.commitBeforeAdvance).toBeUndefined();
    });

    it('should handle state without component (no commitBeforeAdvance)', async () => {
      const mockRun = {
        id: 'run-uuid',
        status: 'running',
        workflowId: 'workflow-uuid',
        story: null,
        workflow: {
          id: 'workflow-uuid',
          name: 'Dev Workflow',
          states: [
            {
              id: 'state-0',
              name: 'manual-step',
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

      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);
      (mockPrisma.workflowRun.update as jest.Mock).mockResolvedValue(mockRun);

      const result: any = await handler(mockPrisma, { runId: 'run-uuid' });

      expect(result.success).toBe(true);
      expect(result.commitBeforeAdvance).toBeUndefined();
    });
  });
});
