/**
 * Restore Service - Database restoration from backups
 */

import {
  Backup,
  RestoreResult,
  RestoreOptions,
  ValidationResult,
  ValidationLevel,
} from '../types/migration.types';
import { migrationConfig } from '../../config/migration.config';
import {
  dockerExec,
  isContainerRunning,
  terminateConnections,
} from '../utils/docker-exec.util';
import { fileExists, formatBytes } from '../utils/file-system.util';
import { BackupService } from './backup.service';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class RestoreService {
  private containerName: string;
  private database: string;
  private username: string;
  private backupService: BackupService;

  constructor() {
    this.containerName = migrationConfig.docker.containerName;
    this.database = migrationConfig.docker.database;
    this.username = migrationConfig.docker.username;
    this.backupService = new BackupService();
  }

  /**
   * Restore database from backup
   */
  async restoreFromBackup(
    backupFile: string,
    options: RestoreOptions = {}
  ): Promise<RestoreResult> {
    const startTime = Date.now();
    const errors: string[] = [];

    console.log(`[RestoreService] Starting restore from: ${backupFile}`);

    try {
      // Step 1: Pre-restore validation
      if (!options.skipValidation) {
        const validation = await this.validateRestore(backupFile);
        if (!validation.passed) {
          return {
            success: false,
            backupFile,
            duration: Date.now() - startTime,
            errors: validation.errors,
            validationPassed: false,
          };
        }
      }

      // Step 2: Terminate active connections
      console.log('[RestoreService] Terminating active connections...');
      const terminateResult = await terminateConnections(
        this.containerName,
        this.database
      );

      if (!terminateResult.success) {
        errors.push(`Warning: Could not terminate all connections: ${terminateResult.stderr}`);
      }

      // Wait a moment for connections to close
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Step 3: Drop and recreate database
      if (options.force !== false) {
        console.log('[RestoreService] Dropping and recreating database...');

        // Drop database
        const dropResult = await dockerExec({
          containerName: this.containerName,
          command: `psql -U ${this.username} -c "DROP DATABASE IF EXISTS ${this.database};"`,
          timeout: 60000,
        });

        if (!dropResult.success) {
          throw new Error(`Failed to drop database: ${dropResult.stderr}`);
        }

        // Create database
        const createResult = await dockerExec({
          containerName: this.containerName,
          command: `psql -U ${this.username} -c "CREATE DATABASE ${this.database};"`,
          timeout: 60000,
        });

        if (!createResult.success) {
          throw new Error(`Failed to create database: ${createResult.stderr}`);
        }
      }

      // Step 4: Restore from backup
      console.log('[RestoreService] Restoring from backup...');

      const backup = await this.backupService.getBackup(backupFile);
      if (backup) {
        console.log(`[RestoreService] Backup size: ${formatBytes(backup.size)}`);
      }

      const restoreResult = await dockerExec({
        containerName: this.containerName,
        command: `pg_restore -U ${this.username} -d ${this.database} -Fc --clean --if-exists /backups/${backupFile}`,
        timeout: migrationConfig.docker.execTimeout,
      });

      if (!restoreResult.success) {
        // pg_restore might return non-zero even on success due to warnings
        // Check if stderr contains actual errors
        const hasErrors = restoreResult.stderr.includes('ERROR:');
        if (hasErrors) {
          throw new Error(`Restore failed: ${restoreResult.stderr}`);
        } else {
          // Just warnings, log them but continue
          errors.push(`Restore warnings: ${restoreResult.stderr}`);
        }
      }

      // Step 5: Regenerate Prisma Client
      console.log('[RestoreService] Regenerating Prisma Client...');
      try {
        await execAsync('cd /opt/stack/AIStudio/backend && npx prisma generate', {
          timeout: 60000,
        });
      } catch (error: any) {
        errors.push(`Warning: Prisma Client regeneration failed: ${error.message}`);
      }

      // Step 6: Post-restore validation
      console.log('[RestoreService] Running post-restore validation...');
      const postValidation = await this.validatePostRestore();

      const duration = Date.now() - startTime;

      console.log(
        `[RestoreService] Restore completed in ${(duration / 1000).toFixed(1)}s`
      );

      return {
        success: postValidation.passed,
        backupFile,
        duration,
        errors: [...errors, ...postValidation.errors],
        validationPassed: postValidation.passed,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      errors.push(error.message);

      console.error(`[RestoreService] Restore failed: ${error.message}`);

      return {
        success: false,
        backupFile,
        duration,
        errors,
        validationPassed: false,
      };
    }
  }

  /**
   * Validate pre-restore conditions
   */
  async validateRestore(backupFile: string): Promise<ValidationResult> {
    console.log('[RestoreService] Validating pre-restore conditions...');

    const checks: Array<{ name: string; passed: boolean; message?: string }> = [];
    const errors: string[] = [];

    // Check 1: Backup file exists
    const backup = await this.backupService.getBackup(backupFile);
    const backupExists = backup !== null;
    checks.push({
      name: 'Backup file exists',
      passed: backupExists,
      message: backupExists ? `Found: ${backupFile}` : `Not found: ${backupFile}`,
    });

    if (!backupExists) {
      errors.push(`Backup file not found: ${backupFile}`);
    }

    // Check 2: Backup integrity
    if (backup) {
      const verification = await this.backupService.verifyBackup(backup);
      checks.push({
        name: 'Backup integrity',
        passed: verification.success,
        message: verification.success
          ? 'Backup verified'
          : `Verification failed: ${verification.errors.join(', ')}`,
      });

      if (!verification.success) {
        errors.push(...verification.errors);
      }
    }

    // Check 3: Docker container running
    const containerRunning = await isContainerRunning(this.containerName);
    checks.push({
      name: 'Docker container running',
      passed: containerRunning,
      message: containerRunning
        ? `${this.containerName} is running`
        : `${this.containerName} is not running`,
    });

    if (!containerRunning) {
      errors.push(`Docker container ${this.containerName} is not running`);
    }

    // Check 4: Database accessible
    if (containerRunning) {
      const dbResult = await dockerExec({
        containerName: this.containerName,
        command: `psql -U ${this.username} -c "SELECT 1;"`,
        timeout: 10000,
      });

      checks.push({
        name: 'Database accessible',
        passed: dbResult.success,
        message: dbResult.success
          ? 'Database connection successful'
          : `Connection failed: ${dbResult.stderr}`,
      });

      if (!dbResult.success) {
        errors.push(`Database not accessible: ${dbResult.stderr}`);
      }
    }

    const passed = checks.every((c) => c.passed);

    return {
      level: ValidationLevel.SCHEMA,
      passed,
      checks,
      errors,
      duration: 0,
    };
  }

  /**
   * Validate post-restore state
   */
  async validatePostRestore(): Promise<ValidationResult> {
    console.log('[RestoreService] Validating post-restore state...');

    const checks: Array<{ name: string; passed: boolean; message?: string }> = [];
    const errors: string[] = [];

    // Check 1: Database accessible
    const dbResult = await dockerExec({
      containerName: this.containerName,
      command: `psql -U ${this.username} -d ${this.database} -c "SELECT 1;"`,
      timeout: 10000,
    });

    checks.push({
      name: 'Database accessible',
      passed: dbResult.success,
      message: dbResult.success
        ? 'Database connection successful'
        : `Connection failed: ${dbResult.stderr}`,
    });

    if (!dbResult.success) {
      errors.push(`Database not accessible: ${dbResult.stderr}`);
    }

    // Check 2: Schema exists (check for critical tables)
    if (dbResult.success) {
      const schemaResult = await dockerExec({
        containerName: this.containerName,
        command: `psql -U ${this.username} -d ${this.database} -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';"`,
        timeout: 10000,
      });

      const tableCount = schemaResult.success
        ? parseInt(schemaResult.stdout.trim(), 10)
        : 0;
      const hasSchema = tableCount > 0;

      checks.push({
        name: 'Schema restored',
        passed: hasSchema,
        message: hasSchema
          ? `${tableCount} tables found`
          : 'No tables found in database',
      });

      if (!hasSchema) {
        errors.push('Database schema not restored correctly');
      }
    }

    // Check 3: Critical tables exist
    const criticalTables = ['projects', 'stories', 'epics'];
    for (const table of criticalTables) {
      const tableResult = await dockerExec({
        containerName: this.containerName,
        command: `psql -U ${this.username} -d ${this.database} -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '${table}');"`,
        timeout: 10000,
      });

      const exists =
        tableResult.success && tableResult.stdout.trim() === 't';

      checks.push({
        name: `Table '${table}' exists`,
        passed: exists,
        message: exists ? `Table ${table} found` : `Table ${table} missing`,
      });

      if (!exists) {
        errors.push(`Critical table '${table}' not found`);
      }
    }

    const passed = checks.every((c) => c.passed);

    return {
      level: ValidationLevel.SCHEMA,
      passed,
      checks,
      errors,
      duration: 0,
    };
  }

  /**
   * List available backups
   */
  async listBackups(): Promise<Backup[]> {
    return this.backupService.listBackups();
  }
}
