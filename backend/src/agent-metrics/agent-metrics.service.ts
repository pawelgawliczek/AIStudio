import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  GetFrameworkMetricsDto,
  ComplexityBand,
  DateRange,
  FrameworkComparisonResponseDto,
  FrameworkComparisonResultDto,
  EfficiencyMetricsDto,
  QualityMetricsDto,
  CostMetricsDto,
  TrendDataPointDto,
  GetWeeklyMetricsDto,
  WeeklyAnalysisResponseDto,
  WeeklySummaryDto,
  GetStoryExecutionDetailsDto,
  StoryExecutionDetailsResponseDto,
  AgentExecutionDto,
  GetPerAgentMetricsDto,
  PerAgentAnalyticsResponseDto,
  FrameworkAgentBreakdownDto,
  AgentRoleEfficiencyDto,
  TotalStoryCostComparisonDto,
} from './dto';

@Injectable()
export class AgentMetricsService {
  private readonly logger = new Logger(AgentMetricsService.name);
  private readonly TOKEN_COST_PER_1K = 0.01; // $0.01 per 1000 tokens (configurable)

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get framework comparison metrics with complexity normalization
   */
  async getFrameworkComparison(
    dto: GetFrameworkMetricsDto,
  ): Promise<FrameworkComparisonResponseDto> {
    this.logger.log(
      `Getting framework comparison for project ${dto.projectId}`,
    );

    // Get project
    const project = await this.prisma.project.findUnique({
      where: { id: dto.projectId },
    });

    if (!project) {
      throw new NotFoundException(`Project ${dto.projectId} not found`);
    }

    // Calculate date range
    const { startDate, endDate } = this.calculateDateRange(
      dto.dateRange,
      dto.startDate,
      dto.endDate,
    );

    // Get complexity filter
    const complexityFilter = this.getComplexityFilter(dto.complexityBand);

    // Get comparisons for each framework
    const comparisons: FrameworkComparisonResultDto[] = [];

    for (const frameworkId of dto.frameworkIds) {
      const comparison = await this.calculateFrameworkMetrics(
        dto.projectId,
        frameworkId,
        complexityFilter,
        startDate,
        endDate,
      );
      comparisons.push(comparison);
    }

    // Calculate overhead analysis for multi-agent frameworks
    const overheadAnalysis =
      dto.frameworkIds.length > 1
        ? await this.calculateOverheadAnalysis(
            dto.projectId,
            dto.frameworkIds,
            complexityFilter,
            startDate,
            endDate,
          )
        : undefined;

    // Get trend data
    const trends = await this.calculateTrends(
      dto.projectId,
      dto.frameworkIds,
      complexityFilter,
      startDate,
      endDate,
    );

    // Generate AI insights
    const aiInsights = this.generateAIInsights(comparisons, overheadAnalysis);

    return {
      projectId: dto.projectId,
      projectName: project.name,
      complexityBand: dto.complexityBand,
      dateRange: dto.dateRange,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      comparisons,
      overheadAnalysis,
      trends,
      aiInsights,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Calculate metrics for a single framework
   */
  private async calculateFrameworkMetrics(
    projectId: string,
    frameworkId: string,
    complexityFilter: number[] | null,
    startDate: Date,
    endDate: Date,
  ): Promise<FrameworkComparisonResultDto> {
    // Get all runs for this framework
    const runs = await this.prisma.run.findMany({
      where: {
        projectId,
        frameworkId,
        success: true,
        startedAt: { gte: startDate, lte: endDate },
        story: complexityFilter
          ? { technicalComplexity: { in: complexityFilter } }
          : undefined,
      },
      include: {
        story: true,
        framework: true,
      },
    });

    const sampleSize = new Set(runs.map((r) => r.storyId)).size;

    if (sampleSize === 0) {
      return {
        framework: {
          id: frameworkId,
          name: 'Unknown',
        },
        efficiencyMetrics: this.getEmptyEfficiencyMetrics(),
        qualityMetrics: this.getEmptyQualityMetrics(),
        costMetrics: this.getEmptyCostMetrics(),
        sampleSize: 0,
        confidenceLevel: 'none',
      };
    }

    // Get framework name
    const frameworkName = runs[0]?.framework?.name || 'Unknown';

    // Calculate efficiency metrics
    const efficiencyMetrics = await this.calculateEfficiencyMetrics(runs);

    // Calculate quality metrics
    const qualityMetrics = await this.calculateQualityMetrics(
      projectId,
      frameworkId,
      complexityFilter,
      startDate,
      endDate,
    );

    // Calculate cost metrics
    const costMetrics = await this.calculateCostMetrics(
      runs,
      qualityMetrics.codeChurnPercent,
    );

    // Determine confidence level
    const confidenceLevel = this.determineConfidenceLevel(sampleSize);

    return {
      framework: {
        id: frameworkId,
        name: frameworkName,
      },
      efficiencyMetrics,
      qualityMetrics,
      costMetrics,
      sampleSize,
      confidenceLevel,
    };
  }

  /**
   * Calculate efficiency metrics from runs
   */
  private calculateEfficiencyMetrics(runs: any[]): EfficiencyMetricsDto {
    const storyGroups = this.groupRunsByStory(runs);
    const storyMetrics = Array.from(storyGroups.values());

    const avgTokensPerStory =
      storyMetrics.reduce((sum, s) => sum + s.totalTokens, 0) /
        storyMetrics.length || 0;

    const totalLoc = storyMetrics.reduce((sum, s) => sum + s.totalLoc, 0);
    const totalTokens = storyMetrics.reduce(
      (sum, s) => sum + s.totalTokens,
      0,
    );
    const avgTokenPerLoc = totalLoc > 0 ? totalTokens / totalLoc : 0;

    const avgCycleTime =
      storyMetrics.reduce((sum, s) => sum + s.cycleTimeHours, 0) /
        storyMetrics.length || 0;

    const avgIterations =
      storyMetrics.reduce((sum, s) => sum + s.totalIterations, 0) /
        storyMetrics.length || 0;

    // Calculate parallelization efficiency (simplified)
    const parallelizationEfficiency = this.calculateParallelizationEfficiency(
      storyMetrics,
    );

    // Token efficiency (output/input ratio)
    const totalInput = runs.reduce((sum, r) => sum + (r.tokensInput || 0), 0);
    const totalOutput = runs.reduce(
      (sum, r) => sum + (r.tokensOutput || 0),
      0,
    );
    const tokenEfficiencyRatio =
      totalInput > 0 ? totalOutput / totalInput : 0;

    return {
      avgTokensPerStory,
      avgTokenPerLoc,
      storyCycleTimeHours: avgCycleTime,
      promptIterationsPerStory: avgIterations,
      parallelizationEfficiencyPercent: parallelizationEfficiency,
      tokenEfficiencyRatio,
    };
  }

  /**
   * Calculate quality metrics
   */
  private async calculateQualityMetrics(
    projectId: string,
    frameworkId: string,
    complexityFilter: number[] | null,
    startDate: Date,
    endDate: Date,
  ): Promise<QualityMetricsDto> {
    // Get stories for this framework
    const stories = await this.prisma.story.findMany({
      where: {
        projectId,
        frameworkId,
        updatedAt: { gte: startDate, lte: endDate },
        technicalComplexity: complexityFilter
          ? { in: complexityFilter }
          : undefined,
      },
      include: {
        defect: true,
        commits: {
          include: {
            files: true,
          },
        },
      },
    });

    const defectsPerStory =
      stories.reduce((sum, s) => sum + (s.defect ? 1 : 0), 0) / stories.length ||
      0;

    // Defect leakage: prod/uat defects vs total
    const totalDefects = stories.reduce(
      (sum, s) => sum + (s.defect ? 1 : 0),
      0,
    );
    const leakedDefects = stories.reduce(
      (sum, s) =>
        sum + (s.defect && s.defect.discoveryStage === 'production' ? 1 : 0),
      0,
    );
    const defectLeakagePercent =
      totalDefects > 0 ? (leakedDefects / totalDefects) * 100 : 0;

    // Code churn from commits
    const { churnPercent, avgCoverage, complexityDelta } =
      await this.calculateCodeQualityMetrics(stories);

    // Critical defects
    const criticalDefects = stories.reduce(
      (sum, s) =>
        sum + (s.defect && s.defect.severity === 'critical' ? 1 : 0),
      0,
    );

    return {
      defectsPerStory,
      defectLeakagePercent,
      codeChurnPercent: churnPercent,
      testCoveragePercent: avgCoverage,
      codeComplexityDeltaPercent: complexityDelta,
      criticalDefects,
    };
  }

  /**
   * Calculate cost metrics
   */
  private calculateCostMetrics(
    runs: any[],
    codeChurnPercent: number,
  ): CostMetricsDto {
    const storyGroups = this.groupRunsByStory(runs);
    const storyMetrics = Array.from(storyGroups.values());

    const totalTokens = runs.reduce(
      (sum, r) => sum + (r.tokensInput || 0) + (r.tokensOutput || 0),
      0,
    );
    const costPerStory =
      (totalTokens / 1000) * this.TOKEN_COST_PER_1K / storyMetrics.length || 0;

    const totalLoc = storyMetrics.reduce((sum, s) => sum + s.totalLoc, 0);
    const costPerAcceptedLoc =
      totalLoc > 0 ? (totalTokens / 1000) * this.TOKEN_COST_PER_1K / totalLoc : 0;

    const storiesCompleted = storyMetrics.length;
    const acceptedLoc = totalLoc;

    // Rework cost based on churn
    const reworkCost = costPerStory * (codeChurnPercent / 100);
    const netCost = costPerStory + reworkCost;

    return {
      costPerStory: parseFloat(costPerStory.toFixed(2)),
      costPerAcceptedLoc: parseFloat(costPerAcceptedLoc.toFixed(4)),
      storiesCompleted,
      acceptedLoc,
      reworkCost: parseFloat(reworkCost.toFixed(2)),
      netCost: parseFloat(netCost.toFixed(2)),
    };
  }

  /**
   * Group runs by story and calculate story-level metrics
   */
  private groupRunsByStory(runs: any[]): Map<string, any> {
    const storyGroups = new Map<string, any>();

    for (const run of runs) {
      if (!run.storyId) continue;

      if (!storyGroups.has(run.storyId)) {
        storyGroups.set(run.storyId, {
          storyId: run.storyId,
          runs: [],
          totalTokens: 0,
          totalLoc: 0,
          totalIterations: 0,
          startedAt: run.startedAt,
          finishedAt: run.finishedAt,
        });
      }

      const story = storyGroups.get(run.storyId);
      story.runs.push(run);
      story.totalTokens +=
        (run.tokensInput || 0) + (run.tokensOutput || 0);
      story.totalLoc += run.locGenerated || 0;
      story.totalIterations += run.iterations || 0;

      if (run.startedAt < story.startedAt) {
        story.startedAt = run.startedAt;
      }
      if (run.finishedAt > story.finishedAt) {
        story.finishedAt = run.finishedAt;
      }
    }

    // Calculate cycle time for each story
    for (const [, story] of storyGroups) {
      const cycleTimeMs = story.finishedAt - story.startedAt;
      story.cycleTimeHours = cycleTimeMs / (1000 * 60 * 60);
    }

    return storyGroups;
  }

  /**
   * Calculate parallelization efficiency (how well agents run in parallel)
   */
  private calculateParallelizationEfficiency(storyMetrics: any[]): number {
    // Simplified: ideal parallel time vs actual time
    // This would need more sophisticated logic in production
    return 75; // Placeholder: 75% efficiency
  }

  /**
   * Calculate code quality metrics from commits
   */
  private async calculateCodeQualityMetrics(
    stories: any[],
  ): Promise<{ churnPercent: number; avgCoverage: number; complexityDelta: number }> {
    let totalChurn = 0;
    let totalCoverage = 0;
    let totalComplexityDelta = 0;
    let filesWithData = 0;

    for (const story of stories) {
      for (const commit of story.commits) {
        for (const file of commit.files) {
          if (file.coverageAfter !== null) {
            totalCoverage += file.coverageAfter;
            filesWithData++;
          }

          if (file.complexityAfter !== null && file.complexityBefore !== null) {
            const delta = file.complexityAfter - file.complexityBefore;
            totalComplexityDelta += delta;
          }

          // Churn calculation: files modified multiple times
          if (file.churn !== null) {
            totalChurn += file.churn;
          }
        }
      }
    }

    const avgCoverage = filesWithData > 0 ? totalCoverage / filesWithData : 85;
    const churnPercent = filesWithData > 0 ? (totalChurn / filesWithData) * 100 : 20;
    const complexityDelta = filesWithData > 0 ? (totalComplexityDelta / filesWithData) : 0;

    return {
      churnPercent: parseFloat(churnPercent.toFixed(2)),
      avgCoverage: parseFloat(avgCoverage.toFixed(2)),
      complexityDelta: parseFloat(complexityDelta.toFixed(2)),
    };
  }

  /**
   * Calculate date range from enum
   */
  private calculateDateRange(
    dateRange: DateRange,
    customStart?: string,
    customEnd?: string,
  ): { startDate: Date; endDate: Date } {
    const endDate = new Date();
    let startDate = new Date();

    switch (dateRange) {
      case DateRange.LAST_7_DAYS:
        startDate.setDate(endDate.getDate() - 7);
        break;
      case DateRange.LAST_30_DAYS:
        startDate.setDate(endDate.getDate() - 30);
        break;
      case DateRange.LAST_90_DAYS:
        startDate.setDate(endDate.getDate() - 90);
        break;
      case DateRange.LAST_6_MONTHS:
        startDate.setMonth(endDate.getMonth() - 6);
        break;
      case DateRange.CUSTOM:
        if (customStart && customEnd) {
          startDate = new Date(customStart);
          return { startDate, endDate: new Date(customEnd) };
        }
        break;
      case DateRange.ALL_TIME:
        startDate = new Date('2020-01-01');
        break;
    }

    return { startDate, endDate };
  }

  /**
   * Get complexity filter array from enum
   */
  private getComplexityFilter(band: ComplexityBand): number[] | null {
    switch (band) {
      case ComplexityBand.LOW:
        return [1, 2];
      case ComplexityBand.MEDIUM:
        return [3];
      case ComplexityBand.HIGH:
        return [4, 5];
      case ComplexityBand.ALL:
        return null;
    }
  }

  /**
   * Determine confidence level based on sample size
   */
  private determineConfidenceLevel(sampleSize: number): string {
    if (sampleSize >= 20) return 'high';
    if (sampleSize >= 5) return 'medium';
    return 'low';
  }

  /**
   * Calculate overhead analysis
   */
  private async calculateOverheadAnalysis(
    projectId: string,
    frameworkIds: string[],
    complexityFilter: number[] | null,
    startDate: Date,
    endDate: Date,
  ): Promise<any> {
    // For simplicity, return mock data
    // In production, this would analyze role distribution
    return undefined;
  }

  /**
   * Calculate trends over time
   */
  private async calculateTrends(
    projectId: string,
    frameworkIds: string[],
    complexityFilter: number[] | null,
    startDate: Date,
    endDate: Date,
  ): Promise<any> {
    // For simplicity, return mock data
    // In production, this would generate time-series data
    return {
      tokenUsage: [],
      defectRate: [],
      storyVelocity: [],
    };
  }

  /**
   * Generate AI insights
   */
  private generateAIInsights(
    comparisons: FrameworkComparisonResultDto[],
    // overheadAnalysis?: any,
  ): string[] {
    const insights: string[] = [];

    if (comparisons.length >= 2) {
      const [first, second] = comparisons;

      // Compare defect rates
      if (first.qualityMetrics.defectsPerStory <
          second.qualityMetrics.defectsPerStory) {
        const reduction =
          ((second.qualityMetrics.defectsPerStory -
            first.qualityMetrics.defectsPerStory) /
            second.qualityMetrics.defectsPerStory) *
          100;
        insights.push(
          `${first.framework.name} reduces defects by ${reduction.toFixed(0)}% compared to ${second.framework.name}`,
        );
      }

      // Compare costs
      if (first.costMetrics.netCost < second.costMetrics.netCost) {
        const savings =
          ((second.costMetrics.netCost - first.costMetrics.netCost) /
            second.costMetrics.netCost) *
          100;
        insights.push(
          `${first.framework.name} is ${savings.toFixed(0)}% more cost-effective (including rework)`,
        );
      }

      // Sample size warning
      if (first.sampleSize < 5 || second.sampleSize < 5) {
        insights.push(
          '⚠️ Small sample size detected. Collect more data for reliable comparison (minimum 5 stories recommended).',
        );
      }
    }

    return insights;
  }

  /**
   * Get weekly metrics analysis
   */
  async getWeeklyAnalysis(
    dto: GetWeeklyMetricsDto,
  ): Promise<WeeklyAnalysisResponseDto> {
    this.logger.log(`Getting weekly analysis for project ${dto.projectId}`);

    // Implementation would calculate week-by-week metrics
    // For now, returning a structured response
    throw new Error('Weekly analysis not yet implemented');
  }

  /**
   * Get per-story execution details
   */
  async getStoryExecutionDetails(
    dto: GetStoryExecutionDetailsDto,
  ): Promise<StoryExecutionDetailsResponseDto> {
    this.logger.log(`Getting execution details for story ${dto.storyId}`);

    // Get story with all runs
    const story = await this.prisma.story.findUnique({
      where: { id: dto.storyId },
      include: {
        epic: true,
        runs: {
          orderBy: { startedAt: 'asc' },
        },
        commits: dto.includeCommits
          ? {
              include: {
                files: dto.includeFileChanges,
              },
            }
          : false,
      },
    });

    if (!story) {
      throw new NotFoundException(`Story ${dto.storyId} not found`);
    }

    // Transform runs to execution DTOs
    const executions: AgentExecutionDto[] = story.runs.map((run, index) => {
      const duration =
        run.finishedAt && run.startedAt
          ? (run.finishedAt.getTime() - run.startedAt.getTime()) / 1000
          : 0;

      const locGenerated = (run.metadata as any)?.locGenerated || 0;

      const metrics = {
        tokensPerLoc:
          locGenerated > 0
            ? (run.tokensInput + run.tokensOutput) / locGenerated
            : undefined,
        locPerPrompt:
          locGenerated && run.iterations
            ? locGenerated / run.iterations
            : undefined,
        runtimePerLoc:
          locGenerated > 0
            ? duration / locGenerated
            : undefined,
        runtimePerToken:
          run.tokensInput + run.tokensOutput > 0
            ? duration / (run.tokensInput + run.tokensOutput)
            : 0,
      };

      return {
        runId: run.id,
        agentRole: run.origin || 'developer',
        agentName: `${run.origin || 'developer'} agent`,
        executionNumber: index + 1,
        startedAt: run.startedAt?.toISOString() || '',
        finishedAt: run.finishedAt?.toISOString() || '',
        duration,
        tokensInput: run.tokensInput || 0,
        tokensOutput: run.tokensOutput || 0,
        tokensTotal: (run.tokensInput || 0) + (run.tokensOutput || 0),
        iterations: run.iterations || 0,
        locGenerated: locGenerated,
        success: run.success || false,
        metrics,
        outputs: {
          description: 'Agent execution completed',
        },
      };
    });

    // Calculate summary
    const totalTokens = executions.reduce((sum, e) => sum + e.tokensTotal, 0);
    const totalLoc = executions.reduce(
      (sum, e) => sum + (e.locGenerated || 0),
      0,
    );
    const totalIterations = executions.reduce(
      (sum, e) => sum + e.iterations,
      0,
    );
    const totalTime = executions.reduce((sum, e) => sum + e.duration, 0);

    const summary = {
      storyId: story.id,
      storyKey: story.key,
      storyTitle: story.title,
      status: story.status,
      complexity: story.technicalComplexity || 3,
      epicId: story.epicId,
      epicKey: story.epic.key,
      totalExecutions: executions.length,
      executionsByRole: {
        ba: executions.filter((e) => e.agentRole === 'ba').length,
        architect: executions.filter((e) => e.agentRole === 'architect').length,
        developer: executions.filter((e) => e.agentRole === 'developer').length,
        qa: executions.filter((e) => e.agentRole === 'qa').length,
      },
      totalTime,
      totalTokens,
      tokensInput: executions.reduce((sum, e) => sum + e.tokensInput, 0),
      tokensOutput: executions.reduce((sum, e) => sum + e.tokensOutput, 0),
      totalLoc,
      totalIterations,
      aggregateMetrics: {
        tokensPerLoc: totalLoc > 0 ? totalTokens / totalLoc : 0,
        locPerPrompt: totalIterations > 0 ? totalLoc / totalIterations : 0,
        runtimePerLoc: totalLoc > 0 ? totalTime / totalLoc : 0,
        runtimePerToken: totalTokens > 0 ? totalTime / totalTokens : 0,
      },
      costEstimate: (totalTokens / 1000) * this.TOKEN_COST_PER_1K,
    };

    // Transform commits if included
    const commits = dto.includeCommits
      ? story.commits.map((commit: any) => ({
          hash: commit.hash,
          author: commit.author,
          message: commit.message,
          timestamp: commit.timestamp.toISOString(),
          locAdded: commit.files?.reduce((sum: number, f: any) => sum + (f.locAdded || 0), 0) || 0,
          locDeleted: commit.files?.reduce((sum: number, f: any) => sum + (f.locDeleted || 0), 0) || 0,
          filesChanged: commit.files?.map((f: any) => f.filePath) || [],
        }))
      : undefined;

    return {
      story: {
        id: story.id,
        key: story.key,
        title: story.title,
        status: story.status,
        complexity: story.technicalComplexity || 3,
        epic: {
          id: story.epic.id,
          key: story.epic.key,
          name: story.epic.title,
        },
      },
      executions,
      summary,
      commits,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Get per-agent analytics
   */
  async getPerAgentAnalytics(
    dto: GetPerAgentMetricsDto,
  ): Promise<PerAgentAnalyticsResponseDto> {
    this.logger.log(
      `Getting per-agent analytics for project ${dto.projectId}`,
    );

    // Implementation would calculate per-agent metrics
    // For now, returning a structured response
    throw new Error('Per-agent analytics not yet implemented');
  }

  // Helper methods for empty metrics
  private getEmptyEfficiencyMetrics(): EfficiencyMetricsDto {
    return {
      avgTokensPerStory: 0,
      avgTokenPerLoc: 0,
      storyCycleTimeHours: 0,
      promptIterationsPerStory: 0,
      parallelizationEfficiencyPercent: 0,
      tokenEfficiencyRatio: 0,
    };
  }

  private getEmptyQualityMetrics(): QualityMetricsDto {
    return {
      defectsPerStory: 0,
      defectLeakagePercent: 0,
      codeChurnPercent: 0,
      testCoveragePercent: 0,
      codeComplexityDeltaPercent: 0,
      criticalDefects: 0,
    };
  }

  private getEmptyCostMetrics(): CostMetricsDto {
    return {
      costPerStory: 0,
      costPerAcceptedLoc: 0,
      storiesCompleted: 0,
      acceptedLoc: 0,
      reworkCost: 0,
      netCost: 0,
    };
  }
}
