import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import { ToolMetadata } from '../../types.js';

export const tool: Tool = {
  name: 'get_file_health',
  description: `Get detailed code health metrics for a specific file from background worker analysis.

Returns comprehensive file-level metrics including:
- Risk score (complexity × churn × (100 - maintainability))
- Cyclomatic complexity
- Cognitive complexity
- Maintainability index (0-100)
- Lines of code
- Code churn rate (90-day window)
- Code smells with details
- Function-level breakdown
- Refactoring recommendations

Use this when you need detailed analysis of a specific file mentioned in a story or identified as a hotspot.`,
  inputSchema: {
    type: 'object',
    properties: {
      projectId: {
        type: 'string',
        description: 'Project ID',
      },
      filePath: {
        type: 'string',
        description: 'Relative file path from repository root (e.g., "backend/src/auth/password-reset.ts")',
      },
    },
    required: ['projectId', 'filePath'],
  },
};

export const metadata: ToolMetadata = {
  category: 'code-quality',
  domain: 'architecture',
  tags: ['code-quality', 'metrics', 'file', 'health', 'workers'],
  version: '1.0.0',
  since: '0.4.0',
  lastUpdated: '2025-11-11',
};

export async function handler(prisma: PrismaClient, params: any): Promise<any> {
  const { projectId, filePath } = params;

  // Verify project exists
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, name: true },
  });

  if (!project) {
    throw new Error(`Project not found: ${projectId}`);
  }

  // Query file metrics from CodeAnalysisWorker results
  const fileMetric = await prisma.codeMetrics.findUnique({
    where: {
      projectId_filePath: {
        projectId,
        filePath,
      },
    },
    select: {
      filePath: true,
      linesOfCode: true,
      cyclomaticComplexity: true,
      cognitiveComplexity: true,
      maintainabilityIndex: true,
      testCoverage: true,
      churnRate: true,
      churnCount: true,
      riskScore: true,
      codeSmellCount: true,
      criticalIssues: true,
      lastAnalyzedAt: true,
      metadata: true,
    },
  });

  if (!fileMetric) {
    throw new Error(
      `File "${filePath}" not found or not analyzed. Run CodeAnalysisWorker first.`,
    );
  }

  // Use stored risk score (calculated by worker using canonical formula) - ST-28
  // Only recalculate if stored value is missing (backward compatibility)
  // Implements BR-2 (Single Source of Truth) and BR-CALC-002 from baAnalysis
  const rawRiskScore = fileMetric.riskScore ?? Math.round(
    (fileMetric.cyclomaticComplexity / 10) *
      fileMetric.churnRate *
      (100 - fileMetric.maintainabilityIndex)
  );
  // Cap risk score at 100 per AC17 requirements
  const riskScore = Math.min(100, rawRiskScore);

  // Parse code smells from metadata
  const codeSmells = (fileMetric.metadata as any)?.codeSmells || [];
  const functions = (fileMetric.metadata as any)?.functions || [];

  // Determine risk level
  const riskLevel =
    riskScore >= 80
      ? 'CRITICAL'
      : riskScore >= 60
      ? 'HIGH'
      : riskScore >= 40
      ? 'MEDIUM'
      : 'LOW';

  // Generate insights
  const insights: string[] = [];

  if (riskScore >= 80) {
    insights.push(
      `🚨 CRITICAL RISK: Risk score ${riskScore}/100. This file needs immediate refactoring before any changes.`,
    );
  } else if (riskScore >= 60) {
    insights.push(
      `⚠️ HIGH RISK: Risk score ${riskScore}/100. Refactor this file before adding features.`,
    );
  } else if (riskScore >= 40) {
    insights.push(
      `ℹ️ MEDIUM RISK: Risk score ${riskScore}/100. Consider refactoring soon.`,
    );
  } else {
    insights.push(
      `✅ LOW RISK: Risk score ${riskScore}/100. File is relatively healthy.`,
    );
  }

  if (fileMetric.cyclomaticComplexity > 15) {
    insights.push(
      `🔥 VERY HIGH COMPLEXITY: Cyclomatic complexity ${fileMetric.cyclomaticComplexity} (target: <10). Breaking into smaller functions is critical.`,
    );
  } else if (fileMetric.cyclomaticComplexity > 10) {
    insights.push(
      `⚠️ HIGH COMPLEXITY: Cyclomatic complexity ${fileMetric.cyclomaticComplexity} (target: <10). Consider refactoring.`,
    );
  }

  if (fileMetric.cognitiveComplexity > 20) {
    insights.push(
      `🧠 HIGH COGNITIVE LOAD: Cognitive complexity ${fileMetric.cognitiveComplexity}. Code is hard to understand.`,
    );
  }

  if (fileMetric.maintainabilityIndex < 50) {
    insights.push(
      `⚠️ LOW MAINTAINABILITY: Index ${fileMetric.maintainabilityIndex}/100. Very difficult to maintain.`,
    );
  } else if (fileMetric.maintainabilityIndex < 65) {
    insights.push(
      `ℹ️ MODERATE MAINTAINABILITY: Index ${fileMetric.maintainabilityIndex}/100. Could be improved.`,
    );
  }

  if (fileMetric.churnRate > 10) {
    insights.push(
      `🔄 VERY HIGH CHURN: Modified ${fileMetric.churnRate} times in 90 days. May indicate instability.`,
    );
  } else if (fileMetric.churnRate > 5) {
    insights.push(
      `🔄 HIGH CHURN: Modified ${fileMetric.churnRate} times in 90 days. Review for design issues.`,
    );
  }

  if (codeSmells.length > 0) {
    const criticalSmells = codeSmells.filter((s: any) => s.severity === 'critical').length;
    const majorSmells = codeSmells.filter((s: any) => s.severity === 'major').length;

    if (criticalSmells > 0) {
      insights.push(
        `🐛 ${criticalSmells} CRITICAL code smell(s) detected. Fix immediately.`,
      );
    }
    if (majorSmells > 0) {
      insights.push(
        `🐛 ${majorSmells} MAJOR code smell(s) detected. Address soon.`,
      );
    }
  }

  // Generate recommendations
  const recommendations: string[] = [];

  // Find most complex functions
  const complexFunctions = functions
    .filter((f: any) => f.complexity > 10)
    .sort((a: any, b: any) => b.complexity - a.complexity);

  if (complexFunctions.length > 0) {
    recommendations.push(
      `1. 🔨 Refactor function "${complexFunctions[0].name}" (complexity: ${complexFunctions[0].complexity}) - extract methods, reduce nesting`,
    );
  }

  if (fileMetric.cyclomaticComplexity > 15) {
    recommendations.push(
      '2. Break file into smaller modules - separate concerns, extract utilities',
    );
  }

  if (codeSmells.length > 0) {
    const topSmells = codeSmells.slice(0, 3);
    topSmells.forEach((smell: any, index: number) => {
      recommendations.push(
        `${index + 3}. Fix ${smell.type}: ${smell.message}`,
      );
    });
  }

  if (fileMetric.churnRate > 5) {
    recommendations.push(
      'Stabilize design - high churn suggests unclear requirements or poor abstraction',
    );
  }

  if (fileMetric.maintainabilityIndex < 65) {
    recommendations.push(
      'Improve maintainability - add documentation, simplify logic, reduce dependencies',
    );
  }

  // Build result
  const result = {
    file: {
      path: filePath,
      folder: filePath.split('/').slice(0, 2).join('/'),
      loc: fileMetric.linesOfCode,
      lastAnalyzed: fileMetric.lastAnalyzedAt.toISOString(),
    },
    project: {
      id: projectId,
      name: project.name,
    },
    risk: {
      score: riskScore,
      level: riskLevel,
      description:
        riskLevel === 'CRITICAL'
          ? 'Immediate refactoring required'
          : riskLevel === 'HIGH'
          ? 'Refactor before changes'
          : riskLevel === 'MEDIUM'
          ? 'Refactor soon'
          : 'Acceptable risk',
    },
    metrics: {
      complexity: {
        cyclomatic: fileMetric.cyclomaticComplexity,
        cognitive: fileMetric.cognitiveComplexity,
        status:
          fileMetric.cyclomaticComplexity <= 10
            ? 'OK'
            : fileMetric.cyclomaticComplexity <= 15
            ? 'Review'
            : 'Refactor',
      },
      maintainability: {
        index: fileMetric.maintainabilityIndex,
        status:
          fileMetric.maintainabilityIndex >= 65
            ? 'Good'
            : fileMetric.maintainabilityIndex >= 50
            ? 'Moderate'
            : 'Poor',
      },
      churn: {
        rate: fileMetric.churnRate,
        window: '90 days',
        level:
          fileMetric.churnRate < 3
            ? 'low'
            : fileMetric.churnRate < 7
            ? 'medium'
            : 'high',
      },
      codeSmells: {
        count: fileMetric.codeSmellCount,
        details: codeSmells,
      },
    },
    functions: functions.map((f: any) => ({
      name: f.name,
      complexity: f.complexity,
      loc: f.loc,
      status: f.complexity <= 10 ? 'OK' : f.complexity <= 15 ? 'Review' : 'Refactor',
    })),
    insights,
    recommendations,
    analysis: {
      analyzedBy: 'CodeAnalysisWorker',
      lastUpdate: fileMetric.lastAnalyzedAt.toISOString(),
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
