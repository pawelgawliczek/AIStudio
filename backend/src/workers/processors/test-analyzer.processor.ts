import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { PrismaService } from '../../prisma/prisma.service';
import { QUEUE_NAMES } from '../workers.module';

/**
 * TestAnalyzerProcessor
 *
 * Responsibilities:
 * - Parse test results from CI/CD webhooks
 * - Calculate test coverage metrics
 * - Identify coverage gaps by component/layer
 * - Generate test recommendations
 * - Support MCP queries for test coverage (UC-QA-003)
 */
@Processor(QUEUE_NAMES.TEST_ANALYSIS)
export class TestAnalyzerProcessor {
  private readonly logger = new Logger(TestAnalyzerProcessor.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Analyze test results from CI/CD
   * Triggered by: CI/CD webhook after test run
   */
  @Process('analyze-tests')
  async analyzeTestResults(job: Job<{
    projectId: string;
    storyId?: string;
    testResults: TestResults;
    coverageReport?: CoverageReport;
  }>) {
    const { projectId, storyId, testResults, coverageReport } = job.data;
    this.logger.log(`Analyzing test results for project ${projectId}`);

    try {
      // 1. Parse test results
      const testStats = this.parseTestResults(testResults);

      // 2. Parse coverage report if provided
      const coverageStats = coverageReport
        ? this.parseCoverageReport(coverageReport)
        : null;

      // 3. Store test execution results
      if (storyId) {
        await this.storeTestExecution(storyId, testStats, coverageStats);
      }

      // 4. Update project test metrics
      await this.updateProjectTestMetrics(projectId, testStats, coverageStats);

      // 5. Identify failing tests
      const failures = testResults.tests?.filter((t) => t.status === 'failed') || [];
      if (failures.length > 0) {
        this.logger.warn(`${failures.length} test(s) failed`);
        // Could trigger notification worker here
      }

      // 6. Check coverage thresholds
      if (coverageStats) {
        const threshold = 80; // Configurable
        if (coverageStats.overall < threshold) {
          this.logger.warn(
            `Coverage ${coverageStats.overall}% is below threshold ${threshold}%`,
          );
        }
      }

      return {
        success: true,
        stats: testStats,
        coverage: coverageStats,
      };
    } catch (error) {
      this.logger.error(`Failed to analyze test results:`, error);
      throw error;
    }
  }

  /**
   * Calculate coverage gaps by component
   * For UC-QA-003: Manage Test Case Coverage
   */
  @Process('coverage-gaps')
  async calculateCoverageGaps(job: Job<{ projectId: string }>) {
    const { projectId } = job.data;
    this.logger.log(`Calculating coverage gaps for project ${projectId}`);

    try {
      // 1. Get all files and their coverage
      const fileMetrics = await this.prisma.codeMetrics.findMany({
        where: { projectId },
        select: {
          filePath: true,
          layer: true,
          component: true,
          linesOfCode: true,
          metadata: true,
        },
      });

      // 2. Get test cases
      const testCases = await this.prisma.testCase.findMany({
        where: { projectId },
        include: {
          executions: {
            orderBy: { executedAt: 'desc' },
            take: 1,
          },
        },
      });

      // 3. Calculate coverage by component
      const componentCoverage = new Map<string, ComponentCoverageData>();

      for (const file of fileMetrics) {
        const key = `${file.layer}/${file.component}`;

        if (!componentCoverage.has(key)) {
          componentCoverage.set(key, {
            layer: file.layer,
            component: file.component,
            totalFiles: 0,
            totalLOC: 0,
            coveredLOC: 0,
            testCases: {
              unit: 0,
              integration: 0,
              e2e: 0,
            },
            gaps: [],
          });
        }

        const data = componentCoverage.get(key)!;
        data.totalFiles++;
        data.totalLOC += file.linesOfCode;

        // Get coverage from metadata (would come from actual coverage tool)
        const coverage = (file.metadata as any)?.coverage || 0;
        data.coveredLOC += Math.floor((file.linesOfCode * coverage) / 100);

        // Identify files with low/no coverage
        if (coverage < 70) {
          data.gaps.push({
            filePath: file.filePath,
            currentCoverage: coverage,
            targetCoverage: 80,
            priority: coverage < 50 ? 'high' : 'medium',
          });
        }
      }

      // 4. Count test cases by component
      for (const testCase of testCases) {
        const component = (testCase.metadata as any)?.component || 'unknown';
        const layer = (testCase.metadata as any)?.layer || 'unknown';
        const key = `${layer}/${component}`;

        const data = componentCoverage.get(key);
        if (data) {
          if (testCase.type === 'unit') data.testCases.unit++;
          else if (testCase.type === 'integration') data.testCases.integration++;
          else if (testCase.type === 'e2e') data.testCases.e2e++;
        }
      }

      // 5. Generate coverage gap report
      const gaps = Array.from(componentCoverage.values()).map((data) => ({
        ...data,
        coveragePercentage: data.totalLOC > 0
          ? (data.coveredLOC / data.totalLOC) * 100
          : 0,
      }));

      // Sort by coverage percentage (lowest first)
      gaps.sort((a, b) => a.coveragePercentage - b.coveragePercentage);

      this.logger.log(`Identified ${gaps.length} components with coverage data`);

      return {
        success: true,
        gaps,
      };
    } catch (error) {
      this.logger.error(`Failed to calculate coverage gaps:`, error);
      throw error;
    }
  }

  /**
   * Generate test recommendations based on code changes
   */
  @Process('test-recommendations')
  async generateTestRecommendations(job: Job<{
    storyId: string;
    changedFiles: string[];
  }>) {
    const { storyId, changedFiles } = job.data;
    this.logger.log(`Generating test recommendations for story ${storyId}`);

    try {
      const recommendations: TestRecommendation[] = [];

      for (const file of changedFiles) {
        // Get file metrics
        const metrics = await this.prisma.codeMetrics.findFirst({
          where: { filePath: file },
        });

        if (!metrics) continue;

        // Recommend tests based on complexity
        if (metrics.cyclomaticComplexity > 10) {
          recommendations.push({
            type: 'unit',
            priority: 'high',
            reason: 'High complexity requires thorough unit testing',
            targetFile: file,
            suggestedTests: [
              'Test all decision branches',
              'Test edge cases',
              'Test error handling',
            ],
          });
        }

        // Recommend integration tests for API files
        if (file.includes('/api/') || file.includes('controller')) {
          recommendations.push({
            type: 'integration',
            priority: 'medium',
            reason: 'API endpoints need integration testing',
            targetFile: file,
            suggestedTests: [
              'Test HTTP request/response',
              'Test authentication',
              'Test validation',
            ],
          });
        }

        // Recommend E2E tests for UI files
        if (file.includes('/pages/') || file.includes('/components/')) {
          recommendations.push({
            type: 'e2e',
            priority: 'medium',
            reason: 'User-facing component needs E2E testing',
            targetFile: file,
            suggestedTests: [
              'Test user interaction flow',
              'Test form submission',
              'Test error states',
            ],
          });
        }
      }

      this.logger.log(`Generated ${recommendations.length} test recommendations`);

      return {
        success: true,
        recommendations,
      };
    } catch (error) {
      this.logger.error(`Failed to generate test recommendations:`, error);
      throw error;
    }
  }

  /**
   * Parse test results from various formats
   */
  private parseTestResults(results: TestResults): TestStats {
    const tests = results.tests || [];

    return {
      total: tests.length,
      passed: tests.filter((t) => t.status === 'passed').length,
      failed: tests.filter((t) => t.status === 'failed').length,
      skipped: tests.filter((t) => t.status === 'skipped').length,
      duration: results.duration || 0,
      timestamp: new Date(),
    };
  }

  /**
   * Parse coverage report (supports various formats)
   */
  private parseCoverageReport(report: CoverageReport): CoverageStats {
    return {
      overall: report.overall || 0,
      lines: report.lines || 0,
      branches: report.branches || 0,
      functions: report.functions || 0,
      statements: report.statements || 0,
    };
  }

  /**
   * Store test execution in database
   */
  private async storeTestExecution(
    storyId: string,
    testStats: TestStats,
    coverageStats: CoverageStats | null,
  ) {
    // TODO: Create proper test execution table
    // For now, store in story metadata
    const story = await this.prisma.story.findUnique({
      where: { id: storyId },
      select: { metadata: true },
    });

    await this.prisma.story.update({
      where: { id: storyId },
      data: {
        metadata: {
          ...(story?.metadata as object),
          lastTestExecution: {
            ...testStats,
            coverage: coverageStats,
            timestamp: new Date().toISOString(),
          },
        },
      },
    });
  }

  /**
   * Update project-level test metrics
   */
  private async updateProjectTestMetrics(
    projectId: string,
    testStats: TestStats,
    coverageStats: CoverageStats | null,
  ) {
    // Store aggregate test metrics for project
    this.logger.debug(`Updated test metrics for project ${projectId}`);
  }
}

// Type definitions
interface TestResults {
  tests?: Array<{
    name: string;
    status: 'passed' | 'failed' | 'skipped';
    duration?: number;
    error?: string;
  }>;
  duration?: number;
}

interface CoverageReport {
  overall?: number;
  lines?: number;
  branches?: number;
  functions?: number;
  statements?: number;
}

interface TestStats {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  timestamp: Date;
}

interface CoverageStats {
  overall: number;
  lines: number;
  branches: number;
  functions: number;
  statements: number;
}

interface ComponentCoverageData {
  layer: string;
  component: string;
  totalFiles: number;
  totalLOC: number;
  coveredLOC: number;
  testCases: {
    unit: number;
    integration: number;
    e2e: number;
  };
  gaps: Array<{
    filePath: string;
    currentCoverage: number;
    targetCoverage: number;
    priority: 'high' | 'medium' | 'low';
  }>;
}

interface TestRecommendation {
  type: 'unit' | 'integration' | 'e2e';
  priority: 'high' | 'medium' | 'low';
  reason: string;
  targetFile: string;
  suggestedTests: string[];
}
