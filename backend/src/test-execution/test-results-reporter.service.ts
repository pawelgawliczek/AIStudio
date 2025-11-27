import * as fs from 'fs';
import * as path from 'path';
import { Injectable, Logger } from '@nestjs/common';
import { TestExecutionsService } from '../test-executions/test-executions.service';
import { AppWebSocketGateway } from '../websocket/websocket.gateway';

export interface ParsedTestResult {
  testCaseKey: string;
  testCaseTitle: string;
  testLevel: 'unit' | 'integration' | 'e2e';
  status: 'pass' | 'fail' | 'skip' | 'error';
  durationMs: number;
  errorMessage?: string;
  stackTrace?: string;
  coveragePercentage?: number;
  linesCovered?: number;
  linesTotal?: number;
  environment: string;
  commitHash?: string;
  storyId?: string;
}

export interface JestResult {
  success: boolean;
  numTotalTests: number;
  numPassedTests: number;
  numFailedTests: number;
  numPendingTests: number;
  testResults: Array<{
    name: string;
    status: 'passed' | 'failed' | 'pending' | 'skipped';
    duration: number;
    failureMessage?: string;
  }>;
}

export interface PlaywrightResult {
  suites: Array<{
    title: string;
    tests: Array<{
      title: string;
      status: 'passed' | 'failed' | 'skipped' | 'timedOut';
      duration: number;
      error?: {
        message: string;
        stack: string;
      };
    }>;
  }>;
}

@Injectable()
export class TestResultsReporterService {
  private readonly logger = new Logger(TestResultsReporterService.name);

  constructor(
    private testExecutionsService: TestExecutionsService,
    private websocketGateway: AppWebSocketGateway,
  ) {}

  /**
   * Parse Jest JSON results from file
   */
  async parseJestResults(jsonPath: string): Promise<ParsedTestResult[]> {
    this.logger.log(`Parsing Jest results from: ${jsonPath}`);

    if (!fs.existsSync(jsonPath)) {
      this.logger.warn(`Jest results file not found: ${jsonPath}`);
      return [];
    }

    const content = fs.readFileSync(jsonPath, 'utf-8');
    const jestResult: JestResult = JSON.parse(content);

    const results: ParsedTestResult[] = [];

    for (const testResult of jestResult.testResults) {
      // Extract test case key from test name (e.g., "TC-AUTH-001: Login test")
      const keyMatch = testResult.name.match(/TC-[A-Z]+-\d+/);
      const testCaseKey = keyMatch ? keyMatch[0] : this.generateTestCaseKey(testResult.name);

      results.push({
        testCaseKey,
        testCaseTitle: testResult.name,
        testLevel: jsonPath.includes('integration') ? 'integration' : 'unit',
        status: this.mapJestStatus(testResult.status),
        durationMs: testResult.duration || 0,
        errorMessage: testResult.failureMessage,
        environment: 'docker',
      });
    }

    this.logger.log(`Parsed ${results.length} Jest test results`);
    return results;
  }

  /**
   * Parse Playwright JSON results from file
   */
  async parsePlaywrightResults(jsonPath: string): Promise<ParsedTestResult[]> {
    this.logger.log(`Parsing Playwright results from: ${jsonPath}`);

    if (!fs.existsSync(jsonPath)) {
      this.logger.warn(`Playwright results file not found: ${jsonPath}`);
      return [];
    }

    const content = fs.readFileSync(jsonPath, 'utf-8');
    const playwrightResult: PlaywrightResult = JSON.parse(content);

    const results: ParsedTestResult[] = [];

    for (const suite of playwrightResult.suites) {
      for (const test of suite.tests) {
        // Extract test case key from test title
        const keyMatch = test.title.match(/TC-[A-Z]+-\d+/);
        const testCaseKey = keyMatch ? keyMatch[0] : this.generateTestCaseKey(test.title);

        results.push({
          testCaseKey,
          testCaseTitle: `${suite.title}: ${test.title}`,
          testLevel: 'e2e',
          status: this.mapPlaywrightStatus(test.status),
          durationMs: test.duration || 0,
          errorMessage: test.error?.message,
          stackTrace: test.error?.stack,
          environment: 'docker',
        });
      }
    }

    this.logger.log(`Parsed ${results.length} Playwright test results`);
    return results;
  }

  /**
   * Report a single test execution with WebSocket notifications
   */
  async reportTestExecution(
    testData: ParsedTestResult,
    projectId: string,
  ): Promise<any> {
    const executionId = this.generateExecutionId();

    // 1. Emit test:started event
    this.websocketGateway.broadcastTestExecutionStarted(executionId, projectId, {
      testCaseKey: testData.testCaseKey,
      testCaseTitle: testData.testCaseTitle,
      testLevel: testData.testLevel,
      environment: testData.environment,
      startedAt: new Date().toISOString(),
    });

    try {
      // 2. Store in database (via test-executions service)
      // Note: This requires the test case to exist in the database
      // For now, we'll just log and emit completed event
      // In production, you'd look up the test case ID first

      const execution = {
        id: executionId,
        testCaseKey: testData.testCaseKey,
        testCaseTitle: testData.testCaseTitle,
        testLevel: testData.testLevel,
        status: testData.status,
        durationMs: testData.durationMs,
        errorMessage: testData.errorMessage,
        coveragePercentage: testData.coveragePercentage,
        environment: testData.environment,
        executedAt: new Date().toISOString(),
      };

      // 3. Emit test:completed event
      this.websocketGateway.broadcastTestExecutionCompleted(
        executionId,
        projectId,
        {
          testCaseKey: testData.testCaseKey,
          testCaseTitle: testData.testCaseTitle,
          status: testData.status,
          durationMs: testData.durationMs,
          errorMessage: testData.errorMessage,
          coveragePercentage: testData.coveragePercentage,
          completedAt: new Date().toISOString(),
          reportUrl: `/test-executions/${executionId}`,
        },
      );

      this.logger.log(
        `Test execution reported: ${testData.testCaseKey} - ${testData.status}`,
      );

      return execution;
    } catch (error) {
      this.logger.error(
        `Failed to report test execution: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Map Jest status to our internal status
   */
  private mapJestStatus(
    jestStatus: 'passed' | 'failed' | 'pending' | 'skipped',
  ): 'pass' | 'fail' | 'skip' | 'error' {
    switch (jestStatus) {
      case 'passed':
        return 'pass';
      case 'failed':
        return 'fail';
      case 'skipped':
      case 'pending':
        return 'skip';
      default:
        return 'error';
    }
  }

  /**
   * Map Playwright status to our internal status
   */
  private mapPlaywrightStatus(
    playwrightStatus: 'passed' | 'failed' | 'skipped' | 'timedOut',
  ): 'pass' | 'fail' | 'skip' | 'error' {
    switch (playwrightStatus) {
      case 'passed':
        return 'pass';
      case 'failed':
        return 'fail';
      case 'skipped':
        return 'skip';
      case 'timedOut':
        return 'error';
      default:
        return 'error';
    }
  }

  /**
   * Generate test case key from test name
   */
  private generateTestCaseKey(testName: string): string {
    // Extract meaningful identifier from test name
    const sanitized = testName
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .trim()
      .toUpperCase();
    const words = sanitized.split(/\s+/).slice(0, 3);
    return `TC-AUTO-${words.join('-')}`;
  }

  /**
   * Generate unique execution ID
   */
  private generateExecutionId(): string {
    return `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
