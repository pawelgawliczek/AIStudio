import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, RunStatus } from '@prisma/client';

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
            coordinator: true,
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
        coordinator: true,
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
}
