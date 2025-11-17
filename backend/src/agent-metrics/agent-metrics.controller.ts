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
import {
  GetFrameworkMetricsDto,
  FrameworkComparisonResponseDto,
  GetWeeklyMetricsDto,
  WeeklyAnalysisResponseDto,
  GetStoryExecutionDetailsDto,
  StoryExecutionDetailsResponseDto,
  GetPerAgentMetricsDto,
  PerAgentAnalyticsResponseDto,
  ComplexityBand,
  DateRange,
  ComparisonBaseline,
  // ST-27 Workflow Metrics
  GetWorkflowMetricsDto,
  WorkflowMetricsResponseDto,
  AggregationLevel,
  WorkflowComparisonResponseDto,
} from './dto';

@ApiTags('Agent Metrics')
@ApiBearerAuth()
@Controller('agent-metrics')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AgentMetricsController {
  private readonly logger = new Logger(AgentMetricsController.name);

  constructor(private readonly agentMetricsService: AgentMetricsService) {}

  @Get('framework-comparison')
  @Roles('admin', 'pm', 'architect', 'viewer')
  @ApiOperation({
    summary: 'Get framework comparison metrics',
    description:
      'Compare multiple agentic frameworks with complexity normalization. Returns efficiency, quality, and cost metrics for side-by-side comparison.',
  })
  @ApiQuery({ name: 'projectId', required: true, type: String })
  @ApiQuery({
    name: 'frameworkIds',
    required: true,
    type: [String],
    description: 'Comma-separated framework IDs',
  })
  @ApiQuery({
    name: 'complexityBand',
    required: false,
    enum: ComplexityBand,
    description: 'Filter by complexity band for fair comparison',
  })
  @ApiQuery({
    name: 'dateRange',
    required: false,
    enum: DateRange,
    description: 'Date range filter',
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
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Framework comparison metrics returned successfully',
    type: FrameworkComparisonResponseDto,
  })
  @HttpCode(HttpStatus.OK)
  async getFrameworkComparison(
    @Query('projectId') projectId: string,
    @Query('frameworkIds') frameworkIds: string,
    @Query('complexityBand') complexityBand?: ComplexityBand,
    @Query('dateRange') dateRange?: DateRange,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<FrameworkComparisonResponseDto> {
    this.logger.log(`GET /agent-metrics/framework-comparison`);

    const dto: GetFrameworkMetricsDto = {
      projectId,
      frameworkIds: frameworkIds.split(',').map((id) => id.trim()),
      complexityBand: complexityBand || ComplexityBand.ALL,
      dateRange: dateRange || DateRange.LAST_30_DAYS,
      startDate,
      endDate,
    };

    return this.agentMetricsService.getFrameworkComparison(dto);
  }

  @Get('weekly-analysis')
  @Roles('admin', 'pm', 'architect', 'viewer')
  @ApiOperation({
    summary: 'Get week-over-week performance analysis',
    description:
      'Analyze framework performance trends over multiple weeks. Shows velocity, quality, and efficiency metrics per week.',
  })
  @ApiQuery({ name: 'projectId', required: true, type: String })
  @ApiQuery({ name: 'frameworkId', required: false, type: String })
  @ApiQuery({
    name: 'weekCount',
    required: false,
    type: Number,
    description: 'Number of weeks to analyze (default: 8)',
  })
  @ApiQuery({
    name: 'complexityBand',
    required: false,
    enum: ComplexityBand,
  })
  @ApiQuery({
    name: 'baseline',
    required: false,
    enum: ComparisonBaseline,
    description: 'Comparison baseline for week analysis',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Weekly analysis returned successfully',
    type: WeeklyAnalysisResponseDto,
  })
  @HttpCode(HttpStatus.OK)
  async getWeeklyAnalysis(
    @Query('projectId') projectId: string,
    @Query('frameworkId') frameworkId?: string,
    @Query('weekCount') weekCount?: number,
    @Query('complexityBand') complexityBand?: ComplexityBand,
    @Query('baseline') baseline?: ComparisonBaseline,
  ): Promise<WeeklyAnalysisResponseDto> {
    this.logger.log(`GET /agent-metrics/weekly-analysis`);

    const dto: GetWeeklyMetricsDto = {
      projectId,
      frameworkId,
      weekCount: weekCount || 8,
      complexityBand: complexityBand || ComplexityBand.ALL,
      baseline: baseline || ComparisonBaseline.PROJECT_AVERAGE,
    };

    return this.agentMetricsService.getWeeklyAnalysis(dto);
  }

  @Get('story-execution')
  @Roles('admin', 'pm', 'architect', 'dev', 'viewer')
  @ApiOperation({
    summary: 'Get per-story agent execution details',
    description:
      'View detailed timeline of all agent executions for a specific story. Shows tokens, LOC, runtime, and metrics for each agent run.',
  })
  @ApiQuery({ name: 'storyId', required: true, type: String })
  @ApiQuery({
    name: 'includeCommits',
    required: false,
    type: Boolean,
    description: 'Include commit details (default: true)',
  })
  @ApiQuery({
    name: 'includeFileChanges',
    required: false,
    type: Boolean,
    description: 'Include file change details (default: true)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Story execution details returned successfully',
    type: StoryExecutionDetailsResponseDto,
  })
  @HttpCode(HttpStatus.OK)
  async getStoryExecutionDetails(
    @Query('storyId') storyId: string,
    @Query('includeCommits') includeCommits?: boolean,
    @Query('includeFileChanges') includeFileChanges?: boolean,
  ): Promise<StoryExecutionDetailsResponseDto> {
    this.logger.log(`GET /agent-metrics/story-execution`);

    const dto: GetStoryExecutionDetailsDto = {
      storyId,
      includeCommits: includeCommits !== false,
      includeFileChanges: includeFileChanges !== false,
    };

    return this.agentMetricsService.getStoryExecutionDetails(dto);
  }

  @Get('per-agent-analytics')
  @Roles('admin', 'pm', 'architect', 'viewer')
  @ApiOperation({
    summary: 'Get per-agent efficiency analytics',
    description:
      'Compare agent performance across frameworks. Shows tokens/LOC, LOC/prompt, runtime, and cost breakdown per agent role.',
  })
  @ApiQuery({ name: 'projectId', required: true, type: String })
  @ApiQuery({
    name: 'frameworkIds',
    required: true,
    type: [String],
    description: 'Comma-separated framework IDs',
  })
  @ApiQuery({
    name: 'complexityBand',
    required: false,
    enum: ComplexityBand,
  })
  @ApiQuery({
    name: 'dateRange',
    required: false,
    enum: DateRange,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Per-agent analytics returned successfully',
    type: PerAgentAnalyticsResponseDto,
  })
  @HttpCode(HttpStatus.OK)
  async getPerAgentAnalytics(
    @Query('projectId') projectId: string,
    @Query('frameworkIds') frameworkIds: string,
    @Query('complexityBand') complexityBand?: ComplexityBand,
    @Query('dateRange') dateRange?: DateRange,
  ): Promise<PerAgentAnalyticsResponseDto> {
    this.logger.log(`GET /agent-metrics/per-agent-analytics`);

    const dto: GetPerAgentMetricsDto = {
      projectId,
      frameworkIds: frameworkIds.split(',').map((id) => id.trim()),
      complexityBand: complexityBand || ComplexityBand.MEDIUM,
      dateRange: dateRange || DateRange.LAST_30_DAYS,
    };

    return this.agentMetricsService.getPerAgentAnalytics(dto);
  }

  @Get('project-summary')
  @Roles('admin', 'pm', 'architect', 'viewer')
  @ApiOperation({
    summary: 'Get project-level metrics summary',
    description:
      'High-level overview of all frameworks, stories, and metrics for a project.',
  })
  @ApiQuery({ name: 'projectId', required: true, type: String })
  @ApiQuery({
    name: 'dateRange',
    required: false,
    enum: DateRange,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Project summary returned successfully',
  })
  @HttpCode(HttpStatus.OK)
  async getProjectSummary(
    @Query('projectId') projectId: string,
    @Query('dateRange') dateRange?: DateRange,
  ) {
    this.logger.log(`GET /agent-metrics/project-summary`);

    // This would be a simplified view combining multiple metrics
    // For now, delegate to framework comparison with all frameworks
    const project = await this.agentMetricsService['prisma'].project.findUnique(
      {
        where: { id: projectId },
        include: {
          frameworks: true,
        },
      },
    );

    if (!project) {
      return { error: 'Project not found' };
    }

    const frameworkIds = project.frameworks.map((f) => f.id);

    if (frameworkIds.length === 0) {
      return {
        projectId,
        projectName: project.name,
        message: 'No frameworks configured for this project',
      };
    }

    const dto: GetFrameworkMetricsDto = {
      projectId,
      frameworkIds,
      complexityBand: ComplexityBand.ALL,
      dateRange: dateRange || DateRange.LAST_30_DAYS,
    };

    return this.agentMetricsService.getFrameworkComparison(dto);
  }

  @Get('velocity-score/:projectId')
  @Roles('admin', 'pm', 'architect', 'viewer')
  @ApiOperation({
    summary: 'Get velocity score breakdown for a project or week',
    description:
      'Calculate and break down the velocity score (0-100) showing throughput, quality, and efficiency components.',
  })
  @ApiQuery({
    name: 'weekNumber',
    required: false,
    type: Number,
    description: 'Specific week number to analyze',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Velocity score breakdown returned successfully',
  })
  @HttpCode(HttpStatus.OK)
  async getVelocityScore(
    @Query('projectId') projectId: string,
    @Query('weekNumber') weekNumber?: number,
  ) {
    this.logger.log(`GET /agent-metrics/velocity-score/${projectId}`);

    // This would calculate the velocity score based on throughput, quality, and efficiency
    // For now, return a mock structure
    return {
      projectId,
      weekNumber,
      totalScore: 85,
      grade: 'B+',
      breakdown: {
        throughput: { score: 35, max: 40 },
        quality: { score: 36, max: 40 },
        efficiency: { score: 14, max: 20 },
      },
      generatedAt: new Date().toISOString(),
    };
  }

  // ========== ST-27 Workflow Metrics Endpoints ==========

  @Get('workflow-metrics')
  @Roles('admin', 'pm', 'architect', 'viewer')
  @ApiOperation({
    summary: 'Get comprehensive workflow metrics with multi-level aggregation',
    description:
      'Returns all KPIs including tokens (in/out/cached), prompts, interactions, LOC, tests, cost, and efficiency ratios. Supports aggregation by workflow, story, epic, or agent.',
  })
  @ApiQuery({ name: 'projectId', required: true, type: String })
  @ApiQuery({
    name: 'workflowId',
    required: false,
    type: String,
    description: 'Filter by specific workflow',
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
    name: 'aggregateBy',
    required: false,
    enum: AggregationLevel,
    description: 'Aggregation level: workflow, story, epic, agent',
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
    description: 'Workflow metrics returned successfully',
    type: WorkflowMetricsResponseDto,
  })
  @HttpCode(HttpStatus.OK)
  async getWorkflowMetrics(
    @Query('projectId') projectId: string,
    @Query('workflowId') workflowId?: string,
    @Query('dateRange') dateRange?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('aggregateBy') aggregateBy?: AggregationLevel,
    @Query('businessComplexityMin') businessComplexityMin?: number,
    @Query('businessComplexityMax') businessComplexityMax?: number,
    @Query('technicalComplexityMin') technicalComplexityMin?: number,
    @Query('technicalComplexityMax') technicalComplexityMax?: number,
  ): Promise<WorkflowMetricsResponseDto> {
    this.logger.log(`GET /agent-metrics/workflow-metrics`);

    const dto: GetWorkflowMetricsDto = {
      projectId,
      workflowId,
      dateRange,
      startDate,
      endDate,
      aggregateBy,
      businessComplexityMin: businessComplexityMin
        ? Number(businessComplexityMin)
        : undefined,
      businessComplexityMax: businessComplexityMax
        ? Number(businessComplexityMax)
        : undefined,
      technicalComplexityMin: technicalComplexityMin
        ? Number(technicalComplexityMin)
        : undefined,
      technicalComplexityMax: technicalComplexityMax
        ? Number(technicalComplexityMax)
        : undefined,
    };

    return this.agentMetricsService.getWorkflowMetrics(dto);
  }

  @Get('workflow-comparison')
  @Roles('admin', 'pm', 'architect', 'viewer')
  @ApiOperation({
    summary: 'Compare two workflows side by side',
    description:
      'Returns detailed comparison of two workflows including percentage differences in tokens/LOC, cost/story, duration, and defects. Generates insights and recommendations.',
  })
  @ApiQuery({ name: 'projectId', required: true, type: String })
  @ApiQuery({
    name: 'workflow1Id',
    required: true,
    type: String,
    description: 'First workflow ID',
  })
  @ApiQuery({
    name: 'workflow2Id',
    required: true,
    type: String,
    description: 'Second workflow ID',
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
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Workflow comparison returned successfully',
    type: WorkflowComparisonResponseDto,
  })
  @HttpCode(HttpStatus.OK)
  async compareWorkflows(
    @Query('projectId') projectId: string,
    @Query('workflow1Id') workflow1Id: string,
    @Query('workflow2Id') workflow2Id: string,
    @Query('dateRange') dateRange?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<WorkflowComparisonResponseDto> {
    this.logger.log(`GET /agent-metrics/workflow-comparison`);

    return this.agentMetricsService.compareWorkflows(
      projectId,
      workflow1Id,
      workflow2Id,
      dateRange,
      startDate,
      endDate,
    );
  }

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
}

