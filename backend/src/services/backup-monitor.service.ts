/**
 * Backup Monitor Service - ST-78
 *
 * Monitors backup health and alerts on missing or stale backups.
 *
 * Features:
 * - Check backup health every 6 hours (manual or cron-triggered)
 * - Alert if production backup hasn't run in 25 hours
 * - Alert if development backup hasn't run in 3 hours
 * - Provide health check endpoint data
 *
 * Note: To enable scheduled checks, add this service to a NestJS module
 * with ScheduleModule imported and uncomment the @Cron decorator.
 */

import { Injectable, Logger } from '@nestjs/common';
// import { Cron, CronExpression } from '@nestjs/schedule';
import * as path from 'path';
import * as fs from 'fs/promises';

export interface BackupHealth {
  environment: 'production' | 'development';
  healthy: boolean;
  lastBackupTime: Date | null;
  lastBackupFile: string | null;
  hoursSinceLastBackup: number | null;
  backupCount: number;
  totalSize: number;
  alerts: string[];
}

export interface BackupStatus {
  production: BackupHealth;
  development: BackupHealth;
  overallHealth: boolean;
  lastCheckTime: Date;
}

@Injectable()
export class BackupMonitorService {
  private readonly logger = new Logger(BackupMonitorService.name);
  private readonly backupRootDir = '/opt/stack/AIStudio/backups';

  // Alert thresholds (in hours)
  private readonly PRODUCTION_THRESHOLD = 25;
  private readonly DEVELOPMENT_THRESHOLD = 3;

  private lastStatus: BackupStatus | null = null;

  /**
   * Check backup health every 6 hours
   *
   * To enable automatic scheduling:
   * 1. Import ScheduleModule in your NestJS module
   * 2. Uncomment the @Cron decorator below
   * 3. Ensure this service is registered as a provider
   */
  // @Cron(CronExpression.EVERY_6_HOURS, { name: 'backup-health-check' })
  async checkBackupHealth(): Promise<void> {
    this.logger.log('Running scheduled backup health check...');

    try {
      const status = await this.getBackupStatus();
      this.lastStatus = status;

      // Log any alerts
      if (status.production.alerts.length > 0) {
        status.production.alerts.forEach((alert) => {
          this.logger.warn(`[PRODUCTION] ${alert}`);
        });
      }

      if (status.development.alerts.length > 0) {
        status.development.alerts.forEach((alert) => {
          this.logger.warn(`[DEVELOPMENT] ${alert}`);
        });
      }

      if (status.overallHealth) {
        this.logger.log('Backup health check passed');
      } else {
        this.logger.error('Backup health check failed - see alerts above');
      }
    } catch (error: any) {
      this.logger.error(`Failed to check backup health: ${error.message}`, error.stack);
    }
  }

  /**
   * Get current backup status for both environments
   */
  async getBackupStatus(): Promise<BackupStatus> {
    const production = await this.checkEnvironmentHealth('production', this.PRODUCTION_THRESHOLD);
    const development = await this.checkEnvironmentHealth('development', this.DEVELOPMENT_THRESHOLD);

    const overallHealth = production.healthy && development.healthy;

    return {
      production,
      development,
      overallHealth,
      lastCheckTime: new Date(),
    };
  }

