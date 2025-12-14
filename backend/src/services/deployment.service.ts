/**
 * Deployment Service - ST-77 Production Deployment Safety System
 *
 * Orchestrates safe production deployments with the following workflow:
 * 1. Validate story, worktree, and PR approval
 * 2. Acquire deployment lock (singleton)
 * 3. Create pre-deployment backup
 * 4. Build Docker containers (backend, frontend)
 * 5. Run health checks (3 consecutive successes)
 * 6. Create deployment log
 * 7. Release lock on completion/failure
 * 8. Auto-rollback on failure
 *
 * Based on deploy_to_test_env pattern (ST-76) and SafeMigration (ST-70)
 */

import { execSync } from 'child_process';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import { BackupType } from '../types/migration.types.js';
import { AppWebSocketGateway } from '../websocket/websocket.gateway';
import { BackupService } from './backup.service.js';
import { BuildDecisionService, ChangeAnalysis } from './build-decision.service.js';
import { DeploymentLockService } from './deployment-lock.service.js';
import { RestoreService } from './restore.service.js';

// ============================================================================
// Types
// ============================================================================

export interface DeploymentParams {
  storyId: string;
  prNumber?: number; // Optional - required for PR mode
  directCommit?: boolean; // Optional - enables direct commit mode
  triggeredBy?: string; // User/agent identifier
  skipBackup?: boolean; // For emergencies only
  skipHealthChecks?: boolean; // For emergencies only
  skipBackendBuild?: boolean; // Optional - skip backend build (for frontend-only changes)
  skipFrontendBuild?: boolean; // Optional - skip frontend build (for backend-only changes)
  useCache?: boolean; // ST-115: Use BuildKit cache (default: false for deterministic prod builds)
  autoDetectBuilds?: boolean; // ST-115: Auto-detect which services need rebuilding based on git diff
  confirmDeploy: boolean; // Required - explicit confirmation
}

export interface DeploymentResult {
  success: boolean;
  deploymentLogId: string;
  storyKey: string;
  prNumber?: number;
  directCommit?: boolean;
  commitHash?: string;
  duration: number;
  lockId?: string;
  backupFile?: string;
  healthCheckResults?: HealthCheckResults;
  phases: PhaseResults;
  warnings: string[];
  errors: string[];
  message: string;
}

export interface HealthCheckResults {
  backend: {
    success: boolean;
    consecutiveSuccesses: number;
    url: string;
    latency?: number;
  };
  frontend: {
    success: boolean;
    consecutiveSuccesses: number;
    url: string;
    latency?: number;
  };
}

export interface PhaseResults {
  validation: PhaseResult;
  lockAcquisition: PhaseResult;
  backup: PhaseResult;
  buildBackend: PhaseResult;
  buildFrontend: PhaseResult;
  restartBackend: PhaseResult;
  restartFrontend: PhaseResult;
  healthChecks: PhaseResult;
  lockRelease: PhaseResult;
  rollback?: PhaseResult;
}

export interface PhaseResult {
  success: boolean;
  duration: number;
  message?: string;
  error?: string;
  metadata?: Record<string, any>;
}

// ============================================================================
// Deployment Service
// ============================================================================

export class DeploymentService {
  private prisma: PrismaClient;
  private lockService: DeploymentLockService;
  private backupService: BackupService;
  private restoreService: RestoreService;
  private buildDecisionService: BuildDecisionService;
  private websocketGateway: AppWebSocketGateway | null;
  private projectRoot: string;

  constructor(
    prismaClient?: PrismaClient,
    lockService?: DeploymentLockService,
    backupService?: BackupService,
    restoreService?: RestoreService,
    buildDecisionService?: BuildDecisionService,
    websocketGateway?: AppWebSocketGateway
  ) {
    this.prisma = prismaClient || new PrismaClient();
    this.lockService = lockService || new DeploymentLockService(this.prisma);
    this.backupService = backupService || new BackupService();
    this.restoreService = restoreService || new RestoreService();
    // ST-236: Use PROJECT_PATH env var (host path) for git/docker operations
    // Falls back to resolved path for local development
    this.projectRoot = process.env.PROJECT_PATH || path.resolve(__dirname, '../../../');
    this.buildDecisionService = buildDecisionService || new BuildDecisionService(this.prisma, this.projectRoot);
    this.websocketGateway = websocketGateway || null;
  }

