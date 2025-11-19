import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WorkersService } from '../workers/workers.service';
import {
  ProjectMetricsDto,
  FileHotspotDto,
  FileDetailDto,
  CodeIssueDto,
  TrendDataPointDto,
  CodeHealthScoreDto,
  FolderNodeDto,
  FolderMetricsDto,
  CoverageGapDto,
} from './dto';
import { QueryMetricsDto, GetHotspotsDto } from './dto/query-metrics.dto';
import { RecentAnalysisDto, RecentAnalysesResponseDto } from './dto/recent-analysis.dto';
import * as fs from 'fs';
import * as path from 'path';
import { Logger, BadRequestException, ForbiddenException } from '@nestjs/common';
import { glob } from 'glob';

@Injectable()
export class CodeMetricsService {
  private readonly logger = new Logger(CodeMetricsService.name);

  constructor(
    private prisma: PrismaService,
    private workersService: WorkersService,
  ) {}

  /**
   * Get project-level code quality metrics
   * Aggregates from CodeMetrics table (populated by worker)
   */
  async getProjectMetrics(
    projectId: string,
    query: QueryMetricsDto,
  ): Promise<ProjectMetricsDto> {
    const timeRangeDays = query.timeRangeDays || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - timeRangeDays);

    // Get all metrics for the project
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

    // Calculate aggregates (using LOC-weighted averages for accuracy)
    const totalLoc = metrics.reduce((sum, m) => sum + m.linesOfCode, 0);
    const weightedComplexity = metrics.reduce((sum, m) => sum + (m.cyclomaticComplexity * m.linesOfCode), 0);
    const weightedMaintainability = metrics.reduce((sum, m) => sum + (m.maintainabilityIndex * m.linesOfCode), 0);

    const avgComplexity = totalLoc > 0 ? weightedComplexity / totalLoc : 0;
    const avgMaintainability = totalLoc > 0 ? weightedMaintainability / totalLoc : 0;

    // ST-37 Fix: Use snapshot coverage (correct total %) instead of file-level average
    // The snapshot stores the accurate project-wide coverage from coverage-summary.json
    const snapshot = await this.prisma.codeMetricsSnapshot.findFirst({
      where: { projectId },
      orderBy: { snapshotDate: 'desc' },
      select: { avgCoverage: true },
    });
    const avgCoverage = snapshot?.avgCoverage || 0;

    // LOC by language
    const locByLanguage: Record<string, number> = {};
    metrics.forEach(m => {
      const lang = m.language || 'unknown';
      locByLanguage[lang] = (locByLanguage[lang] || 0) + m.linesOfCode;
    });

    // Calculate health score (0-100)
    const complexityScore = Math.max(0, 100 - (avgComplexity * 5));
    const maintainabilityScore = avgMaintainability;
    const coverageScore = avgCoverage;
    const overallScore = Math.round(
      (complexityScore * 0.3) + (maintainabilityScore * 0.4) + (coverageScore * 0.3)
    );

    // Tech debt ratio
    const techDebtRatio = Math.round(100 - avgMaintainability);

