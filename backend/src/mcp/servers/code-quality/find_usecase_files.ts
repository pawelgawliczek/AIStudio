import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import { ToolMetadata } from '../../types/index.js';

export const tool: Tool = {
  name: 'find_usecase_files',
  description: 'Find all files that implement a use case. Returns files with confidence scores, code metrics, and risk assessment. For refactoring and impact analysis.',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: {
        type: 'string',
        description: 'Project ID',
      },
      useCaseId: {
        type: 'string',
        description: 'Use case ID (UUID)',
      },
      useCaseKey: {
        type: 'string',
        description: 'Use case key (e.g., UC-AUTH-001)',
      },
      minConfidence: {
        type: 'number',
        description: 'Minimum confidence threshold (0.0-1.0, default 0.5)',
      },
      includeMetrics: {
        type: 'boolean',
        description: 'Include code metrics for files (default true)',
      },
    },
    required: ['projectId'],
  },
};

export const metadata: ToolMetadata = {
  category: 'code-quality',
  domain: 'impact-analysis',
  tags: ['use-cases', 'files', 'implementation', 'metrics'],
  version: '1.0.0',
  since: '0.6.0',
  lastUpdated: '2025-11-13',
};

export async function handler(prisma: PrismaClient, params: any): Promise<any> {
  const {
    projectId,
    useCaseId,
    useCaseKey,
    minConfidence = 0.5,
    includeMetrics = true,
  } = params;

  if (!projectId) {
    throw new Error('projectId is required');
  }
  if (!useCaseId && !useCaseKey) {
    throw new Error('Either useCaseId or useCaseKey is required');
  }

  // Find use case
  const useCase = await prisma.useCase.findFirst({
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
      project: {
        select: {
          name: true,
        },
      },
    },
  });

  if (!useCase) {
    throw new Error(`Use case ${useCaseId || useCaseKey} not found`);
  }

  // Get file mappings
  const mappings = await prisma.fileUseCaseLink.findMany({
    where: {
      projectId,
      useCaseId: useCase.id,
      confidence: { gte: minConfidence },
    },
    orderBy: {
      confidence: 'desc',
    },
  });

  const implementingFiles = [];

  for (const mapping of mappings) {
    const file: any = {
      filePath: mapping.filePath,
      confidence: mapping.confidence,
      source: mapping.source,
      lastSeen: mapping.lastSeenAt.toISOString(),
      occurrences: mapping.occurrences,
    };

    if (includeMetrics) {
      // Get code metrics
      const metrics = await prisma.codeMetrics.findFirst({
        where: {
          projectId,
          filePath: mapping.filePath,
        },
      });

      if (metrics) {
        file.metrics = {
          linesOfCode: metrics.linesOfCode,
          cyclomaticComplexity: metrics.cyclomaticComplexity,
          maintainabilityIndex: Math.round(metrics.maintainabilityIndex),
          testCoverage: metrics.testCoverage || 0,
          churnRate: metrics.churnRate,
          riskScore: Math.round(metrics.riskScore * 10) / 10,
        };

        // Add warnings
        if (metrics.cyclomaticComplexity > 15) {
          file.warning = 'High complexity - refactor before changes';
        } else if (metrics.maintainabilityIndex < 50) {
          file.warning = 'Low maintainability';
        } else if (metrics.riskScore > 50) {
          file.warning = 'High risk file';
        }
      }

      // Get recent commits for this file
      const recentCommits = await prisma.commitFile.findMany({
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
        hash: cf.commit.hash.substring(0, 7),
        message: cf.commit.message,
        author: cf.commit.author,
        timestamp: cf.commit.timestamp.toISOString(),
      }));
    }

    implementingFiles.push(file);
  }

  // Calculate summary
  const filesWithMetrics = implementingFiles.filter((f) => f.metrics);
  const totalLOC = filesWithMetrics.reduce(
    (sum, f) => sum + (f.metrics?.linesOfCode || 0),
    0,
  );
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
    (f) => f.metrics && f.metrics.riskScore > 30 && f.metrics.riskScore <= 50,
  ).length;

  let recommendation = '✅ Well-tested use case with good maintainability.';
  if (highRiskFiles > 0) {
    recommendation = `⚠️  ${highRiskFiles} high-risk file(s) detected. Consider refactoring before changes.`;
  } else if (avgTestCoverage < 70) {
    recommendation = '📝 Low test coverage. Add more tests before changes.';
  } else if (avgMaintainability < 60) {
    recommendation = '🔧 Low maintainability. Refactor before major changes.';
  }

  const result = {
    projectId,
    projectName: useCase.project.name,
    useCase: {
      id: useCase.id,
      key: useCase.key,
      title: useCase.title,
      area: useCase.area,
    },
    implementingFiles,
    stories: useCase.storyLinks.map((link) => ({
      key: link.story.key,
      title: link.story.title,
      status: link.story.status,
    })),
    summary: {
      totalFiles: implementingFiles.length,
      totalLOC,
      avgComplexity: Math.round(avgComplexity * 10) / 10,
      avgMaintainability: Math.round(avgMaintainability),
      avgTestCoverage: Math.round(avgTestCoverage * 10) / 10,
      avgConfidence: Math.round(avgConfidence * 100) / 100,
      highRiskFiles,
      mediumRiskFiles,
      recommendation,
    },
  };

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
}
