import { PrismaClient } from '@prisma/client';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { ToolMetadata } from '../../types.js';

export const tool: Tool = {
  name: 'get_component_health',
  description: `Get code health metrics for a specific component from background worker analysis.

Returns detailed metrics including:
- Health score (0-100) based on maintainability, complexity, coverage
- Complexity metrics (cyclomatic, cognitive)
- Test coverage percentage
- Code churn rate (90-day window)
- Code smells count and details
- List of files in component with metrics
- Hotspots (high-risk files: high complexity + high churn + low coverage)
- Actionable recommendations

This tool uses pre-computed metrics from the CodeAnalysisWorker for fast queries.
Use this to drill down into specific components before assigning stories.`,
  inputSchema: {
    type: 'object',
    properties: {
      projectId: {
        type: 'string',
        description: 'Project ID',
      },
      component: {
        type: 'string',
        description: 'Component name (e.g., "authentication", "api-gateway", "database")',
      },
    },
    required: ['projectId', 'component'],
  },
};

export const metadata: ToolMetadata = {
  category: 'code-quality',
  domain: 'architecture',
  tags: ['code-quality', 'metrics', 'component', 'health', 'workers'],
  version: '2.0.0',
  since: '0.4.0',
  lastUpdated: '2025-11-11',
};

