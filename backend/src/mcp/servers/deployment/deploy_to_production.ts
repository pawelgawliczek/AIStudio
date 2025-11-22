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
import { ValidationError, NotFoundError } from '../../types.js';
import { validateRequired } from '../../utils.js';
import { DeploymentService, DeploymentParams } from '../../../services/deployment.service.js';

// ============================================================================
// Input/Output Types
// ============================================================================

export interface DeployToProductionParams {
  storyId: string;
  prNumber: number;
  triggeredBy?: string; // User/agent identifier (defaults to 'mcp-user')
  skipBackup?: boolean; // EMERGENCY ONLY - skip pre-deployment backup
  skipHealthChecks?: boolean; // EMERGENCY ONLY - skip health checks
  confirmDeploy?: boolean; // REQUIRED: Must be true to confirm deployment
}

export interface DeployToProductionResponse {
  success: boolean;
  deploymentLogId: string;
  storyKey: string;
  prNumber: number;
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
  description: `Deploy a story to production environment with comprehensive safety checks.

**CRITICAL REQUIREMENTS:**
- Story must be in 'qa' or 'done' status
- PR must be approved AND merged to main
- No merge conflicts
- Deployment lock available (only 1 production deployment at a time)
- Pre-deployment backup created automatically
- 3 consecutive health checks must pass
- Complete audit trail logged

**WORKFLOW:**
1. Validate story, PR approval, and worktree
2. Acquire deployment lock (blocks concurrent deployments)
3. Create pre-deployment backup
4. Build backend container (--no-cache)
5. Build frontend container (--no-cache)
6. Restart backend container
7. Restart frontend container
8. Run health checks (3 consecutive successes)
9. Release deployment lock
10. On failure: Auto-rollback from backup

**EMERGENCY OPTIONS:**
- skipBackup: true - Skip backup creation (USE WITH EXTREME CAUTION)
- skipHealthChecks: true - Skip health checks (USE WITH EXTREME CAUTION)

**ACCEPTANCE CRITERIA IMPLEMENTED:**
- AC1: Deployment lock enforcement (singleton)
- AC2: PR approval workflow (GitHub API)
- AC3: Merge conflict detection
- AC4: Pre-deployment backup (automatic)
- AC5: Docker build and deployment (sequential)
- AC6: Health check validation (3 consecutive)
- AC7: Deployment audit trail (7-year retention)
- AC8: Rollback on failure (automatic)
- AC9: CLAUDE.md permission enforcement
- AC10: Structured error handling

**EXAMPLE USAGE:**
\`\`\`typescript
deploy_to_production({
  storyId: "905d1a9c-1337-4cf7-b7f6-72b55db9e336",
  prNumber: 42,
  triggeredBy: "claude-agent",
  confirmDeploy: true
})
\`\`\``,

  inputSchema: {
    type: 'object',
    properties: {
      storyId: {
        type: 'string',
        description: 'Story UUID to deploy (required)',
      },
      prNumber: {
        type: 'number',
        description: 'GitHub PR number (required)',
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
      confirmDeploy: {
        type: 'boolean',
        description: 'REQUIRED: Must be true to confirm production deployment',
      },
    },
    required: ['storyId', 'prNumber', 'confirmDeploy'],
  },
};

// ============================================================================
// Handler Implementation
// ============================================================================

export async function handler(
  params: DeployToProductionParams
): Promise<DeployToProductionResponse> {
  const startTime = Date.now();

  console.log('='.repeat(80));
  console.log('🚀 PRODUCTION DEPLOYMENT INITIATED');
  console.log('='.repeat(80));
  console.log(`Story ID: ${params.storyId}`);
  console.log(`PR Number: #${params.prNumber}`);
  console.log(`Triggered By: ${params.triggeredBy || 'mcp-user'}`);
  console.log(`Emergency Mode: Backup=${params.skipBackup || false}, HealthChecks=${params.skipHealthChecks || false}`);
  console.log('='.repeat(80));

  try {
    // ========================================================================
    // VALIDATION
    // ========================================================================

    // Validate required parameters
    validateRequired(params, ['storyId', 'prNumber', 'confirmDeploy']);

    // AC9: Enforce confirmation (prevents accidental deployments)
    if (params.confirmDeploy !== true) {
      throw new ValidationError(
        'Production deployment requires explicit confirmation. ' +
        'Set confirmDeploy: true to proceed. ' +
        'This is a safety measure to prevent accidental deployments.'
      );
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(params.storyId)) {
      throw new ValidationError(
        `Invalid storyId format: ${params.storyId}. Expected UUID format.`
      );
    }

    // Validate PR number
    if (params.prNumber < 1) {
      throw new ValidationError(
        `Invalid prNumber: ${params.prNumber}. Expected positive integer.`
      );
    }

    // Warn if using emergency options
    if (params.skipBackup) {
      console.warn('⚠️  WARNING: Pre-deployment backup SKIPPED. Emergency mode active.');
    }

    if (params.skipHealthChecks) {
      console.warn('⚠️  WARNING: Health checks SKIPPED. Emergency mode active.');
    }

    // ========================================================================
    // EXECUTE DEPLOYMENT
    // ========================================================================

    const deploymentService = new DeploymentService();

    const deploymentParams: DeploymentParams = {
      storyId: params.storyId,
      prNumber: params.prNumber,
      triggeredBy: params.triggeredBy || 'mcp-user',
      skipBackup: params.skipBackup || false,
      skipHealthChecks: params.skipHealthChecks || false,
    };

    const result = await deploymentService.deployToProduction(deploymentParams);

    // ========================================================================
    // RETURN RESULT
    // ========================================================================

    console.log('='.repeat(80));
    if (result.success) {
      console.log('✅ PRODUCTION DEPLOYMENT SUCCESSFUL');
    } else {
      console.log('❌ PRODUCTION DEPLOYMENT FAILED');
    }
    console.log('='.repeat(80));
    console.log(`Duration: ${Math.round(result.duration / 1000)}s`);
    console.log(`Deployment Log ID: ${result.deploymentLogId}`);
    if (result.backupFile) {
      console.log(`Backup File: ${result.backupFile}`);
    }
    console.log('='.repeat(80));

    // Log warnings
    if (result.warnings.length > 0) {
      console.log('⚠️  WARNINGS:');
      result.warnings.forEach(warning => console.log(`  - ${warning}`));
      console.log('='.repeat(80));
    }

    // Log errors
    if (result.errors.length > 0) {
      console.log('❌ ERRORS:');
      result.errors.forEach(error => console.log(`  - ${error}`));
      console.log('='.repeat(80));
    }

    return {
      success: result.success,
      deploymentLogId: result.deploymentLogId,
      storyKey: result.storyKey,
      prNumber: result.prNumber,
      duration: result.duration,
      lockId: result.lockId,
      backupFile: result.backupFile,
      healthCheckResults: result.healthCheckResults,
      phases: result.phases,
      warnings: result.warnings,
      errors: result.errors,
      message: result.message,
    };

  } catch (error: any) {
    console.error('❌ PRODUCTION DEPLOYMENT FAILED:', error.message);
    console.log('='.repeat(80));

    // Determine error type
    let errorType = 'DeploymentError';
    if (error instanceof ValidationError) {
      errorType = 'ValidationError';
    } else if (error instanceof NotFoundError) {
      errorType = 'NotFoundError';
    }

    // Return structured error response (AC10)
    return {
      success: false,
      deploymentLogId: '',
      storyKey: '',
      prNumber: params.prNumber,
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
