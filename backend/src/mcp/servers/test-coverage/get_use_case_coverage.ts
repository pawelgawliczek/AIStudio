import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';

export const tool: Tool = {
  name: 'get_use_case_coverage',
  description: 'Get test coverage details for a specific use case, including breakdown by test level (unit/integration/e2e), test cases, execution history, and coverage gaps',
  inputSchema: {
    type: 'object',
    properties: {
      useCaseId: {
        type: 'string',
        description: 'UUID of the use case'
      }
    },
    required: ['useCaseId']
  }
};

export const metadata = {
  category: 'test-coverage',
  domain: 'qa',
  tags: ['testing', 'coverage', 'quality'],
  version: '1.0.0',
  since: 'Sprint 9'
};

export async function handler(prisma: PrismaClient, params: any) {
  const { useCaseId } = params;

  // Get use case
  const useCase = await prisma.useCase.findUnique({
    where: { id: useCaseId },
    include: {
      project: {
        select: {
          id: true,
          name: true
        }
      }
    }
  });

  if (!useCase) {
    throw new Error(`Use case with ID ${useCaseId} not found`);
  }

  // Get all test cases for this use case
  const testCases = await prisma.testCase.findMany({
    where: { useCaseId },
    include: {
      assignedTo: {
        select: {
          id: true,
          name: true,
          email: true
        }
      },
      createdBy: {
        select: {
          id: true,
          name: true
        }
      },
      executions: {
        orderBy: { executedAt: 'desc' },
        take: 1 // Get latest execution only
      }
    }
  });

  // Calculate coverage statistics
  const stats = calculateCoverageStats(testCases);

  // Identify coverage gaps
  const gaps = identifyGaps(stats, testCases);

  // Format test cases for response
  const formattedTestCases = testCases.map(tc => ({
    id: tc.id,
    key: tc.key,
    title: tc.title,
    description: tc.description,
    testLevel: tc.testLevel,
    priority: tc.priority,
    status: tc.status,
    preconditions: tc.preconditions,
    testSteps: tc.testSteps,
    expectedResults: tc.expectedResults,
    testFilePath: tc.testFilePath,
    assignedTo: tc.assignedTo,
    createdBy: tc.createdBy,
    createdAt: tc.createdAt,
    updatedAt: tc.updatedAt,
    latestExecution: tc.executions[0] ? {
      id: tc.executions[0].id,
      executedAt: tc.executions[0].executedAt,
      status: tc.executions[0].status,
      durationMs: tc.executions[0].durationMs,
      coveragePercentage: tc.executions[0].coveragePercentage ? Number(tc.executions[0].coveragePercentage) : null,
      environment: tc.executions[0].environment
    } : null
  }));

  return {
    useCase: {
      id: useCase.id,
      key: useCase.key,
      title: useCase.title,
      area: useCase.area,
      project: useCase.project
    },
    coverage: {
      overall: stats.overall,
      byLevel: {
        unit: {
          coverage: stats.byLevel.unit.coverage,
          testCount: stats.byLevel.unit.testCount,
          implemented: stats.byLevel.unit.implemented,
          avgCoverage: stats.byLevel.unit.avgCoverage
        },
        integration: {
          coverage: stats.byLevel.integration.coverage,
          testCount: stats.byLevel.integration.testCount,
          implemented: stats.byLevel.integration.implemented,
          avgCoverage: stats.byLevel.integration.avgCoverage
        },
        e2e: {
          coverage: stats.byLevel.e2e.coverage,
          testCount: stats.byLevel.e2e.testCount,
          implemented: stats.byLevel.e2e.implemented,
          avgCoverage: stats.byLevel.e2e.avgCoverage
        }
      },
      totalTests: stats.totalTests,
      implementedTests: stats.implementedTests,
      pendingTests: stats.pendingTests,
      implementationRate: stats.implementationRate
    },
    testCases: formattedTestCases,
    coverageGaps: gaps
  };
}

// Helper function to calculate coverage stats
function calculateCoverageStats(testCases: any[]) {
  type TestLevel = 'unit' | 'integration' | 'e2e';
  const byLevel: Record<TestLevel, { testCount: number; implemented: number; coverage: number; avgCoverage: number }> = {
    unit: { testCount: 0, implemented: 0, coverage: 0, avgCoverage: 0 },
    integration: { testCount: 0, implemented: 0, coverage: 0, avgCoverage: 0 },
    e2e: { testCount: 0, implemented: 0, coverage: 0, avgCoverage: 0 }
  };

  testCases.forEach(tc => {
    const level = tc.testLevel as TestLevel;
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
  Object.keys(byLevel).forEach(levelKey => {
    const level = levelKey as TestLevel;
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

// Helper function to identify coverage gaps
function identifyGaps(stats: any, testCases: any[]) {
  const gaps = [];

  // Check for missing test levels
  if (stats.byLevel.unit.testCount === 0) {
    gaps.push({
      type: 'missing_level',
      level: 'unit',
      severity: 'high',
      message: 'No unit tests defined for this use case'
    });
  }

  if (stats.byLevel.integration.testCount === 0) {
    gaps.push({
      type: 'missing_level',
      level: 'integration',
      severity: 'medium',
      message: 'No integration tests defined for this use case'
    });
  }

  if (stats.byLevel.e2e.testCount === 0) {
    gaps.push({
      type: 'missing_level',
      level: 'e2e',
      severity: 'high',
      message: 'No E2E tests defined for this use case'
    });
  }

  // Check for low coverage at each level
  Object.entries(stats.byLevel).forEach(([level, levelStats]: [string, any]) => {
    if (levelStats.testCount > 0 && levelStats.coverage < 80) {
      gaps.push({
        type: 'low_coverage',
        level,
        severity: levelStats.coverage < 50 ? 'high' : 'medium',
        message: `${level} test coverage is ${Math.round(levelStats.coverage)}% (target: 80%)`,
        currentCoverage: levelStats.coverage,
        targetCoverage: 80
      });
    }
  });

  // Check for pending implementations
  if (stats.pendingTests > 0) {
    gaps.push({
      type: 'pending_implementation',
      severity: 'medium',
      message: `${stats.pendingTests} test case(s) not yet implemented`,
      count: stats.pendingTests
    });
  }

  return gaps;
}
