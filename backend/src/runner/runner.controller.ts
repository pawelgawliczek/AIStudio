import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { IsString, IsOptional, IsBoolean, IsNumber, IsObject, IsIn, IsEnum } from 'class-validator';
import { ApprovalService, CreateApprovalParams, ApprovalRequestData, RespondToApprovalParams } from './approval.service';
import { BreakpointService, BreakpointContext, BreakpointData } from './breakpoint.service';
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
 * DTO for creating a breakpoint
 * ST-168: REST API for UI breakpoint creation
 */
class CreateBreakpointDto {
  @IsString()
  runId: string;

  @IsOptional()
  @IsString()
  stateId?: string;

  @IsOptional()
  @IsString()
  stateName?: string;

  @IsOptional()
  @IsNumber()
  stateOrder?: number;

  @IsOptional()
  @IsIn(['before', 'after'])
  position?: 'before' | 'after';

  @IsOptional()
  @IsObject()
  condition?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isTemporary?: boolean;
}

/**
 * DTO for creating approval request
 * ST-148: Approval Gates
 */
class CreateApprovalDto {
  workflowRunId: string;
  stateId: string;
  projectId: string;
  stateName: string;
  stateOrder: number;
  requestedBy: string;
  contextSummary?: string;
  artifactKeys?: string[];
  tokensUsed?: number;
}

/**
 * DTO for registering transcript
 * ST-189: Docker Runner Transcript Registration
 */
class RegisterTranscriptDto {
  @IsString()
  type: 'master' | 'agent';

  @IsString()
  transcriptPath: string;

  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsOptional()
  @IsString()
  componentId?: string;

  @IsOptional()
  @IsString()
  agentId?: string;
}

/**
 * DTO for responding to approval
 * ST-148: Approval Gates - REST endpoint for frontend
 */
class RespondToApprovalDto {
  @IsString()
  @IsIn(['approve', 'rerun', 'reject'])
  action: 'approve' | 'rerun' | 'reject';

  @IsString()
  decidedBy: string;

  @IsOptional()
  @IsString()
  feedback?: string;

  @IsOptional()
  @IsString()
  @IsIn(['cancel', 'pause'])
  rejectMode?: 'cancel' | 'pause';

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  notes?: string;
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
 *
 * ST-148 Approval Endpoints:
 * - POST /api/runner/approvals - Create approval request
 * - GET /api/runner/approvals/:runId/pending - Get pending approval
 * - GET /api/runner/approvals/:runId/latest - Get latest approval (for resume)
 */
@Controller('runner')
export class RunnerController {
  constructor(
    private readonly runnerService: RunnerService,
    private readonly breakpointService: BreakpointService,
    private readonly approvalService: ApprovalService,
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
   * Create a breakpoint
   * ST-168: REST API for UI breakpoint creation
   */
  @Post('breakpoints')
  @HttpCode(HttpStatus.CREATED)
  async createBreakpoint(@Body() dto: CreateBreakpointDto): Promise<{
    success: boolean;
    status: string;
    breakpoint: BreakpointData;
    message: string;
  }> {
    return await this.breakpointService.createBreakpoint(dto);
  }

  /**
   * Delete a breakpoint
   * ST-168: REST API for UI breakpoint deletion
   */
  @Delete('breakpoints/:breakpointId')
  @HttpCode(HttpStatus.OK)
  async deleteBreakpoint(@Param('breakpointId') breakpointId: string): Promise<{
    success: boolean;
    message: string;
  }> {
    return await this.breakpointService.deleteBreakpoint(breakpointId);
  }

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

  // ========================================
  // ST-148: Approval Endpoints
  // ========================================

  /**
   * Create approval request
   * ST-148: Approval Gates
   */
  @Post('approvals')
  @HttpCode(HttpStatus.CREATED)
  async createApprovalRequest(
    @Body() dto: CreateApprovalDto,
  ): Promise<ApprovalRequestData> {
    return await this.approvalService.createApprovalRequest(dto);
  }

  /**
   * Get pending approval for a workflow run
   * ST-148: Approval Gates
   */
  @Get('approvals/:runId/pending')
  async getPendingApproval(
    @Param('runId') runId: string,
  ): Promise<ApprovalRequestData> {
    const approval = await this.approvalService.getPendingApproval(runId);
    if (!approval) {
      throw new NotFoundException(`No pending approval found for run ${runId}`);
    }
    return approval;
  }

  /**
   * Get latest approval for a workflow run (for resume check)
   * ST-148: Approval Gates
   */
  @Get('approvals/:runId/latest')
  async getLatestApproval(
    @Param('runId') runId: string,
  ): Promise<ApprovalRequestData> {
    const approval = await this.approvalService.getLatestApproval(runId);
    if (!approval) {
      throw new NotFoundException(`No approval found for run ${runId}`);
    }
    return approval;
  }

  /**
   * Respond to a pending approval
   * ST-148: Approval Gates - REST endpoint for frontend
   */
  @Post('approvals/:runId/respond')
  @HttpCode(HttpStatus.OK)
  async respondToApproval(
    @Param('runId') runId: string,
    @Body() dto: RespondToApprovalDto,
  ): Promise<{ approval: ApprovalRequestData; shouldResume: boolean; shouldRerun: boolean }> {
    const result = await this.approvalService.respondToApproval({
      runId,
      ...dto,
    });
    return result;
  }

  // ========================================
  // ST-189: Transcript Registration Endpoints
  // ========================================

  /**
   * Register transcript for Docker Runner
   * ST-189: Updates masterTranscriptPaths or spawnedAgentTranscripts
   *
   * This endpoint mirrors what TranscriptRegistrationService.registerForLiveStreaming()
   * does, but callable via HTTP from Docker Runner's BackendClient.
   */
  @Post('workflow-runs/:runId/transcripts')
  @HttpCode(HttpStatus.OK)
  async registerTranscript(
    @Param('runId') runId: string,
    @Body() dto: RegisterTranscriptDto,
  ): Promise<{ success: boolean; type: string; transcriptPath: string; error?: string }> {
    return await this.runnerService.registerTranscript(runId, dto);
  }
}