  /**
   * Execute production deployment with full safety workflow
   */
  async deployToProduction(params: DeploymentParams): Promise<DeploymentResult> {
    const startTime = Date.now();
    const warnings: string[] = [];
    const errors: string[] = [];
    const phases: PhaseResults = {
      validation: { success: false, duration: 0 },
      lockAcquisition: { success: false, duration: 0 },
      backup: { success: false, duration: 0 },
      buildBackend: { success: false, duration: 0 },
      buildFrontend: { success: false, duration: 0 },
      restartBackend: { success: false, duration: 0 },
      restartFrontend: { success: false, duration: 0 },
      healthChecks: { success: false, duration: 0 },
      lockRelease: { success: false, duration: 0 },
    };

    let deploymentLogId: string | null = null;
    let lockId: string | null = null;
    let backupFile: string | null = null;
    let storyKey = '';
    let commitHash: string | null = null;
    let approvalMethod: 'PR' | 'MANUAL' = 'PR';

    try {
      // ========================================================================
      // PHASE 0: Host Environment Check (ST-115)
      // ========================================================================
      console.log('[DeploymentService] Phase 0: Host Environment Check');
      await this.validateHostEnvironment();

      // ========================================================================
      // PHASE 1: Validation
      // ========================================================================
      console.log('[DeploymentService] Phase 1: Validation');
      const validationStart = Date.now();

      const story = await this.validateStory(params.storyId);
      storyKey = story.key;

      // ST-84: Route to appropriate approval validation based on deployment mode
      if (params.directCommit) {
        console.log('[DeploymentService] Direct commit mode - validating manual approval');
        approvalMethod = 'MANUAL';
        await this.validateManualApproval(params.storyId);
        const commitValidation = await this.validateCommit(params.storyId);
        commitHash = commitValidation.commitHash;
      } else {
        console.log('[DeploymentService] PR mode - validating PR approval');
        approvalMethod = 'PR';
        await this.validatePRApproval(params.prNumber!);
        // Only validate worktree in PR mode (direct commit mode doesn't use worktrees)
        await this.validateWorktree(params.storyId);
      }

      phases.validation = {
        success: true,
        duration: Date.now() - validationStart,
        message: 'All validations passed',
      };

      // ========================================================================
      // PHASE 2: Create Deployment Log (pending)
      // ========================================================================
      console.log('[DeploymentService] Phase 2: Creating deployment log');
      const deploymentLog = await this.prisma.deploymentLog.create({
        data: {
          storyId: params.storyId,
          prNumber: params.prNumber,
          commitHash: commitHash,
          approvalMethod: approvalMethod,
          status: 'pending',
          environment: 'production',
          deployedBy: params.triggeredBy || 'mcp-user',
          metadata: {
            triggeredAt: new Date().toISOString(),
            triggeredBy: params.triggeredBy || 'mcp-user',
            deploymentMode: params.directCommit ? 'direct_commit' : 'pr',
            commitHash: commitHash,
          },
        },
      });
      deploymentLogId = deploymentLog.id;

      // ========================================================================
      // PHASE 3: Acquire Deployment Lock
      // ========================================================================
      console.log('[DeploymentService] Phase 3: Acquiring deployment lock');
      const lockStart = Date.now();

      const lock = await this.lockService.acquireLock(
        `Production deployment for ${storyKey} (PR #${params.prNumber})`,
        params.storyId,
        params.prNumber,
        30 // 30 minutes
      );
      lockId = lock.id;

      phases.lockAcquisition = {
        success: true,
        duration: Date.now() - lockStart,
        message: `Lock acquired: ${lockId}`,
        metadata: { lockId },
      };

      // Update deployment log with lock ID
      await this.prisma.deploymentLog.update({
        where: { id: deploymentLogId },
        data: {
          deploymentId: lockId,
          status: 'deploying',
          deployedAt: new Date(),
        },
      });

      // ST-129: Broadcast deployment started event via WebSocket
      if (this.websocketGateway) {
        try {
          this.websocketGateway.broadcastDeploymentStarted(params.storyId, story.projectId, {
            storyKey: storyKey,
            environment: 'production',
            startedAt: new Date().toISOString(),
          });
        } catch (wsError: any) {
          // Non-fatal - log and continue
          console.warn(`[ST-129] Failed to broadcast deployment started: ${wsError.message}`);
        }
      }

      // ========================================================================
      // PHASE 4: Pre-Deployment Backup (AC4)
      // ========================================================================
      if (!params.skipBackup) {
        console.log('[DeploymentService] Phase 4: Creating pre-deployment backup');
        const backupStart = Date.now();

        const backup = await this.backupService.createBackup(
          BackupType.PRE_MIGRATION, // Using PRE_MIGRATION for pre-deployment backups
          `ST-${storyKey}-PR-${params.prNumber}`
        );
        backupFile = backup.filepath;

        phases.backup = {
          success: true,
          duration: Date.now() - backupStart,
          message: `Backup created: ${backup.filename}`,
          metadata: {
            filename: backup.filename,
            size: backup.size,
            filepath: backup.filepath,
          },
        };
      } else {
        warnings.push('⚠️  BACKUP SKIPPED - Emergency deployment mode');
        phases.backup = {
          success: true,
          duration: 0,
          message: 'Backup skipped (emergency mode)',
        };
      }

      // ========================================================================
      // PHASE 4.5: Auto-Detect Build Requirements (ST-115)
      // ========================================================================
      let changeAnalysis: ChangeAnalysis | null = null;
      let effectiveSkipBackend = params.skipBackendBuild || false;
      let effectiveSkipFrontend = params.skipFrontendBuild || false;

      if (params.autoDetectBuilds) {
        console.log('[DeploymentService] Phase 4.5: Auto-detecting build requirements');
        try {
          const buildDecision = await this.buildDecisionService.makeBuildDecision();
          changeAnalysis = buildDecision.analysis;

          console.log(`[DeploymentService] Change analysis: ${buildDecision.reason}`);
          console.log(`[DeploymentService] - Backend files: ${changeAnalysis.backendFiles.length}`);
          console.log(`[DeploymentService] - Frontend files: ${changeAnalysis.frontendFiles.length}`);
          console.log(`[DeploymentService] - Shared files: ${changeAnalysis.sharedFiles.length}`);

          // Apply auto-detected build decisions (only if not explicitly set)
          if (!params.skipBackendBuild && buildDecision.skipBackendBuild) {
            effectiveSkipBackend = true;
            warnings.push(`🔍 Auto-detect: Skipping backend build (${buildDecision.reason})`);
          }
          if (!params.skipFrontendBuild && buildDecision.skipFrontendBuild) {
            effectiveSkipFrontend = true;
            warnings.push(`🔍 Auto-detect: Skipping frontend build (${buildDecision.reason})`);
          }
        } catch (autoDetectError: any) {
          console.warn(`[DeploymentService] Auto-detect failed, building both services: ${autoDetectError.message}`);
          warnings.push(`⚠️  Auto-detect failed: ${autoDetectError.message}. Building both services.`);
        }
      }

      // ========================================================================
      // PHASE 4.9: Pull Latest Code from Main
      // ========================================================================
      console.log('[DeploymentService] Phase 4.9: Pulling latest code from main...');
      try {
        execSync('git pull origin main', {
          cwd: this.projectRoot,
          stdio: 'inherit',
        });
        console.log('[DeploymentService] ✅ Git pull completed');
      } catch (gitPullError: any) {
        throw new Error(`Git pull failed: ${gitPullError.message}`);
      }

      // ========================================================================
      // PHASE 5 & 6: Build Containers (AC5) - Parallel Execution
      // ========================================================================
      console.log('[DeploymentService] Phase 5 & 6: Building containers (parallel)');

      // Determine which builds to run
      const buildsToRun: Promise<void>[] = [];

      // ST-115: Log if using cache (default is false for production safety)
      if (params.useCache) {
        console.log('[DeploymentService] Using BuildKit cache (useCache=true)');
      }

      if (!effectiveSkipBackend) {
        buildsToRun.push(
          (async () => {
            console.log('[DeploymentService] Building backend container');
            const start = Date.now();
            await this.buildDockerContainer('backend', params.useCache || false);
            phases.buildBackend = {
              success: true,
              duration: Date.now() - start,
              message: params.useCache
                ? 'Backend container built successfully (with cache)'
                : 'Backend container built successfully',
            };
          })()
        );
      } else {
        console.log('[DeploymentService] Skipping backend build (skipBackendBuild=true)');
        phases.buildBackend = { success: true, duration: 0, message: 'Backend build skipped (no changes detected)' };
      }

      if (!effectiveSkipFrontend) {
        buildsToRun.push(
          (async () => {
            console.log('[DeploymentService] Building frontend container');
            const start = Date.now();
            await this.buildDockerContainer('frontend', params.useCache || false);
            phases.buildFrontend = {
              success: true,
              duration: Date.now() - start,
              message: params.useCache
                ? 'Frontend container built successfully (with cache)'
                : 'Frontend container built successfully',
            };
          })()
        );
      } else {
        console.log('[DeploymentService] Skipping frontend build (skipFrontendBuild=true)');
        phases.buildFrontend = { success: true, duration: 0, message: 'Frontend build skipped (no changes detected)' };
      }

      // Run builds in parallel if multiple builds needed
      if (buildsToRun.length > 0) {
        console.log(`[DeploymentService] Running ${buildsToRun.length} build(s) in parallel`);
        await Promise.all(buildsToRun);
      } else {
        console.log('[DeploymentService] All builds skipped');
      }

      // ========================================================================
      // PHASE 7: Restart Backend Container
      // ========================================================================
      console.log('[DeploymentService] Phase 7: Restarting backend container');
      const backendRestartStart = Date.now();

      await this.restartDockerContainer('backend');

      phases.restartBackend = {
        success: true,
        duration: Date.now() - backendRestartStart,
        message: 'Backend container restarted successfully',
      };

      // ========================================================================
      // PHASE 8: Restart Frontend Container
      // ========================================================================
      console.log('[DeploymentService] Phase 8: Restarting frontend container');
      const frontendRestartStart = Date.now();

      await this.restartDockerContainer('frontend');

      phases.restartFrontend = {
        success: true,
        duration: Date.now() - frontendRestartStart,
        message: 'Frontend container restarted successfully',
      };

      // ========================================================================
      // PHASE 9: Health Checks (AC6)
      // ========================================================================
      let healthCheckResults: HealthCheckResults | undefined;

      if (!params.skipHealthChecks) {
        console.log('[DeploymentService] Phase 9: Running health checks');
        const healthCheckStart = Date.now();

        healthCheckResults = await this.runHealthChecks();

        if (!healthCheckResults.backend.success || !healthCheckResults.frontend.success) {
          throw new Error(
            `Health checks failed. Backend: ${healthCheckResults.backend.consecutiveSuccesses}/3, ` +
            `Frontend: ${healthCheckResults.frontend.consecutiveSuccesses}/3`
          );
        }

        phases.healthChecks = {
          success: true,
          duration: Date.now() - healthCheckStart,
          message: 'All health checks passed (3/3 consecutive)',
          metadata: healthCheckResults,
        };
      } else {
        warnings.push('⚠️  HEALTH CHECKS SKIPPED - Emergency deployment mode');
        phases.healthChecks = {
          success: true,
          duration: 0,
          message: 'Health checks skipped (emergency mode)',
        };
      }

      // ========================================================================
      // PHASE 10: Release Lock
      // ========================================================================
      console.log('[DeploymentService] Phase 10: Releasing deployment lock');
      const lockReleaseStart = Date.now();

      await this.lockService.releaseLock(lockId);

      phases.lockRelease = {
        success: true,
        duration: Date.now() - lockReleaseStart,
        message: 'Deployment lock released',
      };

      // ========================================================================
      // PHASE 11: Update Deployment Log (success)
      // ========================================================================
      await this.prisma.deploymentLog.update({
        where: { id: deploymentLogId },
        data: {
          status: 'deployed',
          completedAt: new Date(),
          metadata: {
            phases: phases as any,
            healthCheckResults,
            backupFile,
            duration: Date.now() - startTime,
          } as any,
        },
      });

      // ========================================================================
      // Success!
      // ========================================================================
      const totalDuration = Date.now() - startTime;

      // Clear manual approval after successful deployment (single-use)
      if (params.directCommit) {
        await this.clearManualApproval(params.storyId);
      }

      // ========================================================================
      // PHASE 12: Record Deployment State for Future Change Detection (ST-115)
      // ========================================================================
      try {
        const currentCommit = commitHash || execSync('git rev-parse HEAD', {
          cwd: this.projectRoot,
          encoding: 'utf-8',
        }).trim();

        // Record backend deployment if it was built
        if (!effectiveSkipBackend) {
          await this.buildDecisionService.recordDeployment(
            'backend',
            currentCommit,
            changeAnalysis?.backendFiles || [],
            { storyKey, prNumber: params.prNumber, duration: phases.buildBackend.duration }
          );
        }

        // Record frontend deployment if it was built
        if (!effectiveSkipFrontend) {
          await this.buildDecisionService.recordDeployment(
            'frontend',
            currentCommit,
            changeAnalysis?.frontendFiles || [],
            { storyKey, prNumber: params.prNumber, duration: phases.buildFrontend.duration }
          );
        }

        console.log('[DeploymentService] ✓ Deployment state recorded for future change detection');
      } catch (recordError: any) {
        // Non-fatal - just log warning
        console.warn(`[DeploymentService] Failed to record deployment state: ${recordError.message}`);
        warnings.push(`⚠️  Failed to record deployment state: ${recordError.message}`);
      }

      // ST-129: Broadcast deployment completed event via WebSocket (success)
      if (this.websocketGateway) {
        try {
          this.websocketGateway.broadcastDeploymentCompleted(params.storyId, story.projectId, {
            storyKey: storyKey,
            environment: 'production',
            status: 'success',
            completedAt: new Date().toISOString(),
          });
        } catch (wsError: any) {
          // Non-fatal - log and continue
          console.warn(`[ST-129] Failed to broadcast deployment completed: ${wsError.message}`);
        }
      }

      return {
        success: true,
        deploymentLogId,
        storyKey,
        prNumber: params.prNumber,
        directCommit: params.directCommit,
        commitHash: commitHash || undefined,
        duration: totalDuration,
        lockId,
        backupFile: backupFile || undefined,
        healthCheckResults,
        phases,
        warnings,
        errors: [],
        message: params.directCommit
          ? `✅ Production deployment successful for ${storyKey} (direct commit: ${commitHash?.substring(0, 7)}). Duration: ${Math.round(totalDuration / 1000)}s`
          : `✅ Production deployment successful for ${storyKey} (PR #${params.prNumber}). Duration: ${Math.round(totalDuration / 1000)}s`,
      };

    } catch (error: any) {
      // ========================================================================
      // ERROR HANDLING & ROLLBACK (AC8)
      // ========================================================================
      console.error('[DeploymentService] Deployment failed:', error.message);
      errors.push(error.message);

      // Attempt rollback if backup exists
      if (backupFile && !params.skipBackup) {
        console.log('[DeploymentService] Attempting automatic rollback...');
        const rollbackStart = Date.now();

        try {
          await this.rollback(backupFile);

          phases.rollback = {
            success: true,
            duration: Date.now() - rollbackStart,
            message: `Rollback successful from backup: ${path.basename(backupFile)}`,
            metadata: { backupFile },
          };

          warnings.push(`✅ Automatic rollback completed from backup: ${path.basename(backupFile)}`);
        } catch (rollbackError: any) {
          console.error('[DeploymentService] Rollback failed:', rollbackError.message);
          errors.push(`Rollback failed: ${rollbackError.message}`);

          phases.rollback = {
            success: false,
            duration: Date.now() - rollbackStart,
            error: rollbackError.message,
          };

          warnings.push(`❌ CRITICAL: Automatic rollback failed. Manual intervention required!`);
        }
      }

      // Release lock if acquired
      if (lockId) {
        try {
          await this.lockService.releaseLock(lockId);
          phases.lockRelease = {
            success: true,
            duration: 0,
            message: 'Lock released after failure',
          };
        } catch (lockError: any) {
          console.error('[DeploymentService] Failed to release lock:', lockError.message);
          warnings.push(`⚠️  Failed to release deployment lock: ${lockError.message}`);
        }
      }

      // Update deployment log (failed)
      if (deploymentLogId) {
        await this.prisma.deploymentLog.update({
          where: { id: deploymentLogId },
          data: {
            status: phases.rollback?.success ? 'rolled_back' : 'failed',
            completedAt: new Date(),
            errorMessage: error.message,
            metadata: {
              phases: phases as any,
              errors,
              warnings,
              duration: Date.now() - startTime,
            } as any,
          },
        });
      }

      // ST-129: Broadcast deployment completed event via WebSocket (failure/rollback)
      if (this.websocketGateway) {
        try {
          const story = await this.prisma.story.findUnique({
            where: { id: params.storyId },
            select: { projectId: true },
          });

          if (story) {
            this.websocketGateway.broadcastDeploymentCompleted(params.storyId, story.projectId, {
              storyKey: storyKey,
              environment: 'production',
              status: phases.rollback?.success ? 'rolled_back' : 'failed',
              completedAt: new Date().toISOString(),
            });
          }
        } catch (wsError: any) {
          // Non-fatal - log and continue
          console.warn(`[ST-129] Failed to broadcast deployment completed (failure): ${wsError.message}`);
        }
      }

      return {
        success: false,
        deploymentLogId: deploymentLogId || '',
        storyKey,
        prNumber: params.prNumber,
        directCommit: params.directCommit,
        commitHash: commitHash || undefined,
        duration: Date.now() - startTime,
        lockId: lockId || undefined,
        backupFile: backupFile || undefined,
        phases,
        warnings,
        errors,
        message: `❌ Deployment failed: ${error.message}`,
      };
    }
  }

