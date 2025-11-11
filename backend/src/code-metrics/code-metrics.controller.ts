import { Controller, Get, Post, Param, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CodeMetricsService } from './code-metrics.service';
import {
  ProjectMetricsDto,
  LayerMetricsDto,
  ComponentMetricsDto,
  FileHotspotDto,
  FileDetailDto,
  CodeIssueDto,
  TrendDataPointDto,
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

  @Get('project/:projectId/layers')
  @Roles('admin', 'pm', 'architect', 'dev', 'qa')
  @ApiOperation({ summary: 'Get layer-level metrics (frontend, backend, infra, test)' })
  @ApiResponse({ status: 200, type: [LayerMetricsDto] })
  async getLayerMetrics(
    @Param('projectId') projectId: string,
    @Query() query: QueryMetricsDto,
  ): Promise<LayerMetricsDto[]> {
    return this.codeMetricsService.getLayerMetrics(projectId, query);
  }

  @Get('project/:projectId/components')
  @Roles('admin', 'pm', 'architect', 'dev', 'qa')
  @ApiOperation({ summary: 'Get component-level metrics' })
  @ApiResponse({ status: 200, type: [ComponentMetricsDto] })
  async getComponentMetrics(
    @Param('projectId') projectId: string,
    @Query() query: QueryMetricsDto,
  ): Promise<ComponentMetricsDto[]> {
    return this.codeMetricsService.getComponentMetrics(projectId, query);
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
}
