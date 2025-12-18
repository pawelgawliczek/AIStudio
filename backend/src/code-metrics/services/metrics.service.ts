import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ProjectMetricsDto, FileHotspotDto, CodeIssueDto, TrendDataPointDto } from '../dto';
import { GetHotspotsDto } from '../dto/query-metrics.dto';
import { TestCoverageService } from './test-coverage.service';

/**
 * Project-level metrics and file hotspot service
 */
@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);

  constructor(
    private prisma: PrismaService,
    private testCoverageService: TestCoverageService,
  ) {}

  /**
   * Get project-level code quality metrics
   */
  async getProjectMetrics(
    projectId: string,
    timeRangeDays: number = 30,
  ): Promise<ProjectMetricsDto> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - timeRangeDays);

    const metrics = await this.prisma.codeMetrics.findMany({
      where: {
        projectId,
        lastAnalyzedAt: { gte: startDate },
      },
    });

    if (metrics.length === 0) {
      return {
        healthScore: {
          overallScore: 0,
          coverage: 0,
          complexity: 0,
          techDebtRatio: 0,
          trend: 'stable',
          weeklyChange: 0,
        },
        totalLoc: 0,
        locByLanguage: {},
        securityIssues: { critical: 0, high: 0, medium: 0, low: 0 },
        lastUpdate: new Date(),
      };
    }

    const totalLoc = metrics.reduce((sum, m) => sum + m.linesOfCode, 0);
    const weightedComplexity = metrics.reduce((sum, m) => sum + (m.cyclomaticComplexity * m.linesOfCode), 0);
    const weightedMaintainability = metrics.reduce((sum, m) => sum + (m.maintainabilityIndex * m.linesOfCode), 0);

    const avgComplexity = totalLoc > 0 ? weightedComplexity / totalLoc : 0;
    const avgMaintainability = totalLoc > 0 ? weightedMaintainability / totalLoc : 0;

    // ST-135: Use TestExecution table as single source of truth
    const testSummary = await this.testCoverageService.getTestSummaryUnified(projectId);
    let avgCoverage = testSummary.coveragePercentage || 0;

    if (avgCoverage === 0 && metrics.length > 0) {
      const weightedCoverage = metrics.reduce(
        (sum, m) => sum + ((m.testCoverage || 0) * m.linesOfCode),
        0
      );
      avgCoverage = totalLoc > 0 ? weightedCoverage / totalLoc : 0;
    }

    const locByLanguage: Record<string, number> = {};
    metrics.forEach(m => {
      const lang = m.language || 'unknown';
      locByLanguage[lang] = (locByLanguage[lang] || 0) + m.linesOfCode;
    });

    const complexityScore = Math.max(0, 100 - (avgComplexity * 5));
    const maintainabilityScore = avgMaintainability;
    const coverageScore = avgCoverage;
    const overallScore = Math.round(
      (complexityScore * 0.3) + (maintainabilityScore * 0.4) + (coverageScore * 0.3)
    );

    const techDebtRatio = Math.round(100 - avgMaintainability);

    const criticalIssuesCount = metrics.reduce((sum, m) => sum + (m.criticalIssues || 0), 0);
    const securityIssues = {
      critical: Math.floor(criticalIssuesCount * 0.1),
      high: Math.floor(criticalIssuesCount * 0.2),
      medium: Math.floor(criticalIssuesCount * 0.3),
      low: criticalIssuesCount - Math.floor(criticalIssuesCount * 0.6),
    };

    return {
      healthScore: {
        overallScore,
        coverage: Math.round(avgCoverage),
        complexity: Math.round(avgComplexity * 10) / 10,
        techDebtRatio,
        trend: 'stable',
        weeklyChange: 0,
      },
      totalLoc,
      locByLanguage,
      securityIssues,
      lastUpdate: new Date(),
    };
  }

  /**
   * Get file hotspots (high-risk files)
   */
  async getFileHotspots(
    projectId: string,
    query: GetHotspotsDto,
  ): Promise<FileHotspotDto[]> {
    const limit = query.limit || 10;
    const minRiskScore = query.minRiskScore || 50;

    const metrics = await this.prisma.codeMetrics.findMany({
      where: {
        projectId,
        riskScore: { gte: minRiskScore },
      },
      orderBy: { riskScore: 'desc' },
      take: limit,
    });

    return metrics.map(m => ({
      filePath: m.filePath,
      riskScore: Math.round(m.riskScore),
      complexity: m.cyclomaticComplexity,
      churnCount: m.churnCount,
      coverage: m.testCoverage || 0,
      loc: m.linesOfCode,
      lastModified: m.lastModified,
      lastStoryKey: undefined as string | undefined,
      criticalIssues: m.criticalIssues || 0,
    }));
  }

  /**
   * ST-18: Get trend data from real historical snapshots
   * ST-135: Merge TestExecution coverage data with snapshot metrics
   */
  async getTrendData(
    projectId: string,
    days: number = 30,
  ): Promise<TrendDataPointDto[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const snapshots = await this.prisma.codeMetricsSnapshot.findMany({
      where: {
        projectId,
        snapshotDate: {
          gte: startDate,
        },
      },
      orderBy: {
        snapshotDate: 'asc',
      },
    });

    const testExecutions = await this.prisma.testExecution.findMany({
      where: {
        testCase: { projectId },
        executedAt: { gte: startDate },
        coveragePercentage: { not: null },
      },
      orderBy: { executedAt: 'asc' },
      select: {
        executedAt: true,
        coveragePercentage: true,
      },
    });

    const coverageByDay = new Map<string, number[]>();
    testExecutions.forEach(te => {
      const dateKey = te.executedAt.toISOString().split('T')[0];
      if (!coverageByDay.has(dateKey)) {
        coverageByDay.set(dateKey, []);
      }
      coverageByDay.get(dateKey)!.push(Number(te.coveragePercentage));
    });

    const dailyAverages = new Map<string, number>();
    coverageByDay.forEach((values, dateKey) => {
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      dailyAverages.set(dateKey, avg);
    });

    return snapshots.map(snapshot => {
      const dateKey = snapshot.snapshotDate.toISOString().split('T')[0];
      const testCoverage = dailyAverages.get(dateKey);

      return {
        date: snapshot.snapshotDate,
        healthScore: snapshot.healthScore,
        coverage: testCoverage !== undefined ? testCoverage : snapshot.avgCoverage,
        complexity: snapshot.avgComplexity,
        techDebt: snapshot.techDebtRatio,
      };
    });
  }

  /**
   * Get code quality issues summary
   */
  async getCodeIssues(projectId: string): Promise<CodeIssueDto[]> {
    const metrics = await this.prisma.codeMetrics.findMany({
      where: { projectId },
    });

    const issuesByType = new Map<string, {
      severity: 'critical' | 'high' | 'medium' | 'low';
      count: number;
      files: Set<string>;
    }>();

    metrics.forEach(m => {
      const metadata = (m.metadata as any) || {};
      const codeSmells = metadata.codeSmells || [];

      codeSmells.forEach((smell: any) => {
        const key = smell.type || 'Unknown';
        if (!issuesByType.has(key)) {
          issuesByType.set(key, {
            severity: smell.severity || 'medium',
            count: 0,
            files: new Set(),
          });
        }
        const entry = issuesByType.get(key)!;
        entry.count++;
        entry.files.add(m.filePath);
      });
    });

    return Array.from(issuesByType.entries()).map(([type, data]) => ({
      severity: data.severity,
      type,
      count: data.count,
      filesAffected: data.files.size,
      sampleFiles: Array.from(data.files).slice(0, 3),
    }));
  }

  /**
   * Get comparison between current and previous analysis
   */
  async getAnalysisComparison(projectId: string): Promise<{
    healthScoreChange: number;
    newTests: number;
    coverageChange: number;
    complexityChange: number;
    newFiles: number;
    deletedFiles: number;
    qualityImprovement: boolean;
    lastAnalysis?: Date;
  }> {
    const currentMetrics = await this.getProjectMetrics(projectId, 30);

    const mostRecentMetric = await this.prisma.codeMetrics.findFirst({
      where: { projectId },
      orderBy: { lastAnalyzedAt: 'desc' },
      select: { lastAnalyzedAt: true },
    });

    if (!mostRecentMetric) {
      return {
        healthScoreChange: 0,
        newTests: 0,
        coverageChange: 0,
        complexityChange: 0,
        newFiles: 0,
        deletedFiles: 0,
        qualityImprovement: false,
      };
    }

    const currentAnalysisTime = mostRecentMetric.lastAnalyzedAt;

    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const previousAnalysisMetric = await this.prisma.codeMetrics.findFirst({
      where: {
        projectId,
        lastAnalyzedAt: {
          lt: currentAnalysisTime,
          gte: ninetyDaysAgo,
        },
      },
      orderBy: { lastAnalyzedAt: 'desc' },
      select: { lastAnalyzedAt: true },
    });

    if (!previousAnalysisMetric) {
      return {
        healthScoreChange: 0,
        newTests: 0,
        coverageChange: 0,
        complexityChange: 0,
        newFiles: 0,
        deletedFiles: 0,
        qualityImprovement: false,
      };
    }

    const previousAnalysisTime = previousAnalysisMetric.lastAnalyzedAt;

    const timeWindow = 5 * 60 * 1000;
    const previousMetrics = await this.prisma.codeMetrics.findMany({
      where: {
        projectId,
        lastAnalyzedAt: {
          gte: new Date(previousAnalysisTime.getTime() - timeWindow),
          lte: new Date(previousAnalysisTime.getTime() + timeWindow),
        },
      },
    });

    if (previousMetrics.length === 0) {
      return {
        healthScoreChange: 0,
        newTests: 0,
        coverageChange: 0,
        complexityChange: 0,
        newFiles: 0,
        deletedFiles: 0,
        qualityImprovement: false,
      };
    }

    const prevTotalLoc = previousMetrics.reduce((sum, m) => sum + m.linesOfCode, 0);
    const prevWeightedComplexity = previousMetrics.reduce(
      (sum, m) => sum + (m.cyclomaticComplexity * m.linesOfCode),
      0,
    );
    const prevWeightedCoverage = previousMetrics.reduce(
      (sum, m) => sum + ((m.testCoverage || 0) * m.linesOfCode),
      0,
    );
    const prevWeightedMaintainability = previousMetrics.reduce(
      (sum, m) => sum + (m.maintainabilityIndex * m.linesOfCode),
      0,
    );

    const prevAvgComplexity = prevTotalLoc > 0 ? prevWeightedComplexity / prevTotalLoc : 0;
    const prevAvgCoverage = prevTotalLoc > 0 ? prevWeightedCoverage / prevTotalLoc : 0;
    const prevAvgMaintainability = prevTotalLoc > 0 ? prevWeightedMaintainability / prevTotalLoc : 0;

    const prevComplexityScore = Math.max(0, 100 - (prevAvgComplexity * 5));
    const prevHealthScore = Math.round(
      (prevComplexityScore * 0.3) + (prevAvgMaintainability * 0.4) + (prevAvgCoverage * 0.3)
    );

    const currentFiles = await this.prisma.codeMetrics.findMany({
      where: { projectId },
      select: { filePath: true },
    });

    const currentFilePaths = new Set(currentFiles.map(f => f.filePath));
    const prevFilePaths = new Set(previousMetrics.map(f => f.filePath));

    const newFiles = currentFiles.filter(f => !prevFilePaths.has(f.filePath)).length;
    const deletedFiles = previousMetrics.filter(f => !currentFilePaths.has(f.filePath)).length;

    const currentTestCount = await this.prisma.testCase.count({ where: { projectId } });
    const previousTestCount = await this.prisma.testCase.count({
      where: {
        projectId,
        createdAt: { lte: previousAnalysisTime },
      },
    });

    const healthScoreChange = currentMetrics.healthScore.overallScore - prevHealthScore;
    const coverageChange = currentMetrics.healthScore.coverage - prevAvgCoverage;
    const complexityChange = currentMetrics.healthScore.complexity - prevAvgComplexity;

    return {
      healthScoreChange: Math.round(healthScoreChange * 10) / 10,
      newTests: currentTestCount - previousTestCount,
      coverageChange: Math.round(coverageChange * 10) / 10,
      complexityChange: Math.round(complexityChange * 10) / 10,
      newFiles,
      deletedFiles,
      qualityImprovement: healthScoreChange > 0,
      lastAnalysis: previousAnalysisTime,
    };
  }
}
