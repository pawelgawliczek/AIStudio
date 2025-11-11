import { PrismaClient } from '@prisma/client';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { ToolMetadata } from '../../types.js';

export const tool: Tool = {
  name: 'get_project_health',
  description: `Get overall code health metrics for entire project from background worker analysis.

Returns project-wide metrics including:
- Overall health score (0-100)
- Aggregated metrics by layer (frontend, backend, infrastructure, tests)
- Top 10 components ranked by health
- Critical hotspots that need immediate attention
- Technical debt summary
- Trends over time
- Actionable recommendations

Use this for high-level project assessment and planning refactoring efforts.`,
  inputSchema: {
    type: 'object',
    properties: {
      projectId: {
        type: 'string',
        description: 'Project ID',
      },
    },
    required: ['projectId'],
  },
};

export const metadata: ToolMetadata = {
  category: 'code-quality',
  domain: 'architecture',
  tags: ['code-quality', 'metrics', 'project', 'health', 'workers'],
  version: '1.0.0',
  since: '0.4.0',
  lastUpdated: '2025-11-11',
};

export async function handler(prisma: PrismaClient, params: any): Promise<any> {
  const { projectId } = params;

  // Verify project exists
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, name: true },
  });

  if (!project) {
    throw new Error(`Project not found: ${projectId}`);
  }

  // Query all code metrics for project
  const allMetrics = await prisma.codeMetrics.findMany({
    where: { projectId },
    orderBy: { lastAnalyzedAt: 'desc' },
  });

  if (allMetrics.length === 0) {
    throw new Error(
      'No code metrics found. Run CodeAnalysisWorker first to analyze the codebase.',
    );
  }

  // Calculate project-level aggregates
  const totalFiles = allMetrics.length;
  const totalLoc = allMetrics.reduce((sum, m) => sum + m.linesOfCode, 0);
  const avgComplexity =
    allMetrics.reduce((sum, m) => sum + m.cyclomaticComplexity, 0) / totalFiles;
  const avgMaintainability =
    allMetrics.reduce((sum, m) => sum + m.maintainabilityIndex, 0) / totalFiles;
  const avgChurn = allMetrics.reduce((sum, m) => sum + m.churnRate, 0) / totalFiles;
  const totalCodeSmells = allMetrics.reduce((sum, m) => sum + m.codeSmellCount, 0);

  // Calculate overall health score
  const complexityPenalty = Math.min(20, (avgComplexity - 10) * 2);
  const churnPenalty = Math.min(20, avgChurn * 2);
  const smellPenalty = Math.min(10, totalCodeSmells / totalFiles);
  const healthScore = Math.max(
    0,
    Math.min(
      100,
      avgMaintainability - complexityPenalty - churnPenalty - smellPenalty,
    ),
  );

  // Group by layer
  const layerMetrics = allMetrics.reduce((acc, m) => {
    if (!acc[m.layer]) {
      acc[m.layer] = {
        files: [],
        totalLoc: 0,
        avgComplexity: 0,
        avgMaintainability: 0,
        avgChurn: 0,
        codeSmells: 0,
      };
    }
    acc[m.layer].files.push(m);
    acc[m.layer].totalLoc += m.linesOfCode;
    acc[m.layer].avgComplexity += m.cyclomaticComplexity;
    acc[m.layer].avgMaintainability += m.maintainabilityIndex;
    acc[m.layer].avgChurn += m.churnRate;
    acc[m.layer].codeSmells += m.codeSmellCount;
    return acc;
  }, {} as Record<string, any>);

  // Calculate layer averages
  Object.keys(layerMetrics).forEach((layer) => {
    const fileCount = layerMetrics[layer].files.length;
    layerMetrics[layer].avgComplexity /= fileCount;
    layerMetrics[layer].avgMaintainability /= fileCount;
    layerMetrics[layer].avgChurn /= fileCount;
    layerMetrics[layer].fileCount = fileCount;
  });

  // Group by component
  const componentMetrics = allMetrics.reduce((acc, m) => {
    if (!acc[m.component]) {
      acc[m.component] = {
        layer: m.layer,
        files: [],
        totalLoc: 0,
        avgComplexity: 0,
        avgMaintainability: 0,
        avgChurn: 0,
        codeSmells: 0,
      };
    }
    acc[m.component].files.push(m);
    acc[m.component].totalLoc += m.linesOfCode;
    acc[m.component].avgComplexity += m.cyclomaticComplexity;
    acc[m.component].avgMaintainability += m.maintainabilityIndex;
    acc[m.component].avgChurn += m.churnRate;
    acc[m.component].codeSmells += m.codeSmellCount;
    return acc;
  }, {} as Record<string, any>);

  // Calculate component health scores
  const components = Object.entries(componentMetrics).map(([name, metrics]: [string, any]) => {
    const fileCount = metrics.files.length;
    const avgComplexity = metrics.avgComplexity / fileCount;
    const avgMaintainability = metrics.avgMaintainability / fileCount;
    const avgChurn = metrics.avgChurn / fileCount;

    const complexityPenalty = Math.min(20, (avgComplexity - 10) * 2);
    const churnPenalty = Math.min(20, avgChurn * 2);
    const smellPenalty = Math.min(10, metrics.codeSmells / fileCount);
    const healthScore = Math.max(
      0,
      Math.min(
        100,
        avgMaintainability - complexityPenalty - churnPenalty - smellPenalty,
      ),
    );

    return {
      name,
      layer: metrics.layer,
      fileCount,
      totalLoc: metrics.totalLoc,
      healthScore: Math.round(healthScore),
      avgComplexity: Math.round(avgComplexity * 10) / 10,
      avgMaintainability: Math.round(avgMaintainability),
      avgChurn: Math.round(avgChurn * 10) / 10,
      codeSmells: metrics.codeSmells,
    };
  });

  // Sort components by health (worst first)
  components.sort((a, b) => a.healthScore - b.healthScore);

  // Identify critical hotspots
  const hotspots = allMetrics
    .map((m) => ({
      filePath: m.filePath,
      component: m.component,
      layer: m.layer,
      complexity: m.cyclomaticComplexity,
      maintainability: m.maintainabilityIndex,
      churn: m.churnRate,
      riskScore: Math.round(
        (m.cyclomaticComplexity / 10) *
          m.churnRate *
          (100 - m.maintainabilityIndex),
      ),
    }))
    .filter((f) => f.riskScore > 60)
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 10);

  // Generate insights
  const insights: string[] = [];

  if (healthScore < 60) {
    insights.push(
      `🚨 CRITICAL: Overall project health is poor (${Math.round(healthScore)}/100). Significant refactoring needed.`,
    );
  } else if (healthScore < 80) {
    insights.push(
      `⚠️ Overall project health is moderate (${Math.round(healthScore)}/100). Plan refactoring sprints.`,
    );
  } else {
    insights.push(
      `✅ Overall project health is good (${Math.round(healthScore)}/100). Maintain quality standards.`,
    );
  }

  if (avgComplexity > 10) {
    insights.push(
      `⚠️ Average complexity (${avgComplexity.toFixed(1)}) exceeds target (<10). Focus on simplification.`,
    );
  }

  if (avgMaintainability < 65) {
    insights.push(
      `⚠️ Low maintainability (${Math.round(avgMaintainability)}/100). Code is difficult to maintain.`,
    );
  }

  if (totalCodeSmells > totalFiles * 2) {
    insights.push(
      `🐛 High code smell density (${(totalCodeSmells / totalFiles).toFixed(1)}/file). Run automated cleanup.`,
    );
  }

  const poorComponents = components.filter((c) => c.healthScore < 60);
  if (poorComponents.length > 0) {
    insights.push(
      `🔥 ${poorComponents.length} component(s) have poor health. Prioritize: ${poorComponents[0].name}`,
    );
  }

  if (hotspots.length > 0) {
    insights.push(
      `🔥 ${hotspots.length} critical hotspots detected across codebase. These need immediate attention.`,
    );
  }

  // Generate recommendations
  const recommendations: string[] = [];

  if (poorComponents.length > 0) {
    recommendations.push(
      `1. 🔨 Refactor ${poorComponents[0].name} component (health: ${poorComponents[0].healthScore}/100) - create refactoring story`,
    );
  }

  if (hotspots.length > 0) {
    recommendations.push(
      `2. 🔥 Address top hotspot: ${hotspots[0].filePath} (risk: ${hotspots[0].riskScore}/100)`,
    );
  }

  if (avgComplexity > 10) {
    const complexFiles = allMetrics.filter((m) => m.cyclomaticComplexity > 10).length;
    recommendations.push(
      `3. Simplify ${complexFiles} file(s) with high complexity - extract methods, reduce nesting`,
    );
  }

  if (totalCodeSmells > totalFiles) {
    recommendations.push(
      `4. Run automated code cleanup - address ${totalCodeSmells} code smells`,
    );
  }

  recommendations.push(
    '5. Set up quality gates - enforce complexity <10, maintainability >65 for new code',
  );

  // Build result
  const result = {
    project: {
      id: projectId,
      name: project.name,
      totalFiles,
      totalLoc,
    },
    health: {
      score: Math.round(healthScore),
      rating:
        healthScore >= 80 ? 'Good' : healthScore >= 60 ? 'Moderate' : 'Poor',
    },
    metrics: {
      complexity: {
        avg: Math.round(avgComplexity * 10) / 10,
        status:
          avgComplexity <= 10 ? 'OK' : avgComplexity <= 15 ? 'Review' : 'Refactor',
      },
      maintainability: {
        avg: Math.round(avgMaintainability),
        status:
          avgMaintainability >= 65
            ? 'Good'
            : avgMaintainability >= 50
            ? 'Moderate'
            : 'Poor',
      },
      churn: {
        avg: Math.round(avgChurn * 10) / 10,
        level: avgChurn < 3 ? 'low' : avgChurn < 7 ? 'medium' : 'high',
      },
      codeSmells: {
        total: totalCodeSmells,
        perFile: Math.round((totalCodeSmells / totalFiles) * 10) / 10,
      },
    },
    layers: Object.entries(layerMetrics).map(([name, metrics]: [string, any]) => ({
      name,
      fileCount: metrics.fileCount,
      totalLoc: metrics.totalLoc,
      avgComplexity: Math.round(metrics.avgComplexity * 10) / 10,
      avgMaintainability: Math.round(metrics.avgMaintainability),
      avgChurn: Math.round(metrics.avgChurn * 10) / 10,
      codeSmells: metrics.codeSmells,
    })),
    components: components.slice(0, 20), // Top 20 components
    criticalHotspots: hotspots,
    insights,
    recommendations,
    analysis: {
      analyzedBy: 'CodeAnalysisWorker',
      lastUpdate: allMetrics[0].lastAnalyzedAt.toISOString(),
      dataSource: 'code_metrics table',
      filesAnalyzed: totalFiles,
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
