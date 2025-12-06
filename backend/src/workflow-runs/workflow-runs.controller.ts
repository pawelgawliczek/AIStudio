import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  ForbiddenException,
  NotFoundException,
  Req,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import {
  CreateWorkflowRunDto,
  UpdateWorkflowRunDto,
  WorkflowRunResponseDto,
  RunStatus,
  TranscriptListResponseDto,
  TranscriptDetailResponseDto,
} from './dto';
import { TranscriptsService } from './transcripts.service';
import { WorkflowRunsService } from './workflow-runs.service';

@ApiTags('workflow-runs')
@Controller('projects/:projectId/workflow-runs')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class WorkflowRunsController {
  constructor(
    private readonly workflowRunsService: WorkflowRunsService,
    private readonly transcriptsService: TranscriptsService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new workflow run' })
  @ApiResponse({
    status: 201,
    description: 'Workflow run created successfully',
    type: WorkflowRunResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async create(
    @Param('projectId') projectId: string,
    @Body() createDto: CreateWorkflowRunDto,
  ): Promise<WorkflowRunResponseDto> {
    return this.workflowRunsService.create(projectId, createDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all workflow runs for a project' })
  @ApiQuery({ name: 'workflowId', required: false, type: String })
  @ApiQuery({ name: 'storyId', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, enum: RunStatus })
  @ApiQuery({ name: 'includeRelations', required: false, type: Boolean })
  @ApiResponse({
    status: 200,
    description: 'Workflow runs retrieved successfully',
    type: [WorkflowRunResponseDto],
  })
  async findAll(
    @Param('projectId') projectId: string,
    @Query('workflowId') workflowId?: string,
    @Query('storyId') storyId?: string,
    @Query('status') status?: RunStatus,
    @Query('includeRelations') includeRelations?: string,
  ): Promise<WorkflowRunResponseDto[]> {
    return this.workflowRunsService.findAll(projectId, {
      workflowId,
      storyId,
      status,
      includeRelations: includeRelations === 'true',
    });
  }

  @Get('active/current')
  @ApiOperation({ summary: 'Get active workflow run for project (for global tracking bar)' })
  @ApiResponse({
    status: 200,
    description: 'Active workflow retrieved successfully (or null if none active)',
  })
  async getActiveWorkflow(@Param('projectId') projectId: string): Promise<any> {
    return this.workflowRunsService.getActiveWorkflowForProject(projectId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a workflow run by ID' })
  @ApiQuery({ name: 'includeRelations', required: false, type: Boolean })
  @ApiResponse({
    status: 200,
    description: 'Workflow run retrieved successfully',
    type: WorkflowRunResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Workflow run not found' })
  async findOne(
    @Param('id') id: string,
    @Query('includeRelations') includeRelations?: string,
  ): Promise<WorkflowRunResponseDto> {
    return this.workflowRunsService.findOne(id, includeRelations === 'true');
  }

  @Get(':id/results')
  @ApiOperation({ summary: 'Get detailed results for a workflow run' })
  @ApiResponse({
    status: 200,
    description: 'Workflow run results retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Workflow run not found' })
  async getResults(@Param('id') id: string): Promise<any> {
    return this.workflowRunsService.getResults(id);
  }

  @Get(':id/status')
  @ApiOperation({ summary: 'Get execution status with full details (for monitoring)' })
  @ApiResponse({
    status: 200,
    description: 'Workflow run status retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Workflow run not found' })
  async getStatus(@Param('id') id: string): Promise<any> {
    return this.workflowRunsService.getStatus(id);
  }

  @Get(':id/artifacts')
  @ApiOperation({ summary: 'Get artifacts for a workflow run' })
  @ApiQuery({ name: 'includeContent', required: false, type: Boolean })
  @ApiQuery({ name: 'definitionKey', required: false, type: String })
  @ApiResponse({
    status: 200,
    description: 'Workflow run artifacts retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Workflow run not found' })
  async getArtifacts(
    @Param('id') id: string,
    @Query('includeContent') includeContent?: string,
    @Query('definitionKey') definitionKey?: string,
  ): Promise<any[]> {
    return this.workflowRunsService.getArtifacts(id, includeContent === 'true', definitionKey);
  }

  @Get(':id/artifact-access')
  @ApiOperation({ summary: 'Get artifact access rules (expected artifacts per state)' })
  @ApiResponse({
    status: 200,
    description: 'Artifact access rules retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Workflow run not found' })
  async getArtifactAccess(@Param('id') id: string): Promise<Record<string, any[]>> {
    return this.workflowRunsService.getArtifactAccess(id);
  }

  @Get(':id/context')
  @ApiOperation({ summary: 'Get workflow context (for coordinator decisions)' })
  @ApiResponse({
    status: 200,
    description: 'Workflow context retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Workflow run not found' })
  async getContext(@Param('id') id: string): Promise<any> {
    return this.workflowRunsService.getContext(id);
  }

  // ==========================================================================
  // ST-173: Transcript Endpoints
  // ==========================================================================

  @Get(':runId/transcripts')
  @ApiOperation({ summary: 'Get all transcripts for a workflow run (ST-173)' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiParam({ name: 'runId', description: 'Workflow Run UUID' })
  @ApiResponse({
    status: 200,
    description: 'Transcripts retrieved successfully',
    type: TranscriptListResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - JWT required' })
  @ApiResponse({ status: 403, description: 'Forbidden - Access denied to project' })
  @ApiResponse({ status: 404, description: 'Workflow run not found' })
  async getTranscriptsForRun(
    @Param('projectId') projectId: string,
    @Param('runId') runId: string,
    @Req() request: any,
  ): Promise<TranscriptListResponseDto> {
    // Validate access
    await this.validateProjectAccess(request.user?.userId, projectId);
    await this.validateRunBelongsToProject(runId, projectId);

    return this.transcriptsService.getTranscriptsForRun(runId);
  }

  @Get(':runId/transcripts/component/:componentId')
  @ApiOperation({ summary: 'Get transcript for a specific component (ST-173)' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiParam({ name: 'runId', description: 'Workflow Run UUID' })
  @ApiParam({ name: 'componentId', description: 'Component UUID' })
  @ApiQuery({ name: 'includeContent', required: false, type: Boolean })
  @ApiResponse({
    status: 200,
    description: 'Component transcript retrieved successfully',
    type: TranscriptDetailResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - JWT required' })
  @ApiResponse({ status: 403, description: 'Forbidden - Access denied to project' })
  @ApiResponse({ status: 404, description: 'Transcript not found' })
  async getTranscriptByComponent(
    @Param('projectId') projectId: string,
    @Param('runId') runId: string,
    @Param('componentId') componentId: string,
    @Req() request: any,
    @Query('includeContent') includeContent?: string,
  ): Promise<TranscriptDetailResponseDto> {
    // Validate access - JWT strategy returns userId (not id)
    await this.validateProjectAccess(request.user?.userId, projectId);
    await this.validateRunBelongsToProject(runId, projectId);

    // ST-182: First check spawnedAgentTranscripts in WorkflowRun metadata
    // This is where transcript paths are stored (not uploaded to Artifact table)
    return this.transcriptsService.getTranscriptByComponentFromMetadata(
      runId,
      componentId,
      includeContent === 'true',
    );
  }

  @Get(':runId/transcripts/master/:index')
  @ApiOperation({ summary: 'Get master transcript by index (ST-173)' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiParam({ name: 'runId', description: 'Workflow Run UUID' })
  @ApiParam({ name: 'index', description: 'Master transcript index (0=initial, 1=after first compact)' })
  @ApiQuery({ name: 'includeContent', required: false, type: Boolean })
  @ApiResponse({
    status: 200,
    description: 'Master transcript retrieved successfully',
    type: TranscriptDetailResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - JWT required' })
  @ApiResponse({ status: 403, description: 'Forbidden - Access denied to project' })
  @ApiResponse({ status: 404, description: 'Master transcript not found at index' })
  async getMasterTranscript(
    @Param('projectId') projectId: string,
    @Param('runId') runId: string,
    @Param('index') index: string,
    @Req() request: any,
    @Query('includeContent') includeContent?: string,
  ): Promise<TranscriptDetailResponseDto> {
    // Validate access
    await this.validateProjectAccess(request.user?.userId, projectId);
    await this.validateRunBelongsToProject(runId, projectId);

    const transcriptIndex = parseInt(index, 10);

    // Get all transcripts and find master at index
    const transcripts = await this.transcriptsService.getTranscriptsForRun(runId);
    const masterTranscript = transcripts.master.find(t => t.index === transcriptIndex);

    if (!masterTranscript) {
      throw new NotFoundException(`Master transcript not found at index ${transcriptIndex}`);
    }

    const result = await this.transcriptsService.getTranscriptById(
      masterTranscript.artifactId,
      includeContent === 'true',
    );

    return {
      ...result,
      index: transcriptIndex,
    };
  }

  @Get(':runId/transcripts/:artifactId')
  @ApiOperation({ summary: 'Get a specific transcript by artifact ID (ST-173)' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiParam({ name: 'runId', description: 'Workflow Run UUID' })
  @ApiParam({ name: 'artifactId', description: 'Artifact UUID' })
  @ApiQuery({ name: 'includeContent', required: false, type: Boolean })
  @ApiResponse({
    status: 200,
    description: 'Transcript retrieved successfully',
    type: TranscriptDetailResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - JWT required' })
  @ApiResponse({ status: 403, description: 'Forbidden - Access denied or artifact mismatch' })
  @ApiResponse({ status: 404, description: 'Transcript not found' })
  async getTranscript(
    @Param('projectId') projectId: string,
    @Param('runId') runId: string,
    @Param('artifactId') artifactId: string,
    @Req() request: any,
    @Query('includeContent') includeContent?: string,
  ): Promise<TranscriptDetailResponseDto> {
    // Validate access
    await this.validateProjectAccess(request.user?.userId, projectId);
    await this.validateRunBelongsToProject(runId, projectId);
    await this.validateArtifactBelongsToRun(artifactId, runId);

    return this.transcriptsService.getTranscriptById(
      artifactId,
      includeContent === 'true',
    );
  }

  // ==========================================================================
  // Access Validation Helpers (ST-173)
  // ==========================================================================

  /**
   * Validate user has access to project
   */
  private async validateProjectAccess(userId: string | undefined, projectId: string): Promise<void> {
    if (!userId) {
      throw new ForbiddenException('Access denied');
    }

    // Check if user has access to this project
    const project = await this.workflowRunsService.findProjectWithAccess(projectId, userId);

    if (!project) {
      throw new ForbiddenException('Access denied');
    }
  }

  /**
   * Validate workflow run belongs to project
   */
  private async validateRunBelongsToProject(runId: string, projectId: string): Promise<void> {
    const run = await this.workflowRunsService.findRunWithProject(runId);

    if (!run) {
      throw new NotFoundException('Workflow run not found');
    }

    if (run.projectId !== projectId) {
      throw new ForbiddenException('Workflow run does not belong to project');
    }
  }

  /**
   * Validate artifact belongs to workflow run
   */
  private async validateArtifactBelongsToRun(artifactId: string, runId: string): Promise<void> {
    const artifact = await this.workflowRunsService.findArtifactWithRun(artifactId);

    if (!artifact) {
      throw new NotFoundException('Transcript not found');
    }

    if (artifact.workflowRunId !== runId) {
      throw new ForbiddenException('Artifact does not belong to workflow run');
    }
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a workflow run' })
  @ApiResponse({
    status: 200,
    description: 'Workflow run updated successfully',
    type: WorkflowRunResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Workflow run not found' })
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateWorkflowRunDto,
  ): Promise<WorkflowRunResponseDto> {
    return this.workflowRunsService.update(id, updateDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a workflow run' })
  @ApiResponse({ status: 204, description: 'Workflow run deleted successfully' })
  @ApiResponse({ status: 404, description: 'Workflow run not found' })
  async remove(@Param('id') id: string): Promise<void> {
    return this.workflowRunsService.remove(id);
  }
}
