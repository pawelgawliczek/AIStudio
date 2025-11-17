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
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import {
  CreateWorkflowRunDto,
  UpdateWorkflowRunDto,
  WorkflowRunResponseDto,
  RunStatus,
} from './dto';
import { WorkflowRunsService } from './workflow-runs.service';

@ApiTags('workflow-runs')
@Controller('projects/:projectId/workflow-runs')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class WorkflowRunsController {
  constructor(private readonly workflowRunsService: WorkflowRunsService) {}

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
  @ApiResponse({
    status: 200,
    description: 'Workflow run artifacts retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Workflow run not found' })
  async getArtifacts(@Param('id') id: string): Promise<any> {
    return this.workflowRunsService.getArtifacts(id);
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
