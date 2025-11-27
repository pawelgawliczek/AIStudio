import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface FlakyTest {
  testCaseId: string;
  testCaseKey: string;
  testCaseTitle: string;
  testLevel: string;
  totalExecutions: number;
  passedExecutions: number;
  failedExecutions: number;
  failRate: number;
  lastFailedAt: Date | null;
}

export interface TestTrend {
  date: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  passRate: number;
  avgDuration: number;
}

export interface UseCaseCoverage {
  useCaseId: string;
  useCaseKey: string;
  useCaseTitle: string;
  area: string;
  totalTestCases: number;
  automatedTestCases: number;
  coveragePercentage: number;
  lastExecutedAt: Date | null;
}

export interface ExecutionTrend {
  date: string;
  totalExecutions: number;
  passedExecutions: number;
  failedExecutions: number;
  passRate: number;
}

export interface SlowTest {
  testCaseId: string;
  testCaseKey: string;
  testCaseTitle: string;
  testLevel: string;
  avgDuration: number;
  maxDuration: number;
  executionCount: number;
}

@Injectable()
export class TestAnalyticsService {
  private readonly logger = new Logger(TestAnalyticsService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Get flaky tests (tests with >10% fail rate over 30 days)
   */
  async getFlakyTests(
    projectId: string,
    days: number = 30,
    threshold: number = 0.1,
  ): Promise<FlakyTest[]> {
    this.logger.log(
      `Getting flaky tests for project ${projectId} over ${days} days with threshold ${threshold}`,
    );

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const result = await this.prisma.$queryRaw<FlakyTest[]>`
      SELECT
        tc.id as "testCaseId",
        tc.key as "testCaseKey",
        tc.title as "testCaseTitle",
        tc.test_level as "testLevel",
        COUNT(te.id)::int as "totalExecutions",
        COUNT(CASE WHEN te.status = 'pass' THEN 1 END)::int as "passedExecutions",
        COUNT(CASE WHEN te.status = 'fail' THEN 1 END)::int as "failedExecutions",
        (COUNT(CASE WHEN te.status = 'fail' THEN 1 END)::float / COUNT(te.id)::float) as "failRate",
        MAX(CASE WHEN te.status = 'fail' THEN te.executed_at END) as "lastFailedAt"
      FROM test_cases tc
      INNER JOIN test_executions te ON tc.id = te.test_case_id
      WHERE tc.project_id = ${projectId}
        AND te.executed_at >= ${cutoffDate}
      GROUP BY tc.id, tc.key, tc.title, tc.test_level
      HAVING COUNT(te.id) >= 5
        AND (COUNT(CASE WHEN te.status = 'fail' THEN 1 END)::float / COUNT(te.id)::float) >= ${threshold}
      ORDER BY "failRate" DESC, "totalExecutions" DESC
      LIMIT 20
    `;

    return result;
  }

  /**
   * Get test performance trends over time
   */
  async getTestPerformanceTrends(
    projectId: string,
    days: number = 30,
  ): Promise<TestTrend[]> {
    this.logger.log(
      `Getting test performance trends for project ${projectId} over ${days} days`,
    );

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const result = await this.prisma.$queryRaw<TestTrend[]>`
      SELECT
        DATE(te.executed_at) as "date",
        COUNT(te.id)::int as "totalTests",
        COUNT(CASE WHEN te.status = 'pass' THEN 1 END)::int as "passedTests",
        COUNT(CASE WHEN te.status = 'fail' THEN 1 END)::int as "failedTests",
        COUNT(CASE WHEN te.status = 'skip' THEN 1 END)::int as "skippedTests",
        (COUNT(CASE WHEN te.status = 'pass' THEN 1 END)::float / COUNT(te.id)::float * 100) as "passRate",
        AVG(te.duration_ms)::int as "avgDuration"
      FROM test_executions te
      INNER JOIN test_cases tc ON te.test_case_id = tc.id
      WHERE tc.project_id = ${projectId}
        AND te.executed_at >= ${cutoffDate}
      GROUP BY DATE(te.executed_at)
      ORDER BY DATE(te.executed_at) DESC
    `;

    return result;
  }

  /**
   * Get use case coverage statistics
   */
  async getUseCaseCoverage(projectId: string): Promise<UseCaseCoverage[]> {
    this.logger.log(`Getting use case coverage for project ${projectId}`);

    const result = await this.prisma.$queryRaw<UseCaseCoverage[]>`
      SELECT
        uc.id as "useCaseId",
        uc.key as "useCaseKey",
        uc.title as "useCaseTitle",
        uc.area as "area",
        COUNT(tc.id)::int as "totalTestCases",
        COUNT(CASE WHEN tc.status IN ('automated', 'implemented') THEN 1 END)::int as "automatedTestCases",
        (COUNT(CASE WHEN tc.status IN ('automated', 'implemented') THEN 1 END)::float /
         NULLIF(COUNT(tc.id)::float, 0) * 100) as "coveragePercentage",
        MAX(te.executed_at) as "lastExecutedAt"
      FROM use_cases uc
      LEFT JOIN test_cases tc ON uc.id = tc.use_case_id
      LEFT JOIN test_executions te ON tc.id = te.test_case_id
      WHERE uc.project_id = ${projectId}
      GROUP BY uc.id, uc.key, uc.title, uc.area
      ORDER BY "coveragePercentage" ASC NULLS FIRST, uc.title ASC
    `;

    return result;
  }

  /**
   * Get test execution trends over time
   */
  async getTestExecutionTrends(
    projectId: string,
    days: number = 30,
  ): Promise<ExecutionTrend[]> {
    this.logger.log(
      `Getting test execution trends for project ${projectId} over ${days} days`,
    );

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const result = await this.prisma.$queryRaw<ExecutionTrend[]>`
      SELECT
        DATE(te.executed_at) as "date",
        COUNT(te.id)::int as "totalExecutions",
        COUNT(CASE WHEN te.status = 'pass' THEN 1 END)::int as "passedExecutions",
        COUNT(CASE WHEN te.status = 'fail' THEN 1 END)::int as "failedExecutions",
        (COUNT(CASE WHEN te.status = 'pass' THEN 1 END)::float / COUNT(te.id)::float * 100) as "passRate"
      FROM test_executions te
      INNER JOIN test_cases tc ON te.test_case_id = tc.id
      WHERE tc.project_id = ${projectId}
        AND te.executed_at >= ${cutoffDate}
      GROUP BY DATE(te.executed_at)
      ORDER BY DATE(te.executed_at) DESC
    `;

    return result;
  }

  /**
   * Get slowest tests by average duration
   */
  async getSlowTests(projectId: string, limit: number = 10): Promise<SlowTest[]> {
    this.logger.log(`Getting top ${limit} slowest tests for project ${projectId}`);

    const result = await this.prisma.$queryRaw<SlowTest[]>`
      SELECT
        tc.id as "testCaseId",
        tc.key as "testCaseKey",
        tc.title as "testCaseTitle",
        tc.test_level as "testLevel",
        AVG(te.duration_ms)::int as "avgDuration",
        MAX(te.duration_ms)::int as "maxDuration",
        COUNT(te.id)::int as "executionCount"
      FROM test_cases tc
      INNER JOIN test_executions te ON tc.id = te.test_case_id
      WHERE tc.project_id = ${projectId}
        AND te.duration_ms IS NOT NULL
      GROUP BY tc.id, tc.key, tc.title, tc.test_level
      HAVING COUNT(te.id) >= 3
      ORDER BY AVG(te.duration_ms) DESC
      LIMIT ${limit}
    `;

    return result;
  }
}
