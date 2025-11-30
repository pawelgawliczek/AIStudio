import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { RunnerService, RunnerCheckpoint, RunnerStatus } from './runner.service';
import { BreakpointService, BreakpointContext, BreakpointData } from './breakpoint.service';

/**
 * DTO for saving checkpoint
 */
class SaveCheckpointDto {
  runId: string;
  workflowId: string;
  storyId?: string;
  checkpointData: RunnerCheckpoint;
}

/**
 * DTO for reporting status
 */
class ReportStatusDto {
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
 * DTO for checking breakpoints
 * ST-146: Breakpoint System
 */
class CheckBreakpointDto {
  stateId: string;
  position: 'before' | 'after';
  context: BreakpointContext;
}

/**
 * DTO for recording breakpoint hit
 * ST-146: Breakpoint System
 */
class RecordBreakpointHitDto {
  hitAt: string;
  context: {
    tokensUsed: number;
    agentSpawns: number;
    stateTransitions: number;
    durationMs: number;
  };
}

/**
 * Runner Controller
 * REST API endpoints for Story Runner communication
 *
 * Endpoints:
 * - POST /api/runner/checkpoints - Save checkpoint
 * - GET /api/runner/checkpoints/:runId - Load checkpoint
 * - DELETE /api/runner/checkpoints/:runId - Delete checkpoint
 * - POST /api/runner/status/:runId - Report status
 * - GET /api/runner/team-context/:runId - Get team context
 * - GET /api/runner/active - List active runs
 *
 * ST-146 Breakpoint Endpoints:
 * - GET /api/runner/breakpoints/:runId - Get breakpoints for run
 * - POST /api/runner/breakpoints/:runId/check - Check if should pause
 * - POST /api/runner/breakpoints/:breakpointId/hit - Record breakpoint hit
 */
@Controller('runner')
export class RunnerController {
  constructor(
    private readonly runnerService: RunnerService,
    private readonly breakpointService: BreakpointService,
  ) {}

  /**
   * Save checkpoint
   */
  @Post('checkpoints')
  @HttpCode(HttpStatus.CREATED)
  async saveCheckpoint(@Body() dto: SaveCheckpointDto): Promise<{ success: boolean }> {
    await this.runnerService.saveCheckpoint(dto.checkpointData);
    return { success: true };
  }

  /**
   * Load checkpoint
   */
  @Get('checkpoints/:runId')
  async loadCheckpoint(
    @Param('runId') runId: string,
  ): Promise<{ checkpointData: RunnerCheckpoint | null }> {
    const checkpointData = await this.runnerService.loadCheckpoint(runId);
    return { checkpointData };
  }

  /**
   * Delete checkpoint
   */
  @Delete('checkpoints/:runId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteCheckpoint(@Param('runId') runId: string): Promise<void> {
    await this.runnerService.deleteCheckpoint(runId);
  }

  /**
   * Report runner status
   */
  @Post('status/:runId')
  @HttpCode(HttpStatus.OK)
  async reportStatus(
    @Param('runId') runId: string,
    @Body() dto: ReportStatusDto,
  ): Promise<{ success: boolean }> {
    await this.runnerService.updateStatus(runId, dto);
    return { success: true };
  }

  /**
   * Get team context for orchestration
   */
  @Get('team-context/:runId')
  async getTeamContext(@Param('runId') runId: string): Promise<{
    runId: string;
    workflow: unknown;
    story: unknown | null;
    previousOutputs: Record<string, unknown>;
  }> {
    return await this.runnerService.getTeamContext(runId);
  }

  /**
   * Get workflow details
   */
  @Get('workflows/:workflowId')
  async getWorkflow(@Param('workflowId') workflowId: string): Promise<unknown> {
    return await this.runnerService.getWorkflow(workflowId);
  }

  /**
   * Get workflow run details
   */
  @Get('workflow-runs/:runId')
  async getWorkflowRun(@Param('runId') runId: string): Promise<unknown> {
    return await this.runnerService.getWorkflowRun(runId);
  }

  /**
   * List active runner runs
   */
  @Get('active')
  async listActiveRuns(): Promise<{ runs: unknown[] }> {
    const runs = await this.runnerService.listActiveRuns();
    return { runs };
  }

  // ========================================
  // ST-146: Breakpoint Endpoints
  // ========================================

  /**
   * Get breakpoints for a workflow run
   * ST-146: Breakpoint System
   */
  @Get('breakpoints/:runId')
  async getBreakpoints(@Param('runId') runId: string): Promise<{
    breakpoints: BreakpointData[];
    breakpointsModifiedAt?: string;
  }> {
    const breakpoints = await this.breakpointService.loadBreakpoints(runId);
    const cached = this.breakpointService.getCachedBreakpoints(runId);

    // Get breakpointsModifiedAt from metadata (would need to pass through)
    // For now, just return breakpoints
    return {
      breakpoints,
      // breakpointsModifiedAt comes from workflow run metadata
    };
  }

  /**
   * Check if runner should pause at breakpoint
   * ST-146: Breakpoint System
   */
  @Post('breakpoints/:runId/check')
  @HttpCode(HttpStatus.OK)
  async checkBreakpoint(
    @Param('runId') runId: string,
    @Body() dto: CheckBreakpointDto,
  ): Promise<{
    shouldPause: boolean;
    breakpoint?: BreakpointData;
    reason?: string;
  }> {
    return await this.breakpointService.shouldPause(
      runId,
      dto.stateId,
      dto.position as 'before' | 'after',
      dto.context,
    );
  }

  /**
   * Record breakpoint hit
   * ST-146: Breakpoint System
   */
  @Post('breakpoints/:breakpointId/hit')
  @HttpCode(HttpStatus.OK)
  async recordBreakpointHit(
    @Param('breakpointId') breakpointId: string,
    @Body() dto: RecordBreakpointHitDto,
  ): Promise<{ success: boolean }> {
    // Get breakpoint by ID
    const breakpoint = await this.breakpointService.getBreakpointById(breakpointId);

    if (breakpoint) {
      await this.breakpointService.recordHit(breakpoint);
    }

    return { success: true };
  }
}
