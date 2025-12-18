/**
 * Unit tests for advance_step Helper Functions
 * ST-284: Architecture & Complexity Cleanup - Phase 1
 *
 * TDD Test Suite - Tests written BEFORE implementation
 *
 * These tests cover helper functions that will be extracted from buildAdvanceResponse
 * to reduce cyclomatic complexity and improve code organization.
 */

// Helper functions to be implemented in advance_step.helpers.ts
// These are currently NOT implemented - tests will fail
import {
  buildPhaseInstructions,
  buildCommitInstruction,
  buildEnforcementData,
} from '../advance_step.helpers';

// Mock types matching the actual domain types
interface WorkflowStateData {
  id: string;
  name: string;
  order: number;
  componentId: string | null;
  preExecutionInstructions: string | null;
  postExecutionInstructions: string | null;
  component?: ComponentData | null;
}

interface ComponentData {
  id: string;
  name: string;
  executionType: string;
  config?: Record<string, unknown>;
  tools?: string[];
  inputInstructions?: string | null;
  operationInstructions?: string | null;
  outputInstructions?: string | null;
}

interface StoryData {
  key: string;
  title: string;
}

describe('advance_step Helper Functions', () => {
  describe('buildPhaseInstructions', () => {
    describe('pre phase', () => {
      it('should build pre-execution instructions', () => {
        const state: WorkflowStateData = {
          id: 'state-1',
          name: 'Analysis',
          order: 1,
          componentId: 'comp-1',
          preExecutionInstructions: 'Review requirements before starting',
          postExecutionInstructions: null,
        };

        const result = buildPhaseInstructions('pre', state, 'run-123');

        expect(result.instructions.type).toBe('pre_execution');
        expect(result.instructions.content).toBe('Review requirements before starting');
        expect(result.nextAction.tool).toBe('advance_step');
        expect(result.nextAction.parameters.runId).toBe('run-123');
      });

      it('should provide default message when no pre-execution instructions', () => {
        const state: WorkflowStateData = {
          id: 'state-1',
          name: 'Analysis',
          order: 1,
          componentId: 'comp-1',
          preExecutionInstructions: null,
          postExecutionInstructions: null,
        };

        const result = buildPhaseInstructions('pre', state, 'run-123');

        expect(result.instructions.type).toBe('pre_execution');
        expect(result.instructions.content).toBe('No pre-execution instructions. Proceed to advance_step.');
      });

      it('should include hint for next action', () => {
        const state: WorkflowStateData = {
          id: 'state-1',
          name: 'Analysis',
          order: 1,
          componentId: null,
          preExecutionInstructions: 'Pre instructions',
          postExecutionInstructions: null,
        };

        const result = buildPhaseInstructions('pre', state, 'run-123');

        expect(result.nextAction.hint).toBe('Call advance_step when pre-execution is complete.');
      });
    });

    describe('agent phase', () => {
      it('should build agent spawn instructions with component config', () => {
        const state: WorkflowStateData = {
          id: 'state-1',
          name: 'Implementation',
          order: 2,
          componentId: 'comp-1',
          preExecutionInstructions: null,
          postExecutionInstructions: null,
          component: {
            id: 'comp-1',
            name: 'Implementer',
            executionType: 'implementer',
            config: { modelId: 'claude-opus-4-5-20251101' },
            tools: ['bash', 'edit', 'read'],
            inputInstructions: 'Read the plan',
            operationInstructions: 'Write code',
            outputInstructions: 'Report changes',
          },
        };

        const result = buildPhaseInstructions('agent', state, 'run-123');

        expect(result.instructions.type).toBe('agent_spawn');
        expect(result.instructions.content).toContain('Implementer');
        expect(result.instructions.content).toContain('claude-opus-4-5-20251101');
        expect(result.instructions.component).toBeDefined();
        expect(result.instructions.component.id).toBe('comp-1');
        expect(result.instructions.component.name).toBe('Implementer');
        expect(result.instructions.component.model).toBe('claude-opus-4-5-20251101');
        expect(result.instructions.component.tools).toEqual(['bash', 'edit', 'read']);
      });

      it('should use default model when not specified in config', () => {
        const state: WorkflowStateData = {
          id: 'state-1',
          name: 'Implementation',
          order: 2,
          componentId: 'comp-1',
          preExecutionInstructions: null,
          postExecutionInstructions: null,
          component: {
            id: 'comp-1',
            name: 'Implementer',
            executionType: 'implementer',
            config: {},
            tools: [],
          },
        };

        const result = buildPhaseInstructions('agent', state, 'run-123');

        expect(result.instructions.component.model).toBe('claude-sonnet-4-20250514');
      });

      it('should include enforcement data with allowed subagent types', () => {
        const state: WorkflowStateData = {
          id: 'state-1',
          name: 'Implementation',
          order: 2,
          componentId: 'comp-1',
          preExecutionInstructions: null,
          postExecutionInstructions: null,
          component: {
            id: 'comp-1',
            name: 'Implementer',
            executionType: 'implementer',
            config: {},
            tools: [],
          },
        };

        const result = buildPhaseInstructions('agent', state, 'run-123');

        expect(result.instructions.enforcement).toBeDefined();
        expect(result.instructions.enforcement.allowedSubagentTypes).toEqual(['code']);
        expect(result.instructions.enforcement.requiredComponentName).toBe('Implementer');
      });

      it('should derive correct subagent type for Developer', () => {
        const state: WorkflowStateData = {
          id: 'state-1',
          name: 'Development',
          order: 2,
          componentId: 'comp-1',
          preExecutionInstructions: null,
          postExecutionInstructions: null,
          component: {
            id: 'comp-1',
            name: 'Developer',
            executionType: 'custom',
            config: {},
            tools: [],
          },
        };

        const result = buildPhaseInstructions('agent', state, 'run-123');

        expect(result.instructions.enforcement.allowedSubagentTypes).toEqual(['code']);
      });

      it('should derive correct subagent type for Tester', () => {
        const state: WorkflowStateData = {
          id: 'state-1',
          name: 'Testing',
          order: 3,
          componentId: 'comp-1',
          preExecutionInstructions: null,
          postExecutionInstructions: null,
          component: {
            id: 'comp-1',
            name: 'Tester',
            executionType: 'custom',
            config: {},
            tools: [],
          },
        };

        const result = buildPhaseInstructions('agent', state, 'run-123');

        expect(result.instructions.enforcement.allowedSubagentTypes).toEqual(['code']);
      });

      it('should derive correct subagent type for Explorer', () => {
        const state: WorkflowStateData = {
          id: 'state-1',
          name: 'Exploration',
          order: 1,
          componentId: 'comp-1',
          preExecutionInstructions: null,
          postExecutionInstructions: null,
          component: {
            id: 'comp-1',
            name: 'Explorer',
            executionType: 'explorer',
            config: {},
            tools: [],
          },
        };

        const result = buildPhaseInstructions('agent', state, 'run-123');

        expect(result.instructions.enforcement.allowedSubagentTypes).toEqual(['ask']);
      });

      it('should handle state with no component (fallback to post)', () => {
        const state: WorkflowStateData = {
          id: 'state-1',
          name: 'Manual Step',
          order: 1,
          componentId: null,
          preExecutionInstructions: null,
          postExecutionInstructions: 'Review manually',
        };

        const result = buildPhaseInstructions('agent', state, 'run-123');

        expect(result.instructions.type).toBe('post_execution');
        expect(result.instructions.content).toBe('No agent assigned. Proceeding to post-execution.');
      });

      it('should include component instructions fields', () => {
        const state: WorkflowStateData = {
          id: 'state-1',
          name: 'Implementation',
          order: 2,
          componentId: 'comp-1',
          preExecutionInstructions: null,
          postExecutionInstructions: null,
          component: {
            id: 'comp-1',
            name: 'Implementer',
            executionType: 'implementer',
            config: {},
            tools: [],
            inputInstructions: 'Read THE_PLAN artifact',
            operationInstructions: 'Implement features from plan',
            outputInstructions: 'Report files modified and tests added',
          },
        };

        const result = buildPhaseInstructions('agent', state, 'run-123');

        expect(result.instructions.component.inputInstructions).toBe('Read THE_PLAN artifact');
        expect(result.instructions.component.operationInstructions).toBe('Implement features from plan');
        expect(result.instructions.component.outputInstructions).toBe('Report files modified and tests added');
      });

      it('should omit undefined instruction fields', () => {
        const state: WorkflowStateData = {
          id: 'state-1',
          name: 'Implementation',
          order: 2,
          componentId: 'comp-1',
          preExecutionInstructions: null,
          postExecutionInstructions: null,
          component: {
            id: 'comp-1',
            name: 'Implementer',
            executionType: 'implementer',
            config: {},
            tools: [],
            inputInstructions: null,
            operationInstructions: null,
            outputInstructions: null,
          },
        };

        const result = buildPhaseInstructions('agent', state, 'run-123');

        expect(result.instructions.component.inputInstructions).toBeUndefined();
        expect(result.instructions.component.operationInstructions).toBeUndefined();
        expect(result.instructions.component.outputInstructions).toBeUndefined();
      });
    });

    describe('post phase', () => {
      it('should build post-execution instructions', () => {
        const state: WorkflowStateData = {
          id: 'state-1',
          name: 'Implementation',
          order: 2,
          componentId: 'comp-1',
          preExecutionInstructions: null,
          postExecutionInstructions: 'Verify code builds successfully',
        };

        const result = buildPhaseInstructions('post', state, 'run-123');

        expect(result.instructions.type).toBe('post_execution');
        expect(result.instructions.content).toBe('Verify code builds successfully');
        expect(result.nextAction.tool).toBe('advance_step');
      });

      it('should provide default message when no post-execution instructions', () => {
        const state: WorkflowStateData = {
          id: 'state-1',
          name: 'Implementation',
          order: 2,
          componentId: 'comp-1',
          preExecutionInstructions: null,
          postExecutionInstructions: null,
        };

        const result = buildPhaseInstructions('post', state, 'run-123');

        expect(result.instructions.type).toBe('post_execution');
        expect(result.instructions.content).toBe('No post-execution instructions. Proceed to advance_step.');
      });

      it('should include hint for advancing to next state', () => {
        const state: WorkflowStateData = {
          id: 'state-1',
          name: 'Implementation',
          order: 2,
          componentId: null,
          preExecutionInstructions: null,
          postExecutionInstructions: 'Post instructions',
        };

        const result = buildPhaseInstructions('post', state, 'run-123');

        expect(result.nextAction.hint).toBe('Call advance_step to proceed to next state.');
      });
    });
  });

  describe('buildCommitInstruction', () => {
    it('should return undefined for non-code-modifying component', () => {
      const componentName = 'Explorer';
      const story: StoryData = { key: 'ST-123', title: 'Test Story' };

      const result = buildCommitInstruction(componentName, story, true);

      expect(result).toBeUndefined();
    });

    it('should return undefined when agent failed', () => {
      const componentName = 'Implementer';
      const story: StoryData = { key: 'ST-123', title: 'Test Story' };

      const result = buildCommitInstruction(componentName, story, false);

      expect(result).toBeUndefined();
    });

    it('should return commit instruction for Implementer when successful', () => {
      const componentName = 'Implementer';
      const story: StoryData = { key: 'ST-123', title: 'Test Story' };

      const result = buildCommitInstruction(componentName, story, true);

      expect(result).toBeDefined();
      expect(result?.tool).toBe('exec-command');
      expect(result?.parameters.command).toContain('git add -A');
      expect(result?.parameters.command).toContain('git commit');
      expect(result?.parameters.command).toContain('ST-123');
      expect(result?.parameters.command).toContain('Implementer');
      expect(result?.parameters.cwd).toBe('{{WORKTREE_PATH}}');
      expect(result?.description).toContain('Implementer');
    });

    it('should return commit instruction for Developer when successful', () => {
      const componentName = 'Developer';
      const story: StoryData = { key: 'ST-456', title: 'Feature Work' };

      const result = buildCommitInstruction(componentName, story, true);

      expect(result).toBeDefined();
      expect(result?.parameters.command).toContain('Developer');
      expect(result?.parameters.command).toContain('ST-456');
    });

    it('should return commit instruction for Tester when successful', () => {
      const componentName = 'Tester';
      const story: StoryData = { key: 'ST-789', title: 'Add Tests' };

      const result = buildCommitInstruction(componentName, story, true);

      expect(result).toBeDefined();
      expect(result?.parameters.command).toContain('Tester');
      expect(result?.parameters.command).toContain('ST-789');
    });

    it('should return commit instruction for Reviewer when successful', () => {
      const componentName = 'Reviewer';
      const story: StoryData = { key: 'ST-101', title: 'Code Review' };

      const result = buildCommitInstruction(componentName, story, true);

      expect(result).toBeDefined();
      expect(result?.parameters.command).toContain('Reviewer');
      expect(result?.parameters.command).toContain('ST-101');
    });

    it('should include Co-Authored-By in commit message', () => {
      const componentName = 'Implementer';
      const story: StoryData = { key: 'ST-123', title: 'Test Story' };

      const result = buildCommitInstruction(componentName, story, true);

      expect(result?.parameters.command).toContain('Co-Authored-By: Implementer Agent <noreply@vibestudio.ai>');
    });

    it('should use "feat" prefix in commit message', () => {
      const componentName = 'Implementer';
      const story: StoryData = { key: 'ST-123', title: 'Test Story' };

      const result = buildCommitInstruction(componentName, story, true);

      expect(result?.parameters.command).toContain('feat(ST-123)');
    });

    it('should handle story without key gracefully', () => {
      const componentName = 'Implementer';
      const story: StoryData | null = null;

      const result = buildCommitInstruction(componentName, story, true);

      expect(result).toBeDefined();
      expect(result?.parameters.command).toContain('feat(workflow)');
    });

    it('should describe the commit action', () => {
      const componentName = 'Implementer';
      const story: StoryData = { key: 'ST-123', title: 'Test Story' };

      const result = buildCommitInstruction(componentName, story, true);

      expect(result?.description).toBe('Commit Implementer changes before advancing');
    });

    it('should use WORKTREE_PATH placeholder for cwd', () => {
      const componentName = 'Developer';
      const story: StoryData = { key: 'ST-999', title: 'Test' };

      const result = buildCommitInstruction(componentName, story, true);

      expect(result?.parameters.cwd).toBe('{{WORKTREE_PATH}}');
    });
  });

  describe('buildEnforcementData', () => {
    it('should build workflow complete enforcement data', () => {
      const result = buildEnforcementData(true, null, null);

      expect(result.workflowActive).toBe(false);
      expect(result.workflowComplete).toBe(true);
      expect(result.runId).toBeUndefined();
      expect(result.currentState).toBeUndefined();
    });

    it('should build active workflow enforcement data with state', () => {
      const state: WorkflowStateData = {
        id: 'state-1',
        name: 'Implementation',
        order: 2,
        componentId: 'comp-1',
        preExecutionInstructions: null,
        postExecutionInstructions: null,
        component: {
          id: 'comp-1',
          name: 'Implementer',
          executionType: 'implementer',
          config: {},
          tools: [],
        },
      };
      const allowedTypes = ['code'];

      const result = buildEnforcementData(false, state, allowedTypes, 'run-123', 'agent');

      expect(result.workflowActive).toBe(true);
      expect(result.workflowComplete).toBeUndefined();
      expect(result.runId).toBe('run-123');
      expect(result.currentState).toBeDefined();
      expect(result.currentState?.id).toBe('state-1');
      expect(result.currentState?.name).toBe('Implementation');
      expect(result.currentState?.phase).toBe('agent');
      expect(result.currentState?.componentName).toBe('Implementer');
      expect(result.currentState?.allowedSubagentTypes).toEqual(['code']);
    });

    it('should handle state without component', () => {
      const state: WorkflowStateData = {
        id: 'state-1',
        name: 'Manual Review',
        order: 1,
        componentId: null,
        preExecutionInstructions: null,
        postExecutionInstructions: null,
      };

      const result = buildEnforcementData(false, state, null, 'run-456', 'pre');

      expect(result.workflowActive).toBe(true);
      expect(result.currentState?.componentName).toBeNull();
      expect(result.currentState?.allowedSubagentTypes).toBeNull();
    });

    it('should handle null allowedSubagentTypes', () => {
      const state: WorkflowStateData = {
        id: 'state-1',
        name: 'Implementation',
        order: 2,
        componentId: 'comp-1',
        preExecutionInstructions: null,
        postExecutionInstructions: null,
        component: {
          id: 'comp-1',
          name: 'Implementer',
          executionType: 'implementer',
          config: {},
          tools: [],
        },
      };

      const result = buildEnforcementData(false, state, null, 'run-789', 'post');

      expect(result.currentState?.allowedSubagentTypes).toBeNull();
    });

    it('should handle empty allowedSubagentTypes array', () => {
      const state: WorkflowStateData = {
        id: 'state-1',
        name: 'Custom',
        order: 1,
        componentId: 'comp-1',
        preExecutionInstructions: null,
        postExecutionInstructions: null,
        component: {
          id: 'comp-1',
          name: 'Custom',
          executionType: 'custom',
          config: {},
          tools: [],
        },
      };

      const result = buildEnforcementData(false, state, [], 'run-111', 'agent');

      expect(result.currentState?.allowedSubagentTypes).toEqual([]);
    });

    it('should include phase in enforcement data', () => {
      const state: WorkflowStateData = {
        id: 'state-1',
        name: 'Testing',
        order: 3,
        componentId: 'comp-1',
        preExecutionInstructions: null,
        postExecutionInstructions: null,
        component: {
          id: 'comp-1',
          name: 'Tester',
          executionType: 'custom',
          config: {},
          tools: [],
        },
      };

      const preResult = buildEnforcementData(false, state, null, 'run-222', 'pre');
      const agentResult = buildEnforcementData(false, state, null, 'run-222', 'agent');
      const postResult = buildEnforcementData(false, state, null, 'run-222', 'post');

      expect(preResult.currentState?.phase).toBe('pre');
      expect(agentResult.currentState?.phase).toBe('agent');
      expect(postResult.currentState?.phase).toBe('post');
    });

    it('should handle null state for workflow complete', () => {
      const result = buildEnforcementData(true, null, null);

      expect(result.workflowActive).toBe(false);
      expect(result.workflowComplete).toBe(true);
      expect(result.currentState).toBeUndefined();
    });

    it('should require runId and phase for active workflow', () => {
      const state: WorkflowStateData = {
        id: 'state-1',
        name: 'Implementation',
        order: 2,
        componentId: 'comp-1',
        preExecutionInstructions: null,
        postExecutionInstructions: null,
        component: {
          id: 'comp-1',
          name: 'Implementer',
          executionType: 'implementer',
          config: {},
          tools: [],
        },
      };

      // Should not throw, but should build valid enforcement data
      const result = buildEnforcementData(false, state, ['code'], 'run-333', 'agent');

      expect(result.runId).toBe('run-333');
      expect(result.currentState?.phase).toBe('agent');
    });

    it('should handle multiple allowed subagent types', () => {
      const state: WorkflowStateData = {
        id: 'state-1',
        name: 'Multi-Mode',
        order: 1,
        componentId: 'comp-1',
        preExecutionInstructions: null,
        postExecutionInstructions: null,
        component: {
          id: 'comp-1',
          name: 'MultiMode',
          executionType: 'custom',
          config: {},
          tools: [],
        },
      };

      const result = buildEnforcementData(false, state, ['code', 'ask', 'web'], 'run-444', 'agent');

      expect(result.currentState?.allowedSubagentTypes).toEqual(['code', 'ask', 'web']);
    });
  });

  describe('Error Handling', () => {
    it('buildPhaseInstructions should handle null state gracefully', () => {
      expect(() => {
        buildPhaseInstructions('pre', null as any, 'run-123');
      }).toThrow();
    });

    it('buildPhaseInstructions should handle invalid phase', () => {
      const state: WorkflowStateData = {
        id: 'state-1',
        name: 'Test',
        order: 1,
        componentId: null,
        preExecutionInstructions: null,
        postExecutionInstructions: null,
      };

      expect(() => {
        buildPhaseInstructions('invalid' as any, state, 'run-123');
      }).toThrow();
    });

    it('buildCommitInstruction should handle null component name gracefully', () => {
      const story: StoryData = { key: 'ST-123', title: 'Test' };

      const result = buildCommitInstruction(null as any, story, true);

      expect(result).toBeUndefined();
    });
  });

  describe('Integration: Using helpers together', () => {
    it('should build complete advance response components', () => {
      const state: WorkflowStateData = {
        id: 'state-1',
        name: 'Implementation',
        order: 2,
        componentId: 'comp-1',
        preExecutionInstructions: null,
        postExecutionInstructions: null,
        component: {
          id: 'comp-1',
          name: 'Implementer',
          executionType: 'implementer',
          config: { modelId: 'claude-opus-4-5-20251101' },
          tools: ['bash', 'edit'],
        },
      };
      const story: StoryData = { key: 'ST-123', title: 'Feature Work' };

      const phaseInstructions = buildPhaseInstructions('agent', state, 'run-123');
      const commitInstruction = buildCommitInstruction('Implementer', story, true);
      const enforcement = buildEnforcementData(
        false,
        state,
        phaseInstructions.instructions.enforcement?.allowedSubagentTypes || null,
        'run-123',
        'agent'
      );

      expect(phaseInstructions.instructions.type).toBe('agent_spawn');
      expect(commitInstruction).toBeDefined();
      expect(enforcement.workflowActive).toBe(true);
      expect(enforcement.currentState?.componentName).toBe('Implementer');
    });
  });
});
