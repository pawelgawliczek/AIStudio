import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import { ToolMetadata } from '../../types.js';

export const tool: Tool = {
  name: 'get_architect_insights',
  description: 'Get AI-powered architecture insights for a project. Returns health assessment, high-risk hotspots, and quality issues. Helps identify technical debt.',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: {
        type: 'string',
        description: 'Project ID',
      },
      timeRangeDays: {
        type: 'number',
        description: 'Time range in days for analysis (default: 30)',
        default: 30,
      },
      includeHotspots: {
        type: 'boolean',
        description: 'Include list of hotspot files (default: true)',
        default: true,
      },
      hotspotLimit: {
        type: 'number',
        description: 'Number of hotspots to include (default: 10)',
        default: 10,
      },
    },
    required: ['projectId'],
  },
};

export const metadata: ToolMetadata = {
  category: 'code-quality',
  domain: 'architecture',
  tags: ['code-quality', 'metrics', 'insights', 'architecture', 'technical-debt'],
  version: '1.0.0',
  since: '0.3.0',
  lastUpdated: '2025-11-10',
};

export async function handler(prisma: PrismaClient, params: any): Promise<any> {
  const { projectId, timeRangeDays = 30, includeHotspots = true, hotspotLimit = 10 } = params;

  // Verify project exists
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    throw new Error(`Project not found: ${projectId}`);
  }

  // Calculate date range
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - timeRangeDays);

  // Get commits in time range
  const commits = await prisma.commit.findMany({
    where: {
      projectId,
      timestamp: { gte: startDate },
    },
    include: {
      files: true,
      story: true,
    },
    orderBy: { timestamp: 'desc' },
  });

  // Calculate overall metrics
  const fileMetrics = new Map<string, any>();
  let totalLoc = 0;
  let totalComplexity = 0;
  let totalCoverage = 0;
  let fileCount = 0;

  for (const commit of commits) {
    for (const file of commit.files) {
      if (!fileMetrics.has(file.filePath)) {
        const complexity = file.complexityAfter || file.complexityBefore || 0;
        const coverage = Number(file.coverageAfter || file.coverageBefore || 0);
        const loc = file.locAdded;
        const churnCount = commits.filter(c =>
          c.files.some(f => f.filePath === file.filePath)
        ).length;

        fileMetrics.set(file.filePath, {
          filePath: file.filePath,
          complexity,
          coverage,
          loc,
          churnCount,
          lastModified: commit.timestamp,
          lastStoryKey: commit.story?.key,
        });

        totalLoc += loc;
        totalComplexity += complexity;
        totalCoverage += coverage;
        fileCount++;
      }
    }
  }

  const avgComplexity = fileCount > 0 ? totalComplexity / fileCount : 0;
  const avgCoverage = fileCount > 0 ? totalCoverage / fileCount : 0;

  // Calculate overall health score
  const coverageScore = avgCoverage;
  const complexityScore = Math.max(0, 100 - (avgComplexity * 5));
  const problematicFiles = Array.from(fileMetrics.values()).filter(f =>
    f.complexity > 10 || f.coverage < 70
  );
  const techDebtRatio = fileCount > 0 ? (problematicFiles.length / fileCount) * 100 : 0;
  const techDebtScore = Math.max(0, 100 - techDebtRatio);
  const overallHealthScore = Math.round(coverageScore * 0.4 + complexityScore * 0.3 + techDebtScore * 0.3);

  // Calculate risk scores for hotspots
  const hotspots: any[] = [];
  if (includeHotspots) {
    for (const file of fileMetrics.values()) {
      const riskScore = Math.min(100, Math.round(
        (file.complexity * file.churnCount) / (file.coverage + 1)
      ));

      if (riskScore >= 50) {
        hotspots.push({
          filePath: file.filePath,
          riskScore,
          complexity: file.complexity,
          churnCount: file.churnCount,
          coverage: file.coverage,
          loc: file.loc,
          lastModified: file.lastModified.toISOString(),
          lastStoryKey: file.lastStoryKey,
        });
      }
    }

    // Sort by risk score descending and limit
    hotspots.sort((a, b) => b.riskScore - a.riskScore);
    hotspots.splice(hotspotLimit);
  }

  // Generate insights
  const insights: string[] = [];

  if (overallHealthScore < 60) {
    insights.push('⚠️ Overall code health is below target (60/100). Consider scheduling refactoring work.');
  } else if (overallHealthScore < 80) {
    insights.push('ℹ️ Code health is moderate. Focus on improving test coverage and reducing complexity.');
  } else {
    insights.push('✅ Code health is good. Continue current practices.');
  }

  if (avgCoverage < 70) {
    insights.push(`⚠️ Test coverage (${Math.round(avgCoverage)}%) is below target (80%). ${fileCount - Math.floor(fileCount * avgCoverage / 100)} files need tests.`);
  }

  if (avgComplexity > 10) {
    insights.push(`⚠️ Average complexity (${avgComplexity.toFixed(1)}) exceeds threshold (10). Consider breaking down complex functions.`);
  }

  if (hotspots.length > 5) {
    insights.push(`🔥 ${hotspots.length} high-risk hotspots detected. Prioritize refactoring these files.`);
  }

  if (techDebtRatio > 20) {
    insights.push(`📊 Technical debt ratio (${techDebtRatio.toFixed(1)}%) is high. ${problematicFiles.length} files need attention.`);
  }

  // Recommendations
  const recommendations: string[] = [];

  if (hotspots.length > 0) {
    const topHotspot = hotspots[0];
    recommendations.push(`1. Refactor ${topHotspot.filePath} (risk: ${topHotspot.riskScore}/100) - high complexity (${topHotspot.complexity}) and churn (${topHotspot.churnCount}×)`);
  }

  if (avgCoverage < 70) {
    recommendations.push('2. Increase test coverage - focus on files with <70% coverage');
  }

  if (avgComplexity > 10) {
    recommendations.push('3. Reduce cyclomatic complexity - extract methods, apply SOLID principles');
  }

  recommendations.push('4. Review and address security issues flagged by static analysis tools');

  const result = {
    project: {
      id: projectId,
      name: project.name,
    },
    timeRange: {
      days: timeRangeDays,
      from: startDate.toISOString(),
      to: new Date().toISOString(),
    },
    summary: {
      overallHealthScore,
      rating: overallHealthScore >= 80 ? 'Good' : overallHealthScore >= 60 ? 'Moderate' : 'Poor',
      totalFiles: fileCount,
      totalLoc,
      avgComplexity: Math.round(avgComplexity * 10) / 10,
      avgCoverage: Math.round(avgCoverage),
      techDebtRatio: Math.round(techDebtRatio * 10) / 10,
    },
    hotspots: includeHotspots ? hotspots : undefined,
    insights,
    recommendations,
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
