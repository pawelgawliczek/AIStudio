import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import { ToolMetadata } from '../../types/index.js';

export const tool: Tool = {
  name: 'analyze_file_impact',
  description: 'Analyze which use cases are affected by file changes. Returns use cases, confidence scores, risk levels, and test coverage. For impact analysis and PR risk assessment.',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: {
        type: 'string',
        description: 'Project ID',
      },
      filePaths: {
        type: 'array',
        items: { type: 'string' },
        description: 'Array of file paths (relative to repo root)',
      },
      minConfidence: {
        type: 'number',
        description: 'Minimum confidence threshold (0.0-1.0, default 0.5)',
      },
      includeIndirect: {
        type: 'boolean',
        description:
          'Include indirectly related use cases (default false)',
      },
    },
    required: ['projectId', 'filePaths'],
  },
};

export const metadata: ToolMetadata = {
  category: 'code-quality',
  domain: 'impact-analysis',
  tags: ['impact', 'analysis', 'risk', 'files', 'use-cases'],
  version: '1.0.0',
  since: '0.6.0',
  lastUpdated: '2025-11-13',
};

export async function handler(prisma: PrismaClient, params: any): Promise<any> {
  const {
    projectId,
    filePaths,
    minConfidence = 0.5,
    includeIndirect = false,
  } = params;

  if (!projectId) {
    throw new Error('projectId is required');
  }
  if (!filePaths || !Array.isArray(filePaths) || filePaths.length === 0) {
    throw new Error('filePaths must be a non-empty array');
  }

  // Verify project exists
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    throw new Error(`Project ${projectId} not found`);
  }

  // Get all file-to-usecase mappings for these files
  const mappings = await prisma.fileUseCaseLink.findMany({
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
  const useCaseMap = new Map<string, any>();

  for (const mapping of mappings) {
    if (!useCaseMap.has(mapping.useCaseId)) {
      // Calculate test coverage for this use case
      const testCases = await prisma.testCase.findMany({
        where: { useCaseId: mapping.useCaseId },
        include: {
          executions: {
            orderBy: { executedAt: 'desc' },
            take: 1,
          },
        },
      });

      const coverages = testCases
        .map((tc) =>
          tc.executions[0]?.coveragePercentage
            ? parseFloat(tc.executions[0].coveragePercentage.toString())
            : 0,
        )
        .filter((c) => c > 0);

      const testCoverage =
        coverages.length > 0
          ? coverages.reduce((sum, c) => sum + c, 0) / coverages.length
          : 0;

      useCaseMap.set(mapping.useCaseId, {
        useCaseId: mapping.useCaseId,
        useCaseKey: mapping.useCase.key,
        title: mapping.useCase.title,
        area: mapping.useCase.area,
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
      lastSeen: mapping.lastSeenAt.toISOString(),
      occurrences: mapping.occurrences,
    });

    // Update max confidence
    useCase.confidence = Math.max(useCase.confidence, mapping.confidence);
  }

  // Calculate risk levels
  const affectedUseCases = [];

  for (const useCase of useCaseMap.values()) {
    // Get code metrics for affected files
    const fileMetrics = await prisma.codeMetrics.findMany({
      where: {
        projectId,
        filePath: {
          in: useCase.affectedByFiles.map((f: any) => f.filePath),
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
    const maxRiskScore = Math.max(...fileMetrics.map((m) => m.riskScore), 0);

    if (
      useCase.confidence >= 0.8 &&
      (maxRiskScore > 50 ||
        avgComplexity > 10 ||
        avgMaintainability < 60 ||
        useCase.testCoverage < 70)
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
    recommendation = `⚠️  HIGH IMPACT: ${highRisk} high-risk use case(s) affected. Review carefully before deployment.`;
  } else if (mediumRisk > 0) {
    recommendation = `⚡ MEDIUM IMPACT: ${mediumRisk} use case(s) affected. Standard review recommended.`;
  } else if (lowRisk > 0) {
    recommendation = `✅ LOW IMPACT: ${lowRisk} use case(s) affected. Proceed with normal workflow.`;
  }

  const result = {
    projectId,
    projectName: project.name,
    filesAnalyzed: filePaths,
    affectedUseCases,
    summary: {
      totalUseCases: affectedUseCases.length,
      highRisk,
      mediumRisk,
      lowRisk,
      avgConfidence: Math.round(avgConfidence * 100) / 100,
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
