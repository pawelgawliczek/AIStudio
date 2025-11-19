/**
 * Safe Migration Orchestrator - Main coordinator for migration workflow
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import {
  MigrationOptions,
  MigrationResult,
  BackupType,
  Backup,
  Lock,
} from '../types/migration.types';
import { BackupService } from './backup.service';
import { RestoreService } from './restore.service';
import { QueueLockService } from './queue-lock.service';
import { ValidationService } from './validation.service';
import { migrationConfig } from '../../config/migration.config';

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

      // Parse output to find pending migrations
      const lines = stdout.split('\n');
      const pending: string[] = [];

      for (const line of lines) {
        if (line.includes('migration') && !line.includes('applied')) {
          // Extract migration name
          const match = line.match(/(\d{14}_[\w_]+)/);
          if (match) {
            pending.push(match[1]);
          }
        }
      }

      return pending;
    } catch (error: any) {
      // If error contains "Database schema is up to date", no pending migrations
      if (error.message.includes('up to date')) {
        return [];
      }
      throw error;
    }
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
}
