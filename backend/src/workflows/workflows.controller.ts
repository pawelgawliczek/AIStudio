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
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ActivationService } from '../mcp/services/activation.service';
import { CreateWorkflowDto, UpdateWorkflowDto, WorkflowResponseDto } from './dto';
import {
  ActivateWorkflowDto,
  DeactivateWorkflowDto,
  ActivationResponseDto,
  DeactivationResponseDto,
  SyncResponseDto,
  ActiveWorkflowResponseDto,
} from './dto/activate-workflow.dto';
import { ValidateTemplateDto, ValidateTemplateResponseDto } from './dto/validate-template.dto';
import { WorkflowsService } from './workflows.service';
import { TemplateParserService } from './template-parser.service';

@ApiTags('workflows')
@Controller('projects/:projectId/workflows')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class WorkflowsController {
  constructor(
    private readonly workflowsService: WorkflowsService,
    private readonly activationService: ActivationService,
    private readonly templateParser: TemplateParserService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new workflow' })
  @ApiResponse({ status: 201, description: 'Workflow created successfully', type: WorkflowResponseDto })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async create(
    @Param('projectId') projectId: string,
    @Body() createWorkflowDto: CreateWorkflowDto,
  ): Promise<WorkflowResponseDto> {
    return this.workflowsService.create(projectId, createWorkflowDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all workflows for a project' })
  @ApiQuery({ name: 'active', required: false, type: Boolean })
  @ApiQuery({ name: 'coordinatorId', required: false, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Workflows retrieved successfully', type: [WorkflowResponseDto] })
  async findAll(
    @Param('projectId') projectId: string,
    @Query('active') active?: string,
    @Query('coordinatorId') coordinatorId?: string,
    @Query('search') search?: string,
  ): Promise<WorkflowResponseDto[]> {
    const options: any = {};

    if (active !== undefined) {
      options.active = active === 'true';
    }

    if (coordinatorId) {
      options.coordinatorId = coordinatorId;
    }

    if (search) {
      options.search = search;
    }

    return this.workflowsService.findAll(projectId, options);
  }

  // NOTE: Static routes like 'active-claude-code' MUST be defined BEFORE dynamic ':id' routes
  // Otherwise NestJS will match ':id' first and interpret 'active-claude-code' as an ID

  @Get('active-claude-code')
  @ApiOperation({ summary: 'Get the currently active workflow in Claude Code' })
  @ApiResponse({ status: 200, description: 'Active workflow retrieved', type: ActiveWorkflowResponseDto })
  async getActiveClaudeCode(
    @Param('projectId') projectId: string,
  ): Promise<ActiveWorkflowResponseDto> {
    const activeWorkflow = await this.activationService.getActiveWorkflow(projectId);
    return activeWorkflow || {};
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a workflow by ID' })
  @ApiQuery({ name: 'includeStats', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'Workflow retrieved successfully', type: WorkflowResponseDto })
  @ApiResponse({ status: 404, description: 'Workflow not found' })
  async findOne(
    @Param('id') id: string,
    @Query('includeStats') includeStats?: string,
  ): Promise<WorkflowResponseDto> {
    return this.workflowsService.findOne(id, includeStats === 'true');
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a workflow' })
  @ApiResponse({ status: 200, description: 'Workflow updated successfully', type: WorkflowResponseDto })
  @ApiResponse({ status: 404, description: 'Workflow not found' })
  async update(
    @Param('id') id: string,
    @Body() updateWorkflowDto: UpdateWorkflowDto,
  ): Promise<WorkflowResponseDto> {
    return this.workflowsService.update(id, updateWorkflowDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a workflow' })
  @ApiResponse({ status: 204, description: 'Workflow deleted successfully' })
  @ApiResponse({ status: 400, description: 'Cannot delete activated workflow or workflow with execution history' })
  @ApiResponse({ status: 404, description: 'Workflow not found' })
  async remove(@Param('id') id: string): Promise<void> {
    return this.workflowsService.remove(id);
  }

  @Post(':id/deactivate')
  @ApiOperation({ summary: 'Deactivate a workflow' })
  @ApiResponse({ status: 200, description: 'Workflow deactivated successfully', type: WorkflowResponseDto })
  @ApiResponse({ status: 404, description: 'Workflow not found' })
  async deactivate(@Param('id') id: string): Promise<WorkflowResponseDto> {
    return this.workflowsService.deactivate(id);
  }

  @Post(':id/activate')
  @ApiOperation({ summary: 'Activate a workflow (toggle active status)' })
  @ApiResponse({ status: 200, description: 'Workflow activated successfully', type: WorkflowResponseDto })
  @ApiResponse({ status: 404, description: 'Workflow not found' })
  async activate(@Param('id') id: string): Promise<WorkflowResponseDto> {
    return this.workflowsService.activate(id);
  }

  // Claude Code Integration Endpoints

  @Post(':id/activate-claude-code')
  @ApiOperation({ summary: 'Activate workflow in Claude Code by generating agent files' })
  @ApiResponse({ status: 200, description: 'Workflow activated in Claude Code successfully', type: ActivationResponseDto })
  @ApiResponse({ status: 400, description: 'Bad request - validation failed' })
  @ApiResponse({ status: 409, description: 'Conflict - another workflow is already active' })
  async activateInClaudeCode(
    @Param('projectId') projectId: string,
    @Param('id') workflowId: string,
    @Body() dto: ActivateWorkflowDto,
    @Req() req: any,
  ): Promise<ActivationResponseDto> {
    const userId = req.user?.id || 'unknown';
    return this.activationService.activateWorkflow(workflowId, projectId, userId, dto);
  }

  @Post('deactivate-claude-code')
  @ApiOperation({ summary: 'Deactivate the currently active workflow in Claude Code' })
  @ApiResponse({ status: 200, description: 'Workflow deactivated successfully', type: DeactivationResponseDto })
  @ApiResponse({ status: 400, description: 'No active workflow found' })
  async deactivateFromClaudeCode(
    @Param('projectId') projectId: string,
    @Body() dto: DeactivateWorkflowDto,
  ): Promise<DeactivationResponseDto> {
    return this.activationService.deactivateWorkflow(projectId, dto);
  }

  @Post('sync-claude-code')
  @ApiOperation({ summary: 'Sync the active workflow in Claude Code to the latest version' })
  @ApiResponse({ status: 200, description: 'Workflow synced successfully', type: SyncResponseDto })
  @ApiResponse({ status: 400, description: 'No active workflow found' })
  async syncClaudeCode(
    @Param('projectId') projectId: string,
  ): Promise<SyncResponseDto> {
    return this.activationService.syncWorkflow(projectId);
  }

  @Post('validate-template')
  @ApiOperation({ summary: 'Validate coordinator instructions template references' })
  @ApiResponse({ status: 200, description: 'Template validation result', type: ValidateTemplateResponseDto })
  async validateTemplate(
    @Body() dto: ValidateTemplateDto,
  ): Promise<ValidateTemplateResponseDto> {
    return this.templateParser.validateReferences(dto.instructions, dto.componentAssignments as any);
  }
}

/**
 * TeamsController - User-friendly alias for WorkflowsController
 *
 * Part of ST-109: User-Friendly Terminology Rebrand
 * "Team" is the user-facing term for "Workflow" (a team of agents working together)
 *
 * This controller provides the same endpoints at /api/projects/:projectId/teams
 * while maintaining backwards compatibility with /api/projects/:projectId/workflows
 */
@ApiTags('teams')
@Controller('projects/:projectId/teams')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TeamsController extends WorkflowsController {
  // Inherits all methods from WorkflowsController
  // No code duplication - just route aliasing for user-friendly terminology
}
