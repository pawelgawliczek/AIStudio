import { execSync } from 'child_process';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import {
  RunTestsParams,
  RunTestsResponse,
  TestResults,
  TestAttempt,
  MigrationInfo,
  ValidationError,
  NotFoundError,
} from '../../types.js';
import { validateRequired } from '../../utils.js';

// ============================================================================
// Constants and Configuration
// ============================================================================

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;
const MAX_OUTPUT_LINES = 1000;
const OVERALL_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

interface TestConfig {
  type: 'unit' | 'integration' | 'e2e';
  command: string;
  args: string[];
  cwd: string;
  timeout: number;
}

const TEST_CONFIGS: Record<string, TestConfig> = {
  unit: {
    type: 'unit',
    command: 'npm',
    args: ['test', '--', '--testPathPattern=.*\\.test\\.ts$', '--testPathIgnorePatterns=e2e', '--testPathIgnorePatterns=integration', '--json'],
    cwd: '/opt/stack/AIStudio/backend',
    timeout: 600000, // 10 minutes
  },
  integration: {
    type: 'integration',
    command: 'npm',
    args: ['test', '--', '--testPathPattern=.*\\.integration\\.test\\.ts$', '--json'],
    cwd: '/opt/stack/AIStudio/backend',
    timeout: 900000, // 15 minutes
  },
  e2e: {
    type: 'e2e',
    command: 'npx',
    args: ['playwright', 'test', '--reporter=json'],
    cwd: '/opt/stack/AIStudio',
    timeout: 1200000, // 20 minutes
  },
};

// ============================================================================
// Tool Definition
// ============================================================================

