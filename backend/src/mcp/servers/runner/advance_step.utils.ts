/**
 * advance_step Utility Functions
 * ST-284: Architecture & Complexity Cleanup - Phase 1
 *
 * Additional utility functions extracted from advance_step handler to reduce file size.
 */

import { PrismaClient } from '@prisma/client';
import { ComponentSummaryStructured } from '../../../types/component-summary.types';
import { deriveSubagentType, buildTaskPrompt } from '../../shared/task-prompt-builder';
import {
  completeAgentTracking,
  generateStructuredSummary,
} from '../../shared/agent-tracking';
import { RemoteRunner } from '../../utils/remote-runner';

export interface ComponentData {
  id: string;
  name: string;
  executionType: string;
  config?: Record<string, unknown>;
  tools?: string[];
  inputInstructions?: string | null;
  operationInstructions?: string | null;
  outputInstructions?: string | null;
}

export interface WorkflowStateData {
  id: string;
  name: string;
  order: number;
  componentId: string | null;
  preExecutionInstructions: string | null;
  postExecutionInstructions: string | null;
  component?: ComponentData | null;
}

export interface RunnerCheckpoint {
  version: number;
  runId: string;
  workflowId: string;
  currentStateId: string;
  currentPhase: 'pre' | 'agent' | 'post';
  phaseStatus: 'pending' | 'in_progress' | 'completed';
  completedStates: string[];
  skippedStates: string[];
  phaseOutputs: Record<string, unknown>;
  resourceUsage: {
    tokensUsed: number;
    agentSpawns: number;
    stateTransitions: number;
    durationMs: number;
  };
  checkpointedAt: string;
  runStartedAt: string;
}

/**
 * Save checkpoint to workflow run metadata
 *
 * @param prisma Prisma client
 * @param runId Workflow run ID
 * @param checkpoint Checkpoint data to save
 * @param existingMetadata Existing metadata to merge with
 * @param workflowComplete Whether workflow is complete (updates status)
 */
export async function saveCheckpoint(
  prisma: PrismaClient,
  runId: string,
  checkpoint: Partial<RunnerCheckpoint>,
  existingMetadata: Record<string, unknown> | null,
  workflowComplete = false
): Promise<void> {
  const updateData: Record<string, unknown> = {
    metadata: {
      ...(existingMetadata || {}),
      checkpoint,
    },
  };

  if (workflowComplete) {
    updateData.status = 'completed';
    updateData.finishedAt = new Date();
  }

  await prisma.workflowRun.update({
    where: { id: runId },
    data: updateData,
  });
}

/**
 * Build agent spawn instructions for a workflow state with component
 *
 * @param prisma Prisma client
 * @param currentState Current workflow state
 * @param runId Workflow run ID
 * @param storyId Story ID (optional, enables buildTaskPrompt)
 * @returns Instructions object with agent spawn details
 */
export async function buildAgentInstructions(
  prisma: PrismaClient,
  currentState: WorkflowStateData,
  runId: string,
  storyId?: string
): Promise<Record<string, unknown>> {
  if (!currentState.component) {
    return {
      type: 'post_execution',
      content: 'No agent assigned. Proceeding to post-execution.',
    };
  }

  const config = (currentState.component.config as Record<string, unknown>) || {};
  const componentModel = (config.modelId as string) || 'claude-sonnet-4-20250514';
  const componentTools = (currentState.component.tools as string[]) || [];
  const componentName = currentState.component.name;
  const executionType = currentState.component.executionType || 'custom';

  // ST-289: Derive subagent type using centralized function
  const subagentType = deriveSubagentType(executionType, componentName);

  // ST-273: Derive allowed subagent types for enforcement
  const allowedSubagentTypes = [subagentType];

  // ST-304: Build ready-to-use agent prompt if storyId is available
  if (storyId && currentState.id && currentState.component) {
    const stateForPrompt = {
      id: currentState.id,
      preExecutionInstructions: currentState.preExecutionInstructions,
      component: {
        id: currentState.component.id,
        name: currentState.component.name,
        inputInstructions: currentState.component.inputInstructions ?? null,
        operationInstructions: currentState.component.operationInstructions ?? null,
        outputInstructions: currentState.component.outputInstructions ?? null,
      },
    };

    const agentPrompt = await buildTaskPrompt(
      prisma,
      stateForPrompt,
      runId,
      storyId
    );

    // When spawnAgent is successfully built, only return that (not redundant raw component fields)
    return {
      type: 'agent_spawn',
      content: `Spawn the ${componentName} agent.`,
      spawnAgent: {
        instruction: "Use the Task tool to spawn this agent. Pass the prompt EXACTLY as provided - do not modify it.",
        task: {
          subagent_type: subagentType,
          model: componentModel,
          prompt: agentPrompt,
        },
        componentName,
        componentId: currentState.component.id,
      },
      // ST-273: Enforcement data for hooks
      enforcement: {
        allowedSubagentTypes,
        requiredComponentName: componentName,
      },
    };
  }

  // Fallback: Keep old structure with raw component fields if we can't build spawnAgent
  return {
    type: 'agent_spawn',
    content: `Spawn the ${currentState.component.name} agent with model: ${componentModel}`,
    component: {
      id: currentState.component.id,
      name: currentState.component.name,
      model: componentModel,
      tools: componentTools,
      inputInstructions: currentState.component.inputInstructions || undefined,
      operationInstructions: currentState.component.operationInstructions || undefined,
      outputInstructions: currentState.component.outputInstructions || undefined,
    },
    // ST-273: Enforcement data for hooks
    enforcement: {
      allowedSubagentTypes,
      requiredComponentName: componentName,
    },
  };
}

