/**
 * Backup Service - Database backup creation and verification
 */

import * as path from 'path';
import { migrationConfig } from '../config/migration.config';
import {
  Backup,
  BackupType,
  BackupMetadata,
  VerificationResult,
  BackupFilter,
} from '../types/migration.types';
import { dockerExec, isContainerRunning } from '../utils/docker-exec.util';
import {
  ensureDirectory,
  getFileSize,
  fileExists,
  getFilesInDirectory,
  generateTimestampedFilename,
  formatBytes,
  getFileAgeDays,
} from '../utils/file-system.util';

export class BackupService {
  private containerName: string;
  private database: string;
  private username: string;
  private backupLocation: string;

  constructor() {
    this.containerName = migrationConfig.docker.containerName;
    this.database = migrationConfig.docker.database;
    this.username = migrationConfig.docker.username;
    this.backupLocation = migrationConfig.backup.primaryLocation;
  }

  /**
   * Create a database backup
   */
  async createBackup(type: BackupType, context?: string): Promise<Backup> {
    console.log(`[BackupService] Creating ${type} backup...`);

    // Ensure backup directory exists
    await ensureDirectory(this.backupLocation);

    // Verify Docker container is running
    const isRunning = await isContainerRunning(this.containerName);
    if (!isRunning) {
      throw new Error(
        `Docker container ${this.containerName} is not running`
      );
    }

    // Generate backup filename
    const filename = generateTimestampedFilename(
      `vibestudio_${type}`,
      'dump',
      context
    );
    const filepath = path.join(this.backupLocation, filename);

    // Execute pg_dump
    const startTime = Date.now();
    const result = await dockerExec({
      containerName: this.containerName,
      command: `pg_dump -U ${this.username} -d ${this.database} -Fc -f /backups/${filename}`,
      timeout: migrationConfig.docker.execTimeout,
    });

    if (!result.success) {
      throw new Error(`Backup creation failed: ${result.stderr}`);
    }

    const duration = Date.now() - startTime;

    // Verify backup file was created
    const exists = await fileExists(filepath);
    if (!exists) {
      throw new Error(`Backup file not created: ${filepath}`);
    }

    // Get file size
    const size = await getFileSize(filepath);

    // Get metadata
    const metadata = await this.getBackupMetadata(filepath);

    const backup: Backup = {
      filename,
      filepath,
      type,
      size,
      created: new Date(),
      verified: false,
      context,
      metadata: {
        ...metadata,
        duration,
      },
    };

    console.log(
      `[BackupService] Backup created: ${filename} (${formatBytes(size)}) in ${(duration / 1000).toFixed(1)}s`
    );

    return backup;
  }

  /**
   * Verify backup integrity
   */
  async verifyBackup(backup: Backup): Promise<VerificationResult> {
    console.log(`[BackupService] Verifying backup: ${backup.filename}...`);

    const errors: string[] = [];

    // Check 1: File exists
    const exists = await fileExists(backup.filepath);
    if (!exists) {
      errors.push(`Backup file does not exist: ${backup.filepath}`);
      return {
        success: false,
        fileExists: false,
        fileSizeValid: false,
        errors,
      };
    }

    // Check 2: File size valid
    const size = await getFileSize(backup.filepath);
    const minSize = migrationConfig.backup.verification.minSizeBytes;
    const fileSizeValid = size > minSize;

    if (!fileSizeValid) {
      errors.push(
        `Backup file too small: ${formatBytes(size)} (min: ${formatBytes(minSize)})`
      );
    }

    // Check 3: Sample restore test (optional - can be slow)
    let sampleRestoreSuccess = true;
    if (migrationConfig.backup.verification.enabled) {
      try {
        // Test that pg_restore can list the backup contents
        const result = await dockerExec({
          containerName: this.containerName,
          command: `pg_restore -l /backups/${backup.filename}`,
          timeout: 30000, // 30 seconds
        });

        sampleRestoreSuccess = result.success;
        if (!sampleRestoreSuccess) {
          errors.push(`Backup restore test failed: ${result.stderr}`);
        }
      } catch (error: any) {
        sampleRestoreSuccess = false;
        errors.push(`Backup restore test error: ${error.message}`);
      }
    }

    const success =
      exists && fileSizeValid && (!migrationConfig.backup.verification.enabled || sampleRestoreSuccess);

    if (success) {
      console.log(`[BackupService] Backup verified successfully: ${backup.filename}`);
    } else {
      console.error(`[BackupService] Backup verification failed: ${errors.join(', ')}`);
    }

    return {
      success,
      fileExists: exists,
      fileSizeValid,
      sampleRestoreSuccess,
      errors,
    };
  }

