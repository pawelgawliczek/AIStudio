import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ComprehensiveMetricsCalculator } from '../calculators/comprehensive-metrics.calculator';
import { calculateWorkflowDateRange } from '../utils/metrics.utils';
import { MetricsAggregationService } from './metrics-aggregation.service';

@Injectable()
export class DashboardMetricsService {
  private readonly logger = new Logger(DashboardMetricsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly comprehensiveMetricsCalculator: ComprehensiveMetricsCalculator,
    private readonly aggregationService: MetricsAggregationService,
  ) {}

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
    this.logger.log(`Getting performance dashboard trends for project ${params.projectId}`);

    const project = await this.prisma.project.findUnique({
      where: { id: params.projectId },
    });

    if (!project) {
      throw new NotFoundException(`Project ${params.projectId} not found`);
    }

    // Calculate date range
    const { startDate, endDate } = calculateWorkflowDateRange(
      params.dateRange || 'month',
      params.startDate,
      params.endDate,
    );

    // Get all workflows for the project
    const allWorkflows = await this.prisma.workflow.findMany({
      where: { projectId: params.projectId },
      select: { id: true, name: true },
    });

    // Build base query for all workflow runs
    const baseWhere: any = {
      workflow: { projectId: params.projectId },
      startedAt: { gte: startDate, lte: endDate },
      status: 'completed',
    };

    // Add complexity filters if specified
    if (params.businessComplexityMin || params.businessComplexityMax ||
        params.technicalComplexityMin || params.technicalComplexityMax) {
      baseWhere.story = {};
      if (params.businessComplexityMin) {
        baseWhere.story.businessComplexity = { gte: params.businessComplexityMin };
      }
      if (params.businessComplexityMax) {
        baseWhere.story.businessComplexity = {
          ...baseWhere.story.businessComplexity,
          lte: params.businessComplexityMax
        };
      }
      if (params.technicalComplexityMin) {
        baseWhere.story.technicalComplexity = { gte: params.technicalComplexityMin };
      }
      if (params.technicalComplexityMax) {
        baseWhere.story.technicalComplexity = {
          ...baseWhere.story.technicalComplexity,
          lte: params.technicalComplexityMax
        };
      }
    }

    // Get all workflow runs with component data
    const allWorkflowRuns = await this.prisma.workflowRun.findMany({
      where: baseWhere,
      include: {
        workflow: true,
        story: true,
        componentRuns: true,
      },
      orderBy: { startedAt: 'asc' },
    });

    // Get selected workflow runs (if specific workflows selected)
    const selectedWorkflowRuns = params.workflowIds && params.workflowIds.length > 0
      ? allWorkflowRuns.filter(wr => params.workflowIds!.includes(wr.workflowId))
      : allWorkflowRuns;

    // Calculate daily metrics for trends
    const dailyAllMetrics = this.aggregationService.calculateDailyMetrics(allWorkflowRuns);
    const dailySelectedMetrics = this.aggregationService.calculateDailyMetrics(selectedWorkflowRuns);

    // Generate date range array
    const dates: string[] = [];
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      dates.push(currentDate.toISOString().split('T')[0]);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Build trends data
    const trends = {
      storiesImplemented: dates.map(date => ({
        date,
        allWorkflows: dailyAllMetrics[date]?.storiesImplemented || 0,
        selectedWorkflows: dailySelectedMetrics[date]?.storiesImplemented || 0,
      })),
      tokensPerLOC: dates.map(date => ({
        date,
        allWorkflows: dailyAllMetrics[date]?.tokensPerLOC || 0,
        selectedWorkflows: dailySelectedMetrics[date]?.tokensPerLOC || 0,
      })),
      promptsPerStory: dates.map(date => ({
        date,
        allWorkflows: dailyAllMetrics[date]?.promptsPerStory || 0,
        selectedWorkflows: dailySelectedMetrics[date]?.promptsPerStory || 0,
      })),
      timePerLOC: dates.map(date => ({
        date,
        allWorkflows: dailyAllMetrics[date]?.timePerLOC || 0,
        selectedWorkflows: dailySelectedMetrics[date]?.timePerLOC || 0,
      })),
    };

    // Calculate current KPIs and changes
    const currentMetrics = this.comprehensiveMetricsCalculator.calculateComprehensiveMetrics(selectedWorkflowRuns);
    const uniqueStories = new Set(selectedWorkflowRuns.map(wr => wr.storyId).filter(Boolean)).size;