/**
 * Initialize checkpoint for a workflow run
 *
 * @param run Workflow run data
 * @param firstState First workflow state
 * @returns Initialized checkpoint object
 */
export function initializeCheckpoint(
  run: { id: string; workflowId: string },
  firstState: { id: string }
): {
  version: number;
  runId: string;
  workflowId: string;
  currentStateId: string;
  currentPhase: 'pre' | 'agent' | 'post';
  phaseStatus: 'pending' | 'in_progress' | 'completed';
  completedStates: string[];
  skippedStates: string[];
  phaseOutputs: Record<string, unknown>;
  resourceUsage: {
    tokensUsed: number;
    agentSpawns: number;
    stateTransitions: number;
    durationMs: number;
  };
  checkpointedAt: string;
  runStartedAt: string;
} {
  return {
    version: 1,
    runId: run.id,
    workflowId: run.workflowId,
    currentStateId: firstState.id,
    currentPhase: 'pre',
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
    checkpointedAt: new Date().toISOString(),
    runStartedAt: new Date().toISOString(),
  };
}

/**
 * Handle skipToState logic - mark intermediate states as skipped
 *
 * @param checkpoint Current checkpoint
 * @param states All workflow states
 * @param targetStateId Target state ID to skip to
 * @returns Updated checkpoint
 */
export function handleSkipToState(
  checkpoint: {
    currentStateId?: string;
    completedStates?: string[];
    skippedStates?: string[];
    resourceUsage?: {
      tokensUsed: number;
      agentSpawns: number;
      stateTransitions: number;
      durationMs: number;
    };
  },
  states: Array<{ id: string }>,
  targetStateId: string
): {
  currentStateId: string;
  currentPhase: 'pre' | 'agent' | 'post';
  phaseStatus: 'pending' | 'in_progress' | 'completed';
  skippedStates: string[];
  resourceUsage: {
    tokensUsed: number;
    agentSpawns: number;
    stateTransitions: number;
    durationMs: number;
  };
} {
  const currentIndex = states.findIndex(s => s.id === checkpoint.currentStateId);
  const targetIndex = states.findIndex(s => s.id === targetStateId);

  const skippedStates = [...(checkpoint.skippedStates || [])];

  if (targetIndex > currentIndex) {
    // Skipping forward - mark intermediate states as skipped
    for (let i = currentIndex; i < targetIndex; i++) {
      const stateId = states[i].id;
      if (!checkpoint.completedStates?.includes(stateId) && !skippedStates.includes(stateId)) {
        skippedStates.push(stateId);
      }
    }
  }

  return {
    currentStateId: targetStateId,
    currentPhase: 'pre',
    phaseStatus: 'pending',
    skippedStates,
    resourceUsage: {
      ...(checkpoint.resourceUsage || { tokensUsed: 0, agentSpawns: 0, stateTransitions: 0, durationMs: 0 }),
      stateTransitions: (checkpoint.resourceUsage?.stateTransitions || 0) + 1,
    },
  };
}

/**
 * Sync spawned agent transcripts from laptop to database
 * ST-242: This ensures transcript data is available for telemetry calculation
 *
 * @param prisma Prisma client
 * @param run Workflow run with metadata
 * @returns Promise that resolves when sync is complete (non-fatal failures)
 */
