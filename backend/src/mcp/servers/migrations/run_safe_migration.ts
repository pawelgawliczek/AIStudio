/**
 * MCP Tool: Run Safe Database Migration
 *
 * **ST-70: Database Schema Migration Strategy & Safeguards**
 *
 * Orchestrates safe database migrations with comprehensive safeguards:
 * 1. Create pre-migration backup
 * 2. Verify backup integrity
 * 3. Acquire queue lock (prevents concurrent migrations)
 * 4. Apply migrations via `prisma migrate deploy`
 * 5. Validate schema, data integrity, health
 * 6. Run smoke tests
 * 7. Release queue lock
 * 8. Auto-rollback on failure
 *
 * **CRITICAL SAFETY FEATURES:**
 * - ✅ Pre-migration backup (automatic)
 * - ✅ Backup integrity verification
 * - ✅ Queue lock enforcement (singleton)
 * - ✅ Multi-level validation (schema → data → health → smoke tests)
 * - ✅ Automatic rollback on failure
 * - ✅ Audit trail logging
 * - ✅ CLAUDE.md permission enforcement
 *
 * **REPLACES UNSAFE COMMANDS:**
 * - ❌ `npx prisma db push --accept-data-loss`
 * - ❌ `npx prisma db push`
 * - ❌ `npx prisma migrate deploy`
 * - ❌ `npx prisma migrate resolve`
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import { SafeMigrationService } from '../../../services/safe-migration.service.js';
import { ValidationError, NotFoundError } from '../../types/index.js';
import { validateRequired } from '../../utils.js';

// ============================================================================
// Input/Output Types
// ============================================================================

export interface RunSafeMigrationParams {
  storyId?: string; // Optional story ID for audit trail
  dryRun?: boolean; // Preview migrations without applying
  skipBackup?: boolean; // EMERGENCY ONLY - skip pre-migration backup
  skipValidation?: boolean; // EMERGENCY ONLY - skip post-migration validation
  confirmMigration?: boolean; // REQUIRED: Must be true to confirm migration
  environment?: 'production' | 'development'; // Target environment (defaults to production)
}

export interface RunSafeMigrationResponse {
  success: boolean;
  storyKey?: string;
  pendingMigrations: string[];
  appliedMigrations: string[];
  backupFile?: string;
  lockId?: string;
  duration: number;
  phases: {
    preFlightChecks: PhaseStatus;
    checkPendingMigrations: PhaseStatus;
    createBackup?: PhaseStatus;
    verifyBackup?: PhaseStatus;
    acquireLock: PhaseStatus;
    executeMigration: PhaseStatus;
    postMigrationValidation?: PhaseStatus;
    releaseLock: PhaseStatus;
    rollback?: PhaseStatus;
  };
  validationResults?: {
    schemaValidation: boolean;
    dataIntegrity: boolean;
    healthChecks: boolean;
    smokeTests: boolean;
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

export const runSafeMigrationTool: Tool = {
  name: 'run_safe_migration',
  description: 'Execute database migration with safety checks. ONLY approved method for migrations. Automatic backup, queue lock, validation, and rollback on failure.',
  inputSchema: {
    type: 'object',
    properties: {
      storyId: {
        type: 'string',
        description: 'Story UUID for audit trail (optional)',
      },
      dryRun: {
        type: 'boolean',
        description: 'Preview migrations without applying (default: false)',
      },
      skipBackup: {
        type: 'boolean',
        description: 'EMERGENCY ONLY: Skip pre-migration backup (default: false)',
      },
      skipValidation: {
        type: 'boolean',
        description: 'EMERGENCY ONLY: Skip post-migration validation (default: false)',
      },
      confirmMigration: {
        type: 'boolean',
        description: 'REQUIRED: Must be true to confirm migration',
      },
      environment: {
        type: 'string',
        enum: ['production', 'development'],
        description: 'Target environment (default: production)',
      },
    },
    required: [],
  },
};

// ============================================================================
// Tool Handler
// ============================================================================

export async function handleRunSafeMigration(
  params: RunSafeMigrationParams,
): Promise<RunSafeMigrationResponse> {
  const startTime = Date.now();
  const warnings: string[] = [];
  const errors: string[] = [];

  // Initialize response structure (only phases always executed)
  const response: RunSafeMigrationResponse = {
    success: false,
    pendingMigrations: [],
    appliedMigrations: [],
    duration: 0,
    phases: {
      preFlightChecks: { success: false, duration: 0 },
      checkPendingMigrations: { success: false, duration: 0 },
      // Other phases added conditionally based on execution path
    } as any,
    warnings,
    errors,
    message: '',
  };

  try {
    // ========================================================================
    // Validation: Require confirmation for non-dry-run migrations
    // ========================================================================

    if (!params.dryRun && !params.confirmMigration) {
      throw new ValidationError(
        'confirmMigration must be true to execute migration. ' +
        'Set dryRun: true to preview migrations without applying.',
      );
    }

    // Warn about emergency flags
    if (params.skipBackup) {
      warnings.push('⚠️ WARNING: Skipping pre-migration backup (EMERGENCY MODE)');
    }
    if (params.skipValidation) {
      warnings.push('⚠️ WARNING: Skipping post-migration validation (EMERGENCY MODE)');
    }

    // ========================================================================
    // Initialize Services
    // ========================================================================

    const safeMigrationService = new SafeMigrationService();
    const prisma = new PrismaClient();

    // ========================================================================
    // Phase 1: Pre-Flight Checks
    // ========================================================================

    const phaseStartTime = Date.now();
    try {
      // Verify database connectivity
      await prisma.$queryRaw`SELECT 1`;

      response.phases.preFlightChecks = {
        success: true,
        duration: Date.now() - phaseStartTime,
        message: 'Database connectivity verified',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      response.phases.preFlightChecks = {
        success: false,
        duration: Date.now() - phaseStartTime,
        error: `Database connectivity check failed: ${errorMessage}`,
      };
      throw new ValidationError(`Pre-flight checks failed: ${errorMessage}`);
    }

    // ========================================================================
    // Phase 2: Check Pending Migrations
    // ========================================================================

    const pendingStartTime = Date.now();
    try {
      const pendingMigrations = await safeMigrationService.checkPendingMigrations();
      response.pendingMigrations = pendingMigrations;

      if (pendingMigrations.length === 0) {
        response.phases.checkPendingMigrations = {
          success: true,
          duration: Date.now() - pendingStartTime,
          message: 'No pending migrations',
        };
        response.success = true;
        response.duration = Date.now() - startTime;
        response.message = '✅ Database schema is up to date. No migrations needed.';
        return response;
      }

      response.phases.checkPendingMigrations = {
        success: true,
        duration: Date.now() - pendingStartTime,
        message: `Found ${pendingMigrations.length} pending migration(s)`,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('checkPendingMigrations failed:', errorMessage);
      if (error instanceof Error && error.stack) {
        console.error('Stack:', error.stack);
      }
      response.phases.checkPendingMigrations = {
        success: false,
        duration: Date.now() - pendingStartTime,
        error: errorMessage,
      };
      throw error;
    }

    // ========================================================================
    // DRY-RUN MODE: Return preview without executing
    // ========================================================================

    if (params.dryRun) {
      // Fetch story key if storyId provided (ignore errors for invalid IDs)
      if (params.storyId) {
        try {
          const story = await prisma.story.findUnique({
            where: { id: params.storyId },
            select: { key: true },
          });
          if (story) {
            response.storyKey = story.key;
          }
        } catch (error) {
          // Invalid story ID - ignore and continue
          console.warn('Invalid storyId provided, skipping story key fetch:', params.storyId);
        }
      }

      response.success = true;
      response.duration = Date.now() - startTime;
      response.message = `🔍 DRY-RUN: Found ${response.pendingMigrations.length} pending migration(s). Set confirmMigration: true to apply.`;
      return response;
    }

    // ========================================================================
    // Phase 3: Create Pre-Migration Backup (unless skipped)
    // ========================================================================

    if (!params.skipBackup) {
      const backupStartTime = Date.now();
      try {
        const backupResult = await safeMigrationService.createPreMigrationBackup(params.storyId);
        response.backupFile = backupResult.backupFile;

        response.phases.createBackup = {
          success: true,
          duration: Date.now() - backupStartTime,
          message: `Backup created: ${backupResult.backupFile}`,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        response.phases.createBackup = {
          success: false,
          duration: Date.now() - backupStartTime,
          error: errorMessage,
        };
        throw new Error(`Backup creation failed: ${errorMessage}`);
      }

      // Verify backup integrity
      const verifyStartTime = Date.now();
      try {
        await safeMigrationService.verifyBackup(response.backupFile!);
        response.phases.verifyBackup = {
          success: true,
          duration: Date.now() - verifyStartTime,
          message: 'Backup integrity verified',
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        response.phases.verifyBackup = {
          success: false,
          duration: Date.now() - verifyStartTime,
          error: errorMessage,
        };
        throw new Error(`Backup verification failed: ${errorMessage}`);
      }
    }

    // ========================================================================
    // Phase 4: Acquire Queue Lock
    // ========================================================================

    const lockStartTime = Date.now();
    try {
      const lock = await safeMigrationService.acquireQueueLock(
        params.storyId || 'manual-migration',
      );
      response.lockId = lock.id;

      response.phases.acquireLock = {
        success: true,
        duration: Date.now() - lockStartTime,
        message: `Queue lock acquired: ${lock.id}`,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      response.phases.acquireLock = {
        success: false,
        duration: Date.now() - lockStartTime,
        error: errorMessage,
      };
      throw new Error(`Failed to acquire queue lock: ${errorMessage}`);
    }

    // ========================================================================
    // Phase 5: Execute Migration
    // ========================================================================

    const migrationStartTime = Date.now();
    try {
      const migrationResult = await safeMigrationService.executePrismaDeployOnly(
        params.environment || 'production',
      );
      response.appliedMigrations = migrationResult.appliedMigrations;

      response.phases.executeMigration = {
        success: true,
        duration: Date.now() - migrationStartTime,
        message: `Applied ${migrationResult.appliedMigrations.length} migration(s)`,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      response.phases.executeMigration = {
        success: false,
        duration: Date.now() - migrationStartTime,
        error: errorMessage,
      };

      // Rollback on failure
      if (response.backupFile) {
        const rollbackStartTime = Date.now();
        try {
          await safeMigrationService.rollbackToBackup(response.backupFile);
          response.phases.rollback = {
            success: true,
            duration: Date.now() - rollbackStartTime,
            message: 'Database restored from backup',
          };
        } catch (rollbackError) {
          const rollbackErrorMsg = rollbackError instanceof Error ? rollbackError.message : 'Unknown error';
          response.phases.rollback = {
            success: false,
            duration: Date.now() - rollbackStartTime,
            error: rollbackErrorMsg,
          };
          errors.push(`⚠️ CRITICAL: Rollback failed: ${rollbackErrorMsg}`);
        }
      }

      throw new Error(`Migration execution failed: ${errorMessage}`);
    }

    // ========================================================================
    // Phase 6: Post-Migration Validation (unless skipped)
    // ========================================================================

    if (!params.skipValidation) {
      const validationStartTime = Date.now();
      try {
        const validationResults = await safeMigrationService.validatePostMigration();
        response.validationResults = validationResults;

        const allPassed = Object.values(validationResults).every((result) => result === true);

        response.phases.postMigrationValidation = {
          success: allPassed,
          duration: Date.now() - validationStartTime,
          message: allPassed ? 'All validation checks passed' : 'Some validation checks failed',
        };

        if (!allPassed) {
          // Rollback on validation failure
          if (response.backupFile) {
            const rollbackStartTime = Date.now();
            try {
              await safeMigrationService.rollbackToBackup(response.backupFile);
              response.phases.rollback = {
                success: true,
                duration: Date.now() - rollbackStartTime,
                message: 'Database restored from backup due to validation failure',
              };
            } catch (rollbackError) {
              const rollbackErrorMsg = rollbackError instanceof Error ? rollbackError.message : 'Unknown error';
              response.phases.rollback = {
                success: false,
                duration: Date.now() - rollbackStartTime,
                error: rollbackErrorMsg,
              };
            }
          }

          throw new Error('Post-migration validation failed');
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        response.phases.postMigrationValidation = {
          success: false,
          duration: Date.now() - validationStartTime,
          error: errorMessage,
        };
        throw error;
      }
    }

    // ========================================================================
    // Phase 7: Release Queue Lock
    // ========================================================================

    const releaseStartTime = Date.now();
    try {
      if (response.lockId) {
        await safeMigrationService.releaseQueueLock(response.lockId);
      }

      response.phases.releaseLock = {
        success: true,
        duration: Date.now() - releaseStartTime,
        message: 'Queue lock released',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      response.phases.releaseLock = {
        success: false,
        duration: Date.now() - releaseStartTime,
        error: errorMessage,
      };
      warnings.push(`⚠️ Failed to release queue lock: ${errorMessage}`);
    }

    // ========================================================================
    // Success Response
    // ========================================================================

    response.success = true;
    response.duration = Date.now() - startTime;
    response.message = `✅ Migration completed successfully. Applied ${response.appliedMigrations.length} migration(s) in ${(response.duration / 1000).toFixed(2)}s`;

    if (params.storyId) {
      const story = await prisma.story.findUnique({
        where: { id: params.storyId },
        select: { key: true },
      });
      if (story) {
        response.storyKey = story.key;
      }
    }

    return response;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Migration handler error:', errorMessage);
    errors.push(errorMessage);

    // Release lock if acquired
    if (response.lockId) {
      try {
        const safeMigrationService = new SafeMigrationService();
        await safeMigrationService.releaseQueueLock(response.lockId);
        response.phases.releaseLock = {
          success: true,
          duration: 0,
          message: 'Queue lock released after error',
        };
      } catch (releaseError) {
        warnings.push('Failed to release queue lock after error');
      }
    }

    response.success = false;
    response.duration = Date.now() - startTime;
    response.message = `❌ Migration failed: ${errorMessage}`;

    return response;
  }
}

// ============================================================================
// Export Aliases for Test Compatibility
// ============================================================================
export const tool = runSafeMigrationTool;
export const handler = handleRunSafeMigration;
