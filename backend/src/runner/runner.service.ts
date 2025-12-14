import { Injectable, Logger, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { Prisma, RunStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RemoteExecutionService } from '../remote-agent/remote-execution.service';

/**
 * Checkpoint data structure
 */
export interface RunnerCheckpoint {
  version: number;
  runId: string;
  workflowId: string;
  storyId?: string;
  currentStateId: string;
  currentPhase: 'pre' | 'agent' | 'post';
  completedStates: string[];
  skippedStates: string[];
  masterSessionId: string;
  resourceUsage: {
    tokensUsed: number;
    agentSpawns: number;
    stateTransitions: number;
    durationMs: number;
  };
  lastError?: {
    message: string;
    stateId: string;
    phase: string;
    timestamp: string;
  };
  checkpointedAt: string;
  runStartedAt: string;
}

/**
 * Runner status data
 */
export interface RunnerStatus {
  state: string;
  currentStateId?: string;
  resourceUsage: {
    tokensUsed: number;
    agentSpawns: number;
    stateTransitions: number;
    durationMs: number;
  };
  warnings?: string[];
}

/**
 * Runner Service
 * Provides database operations for Story Runner
 */
@Injectable()
export class RunnerService {
  private readonly logger = new Logger(RunnerService.name);

  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => RemoteExecutionService))
    private remoteExecution: RemoteExecutionService,
  ) {}

  /**
   * Save checkpoint to database
   * Uses WorkflowRun.metadata to store checkpoint data
   */
  async saveCheckpoint(checkpoint: RunnerCheckpoint): Promise<void> {
    this.logger.log(`Saving checkpoint for run ${checkpoint.runId}`);

    await this.prisma.workflowRun.update({
      where: { id: checkpoint.runId },
      data: {
        currentStateId: checkpoint.currentStateId,
        metadata: {
          checkpoint: checkpoint,
          lastCheckpointAt: new Date().toISOString(),
        } as unknown as Prisma.InputJsonValue,
      },
    });
  }

  /**
   * Load checkpoint from database
   */
  async loadCheckpoint(runId: string): Promise<RunnerCheckpoint | null> {
    this.logger.log(`Loading checkpoint for run ${runId}`);

    const run = await this.prisma.workflowRun.findUnique({
      where: { id: runId },
    });

    if (!run) {
      throw new NotFoundException(`WorkflowRun not found: ${runId}`);
    }

    const metadata = run.metadata as Record<string, unknown> | null;
    return (metadata?.checkpoint as RunnerCheckpoint) || null;
  }

  /**
   * Delete checkpoint
   */
  async deleteCheckpoint(runId: string): Promise<void> {
    this.logger.log(`Deleting checkpoint for run ${runId}`);

    const run = await this.prisma.workflowRun.findUnique({
      where: { id: runId },
    });

    if (!run) {
      throw new NotFoundException(`WorkflowRun not found: ${runId}`);
    }

    const metadata = (run.metadata as Record<string, unknown>) || {};
    delete metadata.checkpoint;

    await this.prisma.workflowRun.update({
      where: { id: runId },
      data: { metadata: metadata as Prisma.InputJsonValue },
    });
  }

  /**
   * Update runner status
   */
  async updateStatus(runId: string, status: RunnerStatus): Promise<void> {
    this.logger.log(`Updating status for run ${runId}: ${status.state}`);

    await this.prisma.workflowRun.update({
      where: { id: runId },
      data: {
        status: this.mapStateToStatus(status.state),
        currentStateId: status.currentStateId,
        metadata: {
          lastStatus: status,
          lastStatusAt: new Date().toISOString(),
        } as unknown as Prisma.InputJsonValue,
      },
    });
  }

  /**
   * Get team context for orchestration
   */
  async getTeamContext(runId: string): Promise<{
    runId: string;
    workflow: unknown;
    story: unknown | null;
    previousOutputs: Record<string, unknown>;
  }> {
    this.logger.log(`Getting team context for run ${runId}`);

    const run = await this.prisma.workflowRun.findUnique({
      where: { id: runId },
      include: {
        workflow: {
          include: {
            states: {
              orderBy: { order: 'asc' },
              include: {
                component: true,
              },
            },
          },
        },
        story: true,
        componentRuns: {
          include: {
            component: true,
          },
        },
      },
    });

    if (!run) {
      throw new NotFoundException(`WorkflowRun not found: ${runId}`);
    }

    // Build previous outputs from completed component runs
    const previousOutputs: Record<string, unknown> = {};
    for (const componentRun of run.componentRuns) {
      if (componentRun.status === 'completed' && componentRun.output) {
        const componentName = componentRun.component?.name || componentRun.componentId;
        previousOutputs[componentName] = componentRun.output;
      }
    }

    return {
      runId: run.id,
      workflow: run.workflow,
      story: run.story,
      previousOutputs,
    };
  }

  /**
   * Get workflow with states
   */
  async getWorkflow(workflowId: string): Promise<unknown> {
    const workflow = await this.prisma.workflow.findUnique({
      where: { id: workflowId },
      include: {
        states: {
          orderBy: { order: 'asc' },
          include: {
            component: true,
          },
        },
      },
    });

    if (!workflow) {
      throw new NotFoundException(`Workflow not found: ${workflowId}`);
    }

    return workflow;
  }

  /**
   * Get workflow run
   */
  async getWorkflowRun(runId: string): Promise<unknown> {
    const run = await this.prisma.workflowRun.findUnique({
      where: { id: runId },
      include: {
        workflow: true,
        story: true,
      },
    });

    if (!run) {
      throw new NotFoundException(`WorkflowRun not found: ${runId}`);
    }

    return run;
  }

  /**
   * Map runner state to DB status
   */
  private mapStateToStatus(state: string): RunStatus {
    const mapping: Record<string, RunStatus> = {
      created: 'pending',
      initializing: 'running',
      ready: 'running',
      executing: 'running',
      paused: 'paused',
      completed: 'completed',
      failed: 'failed',
      cancelled: 'cancelled',
    };

    return mapping[state] || 'pending';
  }

  /**
   * List active runner runs
   */
  async listActiveRuns(): Promise<unknown[]> {
    const runs = await this.prisma.workflowRun.findMany({
      where: {
        status: {
          in: ['running', 'paused'],
        },
      },
      include: {
        workflow: true,
        story: true,
      },
      orderBy: { startedAt: 'desc' },
    });

    return runs;
  }

  /**
   * Register transcript for Docker Runner
   * ST-189: Updates masterTranscriptPaths or spawnedAgentTranscripts
   *
   * This mirrors what TranscriptRegistrationService.registerForLiveStreaming() does,
   * but callable via HTTP from Docker Runner.
   */
  async registerTranscript(
    runId: string,
    dto: {
      type: 'master' | 'agent';
      transcriptPath: string;
      sessionId?: string;
      componentId?: string;
      agentId?: string;
    },
  ): Promise<{ success: boolean; type: string; transcriptPath: string; error?: string }> {
    this.logger.log(`[ST-189] Registering ${dto.type} transcript for run ${runId}`);

    try {
      // Validate runId
      const run = await this.prisma.workflowRun.findUnique({
        where: { id: runId },
        select: { id: true, masterTranscriptPaths: true, metadata: true },
      });

      if (!run) {
        return { success: false, type: dto.type, transcriptPath: dto.transcriptPath, error: `WorkflowRun not found: ${runId}` };
      }

      // Security: Basic path validation (no traversal)
      if (dto.transcriptPath.includes('..')) {
        return { success: false, type: dto.type, transcriptPath: dto.transcriptPath, error: 'Invalid path: traversal not allowed' };
      }

      if (dto.type === 'master') {
        // Append to masterTranscriptPaths (same as get_orchestration_context does)
        const existingPaths = run.masterTranscriptPaths || [];
        if (!existingPaths.includes(dto.transcriptPath)) {
          const metadata = (run.metadata as Record<string, unknown>) || {};
          await this.prisma.workflowRun.update({
            where: { id: runId },
            data: {
              masterTranscriptPaths: [...existingPaths, dto.transcriptPath],
              metadata: {
                ...metadata,
                _transcriptTracking: {
                  ...(metadata._transcriptTracking as Record<string, unknown> || {}),
                  sessionId: dto.sessionId || (metadata._transcriptTracking as Record<string, unknown>)?.sessionId,
                },
              } as Prisma.InputJsonValue,
            },
          });
          this.logger.log(`[ST-189] Master transcript registered: ${dto.transcriptPath}`);
        } else {
          this.logger.log(`[ST-189] Master transcript already registered: ${dto.transcriptPath}`);
        }
        return { success: true, type: 'master', transcriptPath: dto.transcriptPath };
      }

      if (dto.type === 'agent') {
        // Append to spawnedAgentTranscripts (same as registerForLiveStreaming does)
        const metadata = (run.metadata as Record<string, unknown>) || {};
        const spawnedAgentTranscripts = (metadata.spawnedAgentTranscripts as unknown[]) || [];

        spawnedAgentTranscripts.push({
          componentId: dto.componentId,
          agentId: dto.agentId,
          transcriptPath: dto.transcriptPath,
          spawnedAt: new Date().toISOString(),
        });

        await this.prisma.workflowRun.update({
          where: { id: runId },
          data: {
            metadata: {
              ...metadata,
              spawnedAgentTranscripts,
            } as Prisma.InputJsonValue,
          },
        });

        this.logger.log(`[ST-189] Agent transcript registered: ${dto.transcriptPath} (component: ${dto.componentId})`);
        return { success: true, type: 'agent', transcriptPath: dto.transcriptPath };
      }

      return { success: false, type: dto.type, transcriptPath: dto.transcriptPath, error: `Invalid transcript type: ${dto.type}` };
    } catch (error) {
      this.logger.error(`[ST-189] Failed to register transcript: ${error.message}`, error.stack);
      return { success: false, type: dto.type, transcriptPath: dto.transcriptPath, error: error.message };
    }
  }

  /**
   * Launch Laptop Orchestrator for a workflow run (ST-195 Option B)
   * Sends a Claude Code job to the laptop agent to orchestrate the workflow
   * using the get_current_step → advance_step pattern.
   *
   * This replaces Docker Runner with laptop-based execution.
   * No ANTHROPIC_API_KEY needed on KVM - laptop has Claude Code configured.
   *
   * @param runId - WorkflowRun ID
   * @param workflowId - Workflow ID
   * @param storyId - Optional Story ID for context
   * @param triggeredBy - User/agent that triggered the run
   * @returns Launch result
   */
  async launchDockerRunner(params: {
    runId: string;
    workflowId: string;
    storyId?: string;
    triggeredBy?: string;
  }): Promise<{
    success: boolean;
    runId: string;
    workflowId: string;
    storyId?: string;
    message: string;
    jobId?: string;
    agentId?: string;
  }> {
    const { runId, workflowId, storyId, triggeredBy = 'web-ui' } = params;

    this.logger.log(`[ST-195] Launching Laptop Orchestrator for run ${runId}`);

    // Get story details for context
    let storyContext: Record<string, unknown> | undefined;
    if (storyId) {
      const story = await this.prisma.story.findUnique({
        where: { id: storyId },
        select: { id: true, key: true, title: true, description: true },
      });
      if (story) {
        storyContext = {
          storyId: story.id,
          storyKey: story.key,
          title: story.title,
          description: story.description,
        };
      }
    }

    // Build orchestrator instructions
    const instructions = this.buildOrchestratorInstructions(runId, workflowId, storyId);

    try {
      // ST-195 FIX: Update status to 'running' BEFORE dispatching to agent
      // This prevents race condition where agent calls get_current_step before status is updated
      // Also clear finishedAt and any cancellation metadata from previous run
      await this.prisma.workflowRun.update({
        where: { id: runId },
        data: {
          status: 'running',
          startedAt: new Date(),
          finishedAt: null, // Clear finishedAt from previous cancelled/failed run
        },
      });

      this.logger.log(`[ST-195] Status updated to 'running' for run ${runId}`);

      // ST-195: Launch orchestrator via laptop agent
      // Note: No ComponentRun needed for orchestrator - it tracks its own metrics via MCP tools
      const result = await this.remoteExecution.executeClaudeAgent(
        {
          componentId: `orchestrator-${runId}`, // Virtual component ID for orchestrator
          stateId: 'orchestrator',
          workflowRunId: runId,
          instructions,
          storyContext,
          allowedTools: [
            // MCP tools the orchestrator needs
            'mcp__vibestudio__get_current_step',
            'mcp__vibestudio__advance_step',
            'mcp__vibestudio__record_agent_start',
            'mcp__vibestudio__record_agent_complete',
            'mcp__vibestudio__get_runner_status',
            'mcp__vibestudio__get_component_context',
            'mcp__vibestudio__upload_artifact',
            // Task tool for spawning component agents
            'Task',
            // File tools for reading/writing
            'Read',
            'Glob',
            'Grep',
            'Edit',
            'Write',
            'Bash',
          ],
          model: 'claude-sonnet-4-20250514',
          maxTurns: 200, // High limit for multi-state workflows
          projectPath: process.env.PROJECT_HOST_PATH || '/Users/pawelgawliczek/projects/AIStudio',
        },
        undefined, // No componentRunId for orchestrator - it's tracked via WorkflowRun
        triggeredBy,
      );

      // Check if agent is offline
      if ('agentOffline' in result && result.agentOffline) {
        this.logger.warn(`[ST-195] No laptop agent available for orchestration`);

        // Update run status to failed
        await this.prisma.workflowRun.update({
          where: { id: runId },
          data: {
            status: 'failed',
            finishedAt: new Date(),
            metadata: {
              error: 'No laptop agent available',
              offlineFallback: result.offlineFallback,
            } as any,
          },
        });

        return {
          success: false,
          runId,
          workflowId,
          storyId,
          message: `No laptop agent available. Please ensure your laptop agent is running.`,
        };
      }

      // At this point, result is the success type (ClaudeCodeExecutionResult)
      const successResult = result as { jobId: string; agentId: string };

      // Status was already updated to 'running' BEFORE dispatch (see above)
      // No need to update again here

      this.logger.log(`[ST-195] Laptop Orchestrator launched successfully for run ${runId}`);

      return {
        success: true,
        runId,
        workflowId,
        storyId,
        message: `Workflow orchestration started on laptop. Use get_runner_status to monitor progress.`,
        jobId: successResult.jobId,
        agentId: successResult.agentId,
      };
    } catch (error) {
      this.logger.error(`[ST-195] Failed to launch Laptop Orchestrator: ${error.message}`, error.stack);

      // Update run status to failed
      await this.prisma.workflowRun.update({
        where: { id: runId },
        data: {
          status: 'failed',
          finishedAt: new Date(),
        },
      });

      return {
        success: false,
        runId,
        workflowId,
        storyId,
        message: `Failed to launch Laptop Orchestrator: ${error.message}`,
      };
    }
  }

  /**
   * Build orchestrator instructions for Claude Code on laptop
   * These instructions tell Claude to use the get_current_step pattern
   */
  private buildOrchestratorInstructions(runId: string, workflowId: string, storyId?: string): string {
    return `You are the **Story Runner Orchestrator** for workflow run \`${runId}\`.

## Your Mission
Execute the workflow from start to completion by repeatedly calling \`get_current_step\` and following its instructions.

## Workflow Loop
Repeat until workflow is complete:

1. **Get Current Step**
   \`\`\`
   get_current_step({ runId: "${runId}" })
   \`\`\`
   This returns:
   - \`currentState\`: Name and phase (pre/agent/post)
   - \`workflowSequence\`: Array of exact MCP tool calls to execute
   - \`progress\`: How many states completed

2. **Execute the Sequence**
   Follow each step in \`workflowSequence\` exactly:
   - For MCP tool calls: Use the specified tool with exact parameters
   - For "Task" tool calls: Spawn the component agent as instructed
   - For agent phases: Spawn agent, then call advance_step with output (tracking is automatic)

3. **Agent Phases (ST-215: Simplified 2-Step)**
   For agent phases, just follow the 2-step workflow:
   1. Spawn agent via Task tool
   2. Call \`advance_step({ runId: "${runId}", output: <agent_output> })\`
   Agent tracking (record_agent_start/complete) is handled AUTOMATICALLY by advance_step.

4. **Check for Completion**
   When \`get_current_step\` returns \`workflow_complete: true\`, the workflow is done.

## Status Monitoring
Before each phase, check if the run was paused or cancelled:
\`\`\`
get_runner_status({ runId: "${runId}" })
\`\`\`
- If status is "paused": Wait and check again in 30 seconds
- If status is "cancelled" or "failed": Stop execution immediately

## Important Rules
1. **Follow workflowSequence exactly** - Don't skip or modify steps
2. **One phase at a time** - Complete pre → agent → post before advancing
3. **Pass agent output to advance_step** - This enables automatic tracking and context preservation
4. **Handle errors gracefully** - If an agent fails, pass agentStatus: 'failed' to advance_step

## Context
- Workflow ID: ${workflowId}
${storyId ? `- Story ID: ${storyId}` : ''}
- You have access to all VibeStudio MCP tools for workflow orchestration

Begin by calling \`get_current_step({ runId: "${runId}" })\` to see the first state to execute.`;
  }
}