    // Security issues from critical issues count
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
      lastStoryKey: undefined,
      criticalIssues: m.criticalIssues || 0,
    }));
  }

  /**
   * Get detailed metrics for a specific file
   */
  async getFileDetail(projectId: string, filePath: string): Promise<FileDetailDto> {
    const metric = await this.prisma.codeMetrics.findUnique({
      where: {
        projectId_filePath: { projectId, filePath },
      },
    });

    if (!metric) {
      throw new NotFoundException(`File ${filePath} not found in project metrics`);
    }

    // Get recent commits
    const commits = await this.prisma.commit.findMany({
      where: {
        projectId,
        files: {
          some: { filePath },
        },
      },
      include: {
        files: { where: { filePath } },
        story: true,
      },
      orderBy: { timestamp: 'desc' },
      take: 5,
    });

    const recentChanges = commits.map(c => ({
      storyKey: c.story?.key || 'Unknown',
      date: c.timestamp,
      linesChanged: c.files[0].locAdded + c.files[0].locDeleted,
    }));

    // Parse metadata
    const metadata = (metric.metadata as any) || {};
    const issues = metadata.codeSmells || [];
    const imports = metadata.imports || [];
    const importedBy = metadata.importedBy || [];

    const couplingScore =
      (imports.length + importedBy.length) < 5 ? 'low' :
      (imports.length + importedBy.length) < 12 ? 'medium' : 'high';

    return {
      filePath: metric.filePath,
      language: metric.language || 'unknown',
      riskScore: Math.round(metric.riskScore),
      loc: metric.linesOfCode,
      complexity: metric.cyclomaticComplexity,
      cognitiveComplexity: metric.cognitiveComplexity,
      maintainabilityIndex: metric.maintainabilityIndex,
      coverage: metric.testCoverage || 0,
      churnCount: metric.churnCount,
      linesChanged: metric.churnRate,
      churnRate: metric.churnRate,
      lastModified: metric.lastModified,
      recentChanges,
      issues,
      importedBy,
      imports,
      couplingScore,
    };
  }

  /**
   * ST-18: Get trend data from real historical snapshots
   * Replaces previous mocked/interpolated implementation
   */
  async getTrendData(
    projectId: string,
    days: number = 30,
  ): Promise<TrendDataPointDto[]> {
    // Calculate start date for query
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Query real historical snapshots from database
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

    // Transform snapshots to TrendDataPointDto format
    return snapshots.map(snapshot => ({
      date: snapshot.snapshotDate,
      healthScore: snapshot.healthScore,
      coverage: snapshot.avgCoverage,
      complexity: snapshot.avgComplexity,
      techDebt: snapshot.techDebtRatio,
    }));
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
   * Trigger full code analysis for project
   */
  async triggerAnalysis(projectId: string): Promise<{
    jobId: string;
    status: string;
    message: string;
  }> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException(`Project ${projectId} not found`);
    }

    if (!project.repositoryUrl && !project.localPath) {
      throw new NotFoundException('Project has no repository configured');
    }

    // Check if analysis already running
    // TODO: Implement check for running jobs

    const job = await this.workersService.analyzeProject(projectId);

    return {
      jobId: String(job.id),
      status: 'queued',
      message: 'Code analysis job started',
    };
  }

  /**
   * Get hierarchical folder structure with aggregated metrics
   */
  async getFolderHierarchy(projectId: string): Promise<FolderNodeDto> {
    const metrics = await this.prisma.codeMetrics.findMany({
      where: { projectId },
    });

    if (metrics.length === 0) {
      // Return empty folder structure instead of throwing error (Null Object Pattern)
      return {
        path: '',
        name: 'root',
        type: 'folder',
        metrics: this.createEmptyMetrics(),
        children: [],
      };
    }

    // Build tree structure
    const root: FolderNodeDto = {
      path: '',
      name: 'root',
      type: 'folder',
      metrics: this.createEmptyMetrics(),
      children: [],
    };

    // Group files by folder path
    for (const metric of metrics) {
      const parts = metric.filePath.split('/');
      let current = root;

      // Navigate/create folder hierarchy
      for (let i = 0; i < parts.length - 1; i++) {
        const folderName = parts[i];
        const folderPath = parts.slice(0, i + 1).join('/');

        let folder = current.children?.find(c => c.path === folderPath);
        if (!folder) {
          folder = {
            path: folderPath,
            name: folderName,
            type: 'folder',
            metrics: this.createEmptyMetrics(),
            children: [],
          };
          current.children = current.children || [];
          current.children.push(folder);
        }
        current = folder;
      }

      // Add file node
      const fileName = parts[parts.length - 1];
      const fileNode: FolderNodeDto = {
        path: metric.filePath,
        name: fileName,
        type: 'file',
        metrics: {
          fileCount: 1,
          totalLoc: metric.linesOfCode,
          avgComplexity: metric.cyclomaticComplexity,
          avgCognitiveComplexity: metric.cognitiveComplexity,
          avgMaintainability: metric.maintainabilityIndex,
          avgCoverage: metric.testCoverage || 0,
          avgRiskScore: metric.riskScore,
          uncoveredFiles: metric.testCoverage === 0 ? 1 : 0,
          criticalIssues: metric.criticalIssues || 0,
          healthScore: this.calculateHealthScore(metric),
        },
      };
      current.children = current.children || [];
      current.children.push(fileNode);
    }

    // Aggregate metrics up the tree
    this.aggregateMetrics(root);

    return root;
  }

  /**
   * Get coverage gaps - files that need testing
   */
  async getCoverageGaps(projectId: string, limit: number = 20): Promise<CoverageGapDto[]> {
    const metrics = await this.prisma.codeMetrics.findMany({
      where: {
        projectId,
        testCoverage: { lt: 50 }, // Less than 50% coverage
      },
      orderBy: [
        { riskScore: 'desc' },
        { cyclomaticComplexity: 'desc' },
      ],
      take: limit * 2, // Get more to filter
    });

    return metrics
      .map(m => {
        // Priority calculation: risk + complexity + LOC impact
        const complexityFactor = Math.min(m.cyclomaticComplexity / 20, 1) * 30;
        const riskFactor = (m.riskScore / 100) * 40;
        const locFactor = Math.min(m.linesOfCode / 500, 1) * 20;
        const coveragePenalty = ((100 - (m.testCoverage || 0)) / 100) * 10;

        const priority = Math.round(complexityFactor + riskFactor + locFactor + coveragePenalty);

        const reason = [];
        if (m.riskScore > 70) reason.push('High risk');
        if (m.cyclomaticComplexity > 15) reason.push('Complex code');
        if (m.linesOfCode > 300) reason.push('Large file');
        if (m.testCoverage === 0) reason.push('No tests');
        if ((m.criticalIssues || 0) > 0) reason.push(`${m.criticalIssues} critical issues`);

        return {
          filePath: m.filePath,
          loc: m.linesOfCode,
          complexity: m.cyclomaticComplexity,
          riskScore: Math.round(m.riskScore),
          coverage: m.testCoverage || 0,
          priority,
          reason: reason.join(', ') || 'Low coverage',
        };
      })
      .sort((a, b) => b.priority - a.priority)
      .slice(0, limit);
  }

  /**
   * Helper: Create empty metrics object
   */
  private createEmptyMetrics(): FolderMetricsDto {
    return {
      fileCount: 0,
      totalLoc: 0,
      avgComplexity: 0,
      avgCognitiveComplexity: 0,
      avgMaintainability: 0,
      avgCoverage: 0,
      avgRiskScore: 0,
      uncoveredFiles: 0,
      criticalIssues: 0,
      healthScore: 0,
    };
  }

  /**
   * Helper: Aggregate metrics from children to parent
   */
  private aggregateMetrics(node: FolderNodeDto): void {
    if (!node.children || node.children.length === 0) {
      return;
    }

    // First, recursively aggregate children
    for (const child of node.children) {
      if (child.type === 'folder') {
        this.aggregateMetrics(child);
      }
    }

    // Then aggregate this node's metrics from children
    let totalFiles = 0;
    let totalLoc = 0;
    let weightedComplexity = 0;
    let weightedCognitive = 0;
    let weightedMaintainability = 0;
    let weightedCoverage = 0;
    let weightedRiskScore = 0;
    let uncoveredFiles = 0;
    let criticalIssues = 0;

    for (const child of node.children) {
      const childMetrics = child.metrics;
      totalFiles += childMetrics.fileCount;
      totalLoc += childMetrics.totalLoc;

      // Weight by LOC for averages
      weightedComplexity += childMetrics.avgComplexity * childMetrics.totalLoc;
      weightedCognitive += childMetrics.avgCognitiveComplexity * childMetrics.totalLoc;
      weightedMaintainability += childMetrics.avgMaintainability * childMetrics.totalLoc;
      weightedCoverage += childMetrics.avgCoverage * childMetrics.totalLoc;
      weightedRiskScore += childMetrics.avgRiskScore * childMetrics.totalLoc;

      uncoveredFiles += childMetrics.uncoveredFiles;
      criticalIssues += childMetrics.criticalIssues;
    }

    // Calculate weighted averages
    const avgComplexity = totalLoc > 0 ? weightedComplexity / totalLoc : 0;
    const avgCognitive = totalLoc > 0 ? weightedCognitive / totalLoc : 0;
    const avgMaintainability = totalLoc > 0 ? weightedMaintainability / totalLoc : 0;
    const avgCoverage = totalLoc > 0 ? weightedCoverage / totalLoc : 0;
    const avgRiskScore = totalLoc > 0 ? weightedRiskScore / totalLoc : 0;

    // Health score: composite of maintainability, coverage, and low complexity
    const complexityScore = Math.max(0, 100 - (avgComplexity * 5));
    const healthScore = Math.round(
      (avgMaintainability * 0.4) + (avgCoverage * 0.3) + (complexityScore * 0.3)
    );

    node.metrics = {
      fileCount: totalFiles,
      totalLoc,
      avgComplexity: Math.round(avgComplexity * 10) / 10,
      avgCognitiveComplexity: Math.round(avgCognitive * 10) / 10,
      avgMaintainability: Math.round(avgMaintainability * 10) / 10,
      avgCoverage: Math.round(avgCoverage * 10) / 10,
      avgRiskScore: Math.round(avgRiskScore * 10) / 10,
      uncoveredFiles,
      criticalIssues,
      healthScore,
    };
  }

  /**
   * Helper: Calculate health score for a single file
   */
  private calculateHealthScore(metric: any): number {
    const complexityScore = Math.max(0, 100 - (metric.cyclomaticComplexity * 5));
    const maintainabilityScore = metric.maintainabilityIndex;
    const coverageScore = metric.testCoverage || 0;

    return Math.round(
      (maintainabilityScore * 0.4) + (coverageScore * 0.3) + (complexityScore * 0.3)
    );
  }

  /**
   * Get status of ongoing or recent code analysis job
   */
  async getAnalysisStatus(projectId: string): Promise<{
    status: 'queued' | 'running' | 'completed' | 'failed' | 'not_found';
    progress?: number;
    message?: string;
    startedAt?: Date;
    completedAt?: Date;
  }> {
    // Get the most recent metrics to check last analysis time
    const recentMetrics = await this.prisma.codeMetrics.findFirst({
      where: { projectId },
      orderBy: { lastAnalyzedAt: 'desc' },
      select: { lastAnalyzedAt: true },
    });

    if (!recentMetrics) {
      return {
        status: 'not_found',
        message: 'No analysis has been run yet',
      };
    }

    // Check if analysis was recent (within last 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    if (recentMetrics.lastAnalyzedAt > fiveMinutesAgo) {
      return {
        status: 'completed',
        message: 'Analysis completed successfully',
        completedAt: recentMetrics.lastAnalyzedAt,
      };
    }

    // For now, we assume if it's older than 5 minutes, any job has completed
    // In the future, we can query the Bull queue directly for job status
    return {
      status: 'completed',
      message: 'Analysis completed',
      completedAt: recentMetrics.lastAnalyzedAt,
    };
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
    // Get current metrics
    const currentMetrics = await this.getProjectMetrics(projectId, { timeRangeDays: 30 });

    // Find the most recent analysis timestamp
    const mostRecentMetric = await this.prisma.codeMetrics.findFirst({
      where: { projectId },
      orderBy: { lastAnalyzedAt: 'desc' },
      select: { lastAnalyzedAt: true },
    });

    if (!mostRecentMetric) {
      // No metrics at all
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

    // Find the previous analysis (any metrics older than current but within last 90 days)
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
      // No previous analysis found
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

    // Get all metrics from the previous analysis (using a small time window around that timestamp)
    const timeWindow = 5 * 60 * 1000; // 5 minutes window
    const previousMetrics = await this.prisma.codeMetrics.findMany({
      where: {
        projectId,
        lastAnalyzedAt: {
          gte: new Date(previousAnalysisTime.getTime() - timeWindow),
          lte: new Date(previousAnalysisTime.getTime() + timeWindow),
        },
      },
    });

    // Calculate previous aggregates
    if (previousMetrics.length === 0) {
      // No previous data, return zeros
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

    // Calculate previous health score
    const prevComplexityScore = Math.max(0, 100 - (prevAvgComplexity * 5));
    const prevHealthScore = Math.round(
      (prevComplexityScore * 0.3) + (prevAvgMaintainability * 0.4) + (prevAvgCoverage * 0.3)
    );

    // Get current files
    const currentFiles = await this.prisma.codeMetrics.findMany({
      where: { projectId },
      select: { filePath: true },
    });

    const currentFilePaths = new Set(currentFiles.map(f => f.filePath));
    const prevFilePaths = new Set(previousMetrics.map(f => f.filePath));

    const newFiles = currentFiles.filter(f => !prevFilePaths.has(f.filePath)).length;
    const deletedFiles = previousMetrics.filter(f => !currentFilePaths.has(f.filePath)).length;

    // Get test counts
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

  /**
   * Get test execution summary (ST-37: Now uses coverage file instead of database)
   */
  async getTestSummary(projectId: string): Promise<{
    totalTests: number;
    passing: number;
    failing: number;
    skipped: number;
    lastExecution?: Date;
    coveragePercentage?: number;
  }> {
    // ST-37 Issue #1: Parse coverage file instead of database query
    return this.getTestSummaryFromCoverage(projectId);
  }

  /**
   * Get detailed file-level changes between current and previous analysis
   */
  async getFileChanges(projectId: string): Promise<any> {
    // Get most recent analysis timestamp
    const mostRecentMetric = await this.prisma.codeMetrics.findFirst({
      where: { projectId },
      orderBy: { lastAnalyzedAt: 'desc' },
    });

    if (!mostRecentMetric) {
      return { files: [] };
    }

    const currentAnalysisTime = mostRecentMetric.lastAnalyzedAt;
    const fiveMinutesAgo = new Date(currentAnalysisTime.getTime() - 5 * 60 * 1000);
    const fiveMinutesLater = new Date(currentAnalysisTime.getTime() + 5 * 60 * 1000);

    // Get all files from current analysis (within 5-minute window)
    const currentFiles = await this.prisma.codeMetrics.findMany({
      where: {
        projectId,
        lastAnalyzedAt: {
          gte: fiveMinutesAgo,
          lte: fiveMinutesLater,
        },
      },
      orderBy: { filePath: 'asc' },
    });

    // Find previous analysis
    const ninetyDaysAgo = new Date(currentAnalysisTime.getTime() - 90 * 24 * 60 * 60 * 1000);
    const previousAnalysisMetric = await this.prisma.codeMetrics.findFirst({
      where: {
        projectId,
        lastAnalyzedAt: {
          lt: fiveMinutesAgo,
          gte: ninetyDaysAgo,
        },
      },
      orderBy: { lastAnalyzedAt: 'desc' },
    });

    if (!previousAnalysisMetric) {
      // No previous analysis - all files are "added"
      return {
        files: currentFiles.map(file => ({
          filePath: file.filePath,
          status: 'added',
          language: file.language,
          current: {
            linesOfCode: file.linesOfCode,
            cyclomaticComplexity: file.cyclomaticComplexity,
            cognitiveComplexity: file.cognitiveComplexity,
            maintainabilityIndex: file.maintainabilityIndex,
            testCoverage: file.testCoverage,
            riskScore: file.riskScore,
          },
          previous: null,
          changes: null,
        })),
      };
    }

    const previousAnalysisTime = previousAnalysisMetric.lastAnalyzedAt;
    const prevFiveMinutesAgo = new Date(previousAnalysisTime.getTime() - 5 * 60 * 1000);
    const prevFiveMinutesLater = new Date(previousAnalysisTime.getTime() + 5 * 60 * 1000);

    // Get all files from previous analysis
    const previousFiles = await this.prisma.codeMetrics.findMany({
      where: {
        projectId,
        lastAnalyzedAt: {
          gte: prevFiveMinutesAgo,
          lte: prevFiveMinutesLater,
        },
      },
    });

    // Create maps for easy lookup
    const currentFilesMap = new Map(currentFiles.map(f => [f.filePath, f]));
    const previousFilesMap = new Map(previousFiles.map(f => [f.filePath, f]));

    const fileChanges = [];

    // Process current files (added or modified)
    for (const currentFile of currentFiles) {
      const previousFile = previousFilesMap.get(currentFile.filePath);

      if (!previousFile) {
        // New file
        fileChanges.push({
          filePath: currentFile.filePath,
          status: 'added',
          language: currentFile.language,
          current: {
            linesOfCode: currentFile.linesOfCode,
            cyclomaticComplexity: currentFile.cyclomaticComplexity,
            cognitiveComplexity: currentFile.cognitiveComplexity,
            maintainabilityIndex: currentFile.maintainabilityIndex,
            testCoverage: currentFile.testCoverage,
            riskScore: currentFile.riskScore,
          },
          previous: null,
          changes: null,
        });
      } else {
        // Modified file - check if any metric changed
        const hasChanges =
          currentFile.linesOfCode !== previousFile.linesOfCode ||
          currentFile.cyclomaticComplexity !== previousFile.cyclomaticComplexity ||
          currentFile.cognitiveComplexity !== previousFile.cognitiveComplexity ||
          Math.abs(currentFile.maintainabilityIndex - previousFile.maintainabilityIndex) > 0.1 ||
          Math.abs((currentFile.testCoverage || 0) - (previousFile.testCoverage || 0)) > 0.1 ||
          Math.abs(currentFile.riskScore - previousFile.riskScore) > 0.1;

        if (hasChanges) {
          fileChanges.push({
            filePath: currentFile.filePath,
            status: 'modified',
            language: currentFile.language,
            current: {
              linesOfCode: currentFile.linesOfCode,
              cyclomaticComplexity: currentFile.cyclomaticComplexity,
              cognitiveComplexity: currentFile.cognitiveComplexity,
              maintainabilityIndex: currentFile.maintainabilityIndex,
              testCoverage: currentFile.testCoverage,
              riskScore: currentFile.riskScore,
            },
            previous: {
              linesOfCode: previousFile.linesOfCode,
              cyclomaticComplexity: previousFile.cyclomaticComplexity,
              cognitiveComplexity: previousFile.cognitiveComplexity,
              maintainabilityIndex: previousFile.maintainabilityIndex,
              testCoverage: previousFile.testCoverage,
              riskScore: previousFile.riskScore,
            },
            changes: {
              linesOfCode: currentFile.linesOfCode - previousFile.linesOfCode,
              cyclomaticComplexity: currentFile.cyclomaticComplexity - previousFile.cyclomaticComplexity,
              cognitiveComplexity: currentFile.cognitiveComplexity - previousFile.cognitiveComplexity,
              maintainabilityIndex: Math.round((currentFile.maintainabilityIndex - previousFile.maintainabilityIndex) * 10) / 10,
              testCoverage: Math.round(((currentFile.testCoverage || 0) - (previousFile.testCoverage || 0)) * 10) / 10,
              riskScore: Math.round((currentFile.riskScore - previousFile.riskScore) * 10) / 10,
            },
          });
        }
      }
    }

    // Process deleted files
    for (const previousFile of previousFiles) {
      if (!currentFilesMap.has(previousFile.filePath)) {
        fileChanges.push({
          filePath: previousFile.filePath,
          status: 'deleted',
          language: previousFile.language,
          current: null,
          previous: {
            linesOfCode: previousFile.linesOfCode,
            cyclomaticComplexity: previousFile.cyclomaticComplexity,
            cognitiveComplexity: previousFile.cognitiveComplexity,
            maintainabilityIndex: previousFile.maintainabilityIndex,
            testCoverage: previousFile.testCoverage,
            riskScore: previousFile.riskScore,
          },
          changes: null,
        });
      }
    }

    return {
      files: fileChanges,
    };
  }

  /**
   * ST-37 Issue #1: Get test summary from coverage file
   * Parses coverage-summary.json instead of querying TestCase database
   * BR-Test-1: Coverage report is source of truth for test metrics
   */
  async getTestSummaryFromCoverage(projectId: string): Promise<{
    totalTests: number;
    passing: number;
    failing: number;
    skipped: number;
    lastExecution?: Date;
    coveragePercentage?: number;
  }> {
    // Get project to find local path
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { localPath: true },
    });

    if (!project?.localPath) {
      throw new NotFoundException('Project local path not configured');
    }

    // Sanitize path to prevent directory traversal
    const sanitizedPath = path.normalize(project.localPath).replace(/\.\./g, '');
    const coveragePath = path.join(sanitizedPath, 'coverage', 'coverage-summary.json');

    // Verify path is within project directory
    if (!coveragePath.startsWith(sanitizedPath)) {
      throw new ForbiddenException('Invalid coverage file path');
    }

    // Read and parse coverage file
    let coverageData: string;
    let coverage: any;
    let lastExecution: Date | undefined;

    try {
      coverageData = fs.readFileSync(coveragePath, 'utf-8');
      lastExecution = fs.statSync(coveragePath).mtime;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new NotFoundException(
          'Coverage report not found. Run tests with --coverage flag.',
        );
      }
      throw error;
    }

    try {
      coverage = JSON.parse(coverageData);
    } catch (error) {
      throw new BadRequestException('Coverage file is corrupted or invalid JSON');
    }

    // Extract coverage percentage
    const coveragePercentage = coverage.total?.lines?.pct || 0;

    // Count test files (BR-Test-2: Total tests = count of test files)
    const testFilePatterns = [
      `${sanitizedPath}/**/*.test.ts`,
      `${sanitizedPath}/**/*.test.tsx`,
      `${sanitizedPath}/**/*.spec.ts`,
      `${sanitizedPath}/**/*.spec.tsx`,
    ];

    let totalTests = 0;
    for (const pattern of testFilePatterns) {
      const files = await glob(pattern, { ignore: '**/node_modules/**' });
      totalTests += files.length;
    }

    this.logger.log(
      `Parsed coverage file for project ${projectId}: ${totalTests} tests, ${coveragePercentage}% coverage`,
    );

    // Coverage files don't track pass/fail, so infer passing = total
    // (actual test execution results would require test runner integration)
    return {
      totalTests,
      passing: totalTests, // Inferred - actual value requires test execution data
      failing: 0,
      skipped: 0,
      lastExecution,
      coveragePercentage,
    };
  }

  /**
   * ST-37 Issue #2: Get recent code analysis runs
   * Queries CodeMetricsSnapshot table with commit linking
   * BR-Analysis-2: Link commit if timestamp matches within ±5 minutes
   */
  async getRecentAnalyses(
    projectId: string,
    limit: number = 7,
  ): Promise<RecentAnalysesResponseDto> {
    // Query recent snapshots
    const snapshots = await this.prisma.codeMetricsSnapshot.findMany({
      where: { projectId },
      orderBy: { snapshotDate: 'desc' },
      take: limit,
    });

    // Get total count
    const total = await this.prisma.codeMetricsSnapshot.count({
      where: { projectId },
    });

    // Transform snapshots to DTOs with commit linking
    const analyses: RecentAnalysisDto[] = await Promise.all(
      snapshots.map(async snapshot => {
        // BR-Analysis-2: Find commit within ±5 minute window
        const fiveMinutesBefore = new Date(snapshot.snapshotDate.getTime() - 5 * 60 * 1000);
        const fiveMinutesAfter = new Date(snapshot.snapshotDate.getTime() + 5 * 60 * 1000);

        const commit = await this.prisma.commit.findFirst({
          where: {
            projectId,
            timestamp: {
              gte: fiveMinutesBefore,
              lte: fiveMinutesAfter,
            },
          },
          orderBy: { timestamp: 'desc' },
          select: { hash: true },
        });

        if (!commit) {
          this.logger.debug(
            `No commit found for snapshot ${snapshot.id} (timestamp: ${snapshot.snapshotDate})`,
          );
        }

        // BR-Analysis-1: Status = "completed" for all snapshots (MVP)
        // Future enhancement: Read Bull queue job status via analysisRunId
        return {
          id: snapshot.id,
          timestamp: snapshot.snapshotDate,
          status: 'completed' as const,
          commitHash: commit?.hash || undefined,
          healthScore: snapshot.healthScore,
          totalFiles: snapshot.totalFiles,
        };
      }),
    );

    this.logger.log(`Found ${analyses.length} recent analyses for project ${projectId}`);

    return {
      analyses,
      total,
      hasMore: total > limit,
    };
  }
}
