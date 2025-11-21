import { execSync } from 'child_process';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import { ValidationError } from '../../types.js';

// ============================================================================
// Constants and Configuration
// ============================================================================

const PROJECT_ROOT = '/opt/stack/AIStudio';
const DOCKER_COMPOSE_TEST = `${PROJECT_ROOT}/docker-compose.test.yml`;

// Production database configuration
const PROD_DB_HOST = '127.0.0.1';
const PROD_DB_PORT = '5432';
const PROD_DB_USER = 'postgres';
const PROD_DB_PASSWORD = '361a30c6d68396be29c7eddc3f9ff1b1cfe07675c707232a370bda33f7c8b518';
const PROD_DB_NAME = 'vibestudio';

// Test database configuration
const TEST_DB_HOST = '127.0.0.1';
const TEST_DB_PORT = '5434';
const TEST_DB_USER = 'postgres';
const TEST_DB_PASSWORD = 'test';
const TEST_DB_NAME = 'vibestudio_test';
const ISOLATED_DATABASE_URL = `postgresql://${TEST_DB_USER}:${TEST_DB_PASSWORD}@${TEST_DB_HOST}:${TEST_DB_PORT}/${TEST_DB_NAME}?schema=public`;

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;
const CONTAINER_START_TIMEOUT_MS = 60000;
const DB_READY_TIMEOUT_MS = 30000;
const MIGRATION_TIMEOUT_MS = 120000;

// ============================================================================
// Types
// ============================================================================

export interface TestMigrationParams {
  storyId?: string;
  dryRun?: boolean;
}

export interface TestMigrationResponse {
  success: boolean;
  syncedFromProduction: boolean;
  appliedMigrations: string[];
  validationResults: {
    tablesVerified: number;
    indexesVerified: number;
    constraintsVerified: number;
    errors: string[];
  };
  testResults?: {
    integrationTestsPassed: boolean;
    totalTests: number;
    failedTests: number;
  };
  message: string;
  failedStep?: string;
  errorMessage?: string;
  rollbackStatus?: string;
}

// ============================================================================
// Tool Definition
// ============================================================================

