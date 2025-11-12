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

@Injectable()
export class CodeMetricsService {
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
    const weightedCoverage = metrics.reduce((sum, m) => sum + ((m.testCoverage || 0) * m.linesOfCode), 0);

    const avgComplexity = totalLoc > 0 ? weightedComplexity / totalLoc : 0;
    const avgMaintainability = totalLoc > 0 ? weightedMaintainability / totalLoc : 0;
    const avgCoverage = totalLoc > 0 ? weightedCoverage / totalLoc : 0;

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
   * Get trend data (mock for now - need historical snapshots)
   */
  async getTrendData(
    projectId: string,
    days: number = 30,
  ): Promise<TrendDataPointDto[]> {
    const current = await this.getProjectMetrics(projectId, { timeRangeDays: days });

    const trends: TrendDataPointDto[] = [];
    for (let i = days; i >= 0; i -= 7) {
      const date = new Date();
      date.setDate(date.getDate() - i);

      trends.push({
        date,
        healthScore: current.healthScore.overallScore + Math.random() * 5 - 2.5,
        coverage: current.healthScore.coverage + Math.random() * 3 - 1.5,
        complexity: current.healthScore.complexity + Math.random() * 0.5 - 0.25,
        techDebt: current.healthScore.techDebtRatio + Math.random() * 2 - 1,
      });
    }

    return trends;
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
      throw new NotFoundException(`No metrics found for project ${projectId}`);
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

        let reason = [];
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
}
