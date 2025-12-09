import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import { ToolMetadata } from '../../types.js';

export const tool: Tool = {
  name: 'get_file_dependencies',
  description: `Get dependency information for a specific file.

Returns:
- Direct imports (what this file depends on)
- Imported by (what files depend on this)
- External dependencies (npm packages)
- Coupling score (high/medium/low based on number of dependents)
- Circular dependency warnings

Critical for understanding change impact and refactoring safety.`,
  inputSchema: {
    type: 'object',
    properties: {
      projectId: {
        type: 'string',
        description: 'Project ID',
      },
      filePath: {
        type: 'string',
        description: 'Relative file path from repository root',
      },
    },
    required: ['projectId', 'filePath'],
  },
};

export const metadata: ToolMetadata = {
  category: 'code-quality',
  domain: 'architecture',
  tags: ['dependencies', 'coupling', 'architecture', 'impact-analysis'],
  version: '1.0.0',
  since: '0.5.0',
  lastUpdated: '2025-11-12',
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

  // Get file metrics with dependency metadata
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
      maintainabilityIndex: true,
      metadata: true,
    },
  });

  if (!fileMetric) {
    throw new Error(
      `File "${filePath}" not found in project. Run code analysis first.`,
    );
  }

  // Extract dependency info from metadata
  // ST-196: Data is stored under metadata.dependencies by SkottAnalyzer
  const metadata = (fileMetric.metadata as any) || {};
  const deps = metadata.dependencies || {};
  const imports = deps.imports || [];
  const importedBy = deps.importedBy || [];

  // Categorize imports
  const externalDeps = imports.filter((imp: string) =>
    !imp.startsWith('.') && !imp.startsWith('/')
  );
  const internalDeps = imports.filter((imp: string) =>
    imp.startsWith('.') || imp.startsWith('/')
  );

  // Calculate coupling score
  const dependentCount = importedBy.length;
  const couplingScore =
    dependentCount > 10 ? 'high' :
    dependentCount > 5 ? 'medium' : 'low';

  // Check for potential circular dependencies
  const potentialCircular: string[] = [];
  for (const imported of importedBy) {
    if (imports.includes(imported)) {
      potentialCircular.push(imported);
    }
  }

  // Generate insights
  const insights: string[] = [];

  if (couplingScore === 'high') {
    insights.push(
      `⚠️ HIGH COUPLING: ${dependentCount} files depend on this. Changes will have wide impact.`,
    );
  }

  if (potentialCircular.length > 0) {
    insights.push(
      `🔄 CIRCULAR DEPENDENCY WARNING: Mutual dependencies detected with ${potentialCircular.length} file(s). This makes refactoring difficult.`,
    );
  }

  if (externalDeps.length > 15) {
    insights.push(
      `📦 MANY EXTERNAL DEPS: ${externalDeps.length} npm packages imported. Consider reducing for maintainability.`,
    );
  }

  if (internalDeps.length > 10) {
    insights.push(
      `🔗 COMPLEX INTERNAL DEPS: ${internalDeps.length} internal imports. File may have too many responsibilities.`,
    );
  }

  if (dependentCount === 0 && !filePath.includes('main') && !filePath.includes('index')) {
    insights.push(
      `💀 POTENTIALLY DEAD CODE: No files import this. Consider removing if not an entry point.`,
    );
  }

  // Generate recommendations
  const recommendations: string[] = [];

  if (couplingScore === 'high') {
    recommendations.push(
      '1. 🔨 Extract interfaces/types to reduce coupling',
    );
    recommendations.push(
      '2. 📋 Add comprehensive tests before making changes',
    );
  }

  if (potentialCircular.length > 0) {
    recommendations.push(
      `3. 🔄 Break circular dependencies: ${potentialCircular.slice(0, 3).join(', ')}`,
    );
  }

  if (externalDeps.length > 15) {
    recommendations.push(
      '4. 📦 Audit and consolidate external dependencies',
    );
  }

  const result = {
    file: {
      path: filePath,
      folder: filePath.split('/').slice(0, 2).join('/'),
      loc: fileMetric.linesOfCode,
      complexity: fileMetric.cyclomaticComplexity,
      maintainability: fileMetric.maintainabilityIndex,
    },
    dependencies: {
      imports: {
        total: imports.length,
        external: externalDeps.length,
        internal: internalDeps.length,
        list: imports,
      },
      importedBy: {
        total: importedBy.length,
        list: importedBy,
      },
      coupling: {
        score: couplingScore,
        level:
          couplingScore === 'high'
            ? 'Tightly coupled - high change risk'
            : couplingScore === 'medium'
            ? 'Moderate coupling'
            : 'Loosely coupled',
      },
    },
    externalDependencies: externalDeps,
    circularDependencies: potentialCircular,
    insights,
    recommendations,
    changeImpact: {
      directImpact: importedBy.length,
      riskLevel:
        importedBy.length > 10
          ? 'HIGH'
          : importedBy.length > 5
          ? 'MEDIUM'
          : 'LOW',
      recommendation:
        importedBy.length > 10
          ? 'Requires thorough testing and staged rollout'
          : importedBy.length > 5
          ? 'Test dependent files carefully'
          : 'Low risk - limited scope',
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
