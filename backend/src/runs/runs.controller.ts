import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateRunDto, RunResponseDto } from './dto';
import { RunsService } from './runs.service';

@ApiTags('runs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('runs')
export class RunsController {
  constructor(private readonly runsService: RunsService) {}

  @Post()
  @Roles('admin', 'pm', 'dev')
  @ApiOperation({ summary: 'Log a new agent execution run' })
  @ApiResponse({ status: 201, description: 'Run logged successfully', type: RunResponseDto })
  async create(@Body() createRunDto: CreateRunDto): Promise<RunResponseDto> {
    return this.runsService.create(createRunDto);
  }

  @Get('project/:projectId')
  @Roles('admin', 'pm', 'ba', 'architect', 'dev', 'qa', 'viewer')
  @ApiOperation({ summary: 'Get all runs for a project' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiQuery({ name: 'include', required: false, description: 'Include related entities' })
  @ApiResponse({ status: 200, description: 'Runs retrieved', type: [RunResponseDto] })
  async findByProject(
    @Param('projectId') projectId: string,
    @Query('include') include?: string,
  ): Promise<RunResponseDto[]> {
    return this.runsService.findByProject(projectId, include === 'true');
  }

  @Get('project/:projectId/statistics')
  @Roles('admin', 'pm', 'ba', 'architect', 'dev', 'qa', 'viewer')
  @ApiOperation({ summary: 'Get run statistics for a project' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved' })
  async getProjectStatistics(@Param('projectId') projectId: string) {
    return this.runsService.getProjectStatistics(projectId);
  }

  @Get('story/:storyId')
  @Roles('admin', 'pm', 'ba', 'architect', 'dev', 'qa', 'viewer')
  @ApiOperation({ summary: 'Get all runs for a story' })
  @ApiParam({ name: 'storyId', description: 'Story ID' })
  @ApiQuery({ name: 'include', required: false, description: 'Include related entities' })
  @ApiResponse({ status: 200, description: 'Runs retrieved', type: [RunResponseDto] })
  async findByStory(
    @Param('storyId') storyId: string,
    @Query('include') include?: string,
  ): Promise<RunResponseDto[]> {
    return this.runsService.findByStory(storyId, include === 'true');
  }

  @Get('story/:storyId/statistics')
  @Roles('admin', 'pm', 'ba', 'architect', 'dev', 'qa', 'viewer')
  @ApiOperation({ summary: 'Get run statistics for a story' })
  @ApiParam({ name: 'storyId', description: 'Story ID' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved' })
  async getStoryStatistics(@Param('storyId') storyId: string) {
    return this.runsService.getStoryStatistics(storyId);
  }

  @Get('framework/:frameworkId')
  @Roles('admin', 'pm', 'ba', 'architect', 'dev', 'qa', 'viewer')
  @ApiOperation({ summary: 'Get all runs for a framework' })
  @ApiParam({ name: 'frameworkId', description: 'Framework ID' })
  @ApiQuery({ name: 'include', required: false, description: 'Include related entities' })
  @ApiResponse({ status: 200, description: 'Runs retrieved', type: [RunResponseDto] })
  async findByFramework(
    @Param('frameworkId') frameworkId: string,
    @Query('include') include?: string,
  ): Promise<RunResponseDto[]> {
    return this.runsService.findByFramework(frameworkId, include === 'true');
  }

  @Get(':id')
  @Roles('admin', 'pm', 'ba', 'architect', 'dev', 'qa', 'viewer')
  @ApiOperation({ summary: 'Get a single run by ID' })
  @ApiParam({ name: 'id', description: 'Run ID' })
  @ApiResponse({ status: 200, description: 'Run retrieved', type: RunResponseDto })
  async findOne(@Param('id') id: string): Promise<RunResponseDto> {
    return this.runsService.findOne(id);
  }
}
