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
 */
@Controller('runner')
export class RunnerController {
  constructor(private readonly runnerService: RunnerService) {}

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
}