  // ==========================================================================
  // Validation Methods
  // ==========================================================================

  /**
   * ST-115: Validate host environment before deployment
   * Checks Prisma client connectivity to catch corrupted node_modules early
   */
  private async validateHostEnvironment(): Promise<void> {
    console.log('[DeploymentService] Validating host environment...');

    try {
      // Quick Prisma connectivity check
      await this.prisma.$queryRaw`SELECT 1`;
      console.log('[DeploymentService] ✓ Host environment validated (Prisma OK)');
    } catch (error: any) {
      // Provide clear error message with recovery instructions
      throw new Error(
        `Host environment check failed: ${error.message}\n\n` +
        `The MCP server's Prisma client may be corrupted.\n\n` +
        `To fix, run these commands:\n` +
        `  cd /opt/stack/AIStudio\n` +
        `  rm -rf node_modules backend/node_modules\n` +
        `  docker cp vibe-studio-backend:/app/node_modules backend/node_modules\n` +
        `  ln -s backend/node_modules node_modules\n` +
        `  cd backend && npx prisma generate\n\n` +
        `Then restart Claude Code.`
      );
    }
  }

  private async validateStory(storyId: string): Promise<any> {
    const story = await this.prisma.story.findUnique({
      where: { id: storyId },
      include: { epic: true },
    });

    if (!story) {
      throw new Error(`Story ${storyId} not found`);
    }

    // Check if story is in qa or done status (ready for production)
    if (!['qa', 'done'].includes(story.status)) {
      throw new Error(
        `Story ${story.key} is not ready for production. Status: ${story.status}. ` +
        `Expected: qa or done`
      );
    }

    return story;
  }

