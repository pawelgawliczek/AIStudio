/**
 * Safe Migration Orchestrator - Main coordinator for migration workflow
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { migrationConfig } from '../config/migration.config';
import {
  MigrationOptions,
  MigrationResult,
  BackupType,
  Backup,
  Lock,
} from '../types/migration.types';
import { BackupService } from './backup.service';
import { QueueLockService } from './queue-lock.service';
import { RestoreService } from './restore.service';
import { ValidationService } from './validation.service';

const execAsync = promisify(exec);

export class SafeMigrationService {
  private backupService: BackupService;
  private restoreService: RestoreService;
  private queueLockService: QueueLockService;
  private validationService: ValidationService;

  constructor() {
    this.backupService = new BackupService();
    this.restoreService = new RestoreService();
    this.queueLockService = new QueueLockService();
    this.validationService = new ValidationService();
  }

  /**
   * Execute safe migration workflow
   */
  async executeMigration(options: MigrationOptions = {}): Promise<MigrationResult> {
    const startTime = Date.now();
    let backup: Backup | null = null;
    let lock: Lock | null = null;
    const errors: string[] = [];

    console.log('\n=== Safe Migration Starting ===');
    console.log(`Environment: ${options.environment || 'development'}`);
    console.log(`Story: ${options.storyId || 'N/A'}`);
    console.log(`Dry Run: ${options.dryRun ? 'YES' : 'NO'}`);
    console.log('================================\n');

    try {
      // Phase 1: Pre-Flight Checks
      console.log('[Phase 1] Pre-Flight Checks...');
      await this.preFlightChecks();

      // Phase 2: Check Pending Migrations
      console.log('[Phase 2] Checking Pending Migrations...');
      const pendingMigrations = await this.getPendingMigrations();

      if (pendingMigrations.length === 0) {
        console.log('No pending migrations found.');
        return {
          success: true,
          duration: Date.now() - startTime,
          migrationsApplied: 0,
          errors: ['No pending migrations'],
        };
      }

      console.log(`Found ${pendingMigrations.length} pending migration(s)`);

      if (options.dryRun) {
        console.log('\n=== DRY RUN MODE ===');
        console.log('The following migrations would be applied:');
        pendingMigrations.forEach((m, i) => {
          console.log(`  ${i + 1}. ${m}`);
        });
        console.log('===================\n');

        return {
          success: true,
          duration: Date.now() - startTime,
          migrationsApplied: 0,
          errors: [],
        };
      }

      // Phase 3: Create Backup
      console.log('[Phase 3] Creating Pre-Migration Backup...');
      backup = await this.backupService.createBackup(
        BackupType.PRE_MIGRATION,
        options.storyId
      );

      // Phase 4: Verify Backup
      console.log('[Phase 4] Verifying Backup...');
      const verification = await this.backupService.verifyBackup(backup);

      if (!verification.success) {
        throw new Error(
          `Backup verification failed: ${verification.errors.join(', ')}`
        );
      }

      // Phase 5: Acquire Queue Lock
      console.log('[Phase 5] Acquiring Queue Lock...');
      const lockDuration = this.queueLockService.estimateLockDuration(
        pendingMigrations.length,
        false
      );
      lock = await this.queueLockService.acquireLock(
        `Migration: ${options.storyId || 'manual'} (${pendingMigrations.length} pending)`,
        lockDuration
      );

      // Phase 6: Execute Migrations
      console.log('[Phase 6] Executing Migrations...');
      await this.executePrismaMigrate();

      // Phase 7: Post-Migration Validation
      if (!options.skipValidation) {
        console.log('[Phase 7] Post-Migration Validation...');

        const validationResults = await this.validationService.validateAll();

        // Check if validation passed
        const validationPassed =
          validationResults.schema.passed &&
          (validationResults.dataIntegrity?.passed ?? true) &&
          (validationResults.health?.passed ?? true) &&
          (validationResults.smokeTests?.passed ?? true);

        if (!validationPassed) {
          console.error('Validation failed! Triggering rollback...');

          // Collect validation errors
          const validationErrors = [
            ...validationResults.schema.errors,
            ...(validationResults.dataIntegrity?.errors || []),
            ...(validationResults.health?.errors || []),
            ...(validationResults.smokeTests?.errors || []),
          ];

          errors.push(...validationErrors);

          // Trigger rollback
          await this.rollback(backup);

          return {
            success: false,
            duration: Date.now() - startTime,
            backupFile: backup.filename,
            migrationsApplied: pendingMigrations.length,
            validationResults,
            errors,
          };
        }

        console.log('All validations passed!');
      }

      // Phase 8: Release Lock
      console.log('[Phase 8] Releasing Queue Lock...');
      if (lock) {
        await this.queueLockService.releaseLock(lock.id);
      }

      const duration = Date.now() - startTime;

      console.log('\n=== Migration Completed Successfully ===');
      console.log(`Duration: ${(duration / 1000).toFixed(1)}s`);
      console.log(`Migrations Applied: ${pendingMigrations.length}`);
      console.log(`Backup: ${backup.filename}`);
      console.log('=======================================\n');

      return {
        success: true,
        duration,
        backupFile: backup.filename,
        migrationsApplied: pendingMigrations.length,
        errors: [],
      };
    } catch (error: any) {
      console.error(`\n=== Migration Failed ===`);
      console.error(`Error: ${error.message}`);
      console.error('========================\n');

      errors.push(error.message);

      // Attempt rollback if we have a backup
      if (backup) {
        console.log('Attempting automatic rollback...');
        try {
          await this.rollback(backup);
          errors.push('Rollback completed successfully');
        } catch (rollbackError: any) {
          errors.push(`Rollback failed: ${rollbackError.message}`);
        }
      }

      // Always release lock on error
      if (lock) {
        try {
          await this.queueLockService.releaseLock(lock.id);
        } catch (lockError: any) {
          errors.push(`Failed to release lock: ${lockError.message}`);
        }
      }

      return {
        success: false,
        duration: Date.now() - startTime,
        backupFile: backup?.filename,
        migrationsApplied: 0,
        errors,
      };
    }
  }

  /**
   * Pre-flight checks before migration
   */
  private async preFlightChecks(): Promise<void> {
    // Check 1: Database accessible
    try {
      await execAsync('cd /opt/stack/AIStudio/backend && npx prisma db execute --stdin < /dev/null', {
        timeout: 10000,
      });
    } catch (error: any) {
      throw new Error(`Database not accessible: ${error.message}`);
    }

    // Check 2: Backup directory writable
    const { ensureDirectory } = await import('../utils/file-system.util');
    try {
      await ensureDirectory(migrationConfig.backup.primaryLocation);
    } catch (error: any) {
      throw new Error(
        `Backup directory not writable: ${migrationConfig.backup.primaryLocation}`
      );
    }

    // Check 3: No existing lock
    const lockStatus = await this.queueLockService.checkLockStatus();
    if (lockStatus.locked) {
      throw new Error(
        `Queue is locked: ${lockStatus.reason} (expires at ${lockStatus.expiresAt})`
      );
    }

    console.log('Pre-flight checks passed.');
  }

  /**
   * Get pending migrations
   */
  private async getPendingMigrations(): Promise<string[]> {
    try {
      const { stdout } = await execAsync(
        'cd /opt/stack/AIStudio/backend && npx prisma migrate status',
        { timeout: 30000 }
      );

      // Parse successful output
      return this.parseMigrationStatus(stdout);
    } catch (error: any) {
      // prisma migrate status returns exit code 1 when there are pending migrations
      // This is expected behavior, so we parse the output even on "failure"
      const output = error.stdout || error.stderr || '';

      // Check for various "no migrations" scenarios
      if (output.includes('Database schema is up to date') ||
          output.includes('No pending migrations')) {
        return [];
      }

      // If we have pending migrations, parse them from the error output
      if (output.includes('Following migrations have not yet been applied')) {
        return this.parseMigrationStatus(output);
      }

      // True error case
      console.error('getPendingMigrations error:', error.message);
      throw error;
    }
  }

  /**
   * Parse migration status output to extract pending migrations
   */
  private parseMigrationStatus(output: string): string[] {
    const lines = output.split('\n');
    const pending: string[] = [];
    let inPendingSection = false;

    for (const line of lines) {
      // Check if we're in the pending migrations section
      if (line.includes('Following migrations have not yet been applied')) {
        inPendingSection = true;
        continue;
      }

      // Stop if we hit the next section
      if (inPendingSection && (line.startsWith('To apply') || line.trim() === '')) {
        if (line.startsWith('To apply')) {
          break;
        }
        continue;
      }

      // Extract migration names from the pending section
      if (inPendingSection) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('prisma migrate')) {
          pending.push(trimmed);
        }
      }
    }

    return pending;
  }

  /**
   * Execute Prisma migrate deploy
   */
  private async executePrismaMigrate(): Promise<void> {
    try {
      const { stdout, stderr } = await execAsync(
        'cd /opt/stack/AIStudio/backend && npx prisma migrate deploy',
        { timeout: migrationConfig.migration.maxDuration }
      );

      console.log(stdout);
      if (stderr) {
        console.error('Migration warnings:', stderr);
      }
    } catch (error: any) {
      throw new Error(`Migration execution failed: ${error.message}`);
    }
  }

  /**
   * Rollback to backup
   */
  private async rollback(backup: Backup): Promise<void> {
    console.log(`Rolling back to backup: ${backup.filename}`);

    try {
      // Acquire lock for rollback
      const lock = await this.queueLockService.acquireLock(
        `Rollback: ${backup.filename}`,
        30
      );

      // Restore from backup
      const result = await this.restoreService.restoreFromBackup(
        backup.filename,
        { force: true }
      );

      if (!result.success) {
        throw new Error(`Restore failed: ${result.errors.join(', ')}`);
      }

      // Release lock
      await this.queueLockService.releaseLock(lock.id);

      console.log('Rollback completed successfully');
    } catch (error: any) {
      console.error(`Rollback error: ${error.message}`);
      throw error;
    }
  }

  // ===========================================================================
  // Public API for MCP Tools (ST-85)
  // ===========================================================================

  /**
   * Check for pending migrations (read-only)
   * Used by preview_migration MCP tool
   */
  async checkPendingMigrations(): Promise<string[]> {
    return this.getPendingMigrations();
  }

  /**
   * Create pre-migration backup
   * Used by run_safe_migration MCP tool
   */
  async createPreMigrationBackup(storyId?: string): Promise<{ backupFile: string }> {
    const backup = await this.backupService.createBackup(
      BackupType.PRE_MIGRATION,
      storyId
    );
    return { backupFile: backup.filename };
  }

  /**
   * Verify backup integrity
   * Used by run_safe_migration MCP tool
   */
  async verifyBackup(backupFile: string): Promise<boolean> {
    const verification = await this.backupService.verifyBackup({ filename: backupFile } as Backup);
    return verification.success;
  }

  /**
   * Acquire queue lock
   * Used by run_safe_migration MCP tool
   */
  async acquireQueueLock(reason: string): Promise<{ id: string }> {
    const lockDuration = 60; // 60 minutes default
    const lock = await this.queueLockService.acquireLock(reason, lockDuration);
    return { id: lock.id };
  }

  /**
   * Execute migration (without pre-flight checks, backup, or validation)
   * Used by run_safe_migration MCP tool after it handles those steps
   */
  async executePrismaDeployOnly(environment?: string): Promise<{ appliedMigrations: string[] }> {
    const pendingBefore = await this.getPendingMigrations();
    await this.executePrismaMigrate();
    return { appliedMigrations: pendingBefore };
  }

  /**
   * Validate post-migration state
   * Used by run_safe_migration MCP tool
   */
  async validatePostMigration(): Promise<{
    schemaValidation: boolean;
    dataIntegrity: boolean;
    healthChecks: boolean;
    smokeTests: boolean;
  }> {
    const results = await this.validationService.validateAll();
    return {
      schemaValidation: results.schema.passed,
      dataIntegrity: results.dataIntegrity?.passed ?? true,
      healthChecks: results.health?.passed ?? true,
      smokeTests: results.smokeTests?.passed ?? true,
    };
  }

  /**
   * Release queue lock
   * Used by run_safe_migration MCP tool
   */
  async releaseQueueLock(lockId: string): Promise<void> {
    await this.queueLockService.releaseLock(lockId);
  }

  /**
   * Rollback to backup (public wrapper)
   * Used by run_safe_migration MCP tool
   */
  async rollbackToBackup(backupFilename: string): Promise<void> {
    const backup: Backup = {
      filename: backupFilename,
      filepath: `/opt/stack/AIStudio/backups/${backupFilename}`,
      type: BackupType.PRE_MIGRATION,
      size: 0,
      created: new Date(),
      verified: false,
    };
    await this.rollback(backup);
  }
}
