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
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { WorkflowsService } from './workflows.service';
import { CreateWorkflowDto, UpdateWorkflowDto, WorkflowResponseDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('workflows')
@Controller('api/projects/:projectId/workflows')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class WorkflowsController {
  constructor(private readonly workflowsService: WorkflowsService) {}

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
  @ApiOperation({ summary: 'Activate a workflow' })
  @ApiResponse({ status: 200, description: 'Workflow activated successfully', type: WorkflowResponseDto })
  @ApiResponse({ status: 404, description: 'Workflow not found' })
  async activate(@Param('id') id: string): Promise<WorkflowResponseDto> {
    return this.workflowsService.activate(id);
  }
}