  private async validatePRApproval(prNumber: number): Promise<void> {
    console.log(`[DeploymentService] Validating PR #${prNumber} approval...`);

    // Dynamic import to avoid circular dependencies
    const { validatePRForProduction } = await import('../mcp/servers/deployment/utils/github-pr-validator.js');

    const validationResult = await validatePRForProduction(prNumber);

    // Log warnings
    if (validationResult.warnings.length > 0) {
      console.warn(`[DeploymentService] PR validation warnings:`);
      validationResult.warnings.forEach(warning => console.warn(`  - ${warning}`));
    }

    // Check if validation passed
    if (!validationResult.valid) {
      const errorMessage = `PR #${prNumber} validation failed:\n${validationResult.errors.join('\n')}`;
      throw new Error(errorMessage);
    }

    // AC2: Verify PR is approved
    if (!validationResult.approved) {
      throw new Error(
        `PR #${prNumber} is not approved. At least 1 approval required. ` +
        `Current approvers: ${validationResult.approvers.join(', ') || 'none'}`
      );
    }

    // AC2: Verify PR is merged
    if (validationResult.prState !== 'merged' && !validationResult.mergedAt) {
      throw new Error(
        `PR #${prNumber} is not merged. State: ${validationResult.prState}. ` +
        `Merge PR before deploying to production.`
      );
    }

    // AC3: Check for merge conflicts
    if (validationResult.conflictsExist) {
      throw new Error(
        `PR #${prNumber} has merge conflicts. ` +
        `Resolve conflicts before deploying to production.`
      );
    }

    console.log(
      `[DeploymentService] PR #${prNumber} validation passed. ` +
      `Approved by: ${validationResult.approvers.join(', ')}. ` +
      `Merged at: ${validationResult.mergedAt}`
    );
  }

