/**
 * MCP Tool: Deploy to Test Environment
 *
 * Orchestrates safe deployment of a story branch to the test environment:
 * 1. Validates story and worktree
 * 2. Fetches latest from origin
 * 3. Detects changes (schema, deps, env, docker)
 * 4. Executes safe migrations if needed
 * 5. Installs dependencies if needed
 * 6. Rebuilds containers if needed
 * 7. Checks out story branch
 * 8. Restarts services
 * 9. Waits for health checks
 * 10. Updates test queue status
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import {
  enableAgentTestingMode,
  disableAgentTestingMode,
  assertNotProductionDb,
  TEST,
} from '../../../config/environments.js';
import { ValidationError, NotFoundError } from '../../types.js';
import { validateRequired } from '../../utils.js';
import { handler as checkForConflicts } from '../git/check_for_conflicts.js';
import {
  detectAllChanges,
  DetectedChanges,
  EnvChanges
} from './utils/change-detection.util.js';
import {
  buildTestContainers,
  startTestStack,
  getTestContainerLogs,
  checkTestStackHealthy
} from './utils/docker.util.js';
import {
  waitForHealthy,
  createTestStackHealthChecks,
  HealthCheckResult
} from './utils/health-check.util.js';

// Input/Output Types
export interface DeployToTestEnvParams {
  storyId: string;
  worktreePath?: string; // Optional: override auto-detected worktree path
}

export interface DeployToTestEnvResponse {
  success: boolean;
  storyKey: string;
  branchName: string;
  deployedAt: string;
  duration: number;
  actionsExecuted: ActionsExecuted;
  migrationDetails?: MigrationDetails;
  healthCheckResults?: {
    backend: HealthCheckResult;
    frontend: HealthCheckResult;
  };
  testQueueUpdate?: TestQueueUpdate;
  warnings: string[];
  message: string;
}

interface ActionsExecuted {
  conflictCheck: boolean;
  gitCheckout: boolean;
  schemaMigration: boolean;
  npmInstall: boolean;
  dockerRebuild: boolean;
  containerRestart: boolean;
  healthChecks: boolean;
}

interface MigrationDetails {
  lockAcquired: boolean;
  lockId?: string;
  migrationsApplied: number;
  schemaVersion?: string;
}

interface TestQueueUpdate {
  entryId: string;
  status: string;
  position: number;
}

// Deployment phases for error tracking
enum DeploymentPhase {
  VALIDATION = 'validation',
  GIT_FETCH = 'git_fetch',
  CHANGE_DETECTION = 'change_detection',
  CONFLICT_CHECK = 'conflict_check',
  SCHEMA_MIGRATION = 'schema_migration',
  NPM_INSTALL = 'npm_install',
  DOCKER_REBUILD = 'docker_rebuild',
  GIT_CHECKOUT = 'git_checkout',
  CONTAINER_RESTART = 'container_restart',
  HEALTH_CHECKS = 'health_checks',
  QUEUE_UPDATE = 'queue_update'
}

// Deployment error class
class DeploymentError extends Error {
  constructor(
    message: string,
    public phase: DeploymentPhase,
    public recoverable: boolean,
    public rollbackInstructions?: string
  ) {
    super(message);
    this.name = 'DeploymentError';
  }
}

// Tool definition
export const tool: Tool = {
  name: 'mcp__vibestudio__deploy_to_test_env',
  description: `Deploy a story to the ISOLATED test environment (ST-76, ST-64).

IMPORTANT: This deploys to test containers (port 3001/5174), NOT production.
Production containers remain untouched during testing.

Deployment process:
1. Validates story and worktree
2. Fetches latest from origin
3. Checks for merge conflicts with main (fails fast if conflicts)
4. Builds test containers using 'docker build' with explicit worktree context
   - Ensures story code is built, not main worktree code
   - Uses worktreePath parameter (auto-detected or manually specified)
5. Starts isolated test stack (test-postgres:5434, test-redis:6381)
6. Applies migrations to TEST database only
7. Waits for test stack health checks (backend:3001, frontend:5174)
8. Updates test queue status to 'running'

Key isolation guarantees:
- Builds from story worktree (latest code changes included)
- NO checkout in main worktree (production code untouched)
- NO production database changes
- NO production container restarts
- Tests run against isolated test-postgres (port 5434)

The tool supports EP-7 worktree workflow for parallel development and testing.`,
  inputSchema: {
    type: 'object',
    properties: {
      storyId: {
        type: 'string',
        description: 'Story UUID to deploy'
      },
      worktreePath: {
        type: 'string',
        description: 'Optional: Override worktree path for build context (auto-detected from story if not provided)'
      }
    },
    required: ['storyId']
  }
};

// Tool metadata
export const metadata = {
  category: 'deployment',
  domain: 'testing',
  tags: ['deployment', 'testing', 'automation', 'docker', 'migrations'],
  version: '1.0.0'
};

// Main handler
export async function handler(
  prisma: PrismaClient,
  params: DeployToTestEnvParams
): Promise<DeployToTestEnvResponse> {
  const startTime = Date.now();
  const warnings: string[] = [];
  const actionsExecuted: ActionsExecuted = {
    conflictCheck: false,
    gitCheckout: false,
    schemaMigration: false,
    npmInstall: false,
    dockerRebuild: false,
    containerRestart: false,
    healthChecks: false
  };

  let migrationDetails: MigrationDetails | undefined;

  // Enable agent testing mode - activates all production safety guards
  enableAgentTestingMode();

  try {
    // Validate inputs
    validateRequired(params, ['storyId']);

    console.log(`Starting deployment for story ${params.storyId}...`);
    console.log('🔒 Production safety guards ACTIVE - only test environment will be modified');

    // Phase 1: Validation & Setup
    const { story, worktree, mainWorktreePath } = await validateAndFetchStory(
      prisma,
      params.storyId
    );

    // Use provided worktreePath or auto-detected from story
    const buildWorktreePath = params.worktreePath || worktree.worktreePath;

    console.log(`Deploying ${story.key}: ${story.title}`);
    console.log(`Branch: ${worktree.branchName}`);
    console.log(`Worktree: ${worktree.worktreePath}`);
    console.log(`Build context: ${buildWorktreePath}`);

    // Phase 2: Git Fetch
    console.log('Fetching latest from origin...');
    await fetchLatestFromOrigin(mainWorktreePath);

    // Phase 3: Change Detection
    console.log('Detecting changes...');
    const changes = await detectAllChanges(
      prisma,
      params.storyId,
      mainWorktreePath,
      worktree.worktreePath,
      worktree.branchName
    );

    logDetectedChanges(changes);

    // Handle environment variable changes (warnings only)
    if (changes.environment && changes.envDetails) {
      handleEnvChanges(changes.envDetails, warnings);
    }

    // Phase 4: Conflict Check (NEW - prevent deployment if conflicts exist)
    console.log('Checking for merge conflicts with main...');
    try {
      const conflictCheck = await checkForConflicts(prisma, { storyId: params.storyId });

      if (conflictCheck.hasConflicts) {
        const conflictList = conflictCheck.conflictingFiles
          .map(f => `  - ${f.path} (${f.conflictType})`)
          .join('\n');

        throw new DeploymentError(
          `Deployment blocked: ${conflictCheck.conflictCount} merge conflict(s) detected with main branch.\n\n` +
          `Conflicting files:\n${conflictList}\n\n` +
          `Recommended action: Run mcp__vibestudio__rebase_on_main tool or resolve conflicts manually in worktree.`,
          DeploymentPhase.CONFLICT_CHECK,
          false, // Not recoverable without conflict resolution
          'Run mcp__vibestudio__rebase_on_main tool or manually resolve conflicts in worktree, then retry deployment'
        );
      }

      console.log('✓ No conflicts detected, proceeding with deployment');
      actionsExecuted.conflictCheck = true;
    } catch (error: any) {
      // If conflict check itself fails (not detects conflicts), warn but continue
      if (error instanceof DeploymentError) {
        throw error; // Re-throw deployment errors (conflicts detected)
      }

      // Log other errors as warnings and continue (graceful degradation)
      console.warn('Conflict check failed:', error.message);
      warnings.push(`Conflict check failed: ${error.message}. Proceeding with caution.`);
    }

    // Phase 5: Build test containers (ST-76 - isolated test stack)
    // Build from STORY WORKTREE to include latest changes
    console.log('Building test stack containers...');
    try {
      await buildTestContainers(mainWorktreePath, buildWorktreePath, true, true);
      actionsExecuted.dockerRebuild = true;
    } catch (error: any) {
      throw new DeploymentError(
        `Failed to build test containers: ${error.message}`,
        DeploymentPhase.DOCKER_REBUILD,
        true,
        'Check Docker and retry'
      );
    }

    // Phase 6: Start test stack (postgres, redis, backend, frontend)
    // Pass worktree path to mount story code instead of main worktree code
    console.log('Starting isolated test stack...');
    try {
      await startTestStack(mainWorktreePath, buildWorktreePath);
      actionsExecuted.containerRestart = true;
    } catch (error: any) {
      throw new DeploymentError(
        `Failed to start test stack: ${error.message}`,
        DeploymentPhase.CONTAINER_RESTART,
        true,
        'Check test container logs and retry'
      );
    }

    // Phase 7: Schema Migration to TEST DB (if needed)
    if (changes.schema && changes.schemaDetails?.hasChanges) {
      console.log('Schema changes detected, applying to TEST database...');
      migrationDetails = await executeSafeMigrationToTestDb(
        mainWorktreePath,
        story.key,
        changes.schemaDetails
      );
      actionsExecuted.schemaMigration = true;
    }

    // NOTE: Database seeding removed - use mcp__vibestudio__seed_test_database tool instead
    // Seeding should only happen once during initial setup, not on every deployment

    // Phase 8: Health Checks for TEST stack
    console.log('Waiting for test stack health checks (max 2 minutes)...');
    const healthCheckConfigs = createTestStackHealthChecks();
    const healthCheckResult = await waitForHealthy(healthCheckConfigs, 120000);
    actionsExecuted.healthChecks = true;

    if (!healthCheckResult.healthy) {
      // Get test container logs for debugging
      const backendLogs = getTestContainerLogs(mainWorktreePath, 'test-backend', 50);
      const frontendLogs = getTestContainerLogs(mainWorktreePath, 'test-frontend', 50);

      throw new DeploymentError(
        `Test stack health checks failed after 2 minutes.\n\n` +
          `Test backend logs:\n${backendLogs}\n\n` +
          `Test frontend logs:\n${frontendLogs}`,
        DeploymentPhase.HEALTH_CHECKS,
        true,
        'Check test container logs: docker compose -f docker-compose.test.yml logs'
      );
    }

    // Phase 8.5: Regenerate local Prisma client (MCP server runs outside Docker)
    // Docker build can corrupt the local .prisma/client when using worktree symlinks
    console.log('Regenerating local Prisma client for MCP server...');
    try {
      execSync('npx prisma generate', {
        cwd: `${mainWorktreePath}/backend`,
        encoding: 'utf-8',
        timeout: 60000,
        stdio: 'pipe'
      });
      console.log('✓ Local Prisma client regenerated');
    } catch (error: any) {
      // Non-fatal but important warning
      console.warn('⚠ Failed to regenerate Prisma client:', error.message);
      warnings.push(
        'Prisma client regeneration failed - MCP server may need manual "npx prisma generate"'
      );
    }

    // Phase 9: Update Test Queue Status
    let testQueueUpdate: TestQueueUpdate | undefined;
    try {
      testQueueUpdate = await updateTestQueueStatus(prisma, params.storyId);
    } catch (error) {
      // Non-fatal: Log warning if queue entry not found
      console.warn('Failed to update test queue status:', error);
      warnings.push(
        'Test queue status not updated - story may not be in queue'
      );
    }

    // Success!
    const duration = Date.now() - startTime;
    console.log(`Deployment completed successfully in ${duration / 1000}s`);

    return {
      success: true,
      storyKey: story.key,
      branchName: worktree.branchName,
      deployedAt: new Date().toISOString(),
      duration,
      actionsExecuted,
      migrationDetails,
      healthCheckResults: {
        backend: healthCheckResult.results[0],
        frontend: healthCheckResult.results[1]
      },
      testQueueUpdate,
      warnings,
      message: `Successfully deployed ${story.key} to ISOLATED test environment (backend:3001, frontend:5174). Production untouched. Ready for QA testing.`
    };
  } catch (error) {
    // Note: Queue lock release is handled automatically by safe migration script
    const duration = Date.now() - startTime;

    if (error instanceof DeploymentError) {
      throw new Error(
        `Deployment failed during ${error.phase}:\n${error.message}\n\n` +
          (error.rollbackInstructions
            ? `Rollback instructions:\n${error.rollbackInstructions}`
            : '')
      );
    }

    throw error;
  } finally {
    // Always disable agent testing mode when done
    disableAgentTestingMode();
  }
}

/**
 * Validate story and fetch worktree info
 */
