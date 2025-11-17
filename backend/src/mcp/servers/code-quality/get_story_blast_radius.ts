import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import { ToolMetadata } from '../../types.js';

export const tool: Tool = {
  name: 'get_story_blast_radius',
  description: `Analyze the blast radius of a story - what might break if we implement this change.

Calculates:
- Direct file changes (files you'll modify)
- Indirect impact (files that depend on changed files)
- Test files that should be updated
- Related stories that might be affected
- Risk assessment

Critical for preventing breaking changes and planning testing strategy.`,
  inputSchema: {
    type: 'object',
    properties: {
      storyId: {
        type: 'string',
        description: 'Story ID',
      },
      includeSuggestions: {
        type: 'boolean',
        description: 'Include file suggestions if no files linked yet (default: true)',
        default: true,
      },
    },
    required: ['storyId'],
  },
};

export const metadata: ToolMetadata = {
  category: 'stories',
  domain: 'planning',
  tags: ['story', 'impact-analysis', 'risk', 'dependencies'],
  version: '1.0.0',
  since: '0.5.0',
  lastUpdated: '2025-11-12',
};

export async function handler(prisma: PrismaClient, params: any): Promise<any> {
  const { storyId, includeSuggestions = true } = params;

  // Get story with commits
  const story = await prisma.story.findUnique({
    where: { id: storyId },
    select: {
      id: true,
      key: true,
      title: true,
      description: true,
      status: true,
      projectId: true,
      epicId: true,
      technicalComplexity: true,
      commits: {
        select: {
          hash: true,
          message: true,
          timestamp: true,
          files: {
            select: {
              filePath: true,
              locAdded: true,
              locDeleted: true,
            },
          },
        },
        orderBy: { timestamp: 'desc' },
      },
      project: {
        select: { name: true },
      },
    },
  });

  if (!story) {
    throw new Error(`Story not found: ${storyId}`);
  }

  // Get direct file changes from commits
  const directFiles = new Set<string>();
  const fileChanges = new Map<string, { added: number; deleted: number }>();

  for (const commit of story.commits) {
    for (const file of commit.files) {
      directFiles.add(file.filePath);
      const existing = fileChanges.get(file.filePath) || { added: 0, deleted: 0 };
      fileChanges.set(file.filePath, {
        added: existing.added + file.locAdded,
        deleted: existing.deleted + file.locDeleted,
      });
    }
  }

  // If no commits yet and includeSuggestions, get suggested files
  let suggestedFiles: string[] = [];
  if (directFiles.size === 0 && includeSuggestions) {
    // Simple keyword-based suggestion
    const text = `${story.title} ${story.description || ''}`.toLowerCase();
    const allFiles = await prisma.codeMetrics.findMany({
      where: { projectId: story.projectId },
      select: { filePath: true },
      take: 100,
    });

    suggestedFiles = allFiles
      .filter((f) => {
        const fileLower = f.filePath.toLowerCase();
        return (
          text.includes('auth') && fileLower.includes('auth') ||
          text.includes('user') && fileLower.includes('user') ||
          text.includes('payment') && fileLower.includes('payment') ||
          text.includes('email') && fileLower.includes('email')
        );
      })
      .map((f) => f.filePath)
      .slice(0, 5);
  }

  const filesToAnalyze = directFiles.size > 0
    ? Array.from(directFiles)
    : suggestedFiles;

  // Get metrics for direct files
  const directFileMetrics = await prisma.codeMetrics.findMany({
    where: {
      projectId: story.projectId,
      filePath: { in: filesToAnalyze },
    },
    select: {
      filePath: true,
      linesOfCode: true,
      cyclomaticComplexity: true,
      maintainabilityIndex: true,
      testCoverage: true,
      metadata: true,
    },
  });

  // Calculate indirect impact (files that depend on changed files)
  const indirectFiles = new Set<string>();
  const testFiles = new Set<string>();

  for (const fileMetric of directFileMetrics) {
    const metadata = (fileMetric.metadata as any) || {};
    const importedBy = metadata.importedBy || [];

    for (const dependent of importedBy) {
      indirectFiles.add(dependent);

      // Check if it's a test file
      if (dependent.includes('.spec.') || dependent.includes('.test.')) {
        testFiles.add(dependent);
      }
    }

    // Add corresponding test file
    const testVariants = [
      fileMetric.filePath.replace('.ts', '.spec.ts'),
      fileMetric.filePath.replace('.ts', '.test.ts'),
      fileMetric.filePath.replace('.js', '.spec.js'),
      fileMetric.filePath.replace('.js', '.test.js'),
      fileMetric.filePath.replace('.tsx', '.spec.tsx'),
      fileMetric.filePath.replace('.tsx', '.test.tsx'),
    ];

    for (const variant of testVariants) {
      const exists = await prisma.codeMetrics.findFirst({
        where: {
          projectId: story.projectId,
          filePath: variant,
        },
        select: { filePath: true },
      });
      if (exists) {
        testFiles.add(exists.filePath);
      }
    }
  }

  // Remove direct files from indirect set
  for (const file of filesToAnalyze) {
    indirectFiles.delete(file);
  }

  // Calculate risk scores
  const totalComplexity = directFileMetrics.reduce(
    (sum, f) => sum + f.cyclomaticComplexity,
    0,
  );
  const avgComplexity = totalComplexity / (directFileMetrics.length || 1);
  const totalLoc = directFileMetrics.reduce((sum, f) => sum + f.linesOfCode, 0);
  const avgCoverage = directFileMetrics.reduce(
    (sum, f) => sum + (f.testCoverage || 0),
    0,
  ) / (directFileMetrics.length || 1);

  const riskScore =
    (avgComplexity > 15 ? 30 : avgComplexity > 10 ? 20 : 10) +
    (indirectFiles.size > 10 ? 30 : indirectFiles.size > 5 ? 20 : 10) +
    (avgCoverage < 50 ? 30 : avgCoverage < 70 ? 20 : 10) +
    (totalLoc > 1000 ? 20 : totalLoc > 500 ? 10 : 5);

  const riskLevel =
    riskScore >= 70 ? 'HIGH' : riskScore >= 50 ? 'MEDIUM' : 'LOW';

  // Get related stories in same epic
  let relatedStories: any[] = [];
  if (story.epicId) {
    relatedStories = await prisma.story.findMany({
      where: {
        epicId: story.epicId,
        id: { not: storyId },
        status: { notIn: ['done'] },
      },
      select: {
        key: true,
        title: true,
        status: true,
      },
      take: 5,
    });
  }

  // Generate insights
  const insights: string[] = [];

  if (riskLevel === 'HIGH') {
    insights.push(
      `🚨 HIGH RISK: Blast radius is large. ${indirectFiles.size} files indirectly affected.`,
    );
  } else if (riskLevel === 'MEDIUM') {
    insights.push(
      `⚠️ MEDIUM RISK: Moderate impact. ${indirectFiles.size} files indirectly affected.`,
    );
  } else {
    insights.push(
      `✅ LOW RISK: Limited blast radius. ${indirectFiles.size} files indirectly affected.`,
    );
  }

  if (avgCoverage < 50) {
    insights.push(
      `🔴 CRITICAL: Low test coverage (${avgCoverage.toFixed(1)}%). High risk of breaking changes.`,
    );
  } else if (avgCoverage < 70) {
    insights.push(
      `⚠️ WARNING: Moderate test coverage (${avgCoverage.toFixed(1)}%). Add tests before changes.`,
    );
  }

  if (avgComplexity > 15) {
    insights.push(
      `🔥 COMPLEX CODE: Average complexity ${avgComplexity.toFixed(1)}. Consider refactoring first.`,
    );
  }

  if (testFiles.size === 0 && directFiles.size > 0) {
    insights.push(
      `⚠️ NO TEST FILES: Changed files have no corresponding tests. Tests should be added.`,
    );
  }

  if (relatedStories.length > 0) {
    insights.push(
      `📋 RELATED WORK: ${relatedStories.length} related stories in same epic. Coordinate changes.`,
    );
  }

  const result = {
    story: {
      id: story.id,
      key: story.key,
      title: story.title,
      status: story.status,
      complexity: story.technicalComplexity,
      project: story.project.name,
    },
    blastRadius: {
      risk: {
        score: riskScore,
        level: riskLevel,
        description:
          riskLevel === 'HIGH'
            ? 'High risk - extensive testing and staged rollout required'
            : riskLevel === 'MEDIUM'
            ? 'Medium risk - thorough testing recommended'
            : 'Low risk - standard testing sufficient',
      },
      direct: {
        fileCount: filesToAnalyze.length,
        totalLoc,
        avgComplexity: Math.round(avgComplexity * 10) / 10,
        avgCoverage: Math.round(avgCoverage * 10) / 10,
        files: directFileMetrics.map((f) => ({
          path: f.filePath,
          loc: f.linesOfCode,
          complexity: f.cyclomaticComplexity,
          coverage: f.testCoverage || 0,
          maintainability: Math.round(f.maintainabilityIndex),
          changes: fileChanges.get(f.filePath),
        })),
      },
      indirect: {
        fileCount: indirectFiles.size,
        files: Array.from(indirectFiles).slice(0, 20),
      },
      tests: {
        fileCount: testFiles.size,
        files: Array.from(testFiles),
        recommendation:
          testFiles.size === 0
            ? 'Create test files for all changed files'
            : testFiles.size < filesToAnalyze.length
            ? 'Add missing test files'
            : 'Update existing tests',
      },
    },
    relatedStories,
    insights,
    recommendations: [
      riskLevel === 'HIGH'
        ? '1. 🚨 Break into smaller stories if possible'
        : '1. ✅ Story scope is manageable',
      testFiles.size === 0
        ? '2. 📝 Write tests BEFORE making changes (TDD)'
        : '2. 📝 Update tests alongside changes',
      avgComplexity > 15
        ? '3. 🔨 Refactor complex files before adding features'
        : '3. ✅ Code complexity is acceptable',
      indirectFiles.size > 10
        ? '4. 🧪 Integration tests required for dependent files'
        : '4. 🧪 Unit tests should be sufficient',
      '5. 📋 Review and coordinate with related stories',
      riskLevel === 'HIGH'
        ? '6. 🚀 Plan staged rollout with feature flags'
        : '6. 🚀 Standard deployment process',
    ],
    analysis: {
      commitsAnalyzed: story.commits.length,
      estimatedWork:
        riskLevel === 'HIGH'
          ? 'Large - consider breaking down'
          : riskLevel === 'MEDIUM'
          ? 'Medium - 1-2 days'
          : 'Small - few hours',
      suggestedFiles: directFiles.size === 0 ? suggestedFiles : [],
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