  private async validateWorktree(storyId: string): Promise<void> {
    const worktree = await this.prisma.worktree.findFirst({
      where: {
        storyId,
        status: 'active',
      },
    });

    if (!worktree) {
      throw new Error(
        `No active worktree found for story ${storyId}. ` +
        `Create worktree before deploying.`
      );
    }

    // Verify worktree directory exists
    const { existsSync } = await import('fs');
    if (!existsSync(worktree.worktreePath)) {
      throw new Error(
        `Worktree directory not found: ${worktree.worktreePath}. ` +
        `Worktree may be stale.`
      );
    }
  }

  /**
   * ST-84: Validate manual approval for direct commit deployments
   */
  private async validateManualApproval(storyId: string): Promise<void> {
    console.log(`[DeploymentService] Validating manual approval for story ${storyId}...`);

    const story = await this.prisma.story.findUnique({
      where: { id: storyId },
      select: {
        key: true,
        manualApproval: true,
        approvedBy: true,
        approvedAt: true,
        approvalExpiresAt: true,
      },
    });

    if (!story) {
      throw new Error(`Story ${storyId} not found`);
    }

    // Check if manual approval exists
    if (!story.manualApproval) {
      throw new Error(
        `Story ${story.key} does not have manual approval. ` +
        `Use approve_deployment tool before deploying with directCommit mode.`
      );
    }

    // Check if approval has expired
    const now = new Date();
    if (story.approvalExpiresAt && new Date(story.approvalExpiresAt) < now) {
      throw new Error(
        `Manual approval for story ${story.key} has expired. ` +
        `Approved at: ${story.approvedAt?.toISOString()}, Expired at: ${story.approvalExpiresAt.toISOString()}. ` +
        `Use approve_deployment tool to renew approval.`
      );
    }

    console.log(
      `[DeploymentService] Manual approval validation passed. ` +
      `Approved by: ${story.approvedBy}. ` +
      `Approved at: ${story.approvedAt?.toISOString()}. ` +
      `Expires at: ${story.approvalExpiresAt?.toISOString()}`
    );
  }

