import { Injectable, NotFoundException } from '@nestjs/common';
import { MappingSource } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface FileToUseCasesQuery {
  projectId: string;
  filePaths: string[];
  minConfidence?: number;
  includeIndirect?: boolean;
}

export interface UseCaseToFilesQuery {
  projectId: string;
  useCaseId?: string;
  useCaseKey?: string;
  minConfidence?: number;
  includeMetrics?: boolean;
}

export interface AffectedUseCase {
  useCaseId: string;
  useCaseKey: string;
  title: string;
  area?: string;
  confidence: number;
  affectedByFiles: {
    filePath: string;
    source: MappingSource;
    confidence: number;
    lastSeen: Date;
    occurrences: number;
  }[];
  riskLevel: 'low' | 'medium' | 'high';
  relatedStories: {
    key: string;
    title: string;
    status: string;
  }[];
  testCoverage?: number;
}

export interface ImplementingFile {
  filePath: string;
  confidence: number;
  source: MappingSource;
  lastSeen: Date;
  occurrences: number;
  metrics?: {
    linesOfCode: number;
    cyclomaticComplexity: number;
    maintainabilityIndex: number;
    testCoverage: number;
    churnRate: number;
    riskScore: number;
  };
  recentCommits?: {
    hash: string;
    message: string;
    author: string;
    timestamp: Date;
  }[];
  relatedFiles?: string[];
}

@Injectable()
export class ImpactAnalysisService {
  constructor(private prisma: PrismaService) {}

  /**
   * Given file path(s), return which use cases are affected
   */
  async getAffectedUseCases(
    query: FileToUseCasesQuery,
  ): Promise<{
    projectId: string;
    filesAnalyzed: string[];
    affectedUseCases: AffectedUseCase[];
    summary: {
      totalUseCases: number;
      highRisk: number;
      mediumRisk: number;
      lowRisk: number;
      avgConfidence: number;
      recommendation: string;
    };
  }> {
    const { projectId, filePaths, minConfidence = 0.5 } = query;

    // Verify project exists
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException(`Project ${projectId} not found`);
    }