  /**
   * Check health for a specific environment
   */
  private async checkEnvironmentHealth(
    environment: 'production' | 'development',
    thresholdHours: number
  ): Promise<BackupHealth> {
    const backupDir = path.join(this.backupRootDir, environment);
    const alerts: string[] = [];

    // Check if backup directory exists
    try {
      await fs.access(backupDir);
    } catch (error) {
      return {
        environment,
        healthy: false,
        lastBackupTime: null,
        lastBackupFile: null,
        hoursSinceLastBackup: null,
        backupCount: 0,
        totalSize: 0,
        alerts: [`Backup directory does not exist: ${backupDir}`],
      };
    }

    // Get all backup files
    let files: string[] = [];
    try {
      const allFiles = await fs.readdir(backupDir);
      files = allFiles.filter(
        (f) => f.startsWith(`vibestudio_${environment}_`) && f.endsWith('.sql.gz')
      );
    } catch (error: any) {
      this.logger.error(`Failed to read backup directory ${backupDir}: ${error.message}`);
      return {
        environment,
        healthy: false,
        lastBackupTime: null,
        lastBackupFile: null,
        hoursSinceLastBackup: null,
        backupCount: 0,
        totalSize: 0,
        alerts: [`Failed to read backup directory: ${error.message}`],
      };
    }

    // If no backups found
    if (files.length === 0) {
      return {
        environment,
        healthy: false,
        lastBackupTime: null,
        lastBackupFile: null,
        hoursSinceLastBackup: null,
        backupCount: 0,
        totalSize: 0,
        alerts: [`No backups found in ${backupDir}`],
      };
    }

    // Get file stats and find most recent backup
    let mostRecentFile: string | null = null;
    let mostRecentTime: Date | null = null;
    let totalSize = 0;

    for (const file of files) {
      const filePath = path.join(backupDir, file);

      try {
        const stats = await fs.stat(filePath);
        totalSize += stats.size;

        if (!mostRecentTime || stats.mtime > mostRecentTime) {
          mostRecentTime = stats.mtime;
          mostRecentFile = file;
        }
      } catch (error: any) {
        this.logger.warn(`Failed to stat file ${filePath}: ${error.message}`);
      }
    }

    // Calculate hours since last backup
    let hoursSinceLastBackup: number | null = null;
    if (mostRecentTime) {
      const now = new Date();
      const diffMs = now.getTime() - mostRecentTime.getTime();
      hoursSinceLastBackup = diffMs / (1000 * 60 * 60);
    }

    // Check if backup is stale
    let healthy = true;

    if (!mostRecentTime) {
      healthy = false;
      alerts.push('No valid backups found');
    } else if (hoursSinceLastBackup !== null && hoursSinceLastBackup > thresholdHours) {
      healthy = false;
      alerts.push(
        `Last backup is too old: ${hoursSinceLastBackup.toFixed(1)} hours ago (threshold: ${thresholdHours}h)`
      );
    }

    return {
      environment,
      healthy,
      lastBackupTime: mostRecentTime,
      lastBackupFile: mostRecentFile,
      hoursSinceLastBackup,
      backupCount: files.length,
      totalSize,
      alerts,
    };
  }

  /**
   * Get cached status (for health check endpoint)
   */
  getCachedStatus(): BackupStatus | null {
    return this.lastStatus;
  }

  /**
   * Force an immediate health check
   */
  async forceCheck(): Promise<BackupStatus> {
    this.logger.log('Running manual backup health check...');
    const status = await this.getBackupStatus();
    this.lastStatus = status;
    return status;
  }

  /**
   * Get human-readable status summary
   */
  async getStatusSummary(): Promise<string> {
    const status = await this.getBackupStatus();

    const lines: string[] = [];
    lines.push('=== Backup Status Summary ===\n');

    // Production status
    lines.push('PRODUCTION:');
    lines.push(`  Status: ${status.production.healthy ? '✓ Healthy' : '✗ Unhealthy'}`);
    lines.push(`  Backup Count: ${status.production.backupCount}`);
    lines.push(
      `  Last Backup: ${status.production.lastBackupFile || 'None'}`
    );
    if (status.production.hoursSinceLastBackup !== null) {
      lines.push(
        `  Age: ${status.production.hoursSinceLastBackup.toFixed(1)} hours`
      );
    }
    if (status.production.alerts.length > 0) {
      lines.push(`  Alerts: ${status.production.alerts.join(', ')}`);
    }
    lines.push('');

    // Development status
    lines.push('DEVELOPMENT:');
    lines.push(`  Status: ${status.development.healthy ? '✓ Healthy' : '✗ Unhealthy'}`);
    lines.push(`  Backup Count: ${status.development.backupCount}`);
    lines.push(
      `  Last Backup: ${status.development.lastBackupFile || 'None'}`
    );
    if (status.development.hoursSinceLastBackup !== null) {
      lines.push(
        `  Age: ${status.development.hoursSinceLastBackup.toFixed(1)} hours`
      );
    }
    if (status.development.alerts.length > 0) {
      lines.push(`  Alerts: ${status.development.alerts.join(', ')}`);
    }
    lines.push('');

    // Overall status
    lines.push(`Overall Health: ${status.overallHealth ? '✓ Healthy' : '✗ Unhealthy'}`);
    lines.push(`Last Check: ${status.lastCheckTime.toISOString()}`);

    return lines.join('\n');
  }

  /**
   * Format bytes to human-readable size
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }
}