async function validateAndFetchStory(
  prisma: PrismaClient,
  storyId: string
): Promise<{
  story: { id: string; key: string; title: string };
  worktree: { id: string; branchName: string; worktreePath: string };
  mainWorktreePath: string;
}> {
  // Fetch story
  const story = await prisma.story.findUnique({
    where: { id: storyId },
    select: { id: true, key: true, title: true }
  });

  if (!story) {
    throw new NotFoundError(
      'Story',
      storyId,
      { searchTool: 'mcp__vibestudio__search_stories' }
    );
  }

  // Fetch worktree
  const worktree = await prisma.worktree.findFirst({
    where: {
      storyId,
      status: { in: ['active', 'idle'] }
    },
    select: { id: true, branchName: true, worktreePath: true }
  });

  if (!worktree) {
    throw new NotFoundError(
      'Worktree',
      story.key,
      { createTool: 'mcp__vibestudio__git_create_worktree' }
    );
  }

  // Validate worktree filesystem exists
  if (!existsSync(worktree.worktreePath)) {
    // Update worktree status to 'removed' since filesystem doesn't exist
    await prisma.worktree.update({
      where: { id: worktree.id },
      data: { status: 'removed' }
    });

    throw new ValidationError(
      `Worktree path does not exist: ${worktree.worktreePath}\n\n` +
      `The worktree was likely deleted from filesystem but database record remained.\n` +
      `Database record has been updated to status='removed'.\n\n` +
      `To fix: Run mcp__vibestudio__git_create_worktree with storyId="${storyId}" to create a fresh worktree, then retry deployment.`,
      {
        worktreePath: worktree.worktreePath,
        storyId,
        fixTool: 'mcp__vibestudio__git_create_worktree'
      }
    );
  }

  const mainWorktreePath = '/opt/stack/AIStudio';
  if (!existsSync(mainWorktreePath)) {
    throw new ValidationError(`Main worktree not found: ${mainWorktreePath}`, {
      mainWorktreePath
    });
  }

  return { story, worktree, mainWorktreePath };
}

