import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';

export const tool: Tool = {
  name: 'get_component_test_coverage',
  description: 'Get component-level test coverage for a project. Returns coverage by component/area with use case breakdown. Optional component filter.',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: {
        type: 'string',
        description: 'UUID of the project'
      },
      component: {
        type: 'string',
        description: 'Optional: Filter by specific component/area name'
      }
    },
    required: ['projectId']
  }
};

export const metadata = {
  category: 'test-coverage',
  domain: 'qa',
  tags: ['testing', 'coverage', 'quality', 'component'],
  version: '1.0.0',
  since: 'Sprint 9'
};

export async function handler(prisma: PrismaClient, params: any) {
  const { projectId, component } = params;

  // Validate project exists
  const project = await prisma.project.findUnique({
    where: { id: projectId }
  });

  if (!project) {
    throw new Error(`Project with ID ${projectId} not found`);
  }

  // Get all use cases for the project (optionally filtered by component/area)
  const where: any = { projectId };
  if (component) {
    where.area = { contains: component, mode: 'insensitive' };
  }

  const useCases = await prisma.useCase.findMany({
    where,
    include: {
      testCases: {
        include: {
          executions: {
            orderBy: { executedAt: 'desc' },
            take: 1
          }
        }
      }
    }
  });

  // Calculate coverage for each use case
  const useCasesCoverage = useCases.map(uc => {
    const stats = calculateCoverageStats(uc.testCases);
    return {
      useCase: {
        id: uc.id,
        key: uc.key,
        title: uc.title,
        area: uc.area
      },
      coverage: stats.overall,
      byLevel: {
        unit: stats.byLevel.unit.coverage,
        integration: stats.byLevel.integration.coverage,
        e2e: stats.byLevel.e2e.coverage
      },
      testCounts: {
        unit: stats.byLevel.unit.testCount,
        integration: stats.byLevel.integration.testCount,
        e2e: stats.byLevel.e2e.testCount
      },
      totalTests: stats.totalTests,
      implementedTests: stats.implementedTests,
      status: determineStatus(stats.overall)
    };
  });

  // Group by component/area
  const groupedByComponent = groupByComponent(useCasesCoverage);

  // Calculate component overall coverage
  const totalCoverage = useCasesCoverage.length > 0
    ? useCasesCoverage.reduce((sum, uc) => sum + uc.coverage, 0) / useCasesCoverage.length
    : 0;

  // Calculate summary statistics
  const summary = {
    totalUseCases: useCasesCoverage.length,
    fullyCovered: useCasesCoverage.filter(uc => uc.coverage >= 90).length,
    partiallyCovered: useCasesCoverage.filter(uc => uc.coverage >= 50 && uc.coverage < 90).length,
    poorlyCovered: useCasesCoverage.filter(uc => uc.coverage < 50).length,
    notCovered: useCasesCoverage.filter(uc => uc.totalTests === 0).length
  };

  return {
    project: {
      id: project.id,
      name: project.name
    },
    component: component || 'All Components',
    overallCoverage: Math.round(totalCoverage * 10) / 10,
    summary,
    useCases: useCasesCoverage,
    groupedByComponent
  };
}

// Helper function to calculate coverage stats (same as get_use_case_coverage)
function calculateCoverageStats(testCases: any[]) {
  const byLevel = {
    unit: { testCount: 0, implemented: 0, coverage: 0, avgCoverage: 0 },
    integration: { testCount: 0, implemented: 0, coverage: 0, avgCoverage: 0 },
    e2e: { testCount: 0, implemented: 0, coverage: 0, avgCoverage: 0 }
  };

  testCases.forEach(tc => {
    const level = tc.testLevel;
    const levelStats = byLevel[level];

    if (levelStats) {
      levelStats.testCount++;

      if (tc.status === 'implemented' || tc.status === 'automated') {
        levelStats.implemented++;
      }

      // Get coverage from latest execution
      if (tc.executions && tc.executions.length > 0) {
        const latestExecution = tc.executions[0];
        if (latestExecution.coveragePercentage) {
          levelStats.avgCoverage += Number(latestExecution.coveragePercentage);
        }
      }
    }
  });

  // Calculate averages and coverage percentages
  Object.keys(byLevel).forEach(level => {
    const stats = byLevel[level];
    if (stats.implemented > 0) {
      stats.avgCoverage = stats.avgCoverage / stats.implemented;
    }
    stats.coverage = stats.testCount > 0
      ? (stats.avgCoverage * stats.implemented) / stats.testCount
      : 0;
  });

  // Calculate overall weighted coverage (unit 30%, integration 30%, e2e 40%)
  const overall =
    (byLevel.unit.coverage * 0.3) +
    (byLevel.integration.coverage * 0.3) +
    (byLevel.e2e.coverage * 0.4);

  const totalTests = testCases.length;
  const implementedTests = testCases.filter(tc =>
    tc.status === 'implemented' || tc.status === 'automated'
  ).length;

  return {
    overall: Math.round(overall * 10) / 10,
    byLevel,
    totalTests,
    implementedTests,
    pendingTests: totalTests - implementedTests,
    implementationRate: totalTests > 0
      ? Math.round((implementedTests / totalTests) * 100)
      : 0
  };
}

// Helper function to determine status based on coverage
function determineStatus(coverage: number): string {
  if (coverage >= 90) return 'excellent';
  if (coverage >= 80) return 'good';
  if (coverage >= 50) return 'needs_improvement';
  if (coverage > 0) return 'poor';
  return 'not_covered';
}

// Helper function to group use cases by component/area
function groupByComponent(useCases: any[]) {
  const grouped: { [key: string]: any } = {};

  useCases.forEach(uc => {
    const area = uc.useCase.area || 'Uncategorized';

    if (!grouped[area]) {
      grouped[area] = {
        component: area,
        useCases: [],
        totalTests: 0,
        implementedTests: 0,
        avgCoverage: 0
      };
    }

    grouped[area].useCases.push(uc);
    grouped[area].totalTests += uc.totalTests;
    grouped[area].implementedTests += uc.implementedTests;
  });

  // Calculate average coverage for each component
  Object.keys(grouped).forEach(area => {
    const group = grouped[area];
    group.avgCoverage = group.useCases.length > 0
      ? group.useCases.reduce((sum: number, uc: any) => sum + uc.coverage, 0) / group.useCases.length
      : 0;
    group.avgCoverage = Math.round(group.avgCoverage * 10) / 10;
    group.status = determineStatus(group.avgCoverage);
  });

  return grouped;
}