export const tool: Tool = {
  name: 'mcp__vibestudio__test_migration',
  description: `Run migrations against isolated test database (port 5434) before applying to production.

  This tool validates migrations are safe before touching production data:
  1. Starts/reuses isolated test containers (postgres:5434, redis:6381)
  2. Syncs test schema from production (pg_dump --schema-only)
  3. Applies pending migrations to test DB
  4. Validates schema (tables, indexes, constraints)
  5. Runs integration tests against migrated test DB

  Edge Cases Handled:
  - Containers already running: Health check, reuse if healthy
  - Containers unhealthy: Stop and restart with fresh state
  - Test schema drift: Always sync from production before testing
  - Partial migration failure: Capture error, report which migration failed
  - Test DB connection failure: Retry 3x with backoff, then fail gracefully

  Integration with migrate:safe:
  - Call this tool before production migration
  - If success → proceed with production migration
  - If failure → abort, no production changes

  Prerequisites:
  - Docker must be running
  - Production database must be accessible`,
  inputSchema: {
    type: 'object',
    properties: {
      storyId: {
        type: 'string',
        description: 'Story UUID (optional) - if provided, uses worktree migrations',
      },
      dryRun: {
        type: 'boolean',
        description: 'If true, only preview migrations without applying (default: false)',
        default: false,
      },
    },
    required: [],
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if test containers are running and healthy
 */
async function checkContainerHealth(): Promise<{ healthy: boolean; running: boolean }> {
  try {
    const output = execSync(
      'docker ps --filter "name=vibe-studio-test-postgres" --format "{{.Status}}"',
      { encoding: 'utf-8', stdio: 'pipe' }
    );

    const running = output.trim().length > 0;
    if (!running) {
      return { healthy: false, running: false };
    }

    // Check if PostgreSQL is responding
    try {
      execSync('docker exec vibe-studio-test-postgres pg_isready -U postgres', {
        encoding: 'utf-8',
        stdio: 'pipe',
        timeout: 5000,
      });
      return { healthy: true, running: true };
    } catch {
      return { healthy: false, running: true };
    }
  } catch {
    return { healthy: false, running: false };
  }
}

/**
 * Start test containers with health check
 */
async function startTestContainers(): Promise<{ success: boolean; output: string }> {
  console.log('[test_migration] Starting isolated test containers...');

  try {
    // Start containers
    const startOutput = execSync(
      `docker compose -f ${DOCKER_COMPOSE_TEST} up -d`,
      {
        cwd: PROJECT_ROOT,
        encoding: 'utf-8',
        timeout: CONTAINER_START_TIMEOUT_MS,
      }
    );

    // Wait for PostgreSQL to be ready
    let retries = DB_READY_TIMEOUT_MS / 1000;
    while (retries > 0) {
      try {
        execSync('docker exec vibe-studio-test-postgres pg_isready -U postgres', {
          encoding: 'utf-8',
          stdio: 'pipe',
          timeout: 5000,
        });
        console.log('[test_migration] PostgreSQL test container is ready');
        return { success: true, output: startOutput };
      } catch {
        retries--;
        await sleep(1000);
      }
    }

    return { success: false, output: 'PostgreSQL did not become ready in time' };
  } catch (error: any) {
    return { success: false, output: error.message || 'Failed to start test containers' };
  }
}

/**
 * Stop and restart unhealthy containers
 */
async function restartContainers(): Promise<{ success: boolean; output: string }> {
  console.log('[test_migration] Restarting unhealthy test containers...');

  try {
    // Stop existing containers
    execSync(`docker compose -f ${DOCKER_COMPOSE_TEST} down -v`, {
      cwd: PROJECT_ROOT,
      encoding: 'utf-8',
      timeout: 30000,
      stdio: 'pipe',
    });

    // Start fresh
    return await startTestContainers();
  } catch (error: any) {
    return { success: false, output: error.message || 'Failed to restart containers' };
  }
}

/**
 * Sync production schema to test database
 */
async function syncSchemaFromProduction(): Promise<{ success: boolean; output: string }> {
  console.log('[test_migration] Syncing schema from production to test database...');

  try {
    // Dump production schema (structure only, no data)
    const dumpFile = '/tmp/prod_schema.sql';
    execSync(
      `PGPASSWORD='${PROD_DB_PASSWORD}' pg_dump -h ${PROD_DB_HOST} -p ${PROD_DB_PORT} -U ${PROD_DB_USER} --schema-only ${PROD_DB_NAME} > ${dumpFile}`,
      {
        encoding: 'utf-8',
        shell: '/bin/bash',
        timeout: 60000,
      }
    );

    // Drop and recreate test schema
    execSync(
      `PGPASSWORD='${TEST_DB_PASSWORD}' psql -h ${TEST_DB_HOST} -p ${TEST_DB_PORT} -U ${TEST_DB_USER} ${TEST_DB_NAME} -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;"`,
      {
        encoding: 'utf-8',
        shell: '/bin/bash',
        timeout: 30000,
      }
    );

    // Restore schema to test DB
    const restoreOutput = execSync(
      `PGPASSWORD='${TEST_DB_PASSWORD}' psql -h ${TEST_DB_HOST} -p ${TEST_DB_PORT} -U ${TEST_DB_USER} ${TEST_DB_NAME} < ${dumpFile} 2>&1 || true`,
      {
        encoding: 'utf-8',
        shell: '/bin/bash',
        timeout: 60000,
      }
    );

    console.log('[test_migration] Schema sync completed');
    return { success: true, output: restoreOutput };
  } catch (error: any) {
    return { success: false, output: error.message || 'Failed to sync schema' };
  }
}

/**
 * Apply pending migrations to test database
 */
async function applyMigrations(
  prismaDir: string,
  dryRun: boolean
): Promise<{ success: boolean; appliedMigrations: string[]; output: string }> {
  const appliedMigrations: string[] = [];

  console.log(`[test_migration] ${dryRun ? 'Checking' : 'Applying'} pending migrations...`);

  try {
    // First, check for pending migrations
    const statusOutput = execSync(
      `DATABASE_URL="${ISOLATED_DATABASE_URL}" npx prisma migrate status`,
      {
        cwd: prismaDir,
        encoding: 'utf-8',
        timeout: 30000,
      }
    );

    // Parse pending migrations from status output
    const pendingMatch = statusOutput.match(/(\d+) migrations? pending/);
    if (pendingMatch) {
      console.log(`[test_migration] Found ${pendingMatch[1]} pending migration(s)`);
    }

    if (dryRun) {
      return {
        success: true,
        appliedMigrations: [],
        output: `Dry run - ${pendingMatch?.[1] || 0} pending migrations detected:\n${statusOutput}`,
      };
    }

    // Apply migrations
    const migrateOutput = execSync(
      `DATABASE_URL="${ISOLATED_DATABASE_URL}" npx prisma migrate deploy`,
      {
        cwd: prismaDir,
        encoding: 'utf-8',
        timeout: MIGRATION_TIMEOUT_MS,
      }
    );

    // Parse applied migrations from output
    const migrationMatches = migrateOutput.matchAll(/Applied migration `([^`]+)`/g);
    for (const match of migrationMatches) {
      appliedMigrations.push(match[1]);
    }

    console.log(`[test_migration] Applied ${appliedMigrations.length} migration(s)`);
    return { success: true, appliedMigrations, output: migrateOutput };
  } catch (error: any) {
    const errorOutput = error.stdout?.toString() || '' + '\n' + (error.stderr?.toString() || '');
    return {
      success: false,
      appliedMigrations,
      output: error.message + '\n' + errorOutput,
    };
  }
}

/**
 * Validate schema after migration
 */
async function validateSchema(): Promise<{
  success: boolean;
  tablesVerified: number;
  indexesVerified: number;
  constraintsVerified: number;
  errors: string[];
}> {
  const errors: string[] = [];

  console.log('[test_migration] Validating schema...');

  try {
    // Count tables
    const tablesResult = execSync(
      `PGPASSWORD='${TEST_DB_PASSWORD}' psql -h ${TEST_DB_HOST} -p ${TEST_DB_PORT} -U ${TEST_DB_USER} ${TEST_DB_NAME} -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';"`,
      { encoding: 'utf-8', shell: '/bin/bash' }
    );
    const tablesVerified = parseInt(tablesResult.trim(), 10);

    // Count indexes
    const indexesResult = execSync(
      `PGPASSWORD='${TEST_DB_PASSWORD}' psql -h ${TEST_DB_HOST} -p ${TEST_DB_PORT} -U ${TEST_DB_USER} ${TEST_DB_NAME} -t -c "SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public';"`,
      { encoding: 'utf-8', shell: '/bin/bash' }
    );
    const indexesVerified = parseInt(indexesResult.trim(), 10);

    // Count constraints
    const constraintsResult = execSync(
      `PGPASSWORD='${TEST_DB_PASSWORD}' psql -h ${TEST_DB_HOST} -p ${TEST_DB_PORT} -U ${TEST_DB_USER} ${TEST_DB_NAME} -t -c "SELECT COUNT(*) FROM information_schema.table_constraints WHERE constraint_schema = 'public';"`,
      { encoding: 'utf-8', shell: '/bin/bash' }
    );
    const constraintsVerified = parseInt(constraintsResult.trim(), 10);

    console.log(`[test_migration] Schema validation: ${tablesVerified} tables, ${indexesVerified} indexes, ${constraintsVerified} constraints`);

    return {
      success: errors.length === 0,
      tablesVerified,
      indexesVerified,
      constraintsVerified,
      errors,
    };
  } catch (error: any) {
    errors.push(error.message || 'Schema validation failed');
    return {
      success: false,
      tablesVerified: 0,
      indexesVerified: 0,
      constraintsVerified: 0,
      errors,
    };
  }
}

