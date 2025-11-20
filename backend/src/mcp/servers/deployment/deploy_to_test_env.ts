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
import { ValidationError, NotFoundError } from '../../types.js';
import { validateRequired } from '../../utils.js';
import { handler as checkForConflicts } from '../git/check_for_conflicts.js';
import { execGit } from '../git/git_utils.js';
import {
  detectAllChanges,
  DetectedChanges,
  EnvChanges
} from './utils/change-detection.util.js';
import {
  buildContainers,
  restartServices,
  getContainerLogs,
  checkAllServicesHealthy
} from './utils/docker.util.js';
import {
  waitForHealthy,
  createDefaultHealthChecks,
  HealthCheckResult
} from './utils/health-check.util.js';

// Input/Output Types
export interface DeployToTestEnvParams {
  storyId: string;
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
  description: `Deploy a story to the test environment with automatic change detection and safe migrations.

This tool orchestrates the complete deployment process:
1. Fetches latest from origin
2. Detects schema, dependency, environment, and Docker changes
3. Checks for merge conflicts with main branch (fails fast if conflicts detected)
4. Executes safe migrations if schema changes detected (with queue locking)
5. Installs dependencies if package.json/package-lock.json changed
6. Rebuilds containers if Dockerfile or docker-compose.yml changed
7. Uses dev worktree for deployment (no git checkout needed - already on correct branch)
8. Rebuilds containers with volume mounts pointing to dev worktree
9. Restarts backend and frontend services with worktree code
10. Waits for health checks to pass (max 2 minutes)
11. Updates test queue status to 'running'

The tool supports EP-7 worktree workflow by using existing dev worktrees instead of
checking out branches in the main worktree. This avoids git conflicts and maintains
proper isolation between concurrent development and testing.

The tool ensures safe deployments with automatic rollback on migration failures.`,
  inputSchema: {
    type: 'object',
    properties: {
      storyId: {
        type: 'string',
        description: 'Story UUID to deploy'
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

  try {
    // Validate inputs
    validateRequired(params, ['storyId']);

    console.log(`Starting deployment for story ${params.storyId}...`);

    // Phase 1: Validation & Setup
    const { story, worktree, mainWorktreePath } = await validateAndFetchStory(
      prisma,
      params.storyId
    );

    console.log(`Deploying ${story.key}: ${story.title}`);
    console.log(`Branch: ${worktree.branchName}`);
    console.log(`Worktree: ${worktree.worktreePath}`);

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

    // Phase 5: Schema Migration (if needed)
    if (changes.schema && changes.schemaDetails?.hasChanges) {
      console.log('Schema changes detected, executing safe migration...');
      migrationDetails = await executeSafeMigration(
        mainWorktreePath,
        story.key,
        changes.schemaDetails
      );
      actionsExecuted.schemaMigration = true;
    }

    // Phase 6: NPM Install (if needed)
    if (changes.dependencies) {
      console.log('Dependency changes detected, running npm install...');
      await installDependencies(mainWorktreePath);
      actionsExecuted.npmInstall = true;
    }

    // Phase 7: Docker Rebuild (if needed)
    if (changes.docker) {
      console.log('Docker changes detected, rebuilding containers...');
      await buildContainers(mainWorktreePath, true, true);
      actionsExecuted.dockerRebuild = true;
    }

    // Phase 8: Checkout branch in main worktree (TEMPORARY WORKAROUND)
    // LIMITATION: This temporarily detaches the branch from dev worktree during testing.
    // TODO (ST-44 enhancement): Implement proper CODE_PATH support in docker-compose.yml
    // to enable true parallel worktree testing without git conflicts.
    console.log(`Checking out ${worktree.branchName} in main worktree for testing...`);
    try {
      // Remove worktree's git lock on the branch temporarily
      execGit('checkout --detach', worktree.worktreePath);

      // Now checkout in main worktree
      execGit(`checkout ${worktree.branchName}`, mainWorktreePath);
      console.log(`✓ Checked out ${worktree.branchName} in main worktree`);
      actionsExecuted.gitCheckout = true;
    } catch (error: any) {
      throw new DeploymentError(
        `Failed to checkout branch ${worktree.branchName}: ${error.message}`,
        DeploymentPhase.GIT_CHECKOUT,
        true, // Recoverable
        'Resolve git conflicts or ensure worktree branch can be detached'
      );
    }

    // Phase 9: Rebuild containers from main worktree
    console.log('Rebuilding containers with checked-out branch...');
    await buildContainers(mainWorktreePath, true, true);
    actionsExecuted.dockerRebuild = true;

    // Phase 10: Container Restart
    console.log('Restarting services...');
    await restartServices(mainWorktreePath);
    actionsExecuted.containerRestart = true;

    // Phase 11: Health Checks
    console.log('Waiting for health checks (max 2 minutes)...');
    const healthCheckConfigs = createDefaultHealthChecks();
    const healthCheckResult = await waitForHealthy(healthCheckConfigs, 120000);
    actionsExecuted.healthChecks = true;

    if (!healthCheckResult.healthy) {
      // Get container logs for debugging
      const backendLogs = getContainerLogs(mainWorktreePath, 'backend', 50);
      const frontendLogs = getContainerLogs(mainWorktreePath, 'frontend', 50);

      throw new DeploymentError(
        `Health checks failed after 2 minutes. Services may be unhealthy.\n\n` +
          `Backend logs:\n${backendLogs}\n\n` +
          `Frontend logs:\n${frontendLogs}`,
        DeploymentPhase.HEALTH_CHECKS,
        true,
        'To restore previous state: git checkout main && docker compose restart backend frontend'
      );
    }

    // Phase 11: Update Test Queue Status
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
      message: `Successfully deployed ${story.key} to test environment. Ready for QA testing.`
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
    throw new ValidationError(
      `Worktree path does not exist: ${worktree.worktreePath}`,
      { worktreePath: worktree.worktreePath }
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
    execGit('git fetch origin', mainWorktreePath);
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
 * Execute safe migration with queue locking
 */
async function executeSafeMigration(
  mainWorktreePath: string,
  storyKey: string,
  schemaDetails: any
): Promise<MigrationDetails> {
  try {
    // Run safe migration script
    const command = `npm run migrate:safe -- --story-id=${storyKey}`;
    console.log(`Executing: ${command}`);

    execSync(command, {
      cwd: mainWorktreePath,
      encoding: 'utf-8',
      stdio: 'inherit',
      timeout: 300000 // 5 minutes
    });

    return {
      lockAcquired: true,
      migrationsApplied: schemaDetails.migrationCount,
      schemaVersion: schemaDetails.schemaVersion
    };
  } catch (error: any) {
    throw new DeploymentError(
      `Schema migration failed: ${error.message}\n\nDatabase unchanged (auto-rollback). Check migration logs.`,
      DeploymentPhase.SCHEMA_MIGRATION,
      false,
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