export const tool: Tool = {
  name: 'mcp__vibestudio__run_tests',
  description: 'Run tests for deployed story. Supports unit/integration/e2e with retry and result capture.',
  inputSchema: {
    type: 'object',
    properties: {
      storyId: {
        type: 'string',
        description: 'Story UUID (required)',
      },
      testType: {
        type: 'string',
        enum: ['unit', 'integration', 'e2e', 'all'],
        description: "Test type to run (default: 'all')",
        default: 'all',
      },
    },
    required: ['storyId'],
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Truncate output to last N lines
 */
function truncateOutput(output: string, maxLines: number = MAX_OUTPUT_LINES): string {
  const lines = output.split('\n');
  if (lines.length <= maxLines) {
    return output;
  }
  return lines.slice(-maxLines).join('\n');
}

/**
 * Parse Jest output to extract test counts and failed test names
 * Tries JSON format first, falls back to text parsing
 */
function parseJestOutput(stdout: string, stderr: string): {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  failedTestNames: string[];
} {
  // Try to parse JSON output first
  try {
    const jsonMatch = stdout.match(/\{[\s\S]*"numTotalTests"[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      const failedTestNames: string[] = [];

      // Extract failed test names from test results
      if (result.testResults) {
        for (const testFile of result.testResults) {
          if (testFile.assertionResults) {
            for (const test of testFile.assertionResults) {
              if (test.status === 'failed') {
                failedTestNames.push(test.fullName || test.title);
              }
            }
          }
        }
      }

      return {
        totalTests: result.numTotalTests || 0,
        passedTests: result.numPassedTests || 0,
        failedTests: result.numFailedTests || 0,
        skippedTests: result.numPendingTests || 0,
        failedTestNames,
      };
    }
  } catch (error) {
    // JSON parsing failed, fall through to text parsing
    console.log('[run_tests] JSON parsing failed, using text parsing:', error);
  }

  // Fallback to text parsing
  const output = stdout + stderr;

  // Jest summary patterns:
  // "Tests:       1 failed, 144 passed, 145 total"
  // "Test Suites: 1 failed, 144 passed, 145 total"

  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;
  let skippedTests = 0;

  // Match test summary line
  const testSummaryMatch = output.match(/Tests:\s+(?:(\d+)\s+failed,\s*)?(?:(\d+)\s+skipped,\s*)?(?:(\d+)\s+passed,\s*)?(\d+)\s+total/);
  if (testSummaryMatch) {
    failedTests = parseInt(testSummaryMatch[1] || '0', 10);
    skippedTests = parseInt(testSummaryMatch[2] || '0', 10);
    passedTests = parseInt(testSummaryMatch[3] || '0', 10);
    totalTests = parseInt(testSummaryMatch[4] || '0', 10);
  }

  // Extract failed test names
  const failedTestNames: string[] = [];
  const failedTestPattern = /●\s+(.+?)\s+›\s+(.+)/g;
  let match;
  while ((match = failedTestPattern.exec(output)) !== null) {
    failedTestNames.push(`${match[1]} > ${match[2]}`);
  }

  return {
    totalTests,
    passedTests,
    failedTests,
    skippedTests,
    failedTestNames,
  };
}

/**
 * Parse Playwright output to extract test counts and failed test names
 * Tries JSON format first, falls back to text parsing
 */
function parsePlaywrightOutput(stdout: string, stderr: string): {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  failedTestNames: string[];
} {
  // Try to parse JSON output first
  try {
    const jsonMatch = stdout.match(/\{[\s\S]*"suites"[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      const failedTestNames: string[] = [];

      let totalTests = 0;
      let passedTests = 0;
      let failedTests = 0;
      let skippedTests = 0;

      // Traverse suites to count tests
      function traverseSuite(suite: any) {
        if (suite.specs) {
          for (const spec of suite.specs) {
            totalTests++;
            if (spec.ok) {
              passedTests++;
            } else {
              failedTests++;
              failedTestNames.push(spec.title || 'Unknown test');
            }
            // Check for skipped tests
            if (spec.tests && spec.tests.some((t: any) => t.status === 'skipped')) {
              skippedTests++;
            }
          }
        }
        if (suite.suites) {
          for (const childSuite of suite.suites) {
            traverseSuite(childSuite);
          }
        }
      }

      if (result.suites) {
        for (const suite of result.suites) {
          traverseSuite(suite);
        }
      }

      return {
        totalTests,
        passedTests,
        failedTests,
        skippedTests,
        failedTestNames,
      };
    }
  } catch (error) {
    // JSON parsing failed, fall through to text parsing
    console.log('[run_tests] Playwright JSON parsing failed, using text parsing:', error);
  }

  // Fallback to text parsing
  const output = stdout + stderr;

  // Playwright patterns:
  // "  23 passed (2m)"
  // "  1 failed, 22 passed (2m)"

  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;
  let skippedTests = 0;

  // Match Playwright summary
  const summaryMatch = output.match(/(\d+)\s+passed/);
  if (summaryMatch) {
    passedTests = parseInt(summaryMatch[1], 10);
  }

  const failedMatch = output.match(/(\d+)\s+failed/);
  if (failedMatch) {
    failedTests = parseInt(failedMatch[1], 10);
  }

  const skippedMatch = output.match(/(\d+)\s+skipped/);
  if (skippedMatch) {
    skippedTests = parseInt(skippedMatch[1], 10);
  }

  totalTests = passedTests + failedTests + skippedTests;

  // Extract failed test names
  const failedTestNames: string[] = [];
  const failedTestPattern = /\d+\)\s+(.+?)\s+─/g;
  let match;
  while ((match = failedTestPattern.exec(output)) !== null) {
    failedTestNames.push(match[1].trim());
  }

  return {
    totalTests,
    passedTests,
    failedTests,
    skippedTests,
    failedTestNames,
  };
}

/**
 * Execute a single test run
 */
async function executeSingleTestRun(
  config: TestConfig,
  attemptNumber: number
): Promise<TestAttempt> {
  const startTime = Date.now();
  let exitCode = 0;
  let stdout = '';
  let stderr = '';
  let result: 'passed' | 'failed' | 'timeout' = 'passed';
  let errorMessage: string | undefined;

  try {
    const command = `${config.command} ${config.args.join(' ')}`;

    // Execute test command
    const output = execSync(command, {
      cwd: config.cwd,
      encoding: 'utf-8',
      timeout: config.timeout,
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
    });

    stdout = output;
    exitCode = 0;
    result = 'passed';
  } catch (error: any) {
    // Handle execution error
    stderr = error.stderr?.toString() || '';
    stdout = error.stdout?.toString() || '';
    exitCode = error.status || 1;

    if (error.killed && error.signal === 'SIGTERM') {
      result = 'timeout';
      errorMessage = `Test execution timeout after ${config.timeout / 1000} seconds`;
    } else {
      result = 'failed';
      errorMessage = error.message || 'Test execution failed';
    }
  }

  const duration = Date.now() - startTime;
  const output = truncateOutput(stdout + '\n' + stderr);

  // Parse output based on test type
  let parsedResults;
  if (config.type === 'e2e') {
    parsedResults = parsePlaywrightOutput(stdout, stderr);
  } else {
    parsedResults = parseJestOutput(stdout, stderr);
  }

  return {
    attempt: attemptNumber,
    result,
    exitCode,
    duration,
    timestamp: new Date().toISOString(),
    failedTests: parsedResults.failedTestNames.length > 0 ? parsedResults.failedTestNames : undefined,
    output,
    errorMessage,
  };
}

/**
 * Execute tests with retry logic
 */
async function executeTestsWithRetry(
  config: TestConfig,
  maxAttempts: number = MAX_RETRIES
): Promise<TestResults> {
  const attempts: TestAttempt[] = [];
  let lastAttempt: TestAttempt | null = null;

  for (let attemptNum = 1; attemptNum <= maxAttempts; attemptNum++) {
    console.log(`[run_tests] Executing ${config.type} tests - Attempt ${attemptNum}/${maxAttempts}`);

    const attempt = await executeSingleTestRun(config, attemptNum);
    attempts.push(attempt);
    lastAttempt = attempt;

    if (attempt.result === 'passed') {
      console.log(`[run_tests] Tests passed on attempt ${attemptNum}`);
      break;
    }

    // Retry logic
    if (attemptNum < maxAttempts) {
      console.log(`[run_tests] Attempt ${attemptNum} failed, retrying in ${RETRY_DELAY_MS / 1000}s...`);
      await sleep(RETRY_DELAY_MS);
    } else {
      console.log(`[run_tests] All ${maxAttempts} attempts failed`);
    }
  }

  if (!lastAttempt) {
    throw new Error('No test attempts recorded');
  }

  // Aggregate results from last attempt
  const output = lastAttempt.output || '';
  let parsedResults;
  if (config.type === 'e2e') {
    parsedResults = parsePlaywrightOutput(output, '');
  } else {
    parsedResults = parseJestOutput(output, '');
  }

  const totalDuration = attempts.reduce((sum, att) => sum + att.duration, 0);

  return {
    testType: config.type,
    success: lastAttempt.result === 'passed',
    exitCode: lastAttempt.exitCode,
    totalTests: parsedResults.totalTests,
    passedTests: parsedResults.passedTests,
    failedTests: parsedResults.failedTests,
    skippedTests: parsedResults.skippedTests,
    duration: totalDuration,
    timestamp: new Date().toISOString(),
    attempts,
    output: truncateOutput(output),
  };
}

/**
 * Check if breaking migration was applied during deployment
 */
async function checkBreakingMigration(
  prisma: PrismaClient,
  storyId: string
): Promise<MigrationInfo | null> {
  // Query TestQueue entry for migration metadata
  const entry = await prisma.testQueue.findFirst({
    where: {
      storyId,
      status: 'running',
    },
  });

  if (!entry || !entry.testResults) {
    return null;
  }

  // Check if migration metadata exists in testResults
  const metadata = entry.testResults as any;
  if (metadata.migrationDetails && metadata.migrationDetails.isBreaking) {
    return {
      isBreaking: true,
      migrationCount: metadata.migrationDetails.migrationCount || 0,
      schemaVersion: metadata.migrationDetails.schemaVersion,
      rollbackWarning: `Breaking schema migration was applied. Manual rollback may be required. See /docs/migrations/MIGRATION_RUNBOOK.md for instructions.`,
    };
  }

  return null;
}

/**
 * Update TestQueue entry with test results
 */
async function updateTestQueueWithResults(
  prisma: PrismaClient,
  entryId: string,
  testResults: TestResults,
  migrationInfo: MigrationInfo | null
): Promise<void> {
  const status = testResults.success ? 'passed' : 'failed';
  const errorMessage = testResults.success
    ? null
    : `Tests failed after ${testResults.attempts.length} attempts. Exit code: ${testResults.exitCode}`;

  // Include migration info in test results if breaking migration + failure
  const enhancedResults = {
    ...testResults,
    migrationInfo: !testResults.success && migrationInfo ? migrationInfo : undefined,
  };

  await prisma.testQueue.update({
    where: { id: entryId },
    data: {
      status,
      testResults: enhancedResults as any,
      errorMessage,
      updatedAt: new Date(),
    },
  });
}

// ============================================================================
// Main Handler
// ============================================================================

/**
 * Execute automated tests with retry logic
 *
 * @param prisma - PrismaClient instance
 * @param params - RunTestsParams (storyId, optional testType)
 * @returns RunTestsResponse with test results and status
 *
 * @throws ValidationError - If storyId missing or invalid testType
 * @throws NotFoundError - If story or TestQueue entry not found
 * @throws Error - If test execution fails (after retries) or timeout
 */
export async function handler(
  prisma: PrismaClient,
  params: RunTestsParams
): Promise<RunTestsResponse> {
  const startTime = Date.now();

  // Validate required parameters
  validateRequired({ storyId: params.storyId }, ['storyId']);

  const testType = params.testType || 'all';

  // Validate testType
  if (!['unit', 'integration', 'e2e', 'all'].includes(testType)) {
    throw new ValidationError(
      `Invalid testType: ${testType}. Must be one of: unit, integration, e2e, all`
    );
  }

  // Fetch story and TestQueue entry
  const entry = await prisma.testQueue.findFirst({
    where: {
      storyId: params.storyId,
      status: 'running',
    },
    include: {
      story: {
        select: {
          key: true,
          title: true,
        },
      },
    },
  });

  if (!entry) {
    throw new NotFoundError('TestQueue', params.storyId, {
      message: 'No running test queue entry found.',
    });
  }

  const storyKey = entry.story.key;
  console.log(`[run_tests] Starting test execution for ${storyKey} - testType: ${testType}`);

  // Execute tests based on testType
  let aggregatedResults: TestResults;
  const warnings: string[] = [];
  const failureReasons: string[] = [];

  try {
    if (testType === 'all') {
      // Sequential execution with fail-fast
      const allResults: TestResults[] = [];

      for (const type of ['unit', 'integration', 'e2e'] as const) {
        console.log(`[run_tests] Executing ${type} tests...`);
        const result = await executeTestsWithRetry(TEST_CONFIGS[type]);
        allResults.push(result);

        if (!result.success) {
          console.log(`[run_tests] ${type} tests failed - stopping execution (fail-fast)`);
          failureReasons.push(`${type} tests failed: ${result.failedTests} failures`);
          break; // Fail-fast
        }
      }

      // Aggregate all results
      const totalDuration = allResults.reduce((sum, r) => sum + r.duration, 0);
      const allAttempts = allResults.flatMap((r) => r.attempts);

      aggregatedResults = {
        testType: 'all',
        success: allResults.every((r) => r.success),
        exitCode: allResults[allResults.length - 1].exitCode,
        totalTests: allResults.reduce((sum, r) => sum + r.totalTests, 0),
        passedTests: allResults.reduce((sum, r) => sum + r.passedTests, 0),
        failedTests: allResults.reduce((sum, r) => sum + r.failedTests, 0),
        skippedTests: allResults.reduce((sum, r) => sum + (r.skippedTests || 0), 0),
        duration: totalDuration,
        timestamp: new Date().toISOString(),
        attempts: allAttempts,
        output: allResults.map((r) => r.output).join('\n\n'),
      };
    } else {
      // Execute single test type
      const config = TEST_CONFIGS[testType as 'unit' | 'integration' | 'e2e'];
      aggregatedResults = await executeTestsWithRetry(config);

      if (!aggregatedResults.success) {
        failureReasons.push(`${testType} tests failed: ${aggregatedResults.failedTests} failures`);
      }
    }

    // Check for breaking migration if tests failed
    if (!aggregatedResults.success) {
      const migrationInfo = await checkBreakingMigration(prisma, params.storyId);

      if (migrationInfo) {
        warnings.push(migrationInfo.rollbackWarning);
        aggregatedResults.migrationInfo = migrationInfo;
      }
    }

    // Update TestQueue with results
    await updateTestQueueWithResults(
      prisma,
      entry.id,
      aggregatedResults,
      aggregatedResults.migrationInfo || null
    );

    const totalTime = Date.now() - startTime;
    console.log(`[run_tests] Test execution completed in ${totalTime}ms`);

    // Build response
    const response: RunTestsResponse = {
      success: aggregatedResults.success,
      storyId: params.storyId,
      storyKey,
      testType,
      testResults: aggregatedResults,
      failureReasons: failureReasons.length > 0 ? failureReasons : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
      message: aggregatedResults.success
        ? `All ${testType} tests passed (${aggregatedResults.passedTests}/${aggregatedResults.totalTests})`
        : `Tests failed after ${aggregatedResults.attempts.length} attempts (${aggregatedResults.failedTests} failures)`,
    };

    return response;
  } catch (error: any) {
    // Handle catastrophic errors (timeout, database errors, etc.)
    console.error('[run_tests] Catastrophic error:', error);

    // Try to update TestQueue with error
    try {
      await prisma.testQueue.update({
        where: { id: entry.id },
        data: {
          status: 'failed',
          errorMessage: error.message || 'Test execution failed catastrophically',
          updatedAt: new Date(),
        },
      });
    } catch (dbError) {
      console.error('[run_tests] Failed to update TestQueue:', dbError);
    }

    throw error;
  }
}
