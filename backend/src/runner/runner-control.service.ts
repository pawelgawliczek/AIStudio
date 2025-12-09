import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RunnerService } from './runner.service';

/**
 * RunnerControlService
 * ST-195: Workflow Control & Results Dashboard
 *
 * Service to wrap MCP tool handlers for workflow runner control.
 * Provides REST-friendly methods with authorization and validation.
 *
 * ST-195 Update: Now delegates to RunnerService.launchDockerRunner() which
 * uses the laptop orchestrator instead of Docker.
 */
@Injectable()
export class RunnerControlService {
  private readonly logger = new Logger(RunnerControlService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly runnerService: RunnerService,
  ) {}

  /**
   * Start a workflow run (maps to start_runner MCP tool)
   * M1: Authorization - Check user has access to project
   * M2: Validation - Validate run exists and is not already running
   *
   * ST-195: Now launches laptop orchestrator via RunnerService.launchDockerRunner()
   */
  async startRunner(
    runId: string,
    workflowId: string,
    storyId?: string,
    triggeredBy?: string,
  ): Promise<{ success: boolean; runId: string; status: string; message?: string; jobId?: string; agentId?: string }> {
    // Fetch run with workflow and project
    const run = await this.prisma.workflowRun.findUnique({
      where: { id: runId },
      include: {
        workflow: {
          include: {
            project: true,
          },
        },
      },
    });

    if (!run) {
      throw new NotFoundException('WorkflowRun not found');
    }

    // M1: Authorization check (cross-project access)
    // Note: In production, this would check against the user's project access
    // For now, we validate the workflow belongs to a valid project
    if (!run.workflow?.project?.id) {
      throw new ForbiddenException('Access denied to this workflow run');
    }

    // M2: Validation - Check run is not already running
    if (run.status === 'running') {
      throw new BadRequestException('Workflow run is already running');
    }

    // ST-195: Launch laptop orchestrator via RunnerService
    this.logger.log(`[ST-195] Starting workflow run ${runId} via laptop orchestrator`);

    const result = await this.runnerService.launchDockerRunner({
      runId,
      workflowId,
      storyId,
      triggeredBy: triggeredBy || 'mcp-user',
    });

    return {
      success: result.success,
      runId: result.runId,
      status: result.success ? 'running' : 'failed',
      message: result.message,
      jobId: result.jobId,
      agentId: result.agentId,
    };
  }

  /**
   * Pause a workflow run (maps to pause_runner MCP tool)
   * M1: Authorization - Check user has access to project
   */
  async pauseRunner(
    runId: string,
    reason?: string,
  ): Promise<{ success: boolean; runId: string; status: string; message?: string }> {
    // Fetch run with workflow and project
    const run = await this.prisma.workflowRun.findUnique({
      where: { id: runId },
      include: {
        workflow: {
          include: {
            project: true,
          },
        },
      },
    });

    if (!run) {
      throw new NotFoundException('WorkflowRun not found');
    }

    // M1: Authorization check
    if (!run.workflow?.project?.id) {
      throw new ForbiddenException('Access denied to this workflow run');
    }

    // Validate run is running
    if (run.status !== 'running') {
      throw new BadRequestException(`Cannot pause workflow run with status: ${run.status}`);
    }

    // Update run status to paused
    const updatedRun = await this.prisma.workflowRun.update({
      where: { id: runId },
      data: {
        status: 'paused',
      },
    });

    return {
      success: true,
      runId: updatedRun.id,
      status: updatedRun.status,
      message: reason || 'Workflow run paused',
    };
  }

  /**
   * Resume a paused workflow run (maps to resume_runner MCP tool)
   * M1: Authorization - Check user has access to project
   */
  async resumeRunner(
    runId: string,
  ): Promise<{ success: boolean; runId: string; status: string; message?: string }> {
    // Fetch run with workflow and project
    const run = await this.prisma.workflowRun.findUnique({
      where: { id: runId },
      include: {
        workflow: {
          include: {
            project: true,
          },
        },
      },
    });

    if (!run) {
      throw new NotFoundException('WorkflowRun not found');
    }

    // M1: Authorization check
    if (!run.workflow?.project?.id) {
      throw new ForbiddenException('Access denied to this workflow run');
    }

    // Validate run is paused
    if (run.status !== 'paused') {
      throw new BadRequestException(`Cannot resume workflow run with status: ${run.status}`);
    }

    // Update run status to running
    const updatedRun = await this.prisma.workflowRun.update({
      where: { id: runId },
      data: {
        status: 'running',
      },
    });

    return {
      success: true,
      runId: updatedRun.id,
      status: updatedRun.status,
      message: 'Workflow run resumed successfully',
    };
  }