  /**
   * ST-84: Validate commit exists on main branch
   */
  private async validateCommit(storyId: string): Promise<{ commitHash: string; valid: boolean }> {
    console.log(`[DeploymentService] Validating latest commit on main branch...`);

    try {
      // Get latest commit hash on main branch
      const commitHash = execSync('git rev-parse main', {
        cwd: this.projectRoot,
        encoding: 'utf-8',
      }).trim();

      // Verify commit exists
      const commitExists = execSync(`git cat-file -t ${commitHash}`, {
        cwd: this.projectRoot,
        encoding: 'utf-8',
      }).trim();

      if (commitExists !== 'commit') {
        throw new Error(`Invalid commit hash: ${commitHash}`);
      }

      // Verify commit is on main branch
      const branchesContainingCommit = execSync(`git branch --contains ${commitHash}`, {
        cwd: this.projectRoot,
        encoding: 'utf-8',
      }).trim();

      if (!branchesContainingCommit.includes('main')) {
        throw new Error(
          `Commit ${commitHash} is not on main branch. ` +
          `Direct commit deployments must deploy from main branch.`
        );
      }

      console.log(
        `[DeploymentService] Commit validation passed. ` +
        `Deploying commit: ${commitHash.substring(0, 7)}`
      );

      return {
        commitHash,
        valid: true,
      };
    } catch (error: any) {
      throw new Error(`Commit validation failed: ${error.message}`);
    }
  }

