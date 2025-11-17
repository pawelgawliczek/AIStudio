import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CommitsService } from './commits.service';
import { LinkCommitDto, CommitResponseDto } from './dto';

@ApiTags('commits')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('commits')
export class CommitsController {
  constructor(private readonly commitsService: CommitsService) {}

  @Post('link')
  @Roles('admin', 'pm', 'dev')
  @ApiOperation({ summary: 'Link a commit to a story/epic' })
  @ApiResponse({ status: 201, description: 'Commit linked successfully', type: CommitResponseDto })
  async linkCommit(@Body() linkCommitDto: LinkCommitDto): Promise<CommitResponseDto> {
    return this.commitsService.linkCommit(linkCommitDto);
  }

  @Get('project/:projectId')
  @Roles('admin', 'pm', 'ba', 'architect', 'dev', 'qa', 'viewer')
  @ApiOperation({ summary: 'Get all commits for a project' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiQuery({ name: 'includeFiles', required: false, description: 'Include commit files' })
  @ApiResponse({ status: 200, description: 'Commits retrieved', type: [CommitResponseDto] })
  async findByProject(
    @Param('projectId') projectId: string,
    @Query('includeFiles') includeFiles?: string,
  ): Promise<CommitResponseDto[]> {
    return this.commitsService.findByProject(projectId, includeFiles === 'true');
  }

  @Get('project/:projectId/statistics')
  @Roles('admin', 'pm', 'ba', 'architect', 'dev', 'qa', 'viewer')
  @ApiOperation({ summary: 'Get commit statistics for a project' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved' })
  async getProjectStatistics(@Param('projectId') projectId: string) {
    return this.commitsService.getProjectStatistics(projectId);
  }

  @Get('story/:storyId')
  @Roles('admin', 'pm', 'ba', 'architect', 'dev', 'qa', 'viewer')
  @ApiOperation({ summary: 'Get all commits for a story' })
  @ApiParam({ name: 'storyId', description: 'Story ID' })
  @ApiQuery({ name: 'includeFiles', required: false, description: 'Include commit files' })
  @ApiResponse({ status: 200, description: 'Commits retrieved', type: [CommitResponseDto] })
  async findByStory(
    @Param('storyId') storyId: string,
    @Query('includeFiles') includeFiles?: string,
  ): Promise<CommitResponseDto[]> {
    return this.commitsService.findByStory(storyId, includeFiles === 'true');
  }

  @Get('story/:storyId/statistics')
  @Roles('admin', 'pm', 'ba', 'architect', 'dev', 'qa', 'viewer')
  @ApiOperation({ summary: 'Get commit statistics for a story' })
  @ApiParam({ name: 'storyId', description: 'Story ID' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved' })
  async getStoryStatistics(@Param('storyId') storyId: string) {
    return this.commitsService.getStoryStatistics(storyId);
  }

  @Get('epic/:epicId')
  @Roles('admin', 'pm', 'ba', 'architect', 'dev', 'qa', 'viewer')
  @ApiOperation({ summary: 'Get all commits for an epic' })
  @ApiParam({ name: 'epicId', description: 'Epic ID' })
  @ApiQuery({ name: 'includeFiles', required: false, description: 'Include commit files' })
  @ApiResponse({ status: 200, description: 'Commits retrieved', type: [CommitResponseDto] })
  async findByEpic(
    @Param('epicId') epicId: string,
    @Query('includeFiles') includeFiles?: string,
  ): Promise<CommitResponseDto[]> {
    return this.commitsService.findByEpic(epicId, includeFiles === 'true');
  }

  @Get(':hash')
  @Roles('admin', 'pm', 'ba', 'architect', 'dev', 'qa', 'viewer')
  @ApiOperation({ summary: 'Get a single commit by hash' })
  @ApiParam({ name: 'hash', description: 'Commit hash (SHA-1)' })
  @ApiResponse({ status: 200, description: 'Commit retrieved', type: CommitResponseDto })
  async findOne(@Param('hash') hash: string): Promise<CommitResponseDto> {
    return this.commitsService.findOne(hash);
  }
}
