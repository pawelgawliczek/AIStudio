import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FolderNodeDto, FolderMetricsDto, CoverageGapDto } from '../dto';
import { RecentAnalysisDto, RecentAnalysesResponseDto } from '../dto/recent-analysis.dto';

/**
 * ST-37, ST-18: Code Analysis Service
 * Handles analysis history, folder hierarchy, and coverage gaps
 */
@Injectable()
export class AnalysisService {
  private readonly logger = new Logger(AnalysisService.name);

  constructor(private prisma: PrismaService) {}

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

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    if (recentMetrics.lastAnalyzedAt > fiveMinutesAgo) {
      return {
        status: 'completed',
        message: 'Analysis completed successfully',
        completedAt: recentMetrics.lastAnalyzedAt,
      };
    }

    return {
      status: 'completed',
      message: 'Analysis completed',
      completedAt: recentMetrics.lastAnalyzedAt,
    };
  }

  /**
   * ST-37 Issue #2: Get recent code analysis runs
   */
  async getRecentAnalyses(
    projectId: string,
    limit: number = 7,
  ): Promise<RecentAnalysesResponseDto> {
    const snapshots = await this.prisma.codeMetricsSnapshot.findMany({
      where: { projectId },
      orderBy: { snapshotDate: 'desc' },
      take: limit,
    });

    const total = await this.prisma.codeMetricsSnapshot.count({
      where: { projectId },
    });

    const analyses: RecentAnalysisDto[] = await Promise.all(
      snapshots.map(async snapshot => {
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

  /**
   * Get hierarchical folder structure with aggregated metrics
   */
  async getFolderHierarchy(projectId: string): Promise<FolderNodeDto> {
    const metrics = await this.prisma.codeMetrics.findMany({
      where: { projectId },
    });

    if (metrics.length === 0) {
      return {
        path: '',
        name: 'root',
        type: 'folder',
        metrics: this.createEmptyMetrics(),
        children: [],
      };
    }

    const root: FolderNodeDto = {
      path: '',
      name: 'root',
      type: 'folder',
      metrics: this.createEmptyMetrics(),
      children: [],
    };

    for (const metric of metrics) {
      const parts = metric.filePath.split('/');
      let current = root;

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
        testCoverage: { lt: 50 },
      },
      orderBy: [
        { riskScore: 'desc' },
        { cyclomaticComplexity: 'desc' },
      ],
      take: limit * 2,
    });

    return metrics
      .map(m => {
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

  private aggregateMetrics(node: FolderNodeDto): void {
    if (!node.children || node.children.length === 0) {
      return;
    }

    for (const child of node.children) {
      if (child.type === 'folder') {
        this.aggregateMetrics(child);
      }
    }

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

      weightedComplexity += childMetrics.avgComplexity * childMetrics.totalLoc;
      weightedCognitive += childMetrics.avgCognitiveComplexity * childMetrics.totalLoc;
      weightedMaintainability += childMetrics.avgMaintainability * childMetrics.totalLoc;
      weightedCoverage += childMetrics.avgCoverage * childMetrics.totalLoc;
      weightedRiskScore += childMetrics.avgRiskScore * childMetrics.totalLoc;

      uncoveredFiles += childMetrics.uncoveredFiles;
      criticalIssues += childMetrics.criticalIssues;
    }

    const avgComplexity = totalLoc > 0 ? weightedComplexity / totalLoc : 0;
    const avgCognitive = totalLoc > 0 ? weightedCognitive / totalLoc : 0;
    const avgMaintainability = totalLoc > 0 ? weightedMaintainability / totalLoc : 0;
    const avgCoverage = totalLoc > 0 ? weightedCoverage / totalLoc : 0;
    const avgRiskScore = totalLoc > 0 ? weightedRiskScore / totalLoc : 0;

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

  private calculateHealthScore(metric: any): number {
    const complexityScore = Math.max(0, 100 - (metric.cyclomaticComplexity * 5));
    const maintainabilityScore = metric.maintainabilityIndex;
    const coverageScore = metric.testCoverage || 0;

    return Math.round(
      (maintainabilityScore * 0.4) + (coverageScore * 0.3) + (complexityScore * 0.3)
    );
  }
}
