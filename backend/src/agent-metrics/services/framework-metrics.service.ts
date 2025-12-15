import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  GetFrameworkMetricsDto,
  FrameworkComparisonResponseDto,
  FrameworkComparisonResultDto,
  EfficiencyMetricsDto,
  QualityMetricsDto,
  CostMetricsDto,
} from '../dto/metrics.dto';
import {
  calculateDateRange,
  getComplexityFilter,
  determineConfidenceLevel,
  getEmptyEfficiencyMetrics,
  getEmptyQualityMetrics,
  getEmptyCostMetrics,
} from '../utils/metrics.utils';
import { MetricsAggregationService } from './metrics-aggregation.service';

@Injectable()
export class FrameworkMetricsService {
  private readonly logger = new Logger(FrameworkMetricsService.name);
  private readonly TOKEN_COST_PER_1K = 0.01; // $0.01 per 1000 tokens (configurable)

  constructor(
    private readonly prisma: PrismaService,
    private readonly aggregationService: MetricsAggregationService,
  ) {}

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
    const { startDate, endDate } = calculateDateRange(
      dto.dateRange,
      dto.startDate,
      dto.endDate,
    );

    // Get complexity filter
    const complexityFilter = getComplexityFilter(dto.complexityBand);

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
    const aiInsights = this.generateAIInsights(comparisons);

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
        efficiencyMetrics: getEmptyEfficiencyMetrics(),
        qualityMetrics: getEmptyQualityMetrics(),
        costMetrics: getEmptyCostMetrics(),
        sampleSize: 0,
        confidenceLevel: 'none',
      };
    }

    // Get framework name
    const frameworkName = runs[0]?.framework?.name || 'Unknown';

    // Calculate efficiency metrics
    const efficiencyMetrics = this.calculateEfficiencyMetrics(runs);

    // Calculate quality metrics
    const qualityMetrics = await this.calculateQualityMetrics(
      projectId,
      frameworkId,
      complexityFilter,
      startDate,
      endDate,
    );

    // Calculate cost metrics
    const costMetrics = this.calculateCostMetrics(
      runs,
      qualityMetrics.codeChurnPercent,
    );

    // Determine confidence level
    const confidenceLevel = determineConfidenceLevel(sampleSize);

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
    const storyGroups = this.aggregationService.groupRunsByStory(runs);
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
        assignedFrameworkId: frameworkId,
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

    // Type assertion for defect property
    const storiesWithDefect = stories as any[];

    const defectsPerStory =
      storiesWithDefect.reduce((sum, s) => sum + (s.defect ? 1 : 0), 0) / storiesWithDefect.length ||
      0;

    // Defect leakage: prod/uat defects vs total
    const totalDefects = storiesWithDefect.reduce(
      (sum, s) => sum + (s.defect ? 1 : 0),
      0,
    );
    const leakedDefects = storiesWithDefect.reduce(
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
    const criticalDefects = storiesWithDefect.reduce(
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
    const storyGroups = this.aggregationService.groupRunsByStory(runs);
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
}
