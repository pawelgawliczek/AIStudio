/**
 * Tests for get_current_step.ts - Orchestrator-Driven Commits (ST-278)
 *
 * TDD Implementation - These tests WILL FAIL until get_current_step.ts is updated
 *
 * The feature requires get_current_step to return commit instructions for code-modifying components.
 * Components that modify code (Implementer, Developer, Tester, Reviewer) should have orchestrator
 * commit steps in their workflowSequence.
 */

import { PrismaClient } from '@prisma/client';
import { handler } from '../get_current_step';

describe('get_current_step - Orchestrator-Driven Commits (ST-278)', () => {
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

  describe('Code-Modifying Components - Commit Step in workflowSequence', () => {
    const CODE_MODIFYING_COMPONENTS = [
      'Implementer',
      'Developer',
      'Tester',
      'Reviewer',
    ];

    CODE_MODIFYING_COMPONENTS.forEach((componentName) => {
      it(`should include commit step for ${componentName} component in agent phase`, async () => {
        const mockRun = {
          id: 'run-uuid',
          status: 'running',
          isPaused: false,
          storyId: 'story-uuid',
          story: { id: 'story-uuid', key: 'ST-278', title: 'Test', summary: null, status: 'impl' },
          workflow: {
            id: 'workflow-uuid',
            name: 'Dev Workflow',
            states: [
              {
                id: 'state-1',
                name: 'implementation',
                order: 1,
                component: {
                  id: 'comp-1',
                  name: componentName,
                  tools: ['Read', 'Edit', 'Write', 'Bash'],
                  config: { modelId: 'claude-sonnet-4-20250514' },
                  inputInstructions: 'Read requirements',
                  operationInstructions: 'Write code',
                  outputInstructions: 'Provide summary',
                },
                preExecutionInstructions: 'Setup environment',
                postExecutionInstructions: 'Verify changes',
                requiresApproval: false,
              },
            ],
          },
          metadata: {
            checkpoint: {
              currentStateId: 'state-1',
              currentPhase: 'agent',
              phaseStatus: 'pending',
              completedStates: [],
              skippedStates: [],
            },
          },
        };

        (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);

        // THIS TEST WILL FAIL - get_current_step doesn't include commit step yet
        const result: any = await handler(mockPrisma, { runId: 'run-uuid' });

        expect(result.success).toBe(true);
        expect(result.instructions.type).toBe('agent_spawn');
        expect(result.workflowSequence).toBeDefined();

        // Should have 3 steps: spawn agent, commit, advance_step
        expect(result.workflowSequence.length).toBe(3);

        // Step 1: Spawn agent
        expect(result.workflowSequence[0].type).toBe('agent_spawn');
        expect(result.workflowSequence[0].description).toContain('Task tool');

        // Step 2: Commit changes (NEW for ST-278)
        expect(result.workflowSequence[1].type).toBe('mcp_tool');
        expect(result.workflowSequence[1].tool).toBe('exec-command');
        expect(result.workflowSequence[1].description).toContain('Commit');
        expect(result.workflowSequence[1].parameters).toEqual(
          expect.objectContaining({
            command: expect.stringContaining('git commit'),
          })
        );

        // Step 3: advance_step
        expect(result.workflowSequence[2].type).toBe('mcp_tool');
        expect(result.workflowSequence[2].tool).toBe('advance_step');
      });
    });

    it('should include proper commit message in commit step', async () => {
      const mockRun = {
        id: 'run-uuid',
        status: 'running',
        isPaused: false,
        storyId: 'story-uuid',
        story: { id: 'story-uuid', key: 'ST-278', title: 'Add feature X', summary: null, status: 'impl' },
        workflow: {
          id: 'workflow-uuid',
          name: 'Dev Workflow',
          states: [
            {
              id: 'state-1',
              name: 'implementation',
              order: 1,
              component: {
                id: 'comp-1',
                name: 'Implementer',
                tools: ['Read', 'Edit'],
                config: {},
                inputInstructions: '',
                operationInstructions: '',
                outputInstructions: '',
              },
            },
          ],
        },
        metadata: {
          checkpoint: {
            currentStateId: 'state-1',
            currentPhase: 'agent',
            completedStates: [],
            skippedStates: [],
          },
        },
      };

      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);

      // THIS TEST WILL FAIL - get_current_step doesn't generate commit message yet
      const result: any = await handler(mockPrisma, { runId: 'run-uuid' });

      const commitStep = result.workflowSequence.find(
        (step: any) => step.tool === 'exec-command'
      );

      expect(commitStep).toBeDefined();
      expect(commitStep.parameters.command).toContain('git commit');
      expect(commitStep.parameters.command).toContain('ST-278');
      expect(commitStep.parameters.command).toContain('Implementer');
    });
  });

  describe('Non-Code-Modifying Components - No Commit Step', () => {
    const NON_CODE_COMPONENTS = [
      'Explorer',
      'Architect',
      'PM',
      'Analyst',
    ];

    NON_CODE_COMPONENTS.forEach((componentName) => {
      it(`should NOT include commit step for ${componentName} component`, async () => {
        const mockRun = {
          id: 'run-uuid',
          status: 'running',
          isPaused: false,
          storyId: 'story-uuid',
          story: { id: 'story-uuid', key: 'ST-278', title: 'Test', summary: null, status: 'impl' },
          workflow: {
            id: 'workflow-uuid',
            name: 'Dev Workflow',
            states: [
              {
                id: 'state-1',
                name: 'analysis',
                order: 1,
                component: {
                  id: 'comp-1',
                  name: componentName,
                  tools: ['Read', 'Grep'],
                  config: {},
                  inputInstructions: '',
                  operationInstructions: '',
                  outputInstructions: '',
                },
              },
            ],
          },
          metadata: {
            checkpoint: {
              currentStateId: 'state-1',
              currentPhase: 'agent',
              completedStates: [],
              skippedStates: [],
            },
          },
        };

        (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);

        // THIS TEST WILL FAIL if commit step is incorrectly added to non-code components
        const result: any = await handler(mockPrisma, { runId: 'run-uuid' });

        expect(result.success).toBe(true);
        expect(result.workflowSequence).toBeDefined();

        // Should only have 2 steps: spawn agent, advance_step (NO commit)
        expect(result.workflowSequence.length).toBe(2);

        // Step 1: Spawn agent
        expect(result.workflowSequence[0].type).toBe('agent_spawn');

        // Step 2: advance_step
        expect(result.workflowSequence[1].type).toBe('mcp_tool');
        expect(result.workflowSequence[1].tool).toBe('advance_step');

        // Verify NO commit step
        const hasCommitStep = result.workflowSequence.some(
          (step: any) => step.tool === 'exec-command' && step.description.toLowerCase().includes('commit')
        );
        expect(hasCommitStep).toBe(false);
      });
    });
  });

  describe('Step Numbering with Commit Step', () => {
    it('should number steps correctly when commit step is added', async () => {
      const mockRun = {
        id: 'run-uuid',
        status: 'running',
        isPaused: false,
        storyId: 'story-uuid',
        story: { id: 'story-uuid', key: 'ST-278', title: 'Test', summary: null, status: 'impl' },
        workflow: {
          id: 'workflow-uuid',
          name: 'Dev Workflow',
          states: [
            {
              id: 'state-1',
              name: 'implementation',
              order: 1,
              component: {
                id: 'comp-1',
                name: 'Implementer',
                tools: ['Read', 'Edit'],
                config: {},
                inputInstructions: '',
                operationInstructions: '',
                outputInstructions: '',
              },
            },
          ],
        },
        metadata: {
          checkpoint: {
            currentStateId: 'state-1',
            currentPhase: 'agent',
            completedStates: [],
            skippedStates: [],
          },
        },
      };

      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);

      // THIS TEST WILL FAIL - get_current_step doesn't renumber steps yet
      const result: any = await handler(mockPrisma, { runId: 'run-uuid' });

      expect(result.workflowSequence.length).toBe(3);

      // Verify step numbers are sequential
      expect(result.workflowSequence[0].step).toBe(1); // Spawn agent
      expect(result.workflowSequence[1].step).toBe(2); // Commit
      expect(result.workflowSequence[2].step).toBe(3); // advance_step
    });
  });

  describe('Commit Command Format', () => {
    it('should include --cwd parameter in commit command', async () => {
      const mockRun = {
        id: 'run-uuid',
        status: 'running',
        isPaused: false,
        storyId: 'story-uuid',
        story: { id: 'story-uuid', key: 'ST-278', title: 'Test', summary: null, status: 'impl' },
        workflow: {
          id: 'workflow-uuid',
          name: 'Dev Workflow',
          states: [
            {
              id: 'state-1',
              name: 'implementation',
              order: 1,
              component: {
                id: 'comp-1',
                name: 'Implementer',
                tools: [],
                config: {},
                inputInstructions: '',
                operationInstructions: '',
                outputInstructions: '',
              },
            },
          ],
        },
        metadata: {
          checkpoint: {
            currentStateId: 'state-1',
            currentPhase: 'agent',
            completedStates: [],
            skippedStates: [],
          },
        },
      };

      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);

      // THIS TEST WILL FAIL - get_current_step doesn't include cwd yet
      const result: any = await handler(mockPrisma, { runId: 'run-uuid' });

      const commitStep = result.workflowSequence.find(
        (step: any) => step.tool === 'exec-command'
      );

      expect(commitStep).toBeDefined();
      expect(commitStep.parameters).toEqual(
        expect.objectContaining({
          cwd: expect.stringMatching(/worktrees|AIStudio/),
        })
      );
    });

    it('should use git add -A before commit', async () => {
      const mockRun = {
        id: 'run-uuid',
        status: 'running',
        isPaused: false,
        storyId: 'story-uuid',
        story: { id: 'story-uuid', key: 'ST-278', title: 'Test', summary: null, status: 'impl' },
        workflow: {
          id: 'workflow-uuid',
          name: 'Dev Workflow',
          states: [
            {
              id: 'state-1',
              name: 'implementation',
              order: 1,
              component: {
                id: 'comp-1',
                name: 'Developer',
                tools: [],
                config: {},
                inputInstructions: '',
                operationInstructions: '',
                outputInstructions: '',
              },
            },
          ],
        },
        metadata: {
          checkpoint: {
            currentStateId: 'state-1',
            currentPhase: 'agent',
            completedStates: [],
            skippedStates: [],
          },
        },
      };

      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);

      // THIS TEST WILL FAIL - get_current_step doesn't include git add yet
      const result: any = await handler(mockPrisma, { runId: 'run-uuid' });

      const commitStep = result.workflowSequence.find(
        (step: any) => step.tool === 'exec-command'
      );

      expect(commitStep).toBeDefined();
      expect(commitStep.parameters.command).toMatch(/git add -A.*&&.*git commit/);
    });
  });
});