/**
 * Fetch latest from origin
 */
async function fetchLatestFromOrigin(mainWorktreePath: string): Promise<void> {
  try {
    execSync('git fetch origin', {
      cwd: mainWorktreePath,
      encoding: 'utf-8',
      timeout: 60000
    });
  } catch (error) {
    throw new DeploymentError(
      `Failed to fetch from origin: ${error}`,
      DeploymentPhase.GIT_FETCH,
      true,
      'Check network connectivity and retry'
    );
  }
}

/**
 * Note: checkoutStoryBranch function removed - no longer needed with EP-7 worktree support.
 * The dev worktree is already on the correct branch, so we use volume mount switching instead.
 */

/**
 * Execute migration to TEST database only (ST-76)
 * Uses isolated test-postgres on port 5434
 * SAFETY: Validates database URL is NOT production before executing
 */
async function executeSafeMigrationToTestDb(
  mainWorktreePath: string,
  storyKey: string,
  schemaDetails: any
): Promise<MigrationDetails> {
  // Build test DB URL using constants
  const testDbUrl = `postgresql://postgres:test@${TEST.DB_HOST}:${TEST.DB_PORT}/${TEST.DB_NAME}?schema=public`;

  // SAFETY: Double-check we're not targeting production
  assertNotProductionDb(testDbUrl, 'apply migrations');
  console.log(`✓ Safety check passed: targeting test DB on port ${TEST.DB_PORT}`);

  try {
    // Run prisma migrate deploy against TEST database
    const command = `DATABASE_URL='${testDbUrl}' npx prisma migrate deploy`;
    console.log(`Applying migrations to TEST database (port ${TEST.DB_PORT})...`);

    execSync(command, {
      cwd: join(mainWorktreePath, 'backend'),
      encoding: 'utf-8',
      stdio: 'inherit',
      timeout: 300000 // 5 minutes
    });

    console.log('✓ Migrations applied to test database');

    return {
      lockAcquired: false, // No lock needed for test DB
      migrationsApplied: schemaDetails.migrationCount,
      schemaVersion: schemaDetails.schemaVersion
    };
  } catch (error: any) {
    throw new DeploymentError(
      `Test database migration failed: ${error.message}\n\nTest DB unchanged. Check migration files.`,
      DeploymentPhase.SCHEMA_MIGRATION,
      true,
      'Fix migration issues and retry deployment'
    );
  }
}