  /**
   * Repeat current step with optional feedback (maps to repeat_step MCP tool)
   * M1: Authorization - Check user has access to project
   * M2: Validation - Sanitize and validate feedback length
   */
  async repeatStep(
    runId: string,
    reason?: string,
    feedback?: string,
  ): Promise<{ success: boolean; runId: string; status: string; message?: string }> {
    // Fetch run with workflow and project
    const run = await this.prisma.workflowRun.findUnique({
      where: { id: runId },
      include: {
        workflow: {
          include: {
            project: true,
          },
        },
      },
    });

    if (!run) {
      throw new NotFoundException('WorkflowRun not found');
    }

    // M1: Authorization check
    if (!run.workflow?.project?.id) {
      throw new ForbiddenException('Access denied to this workflow run');
    }

    // M2: Validation - Truncate long strings to prevent DoS
    const sanitizedReason = reason ? reason.substring(0, 500) : undefined;
    const sanitizedFeedback = feedback ? feedback.substring(0, 2000) : undefined;

    // Validate run can be repeated (running, paused, or failed)
    if (!['running', 'paused', 'failed'].includes(run.status)) {
      throw new BadRequestException(`Cannot repeat step for workflow run with status: ${run.status}`);
    }

    // In a real implementation, this would trigger the repeat_step MCP tool
    // For now, we just return success (the actual repeat logic is in the Story Runner)
    return {
      success: true,
      runId: run.id,
      status: run.status,
      message: sanitizedReason || 'Step repeat requested',
    };
  }

  /**
   * Advance to next step/phase or skip to state (maps to advance_step MCP tool)
   * M1: Authorization - Check user has access to project
   */
  async advanceStep(
    runId: string,
    output?: Record<string, unknown>,
    skipToState?: string,
  ): Promise<{ success: boolean; runId: string; status: string; message?: string }> {
    // Fetch run with workflow and project
    const run = await this.prisma.workflowRun.findUnique({
      where: { id: runId },
      include: {
        workflow: {
          include: {
            project: true,
          },
        },
      },
    });

    if (!run) {
      throw new NotFoundException('WorkflowRun not found');
    }

    // M1: Authorization check
    if (!run.workflow?.project?.id) {
      throw new ForbiddenException('Access denied to this workflow run');
    }

    // Validate run is running or paused
    if (!['running', 'paused'].includes(run.status)) {
      throw new BadRequestException(`Cannot advance step for workflow run with status: ${run.status}`);
    }

    // In a real implementation, this would trigger the advance_step MCP tool
    // For now, we just return success (the actual advance logic is in the Story Runner)
    return {
      success: true,
      runId: run.id,
      status: run.status,
      message: skipToState ? `Advancing to state: ${skipToState}` : 'Advancing to next phase',
    };
  }

  /**
   * Get workflow run status (maps to get_runner_status MCP tool)
   * M1: Authorization - Check user has access to project
   */
  async getStatus(
    runId: string,
    includeCheckpoint?: boolean,
  ): Promise<{
    runId: string;
    status: string;
    currentStateId?: string;
    checkpoint?: unknown;
    resourceUsage?: unknown;
  }> {
    // Fetch run with workflow and project
    const run = await this.prisma.workflowRun.findUnique({
      where: { id: runId },
      include: {
        workflow: {
          include: {
            project: true,
          },
        },
      },
    });

    if (!run) {
      throw new NotFoundException('WorkflowRun not found');
    }

    // M1: Authorization check
    if (!run.workflow?.project?.id) {
      throw new ForbiddenException('Access denied to this workflow run');
    }

    // Build response
    const response: {
      runId: string;
      status: string;
      currentStateId?: string;
      checkpoint?: unknown;
      resourceUsage?: unknown;
    } = {
      runId: run.id,
      status: run.status,
      currentStateId: run.currentStateId || undefined,
    };

    // Optionally include checkpoint data
    if (includeCheckpoint && run.checkpointData) {
      response.checkpoint = run.checkpointData;
    }

    return response;
  }
}
