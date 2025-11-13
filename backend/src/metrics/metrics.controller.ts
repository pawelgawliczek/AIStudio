import {
  Controller,
  Get,
  Post,
  Query,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { MetricsService } from './metrics.service';
import { MetricsQueryDto, WorkflowComparisonDto } from './dto/metrics-query.dto';
import {
  WorkflowMetricsDto,
  ComponentMetricsDto,
  TrendsResponseDto,
  WorkflowComparisonResponseDto,
  WeeklyAggregationDto,
} from './dto/aggregated-metrics.dto';

@Controller('projects/:projectId/metrics')
@UseGuards(AuthGuard('jwt'))
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  /**
   * GET /api/projects/:projectId/metrics/workflows
   * Get aggregated workflow performance metrics
   */
  @Get('workflows')
  async getWorkflowMetrics(
    @Param('projectId') projectId: string,
    @Query() query: MetricsQueryDto,
  ): Promise<WorkflowMetricsDto[]> {
    return this.metricsService.getWorkflowMetrics(projectId, query);
  }

  /**
   * GET /api/projects/:projectId/metrics/components
   * Get aggregated component performance metrics
   */
  @Get('components')
  async getComponentMetrics(
    @Param('projectId') projectId: string,
    @Query() query: MetricsQueryDto,
  ): Promise<ComponentMetricsDto[]> {
    return this.metricsService.getComponentMetrics(projectId, query);
  }

  /**
   * GET /api/projects/:projectId/metrics/trends
   * Get time-series trends for key metrics
   */
  @Get('trends')
  async getTrends(
    @Param('projectId') projectId: string,
    @Query() query: MetricsQueryDto,
  ): Promise<TrendsResponseDto[]> {
    return this.metricsService.getTrends(projectId, query);
  }

  /**
   * POST /api/projects/:projectId/metrics/comparisons
   * Compare two workflows
   */
  @Post('comparisons')
  @HttpCode(HttpStatus.OK)
  async compareWorkflows(
    @Param('projectId') projectId: string,
    @Body() comparison: WorkflowComparisonDto,
  ): Promise<WorkflowComparisonResponseDto> {
    return this.metricsService.compareWorkflows(projectId, comparison);
  }

  /**
   * GET /api/projects/:projectId/metrics/weekly
   * Get weekly aggregations for the last N weeks
   */
  @Get('weekly')
  async getWeeklyAggregations(
    @Param('projectId') projectId: string,
    @Query('weeks') weeks?: string,
    @Query('businessComplexity') businessComplexity?: string,
    @Query('technicalComplexity') technicalComplexity?: string,
  ): Promise<WeeklyAggregationDto[]> {
    const numWeeks = weeks ? parseInt(weeks, 10) : 8;
    const query = {
      businessComplexity: businessComplexity ? parseInt(businessComplexity, 10) : undefined,
      technicalComplexity: technicalComplexity ? parseInt(technicalComplexity, 10) : undefined,
    };
    return this.metricsService.getWeeklyAggregations(projectId, numWeeks, query);
  }
}