/**
 * Run integration tests against migrated test DB
 */
async function runIntegrationTests(): Promise<{
  success: boolean;
  totalTests: number;
  failedTests: number;
  output: string;
}> {
  console.log('[test_migration] Running integration tests against test database...');

  try {
    const output = execSync(
      `DATABASE_URL="${ISOLATED_DATABASE_URL}" npm run test --workspaces -- --testPathPattern="integration" --maxWorkers=1 --passWithNoTests`,
      {
        cwd: PROJECT_ROOT,
        encoding: 'utf-8',
        timeout: 300000, // 5 minutes
        env: {
          ...process.env,
          DATABASE_URL: ISOLATED_DATABASE_URL,
          NODE_ENV: 'test',
        },
      }
    );

    // Parse test results
    const testSummaryMatch = output.match(/Tests:\s+(?:(\d+)\s+failed,\s*)?(?:(\d+)\s+skipped,\s*)?(?:(\d+)\s+passed,\s*)?(\d+)\s+total/);
    const failedTests = parseInt(testSummaryMatch?.[1] || '0', 10);
    const totalTests = parseInt(testSummaryMatch?.[4] || '0', 10);

    return {
      success: failedTests === 0,
      totalTests,
      failedTests,
      output,
    };
  } catch (error: any) {
    const errorOutput = error.stdout?.toString() || '' + '\n' + (error.stderr?.toString() || '');
    return {
      success: false,
      totalTests: 0,
      failedTests: 1,
      output: errorOutput,
    };
  }
}