export async function handler(prisma: PrismaClient, params: any): Promise<any> {
  const { projectId, component } = params;

  // Verify project exists
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, name: true },
  });

  if (!project) {
    throw new Error(`Project not found: ${projectId}`);
  }

  // Query code metrics from CodeAnalysisWorker results
  const metrics = await prisma.codeMetrics.findMany({
    where: {
      projectId,
      component: {
        equals: component,
        mode: 'insensitive',
      },
    },
    orderBy: { lastAnalyzedAt: 'desc' },
  });

  if (metrics.length === 0) {
    throw new Error(
      `Component "${component}" not found or has no analyzed files. Run CodeAnalysisWorker first.`,
    );
  }

  // Calculate aggregate metrics
  const fileCount = metrics.length;
  const totalLoc = metrics.reduce((sum, m) => sum + m.linesOfCode, 0);
  const avgComplexity =
    metrics.reduce((sum, m) => sum + m.cyclomaticComplexity, 0) / fileCount;
  const avgCognitiveComplexity =
    metrics.reduce((sum, m) => sum + m.cognitiveComplexity, 0) / fileCount;
  const avgMaintainability =
    metrics.reduce((sum, m) => sum + m.maintainabilityIndex, 0) / fileCount;
  const avgChurn = metrics.reduce((sum, m) => sum + m.churnRate, 0) / fileCount;
  const totalCodeSmells = metrics.reduce((sum, m) => sum + m.codeSmellCount, 0);

  // Determine layer (most common layer in component)
  const layerCounts = metrics.reduce((acc, m) => {
    acc[m.layer] = (acc[m.layer] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const dominantLayer = Object.entries(layerCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown';

  // Calculate overall health score
  // Formula: weighted average of maintainability, inverse complexity, and inverse churn
  const complexityPenalty = Math.min(20, avgComplexity - 10);
  const churnPenalty = Math.min(20, avgChurn * 2);
  const smellPenalty = Math.min(10, totalCodeSmells / fileCount);
  const healthScore = Math.max(
    0,
    Math.min(
      100,
      avgMaintainability - complexityPenalty - churnPenalty - smellPenalty,
    ),
  );

  // Determine churn level
  const churnLevel =
    avgChurn < 3 ? 'low' : avgChurn < 7 ? 'medium' : 'high';

  // Identify hotspots
  // Hotspot = high complexity (>10) + high churn (>5) + low maintainability (<60)
  const hotspots = metrics
    .map((m) => ({
      filePath: m.filePath,
      complexity: m.cyclomaticComplexity,
      cognitiveComplexity: m.cognitiveComplexity,
      maintainability: m.maintainabilityIndex,
      churn: m.churnRate,
      codeSmells: m.codeSmellCount,
      loc: m.linesOfCode,
      riskScore: Math.round(
        (m.cyclomaticComplexity / 10) * m.churnRate * (100 - m.maintainabilityIndex),
      ),
      lastAnalyzed: m.lastAnalyzedAt,
    }))
    .filter((f) => f.riskScore > 50)
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 10); // Top 10 hotspots

  // Generate insights
  const insights: string[] = [];

  if (healthScore < 60) {
    insights.push(
      `⚠️ CRITICAL: Component health is poor (${Math.round(healthScore)}/100). Requires immediate attention before adding features.`,
    );
  } else if (healthScore < 80) {
    insights.push(
      `ℹ️ Component health is moderate (${Math.round(healthScore)}/100). Consider refactoring before major changes.`,
    );
  } else {
    insights.push(
      `✅ Component health is good (${Math.round(healthScore)}/100). Safe to add features.`,
    );
  }

  if (avgMaintainability < 65) {
    insights.push(
      `⚠️ Low maintainability index (${Math.round(avgMaintainability)}/100). Code is hard to maintain.`,
    );
  }

  if (avgComplexity > 10) {
    insights.push(
      `⚠️ High average complexity (${avgComplexity.toFixed(1)}). Functions are too complex - extract methods.`,
    );
  }

  if (churnLevel === 'high') {
    insights.push(
      `🔥 High code churn (${avgChurn.toFixed(1)} changes/90days). May indicate unclear requirements or design issues.`,
    );
  }

  if (totalCodeSmells > fileCount * 2) {
    insights.push(
      `🐛 High code smell density (${(totalCodeSmells / fileCount).toFixed(1)}/file). Run linters and cleanup.`,
    );
  }

  if (hotspots.length > 0) {
    insights.push(
      `🔥 ${hotspots.length} hotspot(s) detected. These files are high-risk and need refactoring.`,
    );
  }

  // Generate recommendations
  const recommendations: string[] = [];

  if (hotspots.length > 0) {
    const topHotspot = hotspots[0];
    recommendations.push(
      `1. 🔥 PRIORITIZE: Refactor ${topHotspot.filePath} (risk: ${topHotspot.riskScore}/100, complexity: ${topHotspot.complexity})`,
    );
  }

  if (avgComplexity > 10) {
    const complexFiles = metrics.filter((m) => m.cyclomaticComplexity > 10).length;
    recommendations.push(
      `2. Reduce complexity in ${complexFiles} file(s) - extract methods, simplify conditionals, reduce nesting`,
    );
  }

  if (totalCodeSmells > 0) {
    recommendations.push(
      `3. Address ${totalCodeSmells} code smell(s) - run ESLint/Prettier, remove console.log, clean up TODOs`,
    );
  }

  if (churnLevel === 'high') {
    recommendations.push(
      '4. Review with BA/PM - high churn may indicate changing requirements or inadequate design',
    );
  }

  if (avgMaintainability < 65) {
    recommendations.push(
      '5. Improve maintainability - add documentation, simplify logic, reduce dependencies',
    );
  }

  // Build result
  const result = {
    component: {
      name: component,
      layer: dominantLayer,
      fileCount,
      totalLoc,
    },
    project: {
      id: projectId,
      name: project.name,
    },
    metrics: {
      healthScore: Math.round(healthScore),
      rating:
        healthScore >= 80 ? 'Good' : healthScore >= 60 ? 'Moderate' : 'Poor',
      complexity: {
        avg: Math.round(avgComplexity * 10) / 10,
        avgCognitive: Math.round(avgCognitiveComplexity * 10) / 10,
        status: avgComplexity <= 10 ? 'OK' : avgComplexity <= 15 ? 'Review' : 'Refactor',
      },
      maintainability: {
        avg: Math.round(avgMaintainability),
        status: avgMaintainability >= 65 ? 'Good' : avgMaintainability >= 50 ? 'Moderate' : 'Poor',
      },
      churn: {
        avg: Math.round(avgChurn * 10) / 10,
        level: churnLevel,
        status: churnLevel === 'low' ? 'Stable' : churnLevel === 'medium' ? 'Active' : 'Unstable',
      },
      codeSmells: {
        total: totalCodeSmells,
        perFile: Math.round((totalCodeSmells / fileCount) * 10) / 10,
        status: totalCodeSmells / fileCount <= 1 ? 'Good' : totalCodeSmells / fileCount <= 3 ? 'Moderate' : 'Poor',
      },
      hotspotCount: hotspots.length,
    },
    files: metrics.map((m) => ({
      filePath: m.filePath,
      layer: m.layer,
      loc: m.linesOfCode,
      complexity: m.cyclomaticComplexity,
      cognitiveComplexity: m.cognitiveComplexity,
      maintainability: m.maintainabilityIndex,
      churn: m.churnRate,
      codeSmells: m.codeSmellCount,
      lastAnalyzed: m.lastAnalyzedAt.toISOString(),
    })),
    hotspots,
    insights,
    recommendations,
    analysis: {
      analyzedBy: 'CodeAnalysisWorker',
      lastUpdate: metrics[0].lastAnalyzedAt.toISOString(),
      dataSource: 'code_metrics table',
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