  /**
   * ST-84: Clear manual approval after successful deployment (single-use)
   */
  private async clearManualApproval(storyId: string): Promise<void> {
    console.log(`[DeploymentService] Clearing manual approval for story ${storyId}...`);

    await this.prisma.story.update({
      where: { id: storyId },
      data: {
        manualApproval: false,
        // Keep approval history in metadata, but clear active approval
        // approvedBy, approvedAt, and approvalExpiresAt remain for audit trail
      },
    });

    console.log('[DeploymentService] Manual approval cleared (single-use policy)');
  }

  // ==========================================================================
  // Docker Operations (AC5)
  // ==========================================================================

  /**
   * Ensure a Docker buildx builder exists, creating it if necessary
   * This provides isolated build caches for production deployments
   */
  private async ensureBuilderExists(builderName: string): Promise<void> {
    try {
      // Check if builder already exists
      execSync(`docker buildx inspect ${builderName}`, {
        encoding: 'utf-8',
        stdio: 'pipe'
      });
      console.log(`[DeploymentService] Builder ${builderName} already exists, reusing...`);
    } catch (error) {
      // Builder doesn't exist, create it
      console.log(`[DeploymentService] Creating Docker buildx builder: ${builderName}...`);
      try {
        execSync(`docker buildx create --name ${builderName} --driver docker-container --use`, {
          encoding: 'utf-8',
          stdio: 'pipe'
        });
        console.log(`[DeploymentService] ✓ Builder ${builderName} created successfully`);
      } catch (createError: any) {
        throw new Error(`Failed to create buildx builder ${builderName}: ${createError.message}`);
      }
    }
  }

  /**
   * Build Docker container for a service
   * ST-115: Added useCache parameter for faster builds when cache is safe
   * ST-236: Use docker compose build instead of docker buildx (not available on all hosts)
   */
  private async buildDockerContainer(
    service: 'backend' | 'frontend',
    useCache: boolean = false
  ): Promise<void> {
    const cacheMode = useCache ? 'with cache' : 'with --no-cache';
    console.log(`[DeploymentService] Building ${service} container ${cacheMode}...`);

    try {
      // ST-236: Use docker compose build instead of buildx for compatibility
      // ST-115: Only add --no-cache flag when useCache is false (default for production safety)
      const cacheFlag = useCache ? '' : '--no-cache';
      const buildCommand = `docker compose build ${cacheFlag} ${service}`.replace(/\s+/g, ' ').trim();

      execSync(buildCommand, {
        cwd: this.projectRoot,
        stdio: 'inherit',
        timeout: 600000, // 10 minutes max
      });

      console.log(`[DeploymentService] ${service} container built successfully`);
    } catch (error: any) {
      throw new Error(`Failed to build ${service} container: ${error.message}`);
    }
  }

  private async restartDockerContainer(service: 'backend' | 'frontend'): Promise<void> {
    console.log(`[DeploymentService] Restarting ${service} container...`);

    try {
      const restartCommand = `docker compose up -d ${service}`;

      execSync(restartCommand, {
        cwd: this.projectRoot,
        stdio: 'inherit',
        timeout: 120000, // 2 minutes max
      });

      console.log(`[DeploymentService] ${service} container restarted successfully`);
    } catch (error: any) {
      throw new Error(`Failed to restart ${service} container: ${error.message}`);
    }
  }