/**
 * Install npm dependencies
 */
async function installDependencies(mainWorktreePath: string): Promise<void> {
  try {
    console.log('Running npm install...');
    execSync('npm install', {
      cwd: mainWorktreePath,
      encoding: 'utf-8',
      stdio: 'inherit',
      timeout: 180000 // 3 minutes
    });
  } catch (error: any) {
    throw new DeploymentError(
      `NPM install failed: ${error.message}`,
      DeploymentPhase.NPM_INSTALL,
      true,
      'Check npm logs and retry'
    );
  }
}

/**
 * Clean build artifacts from worktree before Docker build
 *
 * Docker COPY doesn't respect .gitignore, so build artifacts (node_modules/, dist/)
 * must be removed before Docker build to prevent "cannot replace directory with file" errors.
 *
 * This function safely removes:
 * - node_modules/ (backend, frontend, shared)
 * - dist/ (backend, frontend, shared)
 * - .next/ (frontend - Next.js build cache)
 * - build/ (generic build output)
 */
async function cleanWorktreeBuildArtifacts(worktreePath: string): Promise<void> {
  try {
    // Build artifacts to remove (paths relative to worktree root)
    const artifactPaths = [
      'backend/node_modules',
      'backend/dist',
      'frontend/node_modules',
      'frontend/dist',
      'frontend/.next',
      'frontend/build',
      'shared/node_modules',
      'shared/dist',
      'node_modules', // Root level
      'dist' // Root level
    ];

    let removedCount = 0;

    for (const relativePath of artifactPaths) {
      const fullPath = join(worktreePath, relativePath);

      // Check if path exists before attempting removal
      if (existsSync(fullPath)) {
        console.log(`  Removing: ${relativePath}`);

        try {
          // Use rm -rf for reliable removal of directories
          execSync(`rm -rf "${fullPath}"`, {
            cwd: worktreePath,
            encoding: 'utf-8',
            timeout: 30000 // 30 seconds per directory
          });
          removedCount++;
        } catch (rmError: any) {
          // Log error but continue cleanup
          console.warn(`  Warning: Failed to remove ${relativePath}: ${rmError.message}`);
        }
      }
    }

    if (removedCount === 0) {
      console.log('  No build artifacts found to clean');
    } else {
      console.log(`  Cleaned ${removedCount} build artifact(s)`);
    }
  } catch (error: any) {
    // Non-fatal: Log warning and continue
    console.warn(`Build artifact cleanup failed: ${error.message}. Continuing with deployment...`);
  }
}

