import { execSync, spawn } from 'child_process';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import {
  RunTestsParams,
  RunTestsResponse,
  TestResults,
  TestAttempt,
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

// Isolated test environment configuration
const ISOLATED_DATABASE_URL = 'postgresql://postgres:test@127.0.0.1:5434/vibestudio_test?schema=public';
const ISOLATED_REDIS_URL = 'redis://127.0.0.1:6381';

const PROJECT_ROOT = '/opt/stack/AIStudio';
const TEST_SCRIPT = `${PROJECT_ROOT}/scripts/test.sh`;
const DOCKER_COMPOSE_TEST = `${PROJECT_ROOT}/docker-compose.test.yml`;

interface TestConfig {
  type: 'unit' | 'integration' | 'e2e';
  scriptArg: string;
  timeout: number;
}

const TEST_CONFIGS: Record<string, TestConfig> = {
  unit: {
    type: 'unit',
    scriptArg: 'unit',
    timeout: 600000, // 10 minutes
  },
  integration: {
    type: 'integration',
    scriptArg: 'integration',
    timeout: 900000, // 15 minutes
  },
  e2e: {
    type: 'e2e',
    scriptArg: 'e2e',
    timeout: 1200000, // 20 minutes
  },
};

// ============================================================================
// Tool Definition
// ============================================================================

export const tool: Tool = {
  name: 'mcp__vibestudio__worktree_run_tests',
  description: 'Run tests in isolated Docker environment for worktree stories. Auto-manages test containers.',
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function truncateOutput(output: string, maxLines: number = MAX_OUTPUT_LINES): string {
  const lines = output.split('\n');
  if (lines.length <= maxLines) {
    return output;
  }
  return lines.slice(-maxLines).join('\n');
}

/**
 * Start isolated test containers
 */
async function startTestContainers(): Promise<{ success: boolean; output: string }> {
  try {
    console.log('[worktree_run_tests] Starting isolated test containers...');
    const output = execSync(
      `docker compose -f ${DOCKER_COMPOSE_TEST} up -d --wait`,
      {
        cwd: PROJECT_ROOT,
        encoding: 'utf-8',
        timeout: 60000, // 1 minute to start containers
      }
    );

    // Wait for PostgreSQL to be ready
    let retries = 30;
    while (retries > 0) {
      try {
        execSync(
          'docker exec vibe-studio-test-postgres pg_isready -U postgres',
          { encoding: 'utf-8', stdio: 'pipe' }
        );
        console.log('[worktree_run_tests] PostgreSQL is ready');
        break;
      } catch {
        retries--;
        await sleep(1000);
      }
    }

    if (retries === 0) {
      return { success: false, output: 'PostgreSQL did not become ready in time' };
    }

    // Sync Prisma schema to test database
    console.log('[worktree_run_tests] Syncing Prisma schema to test database...');
    const syncOutput = execSync(
      `DATABASE_URL="${ISOLATED_DATABASE_URL}" npx prisma db push --skip-generate --accept-data-loss`,
      {
        cwd: `${PROJECT_ROOT}/backend`,
        encoding: 'utf-8',
        timeout: 60000,
      }
    );

    return { success: true, output: output + '\n' + syncOutput };
  } catch (error: any) {
    return { success: false, output: error.message || 'Failed to start test containers' };
  }
}

/**
 * Stop isolated test containers
 */
async function stopTestContainers(): Promise<void> {
  try {
    console.log('[worktree_run_tests] Stopping test containers...');
    execSync(
      `docker compose -f ${DOCKER_COMPOSE_TEST} down -v`,
      {
        cwd: PROJECT_ROOT,
        encoding: 'utf-8',
        timeout: 60000,
        stdio: 'pipe',
      }
    );
  } catch (error) {
    console.error('[worktree_run_tests] Error stopping containers:', error);
  }
}

/**
 * Parse Jest output to extract test counts and failed test names
 */
function parseJestOutput(stdout: string, stderr: string): {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  failedTestNames: string[];
} {
  const output = stdout + stderr;

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
 */
function parsePlaywrightOutput(stdout: string, stderr: string): {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  failedTestNames: string[];
} {
  const output = stdout + stderr;

  let passedTests = 0;
  let failedTests = 0;
  let skippedTests = 0;

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

  const totalTests = passedTests + failedTests + skippedTests;

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
 * Execute a single test run using isolated environment
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
    // Run tests with isolated environment variables
    const env = {
      ...process.env,
      DATABASE_URL: ISOLATED_DATABASE_URL,
      REDIS_URL: ISOLATED_REDIS_URL,
      NODE_ENV: 'test',
    };

    let command: string;
    let cwd: string;

    if (config.type === 'unit') {
      command = 'npm run test --workspaces -- --testPathIgnorePatterns="integration|e2e"';
      cwd = PROJECT_ROOT;
    } else if (config.type === 'integration') {
      command = 'npm run test --workspaces -- --testPathPattern="integration"';
      cwd = PROJECT_ROOT;
    } else {
      command = 'npx playwright test';
      cwd = PROJECT_ROOT;
    }

    const output = execSync(command, {
      cwd,
      encoding: 'utf-8',
      timeout: config.timeout,
      maxBuffer: 10 * 1024 * 1024,
      env,
    });

    stdout = output;
    exitCode = 0;
    result = 'passed';
  } catch (error: any) {
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
    console.log(`[worktree_run_tests] Executing ${config.type} tests - Attempt ${attemptNum}/${maxAttempts}`);

    const attempt = await executeSingleTestRun(config, attemptNum);
    attempts.push(attempt);
    lastAttempt = attempt;

    if (attempt.result === 'passed') {
      console.log(`[worktree_run_tests] Tests passed on attempt ${attemptNum}`);
      break;
    }

    if (attemptNum < maxAttempts) {
      console.log(`[worktree_run_tests] Attempt ${attemptNum} failed, retrying in ${RETRY_DELAY_MS / 1000}s...`);
      await sleep(RETRY_DELAY_MS);
    } else {
      console.log(`[worktree_run_tests] All ${maxAttempts} attempts failed`);
    }
  }

  if (!lastAttempt) {
    throw new Error('No test attempts recorded');
  }

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
 * Update TestQueue entry with test results
 */
async function updateTestQueueWithResults(
  prisma: PrismaClient,
  entryId: string,
  testResults: TestResults
): Promise<void> {
  const status = testResults.success ? 'passed' : 'failed';
  const errorMessage = testResults.success
    ? null
    : `Tests failed after ${testResults.attempts.length} attempts. Exit code: ${testResults.exitCode}`;

  await prisma.testQueue.update({
    where: { id: entryId },
    data: {
      status,
      testResults: testResults as any,
      errorMessage,
      updatedAt: new Date(),
    },
  });
}

// ============================================================================
// Main Handler
// ============================================================================

export async function handler(
  prisma: PrismaClient,
  params: RunTestsParams
): Promise<RunTestsResponse> {
  const startTime = Date.now();

  // Validate required parameters
  validateRequired({ storyId: params.storyId }, ['storyId']);

  const testType = params.testType || 'all';

  if (!['unit', 'integration', 'e2e', 'all'].includes(testType)) {
    throw new ValidationError(
      `Invalid testType: ${testType}. Must be one of: unit, integration, e2e, all`
    );
  }

  // Fetch story
  const story = await prisma.story.findUnique({
    where: { id: params.storyId },
    select: { key: true, title: true },
  });

  if (!story) {
    throw new NotFoundError('Story', params.storyId);
  }

  const storyKey = story.key;
  console.log(`[worktree_run_tests] Starting isolated test execution for ${storyKey} - testType: ${testType}`);

  // Find or create TestQueue entry
  let entry = await prisma.testQueue.findFirst({
    where: { storyId: params.storyId },
    orderBy: { createdAt: 'desc' },
  });

  if (!entry) {
    // Create a new TestQueue entry
    entry = await prisma.testQueue.create({
      data: {
        storyId: params.storyId,
        status: 'running',
        priority: 5,
        position: 0,
        submittedBy: 'worktree_run_tests',
      },
    });
  } else if (entry.status !== 'running') {
    // Update existing entry to running
    entry = await prisma.testQueue.update({
      where: { id: entry.id },
      data: { status: 'running', updatedAt: new Date() },
    });
  }

  const warnings: string[] = [];
  const failureReasons: string[] = [];
  let aggregatedResults: TestResults;

  try {
    // Start isolated test containers
    const containerStart = await startTestContainers();
    if (!containerStart.success) {
      throw new Error(`Failed to start test containers: ${containerStart.output}`);
    }

    try {
      if (testType === 'all') {
        // Sequential execution with fail-fast
        const allResults: TestResults[] = [];

        for (const type of ['unit', 'integration', 'e2e'] as const) {
          console.log(`[worktree_run_tests] Executing ${type} tests...`);
          const result = await executeTestsWithRetry(TEST_CONFIGS[type]);
          allResults.push(result);

          if (!result.success) {
            console.log(`[worktree_run_tests] ${type} tests failed - stopping execution (fail-fast)`);
            failureReasons.push(`${type} tests failed: ${result.failedTests} failures`);
            break;
          }
        }

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
        const config = TEST_CONFIGS[testType as 'unit' | 'integration' | 'e2e'];
        aggregatedResults = await executeTestsWithRetry(config);

        if (!aggregatedResults.success) {
          failureReasons.push(`${testType} tests failed: ${aggregatedResults.failedTests} failures`);
        }
      }
    } finally {
      // Always stop containers after tests
      await stopTestContainers();
    }

    // Update TestQueue with results
    await updateTestQueueWithResults(prisma, entry.id, aggregatedResults);

    const totalTime = Date.now() - startTime;
    console.log(`[worktree_run_tests] Test execution completed in ${totalTime}ms`);

    return {
      success: aggregatedResults.success,
      storyId: params.storyId,
      storyKey,
      testType,
      testResults: aggregatedResults,
      failureReasons: failureReasons.length > 0 ? failureReasons : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
      message: aggregatedResults.success
        ? `All ${testType} tests passed (${aggregatedResults.passedTests}/${aggregatedResults.totalTests}) using isolated environment`
        : `Tests failed after ${aggregatedResults.attempts.length} attempts (${aggregatedResults.failedTests} failures)`,
    };
  } catch (error: any) {
    console.error('[worktree_run_tests] Catastrophic error:', error);

    // Stop containers on error
    await stopTestContainers();

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
      console.error('[worktree_run_tests] Failed to update TestQueue:', dbError);
    }

    throw error;
  }
}
