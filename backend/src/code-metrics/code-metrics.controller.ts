import { Controller, Get, Post, Param, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CodeMetricsService } from './code-metrics.service';
import {
  ProjectMetricsDto,
  FileHotspotDto,
  FileDetailDto,
  CodeIssueDto,
  TrendDataPointDto,
  FolderNodeDto,
  CoverageGapDto,
} from './dto';
import { QueryMetricsDto, GetHotspotsDto } from './dto/query-metrics.dto';

@ApiTags('code-metrics')
@Controller('code-metrics')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class CodeMetricsController {
  constructor(private readonly codeMetricsService: CodeMetricsService) {}

  @Get('project/:projectId')
  @Roles('admin', 'pm', 'architect', 'dev', 'qa')
  @ApiOperation({ summary: 'Get project-level code quality metrics' })
  @ApiResponse({ status: 200, type: ProjectMetricsDto })
  async getProjectMetrics(
    @Param('projectId') projectId: string,
    @Query() query: QueryMetricsDto,
  ): Promise<ProjectMetricsDto> {
    return this.codeMetricsService.getProjectMetrics(projectId, query);
  }

  @Get('project/:projectId/hotspots')
  @Roles('admin', 'pm', 'architect', 'dev')
  @ApiOperation({ summary: 'Get file hotspots (high-risk files)' })
  @ApiResponse({ status: 200, type: [FileHotspotDto] })
  async getFileHotspots(
    @Param('projectId') projectId: string,
    @Query() query: GetHotspotsDto,
  ): Promise<FileHotspotDto[]> {
    return this.codeMetricsService.getFileHotspots(projectId, query);
  }

  @Get('project/:projectId/trends')
  @Roles('admin', 'pm', 'architect', 'dev', 'qa')
  @ApiOperation({ summary: 'Get trend data for charts' })
  @ApiResponse({ status: 200, type: [TrendDataPointDto] })
  async getTrendData(
    @Param('projectId') projectId: string,
    @Query('days') days?: number,
  ): Promise<TrendDataPointDto[]> {
    return this.codeMetricsService.getTrendData(projectId, days || 30);
  }

  @Get('project/:projectId/issues')
  @Roles('admin', 'pm', 'architect', 'dev')
  @ApiOperation({ summary: 'Get code quality issues summary' })
  @ApiResponse({ status: 200, type: [CodeIssueDto] })
  async getCodeIssues(@Param('projectId') projectId: string): Promise<CodeIssueDto[]> {
    return this.codeMetricsService.getCodeIssues(projectId);
  }

  @Get('file/:projectId')
  @Roles('admin', 'architect', 'dev')
  @ApiOperation({ summary: 'Get detailed metrics for a specific file' })
  @ApiResponse({ status: 200, type: FileDetailDto })
  async getFileDetail(
    @Param('projectId') projectId: string,
    @Query('filePath') filePath: string,
  ): Promise<FileDetailDto> {
    return this.codeMetricsService.getFileDetail(projectId, filePath);
  }

  @Post('project/:projectId/analyze')
  @HttpCode(HttpStatus.ACCEPTED)
  @Roles('admin', 'pm', 'architect')
  @ApiOperation({ summary: 'Trigger full code analysis for project' })
  @ApiResponse({
    status: 202,
    description: 'Analysis job started',
    schema: {
      type: 'object',
      properties: {
        jobId: { type: 'string' },
        status: { type: 'string' },
        message: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Project not found' })
  @ApiResponse({ status: 400, description: 'Project has no repository path configured' })
  @ApiResponse({ status: 409, description: 'Analysis already running for this project' })
  async triggerAnalysis(
    @Param('projectId') projectId: string,
  ): Promise<{ jobId: string; status: string; message: string }> {
    return this.codeMetricsService.triggerAnalysis(projectId);
  }

  @Get('project/:projectId/hierarchy')
  @Roles('admin', 'pm', 'architect', 'dev', 'qa')
  @ApiOperation({ summary: 'Get hierarchical folder structure with aggregated metrics' })
  @ApiResponse({ status: 200, type: FolderNodeDto })
  async getFolderHierarchy(
    @Param('projectId') projectId: string,
  ): Promise<FolderNodeDto> {
    return this.codeMetricsService.getFolderHierarchy(projectId);
  }

  @Get('project/:projectId/coverage-gaps')
  @Roles('admin', 'pm', 'architect', 'dev')
  @ApiOperation({ summary: 'Get prioritized list of files that need test coverage' })
  @ApiResponse({ status: 200, type: [CoverageGapDto] })
  async getCoverageGaps(
    @Param('projectId') projectId: string,
    @Query('limit') limit?: number,
  ): Promise<CoverageGapDto[]> {
    return this.codeMetricsService.getCoverageGaps(projectId, limit || 20);
  }

  @Get('project/:projectId/analysis-status')
  @Roles('admin', 'pm', 'architect', 'dev', 'qa')
  @ApiOperation({ summary: 'Get status of ongoing or recent code analysis job' })
  @ApiResponse({
    status: 200,
    description: 'Analysis job status',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['queued', 'running', 'completed', 'failed', 'not_found'] },
        progress: { type: 'number' },
        message: { type: 'string' },
        startedAt: { type: 'string', format: 'date-time' },
        completedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  async getAnalysisStatus(
    @Param('projectId') projectId: string,
  ): Promise<{
    status: 'queued' | 'running' | 'completed' | 'failed' | 'not_found';
    progress?: number;
    message?: string;
    startedAt?: Date;
    completedAt?: Date;
  }> {
    return this.codeMetricsService.getAnalysisStatus(projectId);
  }

  @Get('project/:projectId/comparison')
  @Roles('admin', 'pm', 'architect', 'dev', 'qa')
  @ApiOperation({ summary: 'Get comparison between current and previous analysis' })
  @ApiResponse({
    status: 200,
    description: 'Analysis comparison data',
    schema: {
      type: 'object',
      properties: {
        healthScoreChange: { type: 'number' },
        newTests: { type: 'number' },
        coverageChange: { type: 'number' },
        complexityChange: { type: 'number' },
        newFiles: { type: 'number' },
        deletedFiles: { type: 'number' },
        qualityImprovement: { type: 'boolean' },
        lastAnalysis: { type: 'string', format: 'date-time' },
      },
    },
  })
  async getAnalysisComparison(
    @Param('projectId') projectId: string,
  ): Promise<{
    healthScoreChange: number;
    newTests: number;
    coverageChange: number;
    complexityChange: number;
    newFiles: number;
    deletedFiles: number;
    qualityImprovement: boolean;
    lastAnalysis?: Date;
  }> {
    return this.codeMetricsService.getAnalysisComparison(projectId);
  }

  @Get('project/:projectId/test-summary')
  @Roles('admin', 'pm', 'architect', 'dev', 'qa')
  @ApiOperation({ summary: 'Get test execution summary (pass/fail/skip counts)' })
  @ApiResponse({
    status: 200,
    description: 'Test execution summary',
    schema: {
      type: 'object',
      properties: {
        totalTests: { type: 'number' },
        passing: { type: 'number' },
        failing: { type: 'number' },
        skipped: { type: 'number' },
        lastExecution: { type: 'string', format: 'date-time' },
      },
    },
  })
  async getTestSummary(
    @Param('projectId') projectId: string,
  ): Promise<{
    totalTests: number;
    passing: number;
    failing: number;
    skipped: number;
    lastExecution?: Date;
  }> {
    return this.codeMetricsService.getTestSummary(projectId);
  }
}