  /**
   * Get backup metadata
   */
  async getBackupMetadata(filepath: string): Promise<BackupMetadata> {
    const filename = path.basename(filepath);

    try {
      // Get table count from backup
      const result = await dockerExec({
        containerName: this.containerName,
        command: `pg_restore -l /backups/${filename} | grep -c "TABLE DATA"`,
        timeout: 30000,
      });

      const tableCount = result.success
        ? parseInt(result.stdout.trim(), 10) || 0
        : 0;

      return {
        databaseName: this.database,
        tableCount,
      };
    } catch {
      return {
        databaseName: this.database,
        tableCount: 0,
      };
    }
  }

  /**
   * List all backups
   */
  async listBackups(filter?: BackupFilter): Promise<Backup[]> {
    const files = await getFilesInDirectory(
      this.backupLocation,
      /\.dump$/
    );

    const backups: Backup[] = [];

    for (const filepath of files) {
      const filename = path.basename(filepath);
      const size = await getFileSize(filepath);

      // Parse backup type from filename
      let type: BackupType = BackupType.MANUAL;
      if (filename.includes('_premig_')) type = BackupType.PRE_MIGRATION;
      else if (filename.includes('_daily_')) type = BackupType.DAILY;
      else if (filename.includes('_emergency_')) type = BackupType.EMERGENCY;

      // Parse context from filename
      const contextMatch = filename.match(/_([A-Z]+-\d+)\.dump$/);
      const context = contextMatch ? contextMatch[1] : undefined;

      // Get file age
      const ageDays = await getFileAgeDays(filepath);

      // Apply filters
      if (filter) {
        if (filter.type && type !== filter.type) continue;
        if (filter.minSize && size < filter.minSize) continue;
        if (filter.maxAge && ageDays > filter.maxAge) continue;
      }

      backups.push({
        filename,
        filepath,
        type,
        size,
        created: new Date(), // Would need to parse from filename or file stats
        verified: false,
        context,
      });
    }

    // Sort by creation date (newest first)
    return backups.sort((a, b) => b.created.getTime() - a.created.getTime());
  }

  /**
   * Get backup by filename
   */
  async getBackup(filename: string): Promise<Backup | null> {
    const filepath = path.join(this.backupLocation, filename);
    const exists = await fileExists(filepath);

    if (!exists) {
      return null;
    }

    const size = await getFileSize(filepath);

    // Parse backup type
    let type: BackupType = BackupType.MANUAL;
    if (filename.includes('_premig_')) type = BackupType.PRE_MIGRATION;
    else if (filename.includes('_daily_')) type = BackupType.DAILY;
    else if (filename.includes('_emergency_')) type = BackupType.EMERGENCY;

    // Parse context
    const contextMatch = filename.match(/_([A-Z]+-\d+)\.dump$/);
    const context = contextMatch ? contextMatch[1] : undefined;

    return {
      filename,
      filepath,
      type,
      size,
      created: new Date(),
      verified: false,
      context,
    };
  }

  /**
   * Delete old backups based on retention policy
   */
  async cleanupOldBackups(): Promise<{ deleted: number; errors: string[] }> {
    console.log('[BackupService] Cleaning up old backups...');

    const backups = await this.listBackups();
    const errors: string[] = [];
    let deleted = 0;

    for (const backup of backups) {
      const ageDays = await getFileAgeDays(backup.filepath);
      let shouldDelete = false;

      // Check retention policy based on type
      switch (backup.type) {
        case BackupType.PRE_MIGRATION:
          shouldDelete = ageDays > migrationConfig.backup.retention.preMigration;
          break;
        case BackupType.DAILY:
          shouldDelete = ageDays > migrationConfig.backup.retention.daily;
          break;
        case BackupType.MANUAL:
          shouldDelete = ageDays > migrationConfig.backup.retention.manual;
          break;
        case BackupType.EMERGENCY:
          // Never auto-delete emergency backups
          shouldDelete = false;
          break;
      }

      if (shouldDelete) {
        try {
          const { promises: fs } = await import('fs');
          await fs.unlink(backup.filepath);
          deleted++;
          console.log(`[BackupService] Deleted old backup: ${backup.filename}`);
        } catch (error: any) {
          errors.push(`Failed to delete ${backup.filename}: ${error.message}`);
        }
      }
    }

    console.log(`[BackupService] Cleanup complete: ${deleted} backups deleted`);

    return { deleted, errors };
  }
}