    // Calculate previous period for comparison
    const periodLength = endDate.getTime() - startDate.getTime();
    const previousEndDate = new Date(startDate.getTime() - 1);
    const previousStartDate = new Date(previousEndDate.getTime() - periodLength);

    const previousRuns = await this.prisma.workflowRun.findMany({
      where: {
        ...baseWhere,
        startedAt: { gte: previousStartDate, lte: previousEndDate },
        workflowId: params.workflowIds && params.workflowIds.length > 0
          ? { in: params.workflowIds }
          : undefined,
      },
      include: {
        componentRuns: true,
        story: true,
      },
    });

    const previousMetrics = this.comprehensiveMetricsCalculator.calculateComprehensiveMetrics(previousRuns);
    const previousUniqueStories = new Set(previousRuns.map(wr => wr.storyId).filter(Boolean)).size;

    // Calculate changes
    const storiesChange = previousUniqueStories > 0
      ? ((uniqueStories - previousUniqueStories) / previousUniqueStories) * 100
      : 0;
    const tokensPerLOCChange = (previousMetrics.efficiency.tokensPerLOC || 0) > 0
      ? (((currentMetrics.efficiency.tokensPerLOC || 0) - (previousMetrics.efficiency.tokensPerLOC || 0)) / (previousMetrics.efficiency.tokensPerLOC || 0)) * 100
      : 0;
    const promptsPerStoryChange = (previousMetrics.efficiency.promptsPerStory || 0) > 0
      ? (((currentMetrics.efficiency.promptsPerStory || 0) - (previousMetrics.efficiency.promptsPerStory || 0)) / (previousMetrics.efficiency.promptsPerStory || 0)) * 100
      : 0;

    const totalLOC = currentMetrics.codeImpact.linesAdded + currentMetrics.codeImpact.linesModified;
    const timePerLOC = totalLOC > 0 ? currentMetrics.execution.totalDurationSeconds / totalLOC / 60 : 0;
    const previousTotalLOC = previousMetrics.codeImpact.linesAdded + previousMetrics.codeImpact.linesModified;
    const previousTimePerLOC = previousTotalLOC > 0 ? previousMetrics.execution.totalDurationSeconds / previousTotalLOC / 60 : 0;
    const timePerLOCChange = previousTimePerLOC > 0
      ? ((timePerLOC - previousTimePerLOC) / previousTimePerLOC) * 100
      : 0;

    // Calculate total user prompts (ST-68: Add totalUserPrompts KPI)
    const totalUserPrompts = currentMetrics.execution.totalPrompts;
    const previousTotalUserPrompts = previousMetrics.execution.totalPrompts;
    const totalUserPromptsChange = previousTotalUserPrompts > 0
      ? ((totalUserPrompts - previousTotalUserPrompts) / previousTotalUserPrompts) * 100
      : 0;

    // ST-147: Session telemetry KPIs
    const totalTurns = currentMetrics.execution.totalTurns || 0;
    const previousTotalTurns = previousMetrics.execution.totalTurns || 0;
    const totalTurnsChange = previousTotalTurns > 0
      ? ((totalTurns - previousTotalTurns) / previousTotalTurns) * 100
      : 0;

    const totalManualPrompts = currentMetrics.execution.totalManualPrompts || 0;
    const previousManualPrompts = previousMetrics.execution.totalManualPrompts || 0;
    const totalManualPromptsChange = previousManualPrompts > 0
      ? ((totalManualPrompts - previousManualPrompts) / previousManualPrompts) * 100
      : 0;

    const automationRate = currentMetrics.efficiency.automationRate || 0;
    const previousAutomationRate = previousMetrics.efficiency.automationRate || 0;
    const automationRateChange = previousAutomationRate > 0
      ? automationRate - previousAutomationRate
      : 0;

    // Get total counts (without filters)
    const [totalStoriesCount, totalBugsCount] = await Promise.all([
      this.prisma.story.count({
        where: {
          projectId: params.projectId,
          type: 'feature',
        },
      }),
      this.prisma.story.count({
        where: {
          projectId: params.projectId,
          type: { in: ['bug', 'defect'] },
        },
      }),
    ]);

    // Get filtered counts - when no workflows selected, use all workflow runs
    // This ensures counts match when nothing is selected
    const hasWorkflowFilter = params.workflowIds && params.workflowIds.length > 0;
    const filteredStoriesSet = new Set(
      selectedWorkflowRuns.filter(wr => wr.story?.type === 'feature').map(wr => wr.storyId).filter(Boolean)
    );
    const filteredBugsSet = new Set(
      selectedWorkflowRuns.filter(wr => wr.story?.type === 'bug' || wr.story?.type === 'defect').map(wr => wr.storyId).filter(Boolean)
    );