  // ==========================================================================
  // Health Checks (AC6) - 3 consecutive successes required
  // ==========================================================================

  private async runHealthChecks(): Promise<HealthCheckResults> {
    const requiredConsecutiveSuccesses = 3;
    const delayBetweenChecks = 5000; // 5 seconds
    const maxAttempts = 24; // 2 minutes total (24 * 5s)
    const warmupDelay = 15000; // 15 seconds initial warmup

    console.log(`[DeploymentService] Waiting ${warmupDelay / 1000} seconds for containers to initialize...`);
    await new Promise(resolve => setTimeout(resolve, warmupDelay));

    let backendSuccesses = 0;
    let frontendSuccesses = 0;
    let attempts = 0;

    while (attempts < maxAttempts) {
      attempts++;
      console.log(`[DeploymentService] Health check attempt ${attempts}/${maxAttempts}`);

      // Check backend
      const backendCheck = await this.checkServiceHealth('http://127.0.0.1:3000/api/health');
      if (backendCheck.success) {
        backendSuccesses++;
        console.log(`[DeploymentService] Backend health check passed (${backendSuccesses}/${requiredConsecutiveSuccesses})`);
      } else {
        console.log(`[DeploymentService] Backend health check failed: ${backendCheck.error || 'Unknown error'}`);
        // DON'T reset counter - just keep trying
      }

      // Check frontend
      const frontendCheck = await this.checkServiceHealth('http://127.0.0.1:5173');
      if (frontendCheck.success) {
        frontendSuccesses++;
        console.log(`[DeploymentService] Frontend health check passed (${frontendSuccesses}/${requiredConsecutiveSuccesses})`);
      } else {
        console.log(`[DeploymentService] Frontend health check failed: ${frontendCheck.error || 'Unknown error'}`);
        // DON'T reset counter - just keep trying
      }

      // Check if both services have enough consecutive successes
      if (backendSuccesses >= requiredConsecutiveSuccesses &&
          frontendSuccesses >= requiredConsecutiveSuccesses) {
        console.log('[DeploymentService] All health checks passed!');
        return {
          backend: {
            success: true,
            consecutiveSuccesses: backendSuccesses,
            url: 'http://127.0.0.1:3000/api/health',
            latency: backendCheck.latency,
          },
          frontend: {
            success: true,
            consecutiveSuccesses: frontendSuccesses,
            url: 'http://127.0.0.1:5173',
            latency: frontendCheck.latency,
          },
        };
      }

      if (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, delayBetweenChecks));
      }
    }

    // Failed after all attempts
    return {
      backend: {
        success: backendSuccesses >= requiredConsecutiveSuccesses,
        consecutiveSuccesses: backendSuccesses,
        url: 'http://127.0.0.1:3000/api/health',
      },
      frontend: {
        success: frontendSuccesses >= requiredConsecutiveSuccesses,
        consecutiveSuccesses: frontendSuccesses,
        url: 'http://127.0.0.1:5173',
      },
    };
  }

  private async checkServiceHealth(url: string): Promise<{ success: boolean; latency?: number; error?: string }> {
    const startTime = Date.now();

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'User-Agent': 'DeploymentService/1.0' },
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });

      const latency = Date.now() - startTime;

      if (response.ok) {
        return { success: true, latency };
      } else {
        const error = `HTTP ${response.status}`;
        return { success: false, error };
      }
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // ==========================================================================
  // Rollback (AC8)
  // ==========================================================================

  private async rollback(backupFile: string): Promise<void> {
    console.log(`[DeploymentService] Rolling back from backup: ${backupFile}`);

    try {
      const restoreResult = await this.restoreService.restoreFromBackup(backupFile, {
        force: true,
        skipValidation: false,
      });

      if (!restoreResult.success) {
        throw new Error(
          `Restore failed: ${restoreResult.errors.join(', ')}`
        );
      }

      console.log('[DeploymentService] Rollback completed successfully');
    } catch (error: any) {
      throw new Error(`Rollback failed: ${error.message}`);
    }
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Get deployment history for a story
   */
  async getDeploymentHistory(storyId: string): Promise<any[]> {
    return this.prisma.deploymentLog.findMany({
      where: { storyId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
  }

  /**
   * Get current deployment status
   */
  async getCurrentDeployment(): Promise<any | null> {
    return this.prisma.deploymentLog.findFirst({
      where: {
        status: 'deploying',
      },
      orderBy: { createdAt: 'desc' },
      include: {
        story: {
          select: {
            key: true,
            title: true,
          },
        },
      },
    });
  }
}