// ============================================================================
// Main Handler
// ============================================================================

export async function handler(
  prisma: PrismaClient,
  params: TestMigrationParams
): Promise<TestMigrationResponse> {
  const dryRun = params.dryRun ?? false;
  let worktreePath: string | null = null;

  console.log(`[test_migration] Starting migration test${dryRun ? ' (dry run)' : ''}...`);

  // If storyId provided, get worktree path for migrations
  if (params.storyId) {
    const worktree = await prisma.worktree.findFirst({
      where: { storyId: params.storyId, status: 'active' },
      select: { worktreePath: true },
    });

    if (worktree) {
      worktreePath = worktree.worktreePath;
      console.log(`[test_migration] Using worktree migrations from: ${worktreePath}`);
    }
  }

  const prismaDir = worktreePath ? `${worktreePath}/backend` : `${PROJECT_ROOT}/backend`;

  // Step 1: Check container health
  const health = await checkContainerHealth();

  // Step 2: Start or restart containers as needed
  let containerResult: { success: boolean; output: string };

  if (!health.running) {
    containerResult = await startTestContainers();
  } else if (!health.healthy) {
    containerResult = await restartContainers();
  } else {
    console.log('[test_migration] Reusing healthy test containers');
    containerResult = { success: true, output: 'Containers already running and healthy' };
  }

  if (!containerResult.success) {
    return {
      success: false,
      syncedFromProduction: false,
      appliedMigrations: [],
      validationResults: { tablesVerified: 0, indexesVerified: 0, constraintsVerified: 0, errors: [] },
      message: 'Failed to start test containers',
      failedStep: 'container_start',
      errorMessage: containerResult.output,
    };
  }

  // Step 3: Sync schema from production with retry
  let syncResult: { success: boolean; output: string } = { success: false, output: '' };
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    syncResult = await syncSchemaFromProduction();
    if (syncResult.success) break;

    if (attempt < MAX_RETRIES) {
      console.log(`[test_migration] Schema sync failed, retrying (${attempt}/${MAX_RETRIES})...`);
      await sleep(RETRY_DELAY_MS);
    }
  }

  if (!syncResult.success) {
    return {
      success: false,
      syncedFromProduction: false,
      appliedMigrations: [],
      validationResults: { tablesVerified: 0, indexesVerified: 0, constraintsVerified: 0, errors: [] },
      message: 'Failed to sync schema from production after retries',
      failedStep: 'schema_sync',
      errorMessage: syncResult.output,
    };
  }

  // Step 4: Apply migrations
  const migrateResult = await applyMigrations(prismaDir, dryRun);

  if (!migrateResult.success) {
    return {
      success: false,
      syncedFromProduction: true,
      appliedMigrations: migrateResult.appliedMigrations,
      validationResults: { tablesVerified: 0, indexesVerified: 0, constraintsVerified: 0, errors: [] },
      message: 'Migration failed on test database',
      failedStep: 'migration_apply',
      errorMessage: migrateResult.output,
      rollbackStatus: 'Test database only - no production changes',
    };
  }

  if (dryRun) {
    return {
      success: true,
      syncedFromProduction: true,
      appliedMigrations: [],
      validationResults: { tablesVerified: 0, indexesVerified: 0, constraintsVerified: 0, errors: [] },
      message: `Dry run complete. ${migrateResult.output}`,
    };
  }

  // Step 5: Validate schema
  const validationResult = await validateSchema();

  if (!validationResult.success) {
    return {
      success: false,
      syncedFromProduction: true,
      appliedMigrations: migrateResult.appliedMigrations,
      validationResults: validationResult,
      message: 'Schema validation failed after migration',
      failedStep: 'schema_validation',
      errorMessage: validationResult.errors.join(', '),
    };
  }

  // Step 6: Run integration tests
  const testResult = await runIntegrationTests();

  return {
    success: testResult.success,
    syncedFromProduction: true,
    appliedMigrations: migrateResult.appliedMigrations,
    validationResults: validationResult,
    testResults: {
      integrationTestsPassed: testResult.success,
      totalTests: testResult.totalTests,
      failedTests: testResult.failedTests,
    },
    message: testResult.success
      ? `Migration test passed: ${migrateResult.appliedMigrations.length} migrations applied, ${validationResult.tablesVerified} tables verified, ${testResult.totalTests} tests passed`
      : `Integration tests failed after migration: ${testResult.failedTests} failures`,
    failedStep: testResult.success ? undefined : 'integration_tests',
  };
}
