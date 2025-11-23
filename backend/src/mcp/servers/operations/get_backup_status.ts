/**
 * Get Backup Status Tool - ST-78
 * Returns backup status for both production and development environments
 *
 * Features:
 * - Last backup time for each environment
 * - Total backup count per environment
 * - Health status (checks if backups are stale)
 * - Alerts for missing or old backups
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import { BackupMonitorService } from '../../../services/backup-monitor.service.js';

export const tool: Tool = {
  name: 'mcp__vibestudio__get_backup_status',
  description:
    'Get backup status for both production and development environments. Includes last backup time, count, and health status.',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
};

export const metadata = {
  category: 'operations',
  domain: 'database',
  tags: ['backup', 'monitoring', 'health', 'status'],
  version: '1.0.0',
  since: 'ST-78',
};

/**
 * Response type for backup status
 */
export interface BackupStatusResponse {
  production: {
    healthy: boolean;
    lastBackupTime: string | null;
    lastBackupFile: string | null;
    hoursSinceLastBackup: number | null;
    backupCount: number;
    totalSizeMB: number;
    alerts: string[];
  };
  development: {
    healthy: boolean;
    lastBackupTime: string | null;
    lastBackupFile: string | null;
    hoursSinceLastBackup: number | null;
    backupCount: number;
    totalSizeMB: number;
    alerts: string[];
  };
  overallHealth: boolean;
  lastCheckTime: string;
}

/**
 * Handler for getting backup status
 *
 * Uses BackupMonitorService to check health of both environments:
 * 1. Production backups (threshold: 25 hours)
 * 2. Development backups (threshold: 3 hours)
 */
export async function handler(
  prisma: PrismaClient,
  params: object // No params needed
): Promise<BackupStatusResponse> {
  try {
    const monitorService = new BackupMonitorService();

    // Get current backup status
    const status = await monitorService.getBackupStatus();

    // Format response
    const response: BackupStatusResponse = {
      production: {
        healthy: status.production.healthy,
        lastBackupTime: status.production.lastBackupTime?.toISOString() || null,
        lastBackupFile: status.production.lastBackupFile,
        hoursSinceLastBackup: status.production.hoursSinceLastBackup
          ? Math.round(status.production.hoursSinceLastBackup * 10) / 10
          : null,
        backupCount: status.production.backupCount,
        totalSizeMB: Math.round(status.production.totalSize / 1024 / 1024),
        alerts: status.production.alerts,
      },
      development: {
        healthy: status.development.healthy,
        lastBackupTime: status.development.lastBackupTime?.toISOString() || null,
        lastBackupFile: status.development.lastBackupFile,
        hoursSinceLastBackup: status.development.hoursSinceLastBackup
          ? Math.round(status.development.hoursSinceLastBackup * 10) / 10
          : null,
        backupCount: status.development.backupCount,
        totalSizeMB: Math.round(status.development.totalSize / 1024 / 1024),
        alerts: status.development.alerts,
      },
      overallHealth: status.overallHealth,
      lastCheckTime: status.lastCheckTime.toISOString(),
    };

    return response;
  } catch (error: any) {
    // If monitoring service fails, return error state
    return {
      production: {
        healthy: false,
        lastBackupTime: null,
        lastBackupFile: null,
        hoursSinceLastBackup: null,
        backupCount: 0,
        totalSizeMB: 0,
        alerts: [`Failed to check backup status: ${error.message}`],
      },
      development: {
        healthy: false,
        lastBackupTime: null,
        lastBackupFile: null,
        hoursSinceLastBackup: null,
        backupCount: 0,
        totalSizeMB: 0,
        alerts: [`Failed to check backup status: ${error.message}`],
      },
      overallHealth: false,
      lastCheckTime: new Date().toISOString(),
    };
  }
}