export async function syncSpawnedAgentTranscripts(
  prisma: PrismaClient,
  run: {
    id: string;
    metadata: unknown;
  }
): Promise<void> {
  const runMetadata = run.metadata as Record<string, unknown> | null;
  try {
    const transcriptTracking = runMetadata?._transcriptTracking as Record<string, unknown> | null;
    const masterSessionId = transcriptTracking?.sessionId as string || (runMetadata?.masterSessionId as string) || (runMetadata?.sessionId as string);
    const cwd = transcriptTracking?.projectPath as string || runMetadata?.cwd as string;

    if (!masterSessionId || !cwd) {
      return;
    }

    const runningWorkflowsPath = `${cwd}/.claude/running-workflows.json`;
    const remoteRunner = new RemoteRunner();

    try {
      const readResult = await remoteRunner.execute('read-file', [
        `--path=${runningWorkflowsPath}`,
      ]);

      if (readResult.success && readResult.result) {
        const resultData = readResult.result as Record<string, unknown>;
        // read-file returns { content, size, path }
        const outputStr = typeof resultData.content === 'string'
          ? resultData.content
          : (typeof resultData === 'string' ? resultData : JSON.stringify(resultData));

        // Parse the running-workflows.json content
        let workflowsData: Record<string, unknown> | null = null;
        try {
          workflowsData = JSON.parse(outputStr) as Record<string, unknown>;
        } catch {
          console.warn('[advance_step] Failed to parse running-workflows.json content');
          return;
        }

        // Extract spawned agent transcripts for this session
        if (workflowsData) {
          const sessions = workflowsData.sessions as Record<string, unknown> | undefined;
          const sessionData = sessions?.[masterSessionId] as Record<string, unknown> | undefined;
          const localTranscripts = (sessionData?.spawnedAgentTranscripts as Array<{ transcriptPath: string }>) || [];

          if (localTranscripts.length > 0) {
            // Merge with existing spawnedAgentTranscripts in DB
            const existingTranscripts = (runMetadata?.spawnedAgentTranscripts as Array<{ transcriptPath: string }>) || [];
            const existingPaths = new Set(existingTranscripts.map((t) => t.transcriptPath));

            const newTranscripts = localTranscripts.filter(
              (t) => !existingPaths.has(t.transcriptPath)
            );

            if (newTranscripts.length > 0) {
              const mergedTranscripts = [...existingTranscripts, ...newTranscripts];

              // Update workflow run metadata with synced transcripts
              await prisma.workflowRun.update({
                where: { id: run.id },
                data: {
                  metadata: {
                    ...(runMetadata || {}),
                    spawnedAgentTranscripts: mergedTranscripts,
                  },
                },
              });

              console.log(`[advance_step] Synced ${newTranscripts.length} spawned agent transcripts from laptop`);
            }
          }
        }
      }
    } catch (syncError) {
      // Non-fatal - just log and continue
      const message = syncError instanceof Error ? syncError.message : 'Unknown error';
      console.warn(`[advance_step] Failed to sync transcripts from laptop: ${message}`);
    }
  } catch (syncSetupError) {
    const message = syncSetupError instanceof Error ? syncSetupError.message : 'Unknown error';
    console.warn(`[advance_step] Transcript sync setup failed: ${message}`);
  }
}

/**
 * Complete agent tracking for a component
 * ST-215: AUTO - Call completeAgentTracking
 *
 * @param prisma Prisma client
 * @param run Workflow run
 * @param currentState Current workflow state
 * @param params Handler params with output, status, summary, errorMessage
 * @returns Agent tracking result
 */
export async function completeAgentTrackingForComponent(
  prisma: PrismaClient,
  run: { id: string },
  currentState: WorkflowStateData,
  params: {
    output?: Record<string, unknown>;
    agentStatus?: 'completed' | 'failed';
    componentSummary?: string | ComponentSummaryStructured;
    errorMessage?: string;
  }
): Promise<{
  action: 'started' | 'completed' | null;
  componentRunId?: string;
  componentName?: string;
  success: boolean;
  warning?: string;
  agentWasSuccessful: boolean;
}> {
  if (!currentState.component) {
    return {
      action: null,
      success: true,
      agentWasSuccessful: true,
    };
  }

  // ST-278: Track if agent completed successfully (not failed)
  const agentWasSuccessful = params.agentStatus !== 'failed';

  try {
    // ST-203: Generate structured summary if not provided
    let summary: string | ComponentSummaryStructured;
    if (params.componentSummary) {
      summary = params.componentSummary;
    } else {
      // Auto-generate structured summary from output
      const structured = generateStructuredSummary(
        params.output,
        currentState.component.name,
        params.agentStatus === 'failed' ? 'failed' : 'success',
      );
      summary = structured; // Pass structured object
    }

    const completeResult = await completeAgentTracking(prisma, {
      runId: run.id,
      componentId: currentState.component.id,
      output: params.output,
      status: params.agentStatus || 'completed',
      componentSummary: summary,
      errorMessage: params.errorMessage,
    });

    const result = {
      action: 'completed' as const,
      componentRunId: completeResult.componentRunId,
      componentName: completeResult.componentName || currentState.component.name,
      success: completeResult.success,
      warning: completeResult.warning || completeResult.error,
      agentWasSuccessful,
    };

    if (!completeResult.success) {
      console.warn(`[advance_step] Agent tracking complete failed: ${completeResult.error}`);
    }

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      action: 'completed',
      componentName: currentState.component.name,
      success: false,
      warning: message,
      agentWasSuccessful,
    };
  }
}
