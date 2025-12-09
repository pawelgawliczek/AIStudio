import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import {
  CreateStoryDto,
  UpdateStoryDto,
  FilterStoryDto,
  UpdateStoryStatusDto,
} from './dto';
import { StoriesService } from './stories.service';

@ApiTags('stories')
@Controller('stories')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@ApiBearerAuth()
export class StoriesController {
  constructor(private readonly storiesService: StoriesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all stories with filters' })
  @ApiResponse({ status: 200, description: 'Return filtered stories' })
  @ApiQuery({ name: 'projectId', required: false })
  @ApiQuery({ name: 'epicId', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'search', required: false })
  findAll(@Query() filterDto: FilterStoryDto) {
    return this.storiesService.findAll(filterDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get story by ID or story key (e.g., ST-26)' })
  @ApiResponse({ status: 200, description: 'Return story details with full traceability' })
  @ApiResponse({ status: 404, description: 'Story not found' })
  findOne(@Param('id') id: string) {
    // Support both UUID and story key (e.g., ST-26) for shareable URLs
    return this.storiesService.findOneByIdOrKey(id);
  }

  @Get(':id/token-metrics')
  @ApiOperation({ summary: 'Get aggregated token metrics for a story' })
  @ApiResponse({ status: 200, description: 'Return token usage and cost breakdown by workflow run and component' })
  @ApiResponse({ status: 404, description: 'Story not found' })
  getTokenMetrics(@Param('id') id: string) {
    return this.storiesService.getTokenMetrics(id);
  }

  @Post()
  @Roles(UserRole.admin, UserRole.pm, UserRole.ba)
  @ApiOperation({ summary: 'Create a new story (Admin, PM, BA)' })
  @ApiResponse({ status: 201, description: 'Story successfully created' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  create(@Body() createStoryDto: CreateStoryDto, @Request() req: any) {
    return this.storiesService.create(createStoryDto, req.user.id);
  }

  @Patch(':id')
  @Roles(UserRole.admin, UserRole.pm, UserRole.ba)
  @ApiOperation({ summary: 'Update story (Admin, PM, BA)' })
  @ApiResponse({ status: 200, description: 'Story successfully updated' })
  @ApiResponse({ status: 404, description: 'Story not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  update(@Param('id') id: string, @Body() updateStoryDto: UpdateStoryDto) {
    return this.storiesService.update(id, updateStoryDto);
  }

  @Patch(':id/status')
  @Roles(UserRole.admin, UserRole.pm, UserRole.ba, UserRole.architect, UserRole.dev)
  @ApiOperation({ summary: 'Update story status with workflow validation' })
  @ApiResponse({ status: 200, description: 'Story status updated' })
  @ApiResponse({ status: 400, description: 'Invalid status transition' })
  @ApiResponse({ status: 404, description: 'Story not found' })
  updateStatus(
    @Param('id') id: string,
    @Body() updateStatusDto: UpdateStoryStatusDto,
    @Request() req: any
  ) {
    const isAdmin = req.user.role === UserRole.admin;
    return this.storiesService.updateStatus(id, updateStatusDto, isAdmin);
  }

  @Post(':id/assign')
  @Roles(UserRole.admin, UserRole.pm)
  @ApiOperation({ summary: 'Assign story to framework (Admin, PM)' })
  @ApiResponse({ status: 200, description: 'Story assigned to framework' })
  @ApiResponse({ status: 404, description: 'Story or framework not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  assignFramework(
    @Param('id') id: string,
    @Body('frameworkId') frameworkId: string
  ) {
    return this.storiesService.assignFramework(id, frameworkId);
  }

  @Delete(':id')
  @Roles(UserRole.admin, UserRole.pm)
  @ApiOperation({ summary: 'Delete story (Admin, PM)' })
  @ApiResponse({ status: 200, description: 'Story successfully deleted' })
  @ApiResponse({ status: 404, description: 'Story not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  remove(@Param('id') id: string) {
    return this.storiesService.remove(id);
  }

  @Patch(':id/priority')
  @Roles(UserRole.admin, UserRole.pm, UserRole.ba)
  @ApiOperation({ summary: 'Update story priority (Admin, PM, BA)' })
  @ApiResponse({ status: 200, description: 'Story priority successfully updated' })
  @ApiResponse({ status: 404, description: 'Story not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  updatePriority(@Param('id') id: string, @Body('priority') priority: number) {
    return this.storiesService.updatePriority(id, priority);
  }

  @Patch(':id/epic')
  @Roles(UserRole.admin, UserRole.pm, UserRole.ba)
  @ApiOperation({ summary: 'Reassign story to different epic (Admin, PM, BA)' })
  @ApiResponse({ status: 200, description: 'Story reassigned successfully' })
  @ApiResponse({ status: 404, description: 'Story or epic not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  reassignEpic(
    @Param('id') id: string,
    @Body('epicId') epicId: string | null,
    @Body('priority') priority?: number
  ) {
    return this.storiesService.reassignEpic(id, epicId, priority);
  }

  @Post(':id/execute')
  @Roles(UserRole.admin, UserRole.pm, UserRole.dev)
  @ApiOperation({ summary: 'Execute story with a workflow/team' })
  @ApiResponse({ status: 201, description: 'Workflow run started' })
  @ApiResponse({ status: 400, description: 'Invalid workflow or story state' })
  @ApiResponse({ status: 404, description: 'Story or workflow not found' })
  @ApiResponse({ status: 409, description: 'Story already has an active workflow run' })
  execute(
    @Param('id') id: string,
    @Body('workflowId') workflowId: string,
    @Request() req: any
  ) {
    return this.storiesService.executeWithWorkflow(id, workflowId, req.user?.email || 'web-user');
  }
}
