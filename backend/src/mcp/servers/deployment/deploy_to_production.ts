/**
 * MCP Tool: Deploy to Production Environment
 *
 * **ST-77: Production Deployment Safety System**
 *
 * Orchestrates safe production deployment with comprehensive safeguards:
 * 1. Validate story, worktree, and PR approval
 * 2. Acquire deployment lock (singleton - only 1 deployment at a time)
 * 3. Create pre-deployment backup
 * 4. Build Docker containers (backend, frontend) with --no-cache
 * 5. Restart containers
 * 6. Run health checks (3 consecutive successes required)
 * 7. Create deployment audit log
 * 8. Release lock on completion
 * 9. Auto-rollback on failure
 *
 * **CRITICAL SAFETY FEATURES:**
 * - ✅ AC1: Deployment lock enforcement (singleton)
 * - ✅ AC2: PR approval workflow (GitHub API validation)
 * - ✅ AC3: Merge conflict detection
 * - ✅ AC4: Pre-deployment backup (automatic)
 * - ✅ AC5: Docker build and deployment (sequential)
 * - ✅ AC6: Health check validation (3 consecutive successes)
 * - ✅ AC7: Deployment audit trail (complete log)
 * - ✅ AC8: Rollback on failure (automatic restore)
 * - ✅ AC9: CLAUDE.md permission enforcement
 * - ✅ AC10: Structured error handling
 *
 * Based on:
 * - deploy_to_test_env (ST-76) - Isolated test deployment
 * - SafeMigration (ST-70) - Database migration safety
 * - DeploymentLockService (ST-77 Phase 1)
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import { DeploymentService, DeploymentParams } from '../../../services/deployment.service.js';
import { DeploymentLockService } from '../../../services/deployment-lock.service.js';
import { getWebSocketGateway } from '../../services/websocket-gateway.instance.js';
import { ValidationError, NotFoundError } from '../../types.js';
import { validateRequired } from '../../utils.js';

// ============================================================================
// Input/Output Types
// ============================================================================

export interface DeployToProductionParams {
  storyId: string;
  prNumber?: number; // Optional - required if directCommit is false
  directCommit?: boolean; // Optional - enables direct commit mode (bypasses PR workflow)
  triggeredBy?: string; // User/agent identifier (defaults to 'mcp-user')
  skipBackup?: boolean; // EMERGENCY ONLY - skip pre-deployment backup
  skipHealthChecks?: boolean; // EMERGENCY ONLY - skip health checks
  skipBackendBuild?: boolean; // Optional - skip backend build (for frontend-only changes)
  skipFrontendBuild?: boolean; // Optional - skip frontend build (for backend-only changes)
  useCache?: boolean; // ST-115: Use BuildKit cache (default: false for deterministic prod builds)
  autoDetectBuilds?: boolean; // ST-115: Auto-detect which services need rebuilding based on git diff
  confirmDeploy?: boolean; // REQUIRED: Must be true to confirm deployment
}

export interface DeployToProductionResponse {
  success: boolean;
  deploymentLogId: string;
  storyKey: string;
  prNumber?: number;
  directCommit?: boolean;
  commitHash?: string;
  duration: number;
  lockId?: string;
  backupFile?: string;
  healthCheckResults?: {
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
  };
  phases: {
    validation: PhaseStatus;
    lockAcquisition: PhaseStatus;
    backup: PhaseStatus;
    buildBackend: PhaseStatus;
    buildFrontend: PhaseStatus;
    restartBackend: PhaseStatus;
    restartFrontend: PhaseStatus;
    healthChecks: PhaseStatus;
    lockRelease: PhaseStatus;
    rollback?: PhaseStatus;
  };
  warnings: string[];
  errors: string[];
  message: string;
}

interface PhaseStatus {
  success: boolean;
  duration: number;
  message?: string;
  error?: string;
}

// ============================================================================
// Tool Definition
// ============================================================================

export const tool: Tool = {
  name: 'deploy_to_production',
  description: 'Deploy story to production with safety checks. Supports PR mode (requires approval) or direct commit mode (requires approve_deployment). Includes automatic backup, health checks, and rollback.',

  inputSchema: {
    type: 'object',
    properties: {
      storyId: {
        type: 'string',
        description: 'Story UUID to deploy (required)',
      },
      prNumber: {
        type: 'number',
        description: 'GitHub PR number (required for PR mode, mutually exclusive with directCommit)',
      },
      directCommit: {
        type: 'boolean',
        description: 'Enable direct commit mode (mutually exclusive with prNumber, requires manual approval)',
      },
      triggeredBy: {
        type: 'string',
        description: 'User or agent identifier (default: "mcp-user")',
      },
      skipBackup: {
        type: 'boolean',
        description: 'EMERGENCY ONLY: Skip pre-deployment backup (default: false)',
      },
      skipHealthChecks: {
        type: 'boolean',
        description: 'EMERGENCY ONLY: Skip health check validation (default: false)',
      },
      skipBackendBuild: {
        type: 'boolean',
        description: 'OPTIMIZATION: Skip backend build for frontend-only changes (default: false)',
      },
      skipFrontendBuild: {
        type: 'boolean',
        description: 'OPTIMIZATION: Skip frontend build for backend-only changes (default: false)',
      },
      useCache: {
        type: 'boolean',
        description: 'OPTIMIZATION (ST-115): Use BuildKit cache for faster builds (default: false for deterministic production builds)',
      },
      autoDetectBuilds: {
        type: 'boolean',
        description: 'OPTIMIZATION (ST-115): Auto-detect which services need rebuilding based on git diff since last deployment (default: false)',
      },
      confirmDeploy: {
        type: 'boolean',
        description: 'REQUIRED: Must be true to confirm production deployment',
      },
    },
    required: ['storyId', 'confirmDeploy'],
  },
};

// ============================================================================
// Handler Implementation
// ============================================================================

export async function handler(
  prisma: PrismaClient,
  params: DeployToProductionParams
): Promise<DeployToProductionResponse> {
  const startTime = Date.now();

  console.log('='.repeat(80));
  console.log('🚀 PRODUCTION DEPLOYMENT INITIATED (ASYNC)');
  console.log('='.repeat(80));
  console.log(`Story ID: ${params.storyId}`);
  console.log(`Deployment Mode: ${params.directCommit ? 'Direct Commit' : 'PR-based'}`);
  if (params.prNumber) {
    console.log(`PR Number: #${params.prNumber}`);
  }
  console.log(`Triggered By: ${params.triggeredBy || 'mcp-user'}`);
  console.log('='.repeat(80));

  try {
    // ========================================================================
    // VALIDATION
    // ========================================================================

    // Validate required parameters
    validateRequired(params, ['storyId', 'confirmDeploy']);

    // Enforce confirmation (prevents accidental deployments)
    if (params.confirmDeploy !== true) {
      throw new ValidationError(
        'Production deployment requires explicit confirmation. ' +
        'Set confirmDeploy: true to proceed. ' +
        'This is a safety measure to prevent accidental deployments.'
      );
    }

    // ST-84 Mutual exclusivity check
    if (params.prNumber && params.directCommit) {
      throw new ValidationError(
        'Cannot use both prNumber and directCommit simultaneously. ' +
        'Choose one deployment mode: PR-based (prNumber) OR direct commit (directCommit=true).'
      );
    }

    // ST-84 Require one of the two modes
    if (!params.prNumber && !params.directCommit) {
      throw new ValidationError(
        'Must provide either prNumber (for PR mode) or directCommit=true (for direct commit mode). ' +
        'Direct commit mode requires prior approval via approve_deployment tool.'
      );
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(params.storyId)) {
      throw new ValidationError(
        `Invalid storyId format: ${params.storyId}. Expected UUID format.`
      );
    }

    // Validate PR number if provided
    if (params.prNumber && params.prNumber < 1) {
      throw new ValidationError(
        `Invalid prNumber: ${params.prNumber}. Expected positive integer.`
      );
    }

    // Get story for key
    const story = await prisma.story.findUnique({
      where: { id: params.storyId },
      select: { key: true, projectId: true },
    });

    if (!story) {
      throw new NotFoundError('Story', params.storyId);
    }

    // ========================================================================
    // CHECK DEPLOYMENT LOCK & CREATE DEPLOYMENT LOG (ATOMIC)
    // ========================================================================
    // CRITICAL-3: Use transaction to atomically check lock and create deployment log

    const lockService = new DeploymentLockService(prisma);

    const deploymentLog = await prisma.$transaction(async (tx) => {
      // Check if there's already an active lock inside transaction
      const existingLocks = await tx.deploymentLock.findMany({
        where: {
          active: true,
          expiresAt: { gt: new Date() },
        },
      });

      if (existingLocks.length > 0) {
        const activeLock = existingLocks[0];
        throw new ValidationError(
          `Deployment already in progress (locked by ${activeLock.lockedBy}). ` +
          `Wait for current deployment to complete or release the lock.`
        );
      }

      // Create deployment log inside same transaction
      return await tx.deploymentLog.create({
        data: {
          storyId: params.storyId,
          prNumber: params.prNumber,
          status: 'queued',
          environment: 'production',
          deployedBy: params.triggeredBy || 'mcp-user',
          approvalMethod: params.directCommit ? 'MANUAL' : 'PR',
          currentPhase: 'queued',
          progress: {
            phaseIndex: 0,
            totalPhases: 8,
            percentComplete: 0,
            currentPhase: 'queued',
            message: 'Deployment queued for execution',
          },
        },
      });
    });

    console.log(`✅ Deployment queued: ${deploymentLog.id}`);

    // ========================================================================
    // SPAWN DEPLOYMENT WORKER (DETACHED)
    // ========================================================================

    const { fork } = await import('child_process');
    const path = await import('path');

    const workerPath = path.resolve(__dirname, '../../../workers/deployment-worker.js');
    const workerProcess = fork(workerPath, [deploymentLog.id], {
      detached: true,
      stdio: 'ignore',
    });

    // CRITICAL-2: Add error handler for worker spawn failures
    workerProcess.on('error', async (error) => {
      console.error(`Failed to spawn deployment worker: ${error.message}`);
      await prisma.deploymentLog.update({
        where: { id: deploymentLog.id },
        data: {
          status: 'failed',
          errorMessage: `Worker spawn failed: ${error.message}`,
          completedAt: new Date(),
        },
      });
    });

    // Unref so parent can exit
    workerProcess.unref();

    console.log(`✅ Deployment worker spawned: PID ${workerProcess.pid}`);

    // ========================================================================
    // RETURN IMMEDIATELY WITH POLL INFO
    // ========================================================================

    const pollUrl = `/api/deployment/status/${deploymentLog.id}`;
    const pollIntervalMs = 5000; // Poll every 5 seconds

    console.log('='.repeat(80));
    console.log('✅ DEPLOYMENT QUEUED SUCCESSFULLY');
    console.log('='.repeat(80));
    console.log(`Deployment Log ID: ${deploymentLog.id}`);
    console.log(`Poll URL: ${pollUrl}`);
    console.log(`Poll Interval: ${pollIntervalMs}ms`);
    console.log('='.repeat(80));

    return {
      success: true,
      deploymentLogId: deploymentLog.id,
      storyKey: story.key,
      prNumber: params.prNumber,
      directCommit: params.directCommit,
      duration: Date.now() - startTime,
      phases: {
        validation: { success: true, duration: Date.now() - startTime },
        lockAcquisition: { success: false, duration: 0 },
        backup: { success: false, duration: 0 },
        buildBackend: { success: false, duration: 0 },
        buildFrontend: { success: false, duration: 0 },
        restartBackend: { success: false, duration: 0 },
        restartFrontend: { success: false, duration: 0 },
        healthChecks: { success: false, duration: 0 },
        lockRelease: { success: false, duration: 0 },
      },
      warnings: [],
      errors: [],
      message: `Deployment queued. Poll ${pollUrl} every ${pollIntervalMs}ms for status updates. Use get_deployment_status tool.`,
    };

  } catch (error: any) {
    console.error('❌ DEPLOYMENT QUEUEING FAILED:', error.message);
    console.log('='.repeat(80));

    // Determine error type
    let errorType = 'DeploymentError';
    if (error instanceof ValidationError) {
      errorType = 'ValidationError';
    } else if (error instanceof NotFoundError) {
      errorType = 'NotFoundError';
    }

    // Return structured error response
    return {
      success: false,
      deploymentLogId: '',
      storyKey: '',
      prNumber: params.prNumber,
      directCommit: params.directCommit,
      duration: Date.now() - startTime,
      phases: {
        validation: { success: false, duration: 0, error: error.message },
        lockAcquisition: { success: false, duration: 0 },
        backup: { success: false, duration: 0 },
        buildBackend: { success: false, duration: 0 },
        buildFrontend: { success: false, duration: 0 },
        restartBackend: { success: false, duration: 0 },
        restartFrontend: { success: false, duration: 0 },
        healthChecks: { success: false, duration: 0 },
        lockRelease: { success: false, duration: 0 },
      },
      warnings: [],
      errors: [error.message],
      message: `❌ ${errorType}: ${error.message}`,
    };
  }
}

// ============================================================================
// Export
// ============================================================================

export default {
  tool,
  handler,
};
