/**
 * advance_step Helper Functions
 * ST-284: Architecture & Complexity Cleanup - Phase 1
 *
 * Helper functions extracted from buildAdvanceResponse to reduce complexity.
 */

export interface WorkflowStateData {
  id: string;
  name: string;
  order: number;
  componentId: string | null;
  preExecutionInstructions: string | null;
  postExecutionInstructions: string | null;
  component?: ComponentData | null;
}

export interface ComponentData {
  id: string;
  name: string;
  executionType: string;
  config?: Record<string, unknown> | unknown;  // Accepts Prisma JsonValue
  tools?: string[];
  inputInstructions?: string | null;
  operationInstructions?: string | null;
  outputInstructions?: string | null;
}

export interface StoryData {
  key: string;
  title: string;
}

interface RunnerCheckpoint {
  currentPhase?: 'pre' | 'agent' | 'post';
  completedStates?: string[];
  skippedStates?: string[];
}

/**
 * Build phase-specific instructions and next actions
 *
 * @param phase Current workflow phase
 * @param state Current workflow state
 * @param runId Workflow run ID
 * @returns Instructions and next action object
 */
export function buildPhaseInstructions(
  phase: 'pre' | 'agent' | 'post',
  state: WorkflowStateData,
  runId: string
): {
  instructions: Record<string, unknown>;
  nextAction: Record<string, unknown>;
} {
  if (!state) {
    throw new Error('State is required for buildPhaseInstructions');
  }

  if (phase === 'pre') {
    return {
      instructions: {
        type: 'pre_execution',
        content: state.preExecutionInstructions || 'No pre-execution instructions. Proceed to advance_step.',
      },
      nextAction: {
        tool: 'advance_step',
        parameters: { runId },
        hint: 'Call advance_step when pre-execution is complete.',
      },
    };
  }

  if (phase === 'agent') {
    // Check if state has a component
    if (!state.component || !state.componentId) {
      return {
        instructions: {
          type: 'post_execution',
          content: 'No agent assigned. Proceeding to post-execution.',
        },
        nextAction: {
          tool: 'advance_step',
          parameters: { runId },
          hint: 'Call advance_step to proceed to next state.',
        },
      };
    }

    const component = state.component;
    const config = component.config as Record<string, unknown> | undefined;
    const modelId = (config?.modelId as string) || 'claude-sonnet-4-20250514';

    // Derive allowed subagent types based on component name
    let allowedSubagentTypes: string[] = ['code'];
    if (component.name === 'Explorer') {
      allowedSubagentTypes = ['ask'];
    } else if (['Developer', 'Implementer', 'Tester', 'Reviewer'].includes(component.name)) {
      allowedSubagentTypes = ['code'];
    }

    return {
      instructions: {
        type: 'agent_spawn',
        content: `Spawn ${component.name} agent with model ${modelId}`,
        component: {
          id: component.id,
          name: component.name,
          model: modelId,
          tools: component.tools || [],
          inputInstructions: component.inputInstructions || undefined,
          operationInstructions: component.operationInstructions || undefined,
          outputInstructions: component.outputInstructions || undefined,
        },
        enforcement: {
          allowedSubagentTypes,
          requiredComponentName: component.name,
        },
      },
      nextAction: {
        tool: 'Task',
        parameters: { subagent_type: allowedSubagentTypes[0] },
        hint: `Spawn ${component.name} agent to execute component work.`,
      },
    };
  }

  if (phase === 'post') {
    return {
      instructions: {
        type: 'post_execution',
        content: state.postExecutionInstructions || 'No post-execution instructions. Proceed to advance_step.',
      },
      nextAction: {
        tool: 'advance_step',
        parameters: { runId },
        hint: 'Call advance_step to proceed to next state.',
      },
    };
  }

  throw new Error(`Invalid phase: ${phase}`);
}

/**
 * Build commit instruction for code-modifying components
 *
 * @param componentName Name of the component
 * @param story Story data (key, title)
 * @param agentWasSuccessful Whether the agent completed successfully
 * @returns Commit instruction object or undefined
 */
export function buildCommitInstruction(
  componentName: string | null,
  story: StoryData | null,
  agentWasSuccessful: boolean
): {
  tool: string;
  parameters: Record<string, string>;
  description: string;
} | undefined {
  if (!componentName) {
    return undefined;
  }

  if (!agentWasSuccessful) {
    return undefined;
  }

  // Only commit for code-modifying components
  const codeModifyingComponents = ['Implementer', 'Developer', 'Tester', 'Reviewer'];
  if (!codeModifyingComponents.includes(componentName)) {
    return undefined;
  }

  const storyKey = story?.key || 'workflow';

  return {
    tool: 'exec-command',
    parameters: {
      command: `git add -A && git commit -m "feat(${storyKey}): ${componentName} changes

Co-Authored-By: ${componentName} Agent <noreply@vibestudio.ai>"`,
      cwd: '{{WORKTREE_PATH}}',
    },
    description: `Commit ${componentName} changes before advancing`,
  };
}

/**
 * Build enforcement data for workflow hooks
 *
 * @param workflowComplete Whether the workflow is complete
 * @param currentState Current workflow state
 * @param allowedSubagentTypes Allowed subagent types for enforcement
 * @param runId Workflow run ID
 * @param currentPhase Current phase
 * @returns Enforcement data object
 */
export function buildEnforcementData(
  workflowComplete: boolean,
  currentState: WorkflowStateData | null,
  allowedSubagentTypes: string[] | null,
  runId?: string,
  currentPhase?: 'pre' | 'agent' | 'post'
): Record<string, unknown> {
  if (workflowComplete) {
    return {
      workflowActive: false,
      workflowComplete: true,
    };
  }

  if (!currentState) {
    return {
      workflowActive: false,
      workflowComplete: true,
    };
  }

  return {
    workflowActive: true,
    runId,
    currentState: {
      id: currentState.id,
      name: currentState.name,
      phase: currentPhase,
      componentName: currentState.component?.name || null,
      allowedSubagentTypes: allowedSubagentTypes || null,
    },
  };
}
