import {
  Controller,
  Get,
  Query,
  UseGuards,
  Logger,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AgentMetricsService } from './agent-metrics.service';
import { KpiHistoryService } from './services/kpi-history.service';

@ApiTags('Agent Metrics')
@ApiBearerAuth()
@Controller('agent-metrics')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AgentMetricsController {
  private readonly logger = new Logger(AgentMetricsController.name);

  constructor(
    private readonly agentMetricsService: AgentMetricsService,
    private readonly kpiHistoryService: KpiHistoryService,
  ) {}

  @Get('performance-dashboard')
  @Roles('admin', 'pm', 'architect', 'viewer')
  @ApiOperation({
    summary: 'Get performance dashboard trends and KPIs',
    description:
      'Returns KPIs with change percentages and daily trend data for charting. Supports workflow filtering where selected workflows show as solid line and all workflows as dotted line.',
  })
  @ApiQuery({ name: 'projectId', required: true, type: String })
  @ApiQuery({
    name: 'workflowIds',
    required: false,
    type: String,
    description: 'Comma-separated workflow IDs to filter (empty = all workflows)',
  })
  @ApiQuery({
    name: 'dateRange',
    required: false,
    type: String,
    description: 'Date range: week, month, quarter, custom',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: String,
    description: 'Custom start date (ISO format)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: String,
    description: 'Custom end date (ISO format)',
  })
  @ApiQuery({
    name: 'businessComplexityMin',
    required: false,
    type: Number,
    description: 'Minimum business complexity (1-10)',
  })
  @ApiQuery({
    name: 'businessComplexityMax',
    required: false,
    type: Number,
    description: 'Maximum business complexity (1-10)',
  })
  @ApiQuery({
    name: 'technicalComplexityMin',
    required: false,
    type: Number,
    description: 'Minimum technical complexity (1-10)',
  })
  @ApiQuery({
    name: 'technicalComplexityMax',
    required: false,
    type: Number,
    description: 'Maximum technical complexity (1-10)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Performance dashboard data returned successfully',
  })
  @HttpCode(HttpStatus.OK)
  async getPerformanceDashboard(
    @Query('projectId') projectId: string,
    @Query('workflowIds') workflowIds?: string,
    @Query('dateRange') dateRange?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('businessComplexityMin') businessComplexityMin?: number,
    @Query('businessComplexityMax') businessComplexityMax?: number,
    @Query('technicalComplexityMin') technicalComplexityMin?: number,
    @Query('technicalComplexityMax') technicalComplexityMax?: number,
  ) {
    this.logger.log(`GET /agent-metrics/performance-dashboard`);

    const params = {
      projectId,
      workflowIds: workflowIds ? workflowIds.split(',').map((id) => id.trim()) : undefined,
      dateRange,
      startDate,
      endDate,
      businessComplexityMin: businessComplexityMin ? Number(businessComplexityMin) : undefined,
      businessComplexityMax: businessComplexityMax ? Number(businessComplexityMax) : undefined,
      technicalComplexityMin: technicalComplexityMin ? Number(technicalComplexityMin) : undefined,
      technicalComplexityMax: technicalComplexityMax ? Number(technicalComplexityMax) : undefined,
    };

    return this.agentMetricsService.getPerformanceDashboardTrends(params);
  }

  @Get('workflow-details')
  @Roles('admin', 'pm', 'architect', 'viewer')
  @ApiOperation({
    summary: 'Get detailed metrics for one or two workflows',
    description:
      'Returns comprehensive KPIs for workflow comparison including execution metrics, token/cost metrics, code generation stats, cache metrics, and quality indicators.',
  })
  @ApiQuery({ name: 'projectId', required: true, type: String })
  @ApiQuery({ name: 'workflowAId', required: true, type: String })
  @ApiQuery({ name: 'workflowBId', required: false, type: String })
  @ApiQuery({ name: 'businessComplexity', required: false, type: String })
  @ApiQuery({ name: 'technicalComplexity', required: false, type: String })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Workflow details returned successfully',
  })
  @HttpCode(HttpStatus.OK)
  async getWorkflowDetails(
    @Query('projectId') projectId: string,
    @Query('workflowAId') workflowAId: string,
    @Query('workflowBId') workflowBId?: string,
    @Query('businessComplexity') businessComplexity?: string,
    @Query('technicalComplexity') technicalComplexity?: string,
  ) {
    this.logger.log(`GET /agent-metrics/workflow-details for workflow ${workflowAId}`);

    return this.agentMetricsService.getWorkflowDetails({
      projectId,
      workflowAId,
      workflowBId,
      businessComplexity: businessComplexity || 'all',
      technicalComplexity: technicalComplexity || 'all',
    });
  }

  @Get('kpi-history')
  @Roles('admin', 'pm', 'architect', 'viewer')
  @ApiOperation({
    summary: 'Get KPI history for trend charts',
    description:
      'Returns daily trend data for a specific KPI metric over the specified time range. Used for the trend charts in workflow details modal.',
  })
  @ApiQuery({ name: 'workflowId', required: true, type: String })
  @ApiQuery({ name: 'kpiName', required: true, type: String })
  @ApiQuery({ name: 'days', required: false, type: Number, description: 'Number of days to fetch (default: 30)' })
  @ApiQuery({ name: 'businessComplexityMin', required: false, type: Number })
  @ApiQuery({ name: 'businessComplexityMax', required: false, type: Number })
  @ApiQuery({ name: 'technicalComplexityMin', required: false, type: Number })
  @ApiQuery({ name: 'technicalComplexityMax', required: false, type: Number })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'KPI history returned successfully',
  })
  @HttpCode(HttpStatus.OK)
  async getKpiHistory(
    @Query('workflowId') workflowId: string,
    @Query('kpiName') kpiName: string,
    @Query('days') days?: number,
    @Query('businessComplexityMin') businessComplexityMin?: number,
    @Query('businessComplexityMax') businessComplexityMax?: number,
    @Query('technicalComplexityMin') technicalComplexityMin?: number,
    @Query('technicalComplexityMax') technicalComplexityMax?: number,
  ) {
    this.logger.log(`GET /agent-metrics/kpi-history for workflow ${workflowId}, metric: ${kpiName}`);

    const params: any = {
      workflowId,
      kpiName,
      days: days ? Number(days) : undefined,
    };

    if (businessComplexityMin !== undefined && businessComplexityMax !== undefined) {
      params.businessComplexity = [Number(businessComplexityMin), Number(businessComplexityMax)];
    }

    if (technicalComplexityMin !== undefined && technicalComplexityMax !== undefined) {
      params.technicalComplexity = [Number(technicalComplexityMin), Number(technicalComplexityMax)];
    }

    return this.kpiHistoryService.getKpiHistory(params);
  }
}
