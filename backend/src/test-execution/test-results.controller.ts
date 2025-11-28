import { Controller, Post, Body } from '@nestjs/common';
import { TestResultsReporterService, ParsedTestResult } from './test-results-reporter.service';

/**
 * Test Results Controller (ST-132)
 *
 * HTTP endpoint for reporting test execution results from CI/CD or local test runs.
 * Called by scripts/report-test-results.ts after test execution.
 */
@Controller('test-results')
export class TestResultsController {
  constructor(private readonly testResultsReporter: TestResultsReporterService) {}

  /**
   * Report a single test execution result
   * POST /test-results/report
   *
   * Body:
   * {
   *   projectId: string,
   *   testCaseKey: string,
   *   testCaseTitle: string,
   *   testLevel: 'unit' | 'integration' | 'e2e',
   *   status: 'pass' | 'fail' | 'skip' | 'error',
   *   durationMs: number,
   *   errorMessage?: string,
   *   environment: string,
   *   commitHash?: string,
   *   storyId?: string,
   *   coveragePercentage?: number,
   *   linesCovered?: number,
   *   linesTotal?: number
   * }
   */
  @Post('report')
  async reportTestExecution(
    @Body() body: ParsedTestResult & { projectId: string },
  ) {
    const { projectId, ...testData } = body;
    return this.testResultsReporter.reportTestExecution(testData, projectId);
  }
}