/**
 * Update test queue status to 'running'
 */
async function updateTestQueueStatus(
  prisma: PrismaClient,
  storyId: string
): Promise<TestQueueUpdate> {
  // Find most recent pending or running entry
  const entry = await prisma.testQueue.findFirst({
    where: {
      storyId,
      status: { in: ['pending', 'running'] }
    },
    orderBy: { createdAt: 'desc' }
  });

  if (!entry) {
    throw new Error('No pending/running test queue entry found for story');
  }

  // Update to running
  const updated = await prisma.testQueue.update({
    where: { id: entry.id },
    data: { status: 'running' }
  });

  return {
    entryId: updated.id,
    status: updated.status,
    position: updated.position
  };
}

/**
 * Release queue lock is handled automatically by the safe migration script
 * No manual lock management needed here
 */

/**
 * Handle environment variable changes (warnings)
 */
function handleEnvChanges(envDetails: EnvChanges, warnings: string[]): void {
  if (envDetails.missingRequired.length > 0) {
    throw new ValidationError(
      `Missing required environment variables in main .env:\n${envDetails.missingRequired.join(', ')}\n\nAdd these variables and retry.`,
      { missingVars: envDetails.missingRequired }
    );
  }

  if (envDetails.addedVars.length > 0) {
    warnings.push(
      `New env variables in worktree (not required): ${envDetails.addedVars.join(', ')}`
    );
  }

  if (envDetails.modifiedVars.length > 0) {
    warnings.push(
      `Modified env variables in worktree: ${envDetails.modifiedVars.join(', ')}. Manual review recommended.`
    );
  }

  if (envDetails.removedVars.length > 0) {
    warnings.push(
      `Removed env variables in worktree: ${envDetails.removedVars.join(', ')}`
    );
  }
}

/**
 * Log detected changes
 */
function logDetectedChanges(changes: DetectedChanges): void {
  console.log('Change detection results:');
  console.log(`  Schema: ${changes.schema ? 'YES' : 'NO'}`);
  console.log(`  Dependencies: ${changes.dependencies ? 'YES' : 'NO'}`);
  console.log(`  Environment: ${changes.environment ? 'YES' : 'NO'}`);
  console.log(`  Docker: ${changes.docker ? 'YES' : 'NO'}`);

  if (changes.schemaDetails?.hasChanges) {
    console.log(
      `  - ${changes.schemaDetails.migrationCount} migrations (breaking: ${changes.schemaDetails.isBreaking})`
    );
  }
}
