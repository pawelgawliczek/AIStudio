/**
 * MCP Tool Client - Abstraction layer for calling MCP tools from worker
 *
 * This client provides typed interfaces for calling MCP tool handlers directly
 * without network overhead. Used by QueueProcessorService to orchestrate
 * deployment and testing workflows.
 */

import { PrismaClient } from '@prisma/client';
import { Logger } from '@nestjs/common';

// ============================================================================
// Response Types
// ============================================================================

export interface DeployToTestEnvResponse {
  success: boolean;
  storyKey: string;
  branchName: string;
  duration: number;
  migrationDetails?: {
    lockAcquired: boolean;
    lockId?: string;
    migrationsApplied: number;
    isBreaking?: boolean;
  };
  warnings?: string[];
  message: string;
}

export interface TestResults {
  testType: 'unit' | 'integration' | 'e2e' | 'all';
  success: boolean;
  exitCode: number;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests?: number;
  duration: number;
  timestamp: string;
  attempts: Array<{
    attempt: number;
    result: 'passed' | 'failed' | 'timeout';
    exitCode: number;
    duration: number;
    timestamp: string;
    failedTests?: string[];
    output?: string;
    errorMessage?: string;
  }>;
  output?: string;
  migrationInfo?: {
    isBreaking: boolean;
    migrationCount: number;
    schemaVersion?: string;
    rollbackWarning?: string;
  };
}

export interface RunTestsResponse {
  success: boolean;
  storyId: string;
  storyKey: string;
  testType: string;
  testResults: TestResults;
  failureReasons?: string[];
  warnings?: string[];
  message: string;
}

// ============================================================================
// MCP Tool Client
// ============================================================================

export class McpToolClient {
  private readonly logger: Logger;

  constructor(
    private readonly prisma: PrismaClient,
    logger?: Logger
  ) {
    this.logger = logger || new Logger(McpToolClient.name);
  }

  /**
   * Deploy story branch to test environment
   *
   * Orchestrates safe deployment including:
   * - Conflict detection
   * - Schema migration execution with queue locking
   * - Dependency installation
   * - Docker rebuild and health checks
   *
   * @param storyId - Story UUID
   * @returns DeployToTestEnvResponse
   * @throws Error if deployment fails
   */
  async deployToTestEnv(storyId: string): Promise<DeployToTestEnvResponse> {
    this.logger.log(`[McpToolClient] Calling deploy_to_test_env for story ${storyId}`);

    try {
      const { handler } = await import('../mcp/servers/deployment/deploy_to_test_env.js');
      const response = await handler(this.prisma, { storyId });

      this.logger.log(
        `[McpToolClient] deploy_to_test_env completed - success: ${response.success}`
      );

      return response as DeployToTestEnvResponse;
    } catch (error: any) {
      this.logger.error(
        `[McpToolClient] deploy_to_test_env failed: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }

  /**
   * Execute automated tests for deployed story
   *
   * Runs unit, integration, and/or e2e tests with retry logic.
   * Updates TestQueue entry with results.
   *
   * @param storyId - Story UUID
   * @param testType - Type of tests to run (default: 'all')
   * @returns RunTestsResponse
   * @throws Error if test execution fails
   */
  async runTests(
    storyId: string,
    testType: 'all' | 'unit' | 'integration' | 'e2e' = 'all'
  ): Promise<RunTestsResponse> {
    this.logger.log(`[McpToolClient] Calling run_tests for story ${storyId} - type: ${testType}`);

    try {
      const { handler } = await import('../mcp/servers/test-queue/run_tests.js');
      const response = await handler(this.prisma, { storyId, testType });

      this.logger.log(
        `[McpToolClient] run_tests completed - success: ${response.success}`
      );

      return response as RunTestsResponse;
    } catch (error: any) {
      this.logger.error(
        `[McpToolClient] run_tests failed: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }

  /**
   * Unlock test queue after migration completes
   *
   * Releases queue lock to allow subsequent test executions.
   * Called automatically by worker after breaking migration completes.
   *
   * @param lockId - Specific lock ID to unlock (optional)
   * @param force - Force unlock regardless of ownership (default: false)
   * @returns void
   * @throws Error if unlock fails
   */
  async unlockTestQueue(lockId?: string, force: boolean = false): Promise<void> {
    this.logger.log(
      `[McpToolClient] Calling unlock_test_queue${lockId ? ` - lockId: ${lockId}` : ''}`
    );

    try {
      const { handler } = await import('../mcp/servers/test-queue/unlock_test_queue.js');
      await handler(this.prisma, { lockId, force });

      this.logger.log('[McpToolClient] unlock_test_queue completed successfully');
    } catch (error: any) {
      this.logger.error(
        `[McpToolClient] unlock_test_queue failed: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }
}
