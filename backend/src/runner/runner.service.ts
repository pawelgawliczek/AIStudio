import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, RunStatus } from '@prisma/client';
import { spawn } from 'child_process';
import { PrismaService } from '../prisma/prisma.service';

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

  constructor(private prisma: PrismaService) {}

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
   * Launch Docker Runner for a workflow run (ST-195)
   * Spawns the Story Runner Docker container to execute the workflow
   *
   * @param runId - WorkflowRun ID
   * @param workflowId - Workflow ID
   * @param storyId - Optional Story ID for context
   * @param triggeredBy - User/agent that triggered the run
   * @returns Launch result with command details
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
    command?: string;
  }> {
    const { runId, workflowId, storyId, triggeredBy = 'web-ui' } = params;

    this.logger.log(`[ST-195] Launching Docker Runner for run ${runId}`);

    // Build Docker command (same as start_runner.ts MCP tool)
    const args = [
      'compose',
      '-f', 'runner/docker-compose.runner.yml',
      'run',
      '--rm',
      '-d', // Run in detached mode (background)
      'runner',
      'start',
      '--run-id', runId,
      '--workflow-id', workflowId,
    ];

    if (storyId) {
      args.push('--story-id', storyId);
    }

    args.push('--triggered-by', triggeredBy);

    const projectPath = process.env.PROJECT_PATH || '/opt/stack/AIStudio';
    const command = `docker ${args.join(' ')}`;

    this.logger.log(`[ST-195] Spawning Docker Runner: ${command}`);
    this.logger.log(`[ST-195] Working directory: ${projectPath}`);

    try {
      // Spawn Docker process in detached mode
      const dockerProcess = spawn('docker', args, {
        cwd: projectPath,
        stdio: 'pipe',
        detached: true,
      });

      // Don't wait for the process, let it run in background
      dockerProcess.unref();

      // Capture any immediate errors
      dockerProcess.on('error', (error) => {
        this.logger.error(`[ST-195] Docker spawn error: ${error.message}`, error.stack);
      });

      // Update run status to running
      await this.prisma.workflowRun.update({
        where: { id: runId },
        data: {
          status: 'running',
          startedAt: new Date(),
        },
      });

      this.logger.log(`[ST-195] Docker Runner launched successfully for run ${runId}`);

      return {
        success: true,
        runId,
        workflowId,
        storyId,
        message: `Docker Runner started. Use get_runner_status to monitor progress.`,
        command,
      };
    } catch (error) {
      this.logger.error(`[ST-195] Failed to launch Docker Runner: ${error.message}`, error.stack);

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
        message: `Failed to launch Docker Runner: ${error.message}`,
      };
    }
  }
}
