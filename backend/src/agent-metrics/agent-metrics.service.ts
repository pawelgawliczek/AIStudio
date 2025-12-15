import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  GetFrameworkMetricsDto,
  FrameworkComparisonResponseDto,
  GetWorkflowMetricsDto,
  WorkflowMetricsResponseDto,
  WorkflowComparisonResponseDto,
  GetStoryExecutionDetailsDto,
  StoryExecutionDetailsResponseDto,
  GetPerAgentMetricsDto,
  PerAgentAnalyticsResponseDto,
  GetWeeklyMetricsDto,
  WeeklyAnalysisResponseDto,
} from './dto/metrics.dto';
import { FrameworkMetricsService } from './services/framework-metrics.service';
import { WorkflowMetricsService } from './services/workflow-metrics.service';
import { DashboardMetricsService } from './services/dashboard-metrics.service';
import { StoryMetricsService } from './services/story-metrics.service';

/**
 * AgentMetricsService - Facade for agent metrics functionality
 *
 * This service acts as a facade, delegating to specialized services:
 * - FrameworkMetricsService: Framework comparison and analysis
 * - WorkflowMetricsService: Workflow metrics and comparisons
 * - DashboardMetricsService: Performance dashboard trends
 * - StoryMetricsService: Story execution details and analytics
 */
@Injectable()
export class AgentMetricsService {
  private readonly logger = new Logger(AgentMetricsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly frameworkMetricsService: FrameworkMetricsService,
    private readonly workflowMetricsService: WorkflowMetricsService,
    private readonly dashboardMetricsService: DashboardMetricsService,
    private readonly storyMetricsService: StoryMetricsService,
  ) {}

  /**
   * Get framework comparison metrics with complexity normalization
   */
  async getFrameworkComparison(
    dto: GetFrameworkMetricsDto,
  ): Promise<FrameworkComparisonResponseDto> {
    return this.frameworkMetricsService.getFrameworkComparison(dto);
  }

  /**
   * Get weekly metrics analysis
   */
  async getWeeklyAnalysis(
    dto: GetWeeklyMetricsDto,
  ): Promise<WeeklyAnalysisResponseDto> {
    return this.storyMetricsService.getWeeklyAnalysis(dto);
  }

  /**
   * Get per-story execution details
   */
  async getStoryExecutionDetails(
    dto: GetStoryExecutionDetailsDto,
  ): Promise<StoryExecutionDetailsResponseDto> {
    return this.storyMetricsService.getStoryExecutionDetails(dto);
  }

  /**
   * Get per-agent analytics
   */
  async getPerAgentAnalytics(
    dto: GetPerAgentMetricsDto,
  ): Promise<PerAgentAnalyticsResponseDto> {
    return this.storyMetricsService.getPerAgentAnalytics(dto);
  }

  /**
   * ST-27: Get comprehensive workflow metrics with multi-level aggregation
   */
  async getWorkflowMetrics(
    dto: GetWorkflowMetricsDto,
  ): Promise<WorkflowMetricsResponseDto> {
    return this.workflowMetricsService.getWorkflowMetrics(dto);
  }

  /**
   * Compare two workflows side by side
   */
  async compareWorkflows(
    projectId: string,
    workflow1Id: string,
    workflow2Id: string,
    dateRange?: string,
    startDate?: string,
    endDate?: string,
  ): Promise<WorkflowComparisonResponseDto> {
    return this.workflowMetricsService.compareWorkflows(
      projectId,
      workflow1Id,
      workflow2Id,
      dateRange,
      startDate,
      endDate,
    );
  }

  /**
   * Get performance dashboard trends for charting
   */
  async getPerformanceDashboardTrends(params: {
    projectId: string;
    workflowIds?: string[];
    dateRange?: string;
    startDate?: string;
    endDate?: string;
    businessComplexityMin?: number;
    businessComplexityMax?: number;
    technicalComplexityMin?: number;
    technicalComplexityMax?: number;
  }): Promise<{
    kpis: {
      storiesImplemented: number;
      storiesChange: number;
      tokensPerLOC: number;
      tokensPerLOCChange: number;
      promptsPerStory: number;
      promptsPerStoryChange: number;
      timePerLOC: number;
      timePerLOCChange: number;
      totalUserPrompts: number;
      totalUserPromptsChange: number;
      // ST-147: Session telemetry KPIs
      totalTurns: number;
      totalTurnsChange: number;
      totalManualPrompts: number;
      totalManualPromptsChange: number;
      automationRate: number;
      automationRateChange: number;
    };
    trends: {
      storiesImplemented: { date: string; allWorkflows: number; selectedWorkflows: number }[];
      tokensPerLOC: { date: string; allWorkflows: number; selectedWorkflows: number }[];
      promptsPerStory: { date: string; allWorkflows: number; selectedWorkflows: number }[];
      timePerLOC: { date: string; allWorkflows: number; selectedWorkflows: number }[];
    };
    workflows: { id: string; name: string }[];
    workflowsWithMetrics: {
      id: string;
      name: string;
      storiesCount: number;
      bugsCount: number;
      avgPromptsPerStory: number;
      avgTokensPerLOC: number;
    }[];
    counts: {
      filteredStories: number;
      totalStories: number;
      filteredBugs: number;
      totalBugs: number;
    };
    generatedAt: string;
  }> {
    return this.dashboardMetricsService.getPerformanceDashboardTrends(params);
  }

  /**
   * Get detailed metrics for one or two workflows for comparison
   */
  async getWorkflowDetails(params: {
    projectId: string;
    workflowAId: string;
    workflowBId?: string;
    businessComplexity: string;
    technicalComplexity: string;
  }) {
    return this.workflowMetricsService.getWorkflowDetails(params);
  }
}