    // When no workflows are selected, show total counts from all workflow runs
    const allStoriesSet = new Set(
      allWorkflowRuns.filter(wr => wr.story?.type === 'feature').map(wr => wr.storyId).filter(Boolean)
    );
    const allBugsSet = new Set(
      allWorkflowRuns.filter(wr => wr.story?.type === 'bug' || wr.story?.type === 'defect').map(wr => wr.storyId).filter(Boolean)
    );

    // Calculate per-workflow metrics
    // ST-272: Apply same date/complexity filters to workflow table as header counts
    // This ensures the table totals match the header badge
    const workflowsWithMetrics = await Promise.all(allWorkflows.map(async wf => {
      // Get workflow runs for this workflow WITH date and complexity filters
      const workflowRunsForWorkflow = await this.prisma.workflowRun.findMany({
        where: {
          ...baseWhere,
          workflowId: wf.id,
        },
        include: {
          story: true,
          componentRuns: true,
        },
      });

      const uniqueStories = new Set(
        workflowRunsForWorkflow.filter(r => r.story?.type === 'feature').map(r => r.storyId).filter(Boolean)
      ).size;
      const uniqueBugs = new Set(
        workflowRunsForWorkflow.filter(r => r.story?.type === 'bug' || r.story?.type === 'defect').map(r => r.storyId).filter(Boolean)
      ).size;
      const allComponentRuns = workflowRunsForWorkflow.flatMap(r => r.componentRuns);

      const totalTokens = allComponentRuns.reduce((sum, cr) => sum + (cr.tokensInput || 0) + (cr.tokensOutput || 0), 0);
      const linesAdded = allComponentRuns.reduce((sum, cr) => sum + (cr.linesAdded || 0), 0);
      const linesModified = allComponentRuns.reduce((sum, cr) => sum + (cr.linesModified || 0), 0);
      const totalLOC = linesAdded + linesModified;
      const totalPrompts = allComponentRuns.reduce((sum, cr) => sum + (cr.userPrompts || 0), 0);
      const totalWorkItems = uniqueStories + uniqueBugs;

      return {
        id: wf.id,
        name: wf.name,
        storiesCount: uniqueStories,
        bugsCount: uniqueBugs,
        avgPromptsPerStory: totalWorkItems > 0 ? parseFloat((totalPrompts / totalWorkItems).toFixed(1)) : 0,
        avgTokensPerLOC: totalLOC > 0 ? parseFloat((totalTokens / totalLOC).toFixed(1)) : 0,
      };
    }));

    return {
      kpis: {
        storiesImplemented: uniqueStories,
        storiesChange: parseFloat(storiesChange.toFixed(1)),
        tokensPerLOC: parseFloat((currentMetrics.efficiency.tokensPerLOC || 0).toFixed(1)),
        tokensPerLOCChange: parseFloat(tokensPerLOCChange.toFixed(1)),
        promptsPerStory: parseFloat((currentMetrics.efficiency.promptsPerStory || 0).toFixed(1)),
        promptsPerStoryChange: parseFloat(promptsPerStoryChange.toFixed(1)),
        timePerLOC: parseFloat(timePerLOC.toFixed(2)),
        timePerLOCChange: parseFloat(timePerLOCChange.toFixed(1)),
        totalUserPrompts: totalUserPrompts,
        totalUserPromptsChange: parseFloat(totalUserPromptsChange.toFixed(1)),
        // ST-147: Session telemetry KPIs
        totalTurns,
        totalTurnsChange: parseFloat(totalTurnsChange.toFixed(1)),
        totalManualPrompts,
        totalManualPromptsChange: parseFloat(totalManualPromptsChange.toFixed(1)),
        automationRate: parseFloat(automationRate.toFixed(1)),
        automationRateChange: parseFloat(automationRateChange.toFixed(1)),
      },
      trends,
      workflows: allWorkflows,
      workflowsWithMetrics,
      counts: {
        // When workflows are selected, show filtered vs all from workflow runs
        // When no workflows selected, show all from workflow runs (same numbers)
        filteredStories: hasWorkflowFilter ? filteredStoriesSet.size : allStoriesSet.size,
        totalStories: allStoriesSet.size,
        filteredBugs: hasWorkflowFilter ? filteredBugsSet.size : allBugsSet.size,
        totalBugs: allBugsSet.size,
      },
      generatedAt: new Date().toISOString(),
    };
  }
}
