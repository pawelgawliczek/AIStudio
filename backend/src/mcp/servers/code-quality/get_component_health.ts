import { PrismaClient } from '@prisma/client';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { ToolMetadata } from '../../types.js';

export const tool: Tool = {
  name: 'get_component_health',
  description: `Get code health metrics for a specific component.

Returns detailed metrics including:
- Health score (0-100)
- Complexity metrics
- Test coverage
- Code churn level
- List of files in component
- Hotspots (high-risk files)
- Recommendations for improvement

Use this to drill down into specific components that need attention.`,
  inputSchema: {
    type: 'object',
    properties: {
      projectId: {
        type: 'string',
        description: 'Project ID',
      },
      component: {
        type: 'string',
        description: 'Component name (e.g., "Authentication", "User Management")',
      },
      timeRangeDays: {
        type: 'number',
        description: 'Time range in days for analysis (default: 30)',
        default: 30,
      },
    },
    required: ['projectId', 'component'],
  },
};

export const metadata: ToolMetadata = {
  category: 'code-quality',
  domain: 'architecture',
  tags: ['code-quality', 'metrics', 'component', 'health'],
  version: '1.0.0',
  since: '0.3.0',
  lastUpdated: '2025-11-10',
};

function extractComponent(filePath: string): string {
  const parts = filePath.split('/');
  let component = 'Unknown';

  if (parts.includes('auth')) component = 'Authentication';
  else if (parts.includes('user')) component = 'User Management';
  else if (parts.includes('email')) component = 'Email Service';
  else if (parts.includes('api') || parts.includes('gateway')) component = 'API Gateway';
  else if (parts.includes('search')) component = 'Search';
  else if (parts.includes('dashboard')) component = 'Dashboard';
  else if (parts.length > 1) {
    component = parts[parts.length - 2]
      .split('-')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  return component;
}

function getLayerFromPath(filePath: string): string {
  if (filePath.includes('frontend/') || filePath.includes('/ui/') || filePath.includes('/components/')) {
    return 'frontend';
  }
  if (filePath.includes('backend/') || filePath.includes('/api/') || filePath.includes('/services/')) {
    return 'backend';
  }
  if (filePath.includes('/test') || filePath.endsWith('.test.ts') || filePath.endsWith('.spec.ts')) {
    return 'test';
  }
  if (filePath.includes('infra/') || filePath.includes('docker') || filePath.includes('kubernetes')) {
    return 'infra';
  }
  return 'other';
}

export async function handler(prisma: PrismaClient, params: any): Promise<any> {
  const { projectId, component, timeRangeDays = 30 } = params;

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

  // Filter files by component
  const componentFiles = new Map<string, any>();

  for (const commit of commits) {
    for (const file of commit.files) {
      const fileComponent = extractComponent(file.filePath);

      if (fileComponent.toLowerCase() === component.toLowerCase()) {
        if (!componentFiles.has(file.filePath)) {
          const complexity = file.complexityAfter || file.complexityBefore || 0;
          const coverage = Number(file.coverageAfter || file.coverageBefore || 0);
          const loc = file.locAdded;
          const churnCount = commits.filter(c =>
            c.files.some(f => f.filePath === file.filePath)
          ).length;

          componentFiles.set(file.filePath, {
            filePath: file.filePath,
            layer: getLayerFromPath(file.filePath),
            complexity,
            coverage,
            loc,
            churnCount,
            lastModified: commit.timestamp,
            lastStoryKey: commit.story?.key,
          });
        }
      }
    }
  }

  if (componentFiles.size === 0) {
    throw new Error(`Component "${component}" not found in project or has no files`);
  }

  // Calculate component metrics
  const files = Array.from(componentFiles.values());
  const totalLoc = files.reduce((sum, f) => sum + f.loc, 0);
  const avgComplexity = files.reduce((sum, f) => sum + f.complexity, 0) / files.length;
  const avgCoverage = files.reduce((sum, f) => sum + f.coverage, 0) / files.length;
  const avgChurn = files.reduce((sum, f) => sum + f.churnCount, 0) / files.length;

  // Churn level
  const churnLevel = avgChurn < 2 ? 'low' : avgChurn < 5 ? 'medium' : 'high';

  // Calculate health score
  const complexityScore = Math.max(0, 100 - (avgComplexity * 5));
  const coverageScore = avgCoverage;
  const churnScore = churnLevel === 'low' ? 100 : churnLevel === 'medium' ? 70 : 40;
  const healthScore = Math.round(complexityScore * 0.3 + coverageScore * 0.4 + churnScore * 0.3);

  // Find hotspots (high-risk files)
  const hotspots = files
    .map(f => ({
      ...f,
      riskScore: Math.min(100, Math.round((f.complexity * f.churnCount) / (f.coverage + 1))),
    }))
    .filter(f => f.riskScore >= 50)
    .sort((a, b) => b.riskScore - a.riskScore);

  // Determine layer
  const layerCounts = files.reduce((acc, f) => {
    acc[f.layer] = (acc[f.layer] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const dominantLayer = Object.entries(layerCounts).sort((a, b) => b[1] - a[1])[0][0];

  // Generate insights
  const insights: string[] = [];

  if (healthScore < 60) {
    insights.push(`⚠️ Component health is poor (${healthScore}/100). Requires immediate attention.`);
  } else if (healthScore < 80) {
    insights.push(`ℹ️ Component health is moderate (${healthScore}/100). Room for improvement.`);
  } else {
    insights.push(`✅ Component health is good (${healthScore}/100).`);
  }

  if (avgCoverage < 70) {
    insights.push(`⚠️ Test coverage (${Math.round(avgCoverage)}%) is below target. Add tests for critical paths.`);
  }

  if (avgComplexity > 10) {
    insights.push(`⚠️ High average complexity (${avgComplexity.toFixed(1)}). Consider refactoring.`);
  }

  if (churnLevel === 'high') {
    insights.push(`🔥 High code churn detected (${avgChurn.toFixed(1)} changes/file). May indicate unclear requirements or design issues.`);
  }

  if (hotspots.length > 0) {
    insights.push(`🔥 ${hotspots.length} hotspot(s) detected. Focus refactoring efforts here.`);
  }

  // Recommendations
  const recommendations: string[] = [];

  if (hotspots.length > 0) {
    const topHotspot = hotspots[0];
    recommendations.push(`1. Prioritize refactoring ${topHotspot.filePath} (risk: ${topHotspot.riskScore}/100)`);
  }

  if (avgCoverage < 80) {
    const uncoveredFiles = files.filter(f => f.coverage < 80).length;
    recommendations.push(`2. Add tests to ${uncoveredFiles} file(s) with <80% coverage`);
  }

  if (avgComplexity > 10) {
    const complexFiles = files.filter(f => f.complexity > 10).length;
    recommendations.push(`3. Reduce complexity in ${complexFiles} file(s) - extract methods, simplify logic`);
  }

  if (churnLevel === 'high') {
    recommendations.push('4. Review with BA/PM - high churn may indicate changing requirements');
  }

  const result = {
    component: {
      name: component,
      layer: dominantLayer,
      fileCount: files.length,
    },
    project: {
      id: projectId,
      name: project.name,
    },
    timeRange: {
      days: timeRangeDays,
      from: startDate.toISOString(),
      to: new Date().toISOString(),
    },
    metrics: {
      healthScore,
      rating: healthScore >= 80 ? 'Good' : healthScore >= 60 ? 'Moderate' : 'Poor',
      totalLoc,
      avgComplexity: Math.round(avgComplexity * 10) / 10,
      avgCoverage: Math.round(avgCoverage),
      churnLevel,
      avgChurn: Math.round(avgChurn * 10) / 10,
      hotspotCount: hotspots.length,
    },
    files: files.map(f => ({
      filePath: f.filePath,
      layer: f.layer,
      complexity: f.complexity,
      coverage: f.coverage,
      churnCount: f.churnCount,
      loc: f.loc,
    })),
    hotspots: hotspots.map(f => ({
      filePath: f.filePath,
      riskScore: f.riskScore,
      complexity: f.complexity,
      churnCount: f.churnCount,
      coverage: f.coverage,
      lastModified: f.lastModified.toISOString(),
      lastStoryKey: f.lastStoryKey,
    })),
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
