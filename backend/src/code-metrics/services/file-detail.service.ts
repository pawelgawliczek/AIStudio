import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FileDetailDto } from '../dto';

/**
 * File-level metrics and change tracking
 */
@Injectable()
export class FileDetailService {
  constructor(private prisma: PrismaService) {}

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
   * Get detailed file-level changes between analyses
   */
  async getFileChanges(projectId: string): Promise<any> {
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
          previous: null as any,
          changes: null as any,
        })),
      };
    }

    const previousAnalysisTime = previousAnalysisMetric.lastAnalyzedAt;
    const prevFiveMinutesAgo = new Date(previousAnalysisTime.getTime() - 5 * 60 * 1000);
    const prevFiveMinutesLater = new Date(previousAnalysisTime.getTime() + 5 * 60 * 1000);

    const previousFiles = await this.prisma.codeMetrics.findMany({
      where: {
        projectId,
        lastAnalyzedAt: {
          gte: prevFiveMinutesAgo,
          lte: prevFiveMinutesLater,
        },
      },
    });

    const currentFilesMap = new Map(currentFiles.map(f => [f.filePath, f]));
    const previousFilesMap = new Map(previousFiles.map(f => [f.filePath, f]));

    const fileChanges = [];

    for (const currentFile of currentFiles) {
      const previousFile = previousFilesMap.get(currentFile.filePath);

      if (!previousFile) {
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
}