    // Get all file-to-usecase mappings for these files
    const mappings = await this.prisma.fileUseCaseLink.findMany({
      where: {
        projectId,
        filePath: { in: filePaths },
        confidence: { gte: minConfidence },
      },
      include: {
        useCase: {
          include: {
            storyLinks: {
              include: {
                story: {
                  select: {
                    key: true,
                    title: true,
                    status: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        confidence: 'desc',
      },
    });

    // Group by use case
    const useCaseMap = new Map<string, AffectedUseCase>();

    for (const mapping of mappings) {
      if (!useCaseMap.has(mapping.useCaseId)) {
        // Calculate test coverage for this use case
        const testCoverage = await this.calculateUseCaseTestCoverage(
          mapping.useCaseId,
        );

        useCaseMap.set(mapping.useCaseId, {
          useCaseId: mapping.useCaseId,
          useCaseKey: mapping.useCase.key,
          title: mapping.useCase.title,
          area: mapping.useCase.area ?? undefined,
          confidence: mapping.confidence,
          affectedByFiles: [],
          riskLevel: 'low',
          relatedStories: mapping.useCase.storyLinks.map((link) => ({
            key: link.story.key,
            title: link.story.title,
            status: link.story.status,
          })),
          testCoverage,
        });
      }

      const useCase = useCaseMap.get(mapping.useCaseId)!;
      useCase.affectedByFiles.push({
        filePath: mapping.filePath,
        source: mapping.source,
        confidence: mapping.confidence,
        lastSeen: mapping.lastSeenAt,
        occurrences: mapping.occurrences,
      });

      // Update max confidence
      useCase.confidence = Math.max(useCase.confidence, mapping.confidence);
    }

    // Calculate risk levels and get metrics for affected files
    const affectedUseCases: AffectedUseCase[] = [];

    for (const useCase of useCaseMap.values()) {
      // Get code metrics for affected files
      const fileMetrics = await this.prisma.codeMetrics.findMany({
        where: {
          projectId,
          filePath: {
            in: useCase.affectedByFiles.map((f) => f.filePath),
          },
        },
        select: {
          filePath: true,
          cyclomaticComplexity: true,
          maintainabilityIndex: true,
          riskScore: true,
        },
      });

      // Calculate risk level
      const avgComplexity =
        fileMetrics.reduce((sum, m) => sum + m.cyclomaticComplexity, 0) /
          (fileMetrics.length || 1);
      const avgMaintainability =
        fileMetrics.reduce((sum, m) => sum + m.maintainabilityIndex, 0) /
          (fileMetrics.length || 1);
      const maxRiskScore = Math.max(
        ...fileMetrics.map((m) => m.riskScore),
        0,
      );

      if (
        useCase.confidence >= 0.8 &&
        (maxRiskScore > 50 ||
          avgComplexity > 10 ||
          avgMaintainability < 60 ||
          (useCase.testCoverage && useCase.testCoverage < 70))
      ) {
        useCase.riskLevel = 'high';
      } else if (
        useCase.confidence >= 0.6 &&
        (maxRiskScore > 30 || avgComplexity > 7 || avgMaintainability < 70)
      ) {
        useCase.riskLevel = 'medium';
      }

      affectedUseCases.push(useCase);
    }

    // Calculate summary
    const highRisk = affectedUseCases.filter(
      (uc) => uc.riskLevel === 'high',
    ).length;
    const mediumRisk = affectedUseCases.filter(
      (uc) => uc.riskLevel === 'medium',
    ).length;
    const lowRisk = affectedUseCases.filter(
      (uc) => uc.riskLevel === 'low',
    ).length;
    const avgConfidence =
      affectedUseCases.reduce((sum, uc) => sum + uc.confidence, 0) /
      (affectedUseCases.length || 1);

    let recommendation = 'No use cases affected.';
    if (highRisk > 0) {
      recommendation = `High impact change. Review ${highRisk} high-risk use case(s) carefully.`;
    } else if (mediumRisk > 0) {
      recommendation = `Medium impact change. Review ${mediumRisk} use case(s) before deployment.`;
    } else if (lowRisk > 0) {
      recommendation = `Low impact change. Standard review process recommended.`;
    }

    return {
      projectId,
      filesAnalyzed: filePaths,
      affectedUseCases,
      summary: {
        totalUseCases: affectedUseCases.length,
        highRisk,
        mediumRisk,
        lowRisk,
        avgConfidence,
        recommendation,
      },
    };
  }

  /**
   * Given a use case, return which files implement it
   */
  async getImplementingFiles(
    query: UseCaseToFilesQuery,
  ): Promise<{
    projectId: string;
    useCase: {
      id: string;
      key: string;
      title: string;
      area?: string;
    };
    implementingFiles: ImplementingFile[];
    relatedUseCases: {
      key: string;
      title: string;
      sharedFiles: number;
      relation: string;
    }[];
    stories: {
      key: string;
      title: string;
      status: string;
    }[];
    summary: {
      totalFiles: number;
      totalLOC: number;
      avgComplexity: number;
      avgMaintainability: number;
      avgTestCoverage: number;
      avgConfidence: number;
      highRiskFiles: number;
      mediumRiskFiles: number;
      recommendation: string;
    };
  }> {
    const {
      projectId,
      useCaseId,
      useCaseKey,
      minConfidence = 0.5,
      includeMetrics = true,
    } = query;

    // Find use case
    const useCase = await this.prisma.useCase.findFirst({
      where: {
        projectId,
        ...(useCaseId ? { id: useCaseId } : { key: useCaseKey }),
      },
      include: {
        storyLinks: {
          include: {
            story: {
              select: {
                key: true,
                title: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (!useCase) {
      throw new NotFoundException(
        `Use case ${useCaseId || useCaseKey} not found`,
      );
    }

    // Get file mappings
    const mappings = await this.prisma.fileUseCaseLink.findMany({
      where: {
        projectId,
        useCaseId: useCase.id,
        confidence: { gte: minConfidence },
      },
      orderBy: {
        confidence: 'desc',
      },
    });

    const implementingFiles: ImplementingFile[] = [];

    for (const mapping of mappings) {
      const file: ImplementingFile = {
        filePath: mapping.filePath,
        confidence: mapping.confidence,
        source: mapping.source,
        lastSeen: mapping.lastSeenAt,
        occurrences: mapping.occurrences,
      };

      if (includeMetrics) {
        // Get code metrics
        const metrics = await this.prisma.codeMetrics.findFirst({
          where: {
            projectId,
            filePath: mapping.filePath,
          },
        });

        if (metrics) {
          file.metrics = {
            linesOfCode: metrics.linesOfCode,
            cyclomaticComplexity: metrics.cyclomaticComplexity,
            maintainabilityIndex: metrics.maintainabilityIndex,
            testCoverage: metrics.testCoverage || 0,
            churnRate: metrics.churnRate,
            riskScore: metrics.riskScore,
          };
        }

        // Get recent commits for this file
        const recentCommits = await this.prisma.commitFile.findMany({
          where: {
            filePath: mapping.filePath,
          },
          include: {
            commit: {
              select: {
                hash: true,
                message: true,
                author: true,
                timestamp: true,
              },
            },
          },
          orderBy: {
            commit: {
              timestamp: 'desc',
            },
          },
          take: 3,
        });

        file.recentCommits = recentCommits.map((cf) => ({
          hash: cf.commit.hash,
          message: cf.commit.message,
          author: cf.commit.author,
          timestamp: cf.commit.timestamp,
        }));
      }

      implementingFiles.push(file);
    }

    // Calculate summary
    const totalLOC = implementingFiles.reduce(
      (sum, f) => sum + (f.metrics?.linesOfCode || 0),
      0,
    );
    const filesWithMetrics = implementingFiles.filter((f) => f.metrics);
    const avgComplexity =
      filesWithMetrics.reduce(
        (sum, f) => sum + (f.metrics?.cyclomaticComplexity || 0),
        0,
      ) / (filesWithMetrics.length || 1);
    const avgMaintainability =
      filesWithMetrics.reduce(
        (sum, f) => sum + (f.metrics?.maintainabilityIndex || 0),
        0,
      ) / (filesWithMetrics.length || 1);
    const avgTestCoverage =
      filesWithMetrics.reduce(
        (sum, f) => sum + (f.metrics?.testCoverage || 0),
        0,
      ) / (filesWithMetrics.length || 1);
    const avgConfidence =
      implementingFiles.reduce((sum, f) => sum + f.confidence, 0) /
      (implementingFiles.length || 1);

    const highRiskFiles = implementingFiles.filter(
      (f) => f.metrics && f.metrics.riskScore > 50,
    ).length;
    const mediumRiskFiles = implementingFiles.filter(
      (f) =>
        f.metrics && f.metrics.riskScore > 30 && f.metrics.riskScore <= 50,
    ).length;

    let recommendation = 'Well-tested use case with good maintainability.';
    if (highRiskFiles > 0) {
      recommendation = `${highRiskFiles} high-risk file(s) detected. Consider refactoring.`;
    } else if (avgTestCoverage < 70) {
      recommendation = 'Low test coverage. Add more tests before changes.';
    } else if (avgMaintainability < 60) {
      recommendation = 'Low maintainability. Refactor before major changes.';
    }

    return {
      projectId,
      useCase: {
        id: useCase.id,
        key: useCase.key,
        title: useCase.title,
        area: useCase.area ?? undefined,
      },
      implementingFiles,
      relatedUseCases: [], // TODO: Implement
      stories: useCase.storyLinks.map((link) => ({
        key: link.story.key,
        title: link.story.title,
        status: link.story.status,
      })),
      summary: {
        totalFiles: implementingFiles.length,
        totalLOC,
        avgComplexity,
        avgMaintainability,
        avgTestCoverage,
        avgConfidence,
        highRiskFiles,
        mediumRiskFiles,
        recommendation,
      },
    };
  }

  /**
   * Calculate test coverage for a use case based on its test cases
   */
  private async calculateUseCaseTestCoverage(
    useCaseId: string,
  ): Promise<number> {
    const testCases = await this.prisma.testCase.findMany({
      where: { useCaseId },
      include: {
        executions: {
          orderBy: { executedAt: 'desc' },
          take: 1,
        },
      },
    });

    if (testCases.length === 0) {
      return 0;
    }

    // Get average coverage from latest test executions
    const coverages = testCases
      .map((tc) =>
        tc.executions[0]?.coveragePercentage
          ? parseFloat(tc.executions[0].coveragePercentage.toString())
          : 0,
      )
      .filter((c) => c > 0);

    if (coverages.length === 0) {
      return 0;
    }

    return coverages.reduce((sum, c) => sum + c, 0) / coverages.length;
  }

  /**
   * Create or update file-to-usecase mapping
   */
  async createOrUpdateMapping(data: {
    projectId: string;
    filePath: string;
    useCaseId: string;
    source: MappingSource;
    confidence?: number;
  }): Promise<boolean> {
    const { projectId, filePath, useCaseId, source, confidence = 1.0 } = data;

    // Check if mapping already exists
    const existing = await this.prisma.fileUseCaseLink.findUnique({
      where: {
        projectId_filePath_useCaseId: {
          projectId,
          filePath,
          useCaseId,
        },
      },
    });

    if (existing) {
      // Update: increment occurrences, update confidence if higher
      await this.prisma.fileUseCaseLink.update({
        where: {
          id: existing.id,
        },
        data: {
          occurrences: { increment: 1 },
          confidence: Math.max(existing.confidence, confidence),
          source: source, // Update source to latest
          lastSeenAt: new Date(),
        },
      });
      return false; // Existing mapping updated, not created
    } else {
      // Create new mapping
      await this.prisma.fileUseCaseLink.create({
        data: {
          projectId,
          filePath,
          useCaseId,
          source,
          confidence,
        },
      });
      return true; // New mapping created
    }
  }

  /**
   * Create mappings from a commit
   * Called when a commit is linked to a story
   */
  async createMappingsFromCommit(commitHash: string): Promise<number> {
    // Get commit with files and story
    const commit = await this.prisma.commit.findUnique({
      where: { hash: commitHash },
      include: {
        files: true,
        story: {
          include: {
            useCaseLinks: true,
          },
        },
      },
    });

    if (!commit || !commit.story || commit.story.useCaseLinks.length === 0) {
      return 0;
    }

    let mappingsCreated = 0;

    // For each file in the commit, create mappings to all linked use cases
    for (const file of commit.files) {
      for (const useCaseLink of commit.story.useCaseLinks) {
        const created = await this.createOrUpdateMapping({
          projectId: commit.projectId,
          filePath: file.filePath,
          useCaseId: useCaseLink.useCaseId,
          source: MappingSource.COMMIT_DERIVED,
          confidence: 0.8,
        });
        if (created) {
          mappingsCreated++;
        }
      }
    }

    return mappingsCreated;
  }
}
