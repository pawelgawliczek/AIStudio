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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
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
}
