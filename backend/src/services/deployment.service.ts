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

import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import * as path from 'path';
import { DeploymentLockService } from './deployment-lock.service.js';
import { BackupService } from './backup.service.js';
import { RestoreService } from './restore.service.js';
import { BackupType } from '../types/migration.types.js';

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
  private projectRoot: string;

  constructor(
    prismaClient?: PrismaClient,
    lockService?: DeploymentLockService,
    backupService?: BackupService,
    restoreService?: RestoreService
  ) {
    this.prisma = prismaClient || new PrismaClient();
    this.lockService = lockService || new DeploymentLockService(this.prisma);
    this.backupService = backupService || new BackupService();
    this.restoreService = restoreService || new RestoreService();
    this.projectRoot = path.resolve(__dirname, '../../../');
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
      }

      await this.validateWorktree(params.storyId);

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
      // PHASE 5: Build Backend Container (AC5)
      // ========================================================================
      console.log('[DeploymentService] Phase 5: Building backend container');
      const backendBuildStart = Date.now();

      await this.buildDockerContainer('backend');

      phases.buildBackend = {
        success: true,
        duration: Date.now() - backendBuildStart,
        message: 'Backend container built successfully',
      };

      // ========================================================================
      // PHASE 6: Build Frontend Container (AC5)
      // ========================================================================
      console.log('[DeploymentService] Phase 6: Building frontend container');
      const frontendBuildStart = Date.now();

      await this.buildDockerContainer('frontend');

      phases.buildFrontend = {
        success: true,
        duration: Date.now() - frontendBuildStart,
        message: 'Frontend container built successfully',
      };

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

  private async buildDockerContainer(service: 'backend' | 'frontend'): Promise<void> {
    console.log(`[DeploymentService] Building ${service} container with --no-cache...`);

    try {
      // Use production Dockerfile (per CLAUDE.md requirements)
      const buildCommand = `docker compose build ${service} --no-cache`;

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
    const maxAttempts = 10; // Max 10 attempts

    let backendSuccesses = 0;
    let frontendSuccesses = 0;
    let attempts = 0;

    while (attempts < maxAttempts) {
      attempts++;

      // Check backend
      const backendCheck = await this.checkServiceHealth('http://localhost:3000/health');
      if (backendCheck.success) {
        backendSuccesses++;
      } else {
        backendSuccesses = 0; // Reset on failure
      }

      // Check frontend
      const frontendCheck = await this.checkServiceHealth('http://localhost:5173');
      if (frontendCheck.success) {
        frontendSuccesses++;
      } else {
        frontendSuccesses = 0; // Reset on failure
      }

      console.log(
        `[DeploymentService] Health check attempt ${attempts}: ` +
        `Backend ${backendSuccesses}/3, Frontend ${frontendSuccesses}/3`
      );

      // Check if we have 3 consecutive successes for both
      if (
        backendSuccesses >= requiredConsecutiveSuccesses &&
        frontendSuccesses >= requiredConsecutiveSuccesses
      ) {
        return {
          backend: {
            success: true,
            consecutiveSuccesses: backendSuccesses,
            url: 'http://localhost:3000/health',
            latency: backendCheck.latency,
          },
          frontend: {
            success: true,
            consecutiveSuccesses: frontendSuccesses,
            url: 'http://localhost:5173',
            latency: frontendCheck.latency,
          },
        };
      }

      // Wait before next attempt
      if (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, delayBetweenChecks));
      }
    }

    // Failed to get 3 consecutive successes
    return {
      backend: {
        success: false,
        consecutiveSuccesses: backendSuccesses,
        url: 'http://localhost:3000/health',
      },
      frontend: {
        success: false,
        consecutiveSuccesses: frontendSuccesses,
        url: 'http://localhost:5173',
      },
    };
  }

  private async checkServiceHealth(url: string): Promise<{ success: boolean; latency?: number }> {
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
        console.warn(`[DeploymentService] Health check failed: ${url} returned ${response.status}`);
        return { success: false };
      }
    } catch (error: any) {
      console.warn(`[DeploymentService] Health check error: ${url} - ${error.message}`);
      return { success: false };
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
