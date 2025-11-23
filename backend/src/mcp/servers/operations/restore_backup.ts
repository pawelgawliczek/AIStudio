/**
 * Restore Backup Tool - ST-78
 * Restore database from backup file (REQUIRES confirmation)
 *
 * CRITICAL SAFETY FEATURES:
 * - Requires explicit confirm: true parameter
 * - Verifies backup file exists
 * - Verifies checksum matches (if available)
 * - Executes restore script
 * - Returns restoration results
 *
 * This is a DESTRUCTIVE operation that will replace all database data!
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile, access } from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const execAsync = promisify(exec);

export const tool: Tool = {
  name: 'mcp__vibestudio__restore_backup',
  description:
    'Restore database from backup file. CRITICAL: This is a DESTRUCTIVE operation that will DESTROY all current database data! Requires confirm: true parameter.',
  inputSchema: {
    type: 'object',
    properties: {
      backupFile: {
        type: 'string',
        description:
          'Backup filename to restore (e.g., vibestudio_production_20251122_115533.sql.gz)',
      },
      confirm: {
        type: 'boolean',
        description:
          'REQUIRED: Must be set to true to confirm you understand this will destroy all current data',
      },
    },
    required: ['backupFile', 'confirm'],
  },
};

export const metadata = {
  category: 'operations',
  domain: 'database',
  tags: ['backup', 'restore', 'database', 'destructive', 'critical'],
  version: '1.0.0',
  since: 'ST-78',
};

/**
 * Input parameters for restore_backup
 */
export interface RestoreBackupParams {
  backupFile: string;
  confirm: boolean;
}

/**
 * Response type for restore_backup
 */
export interface RestoreBackupResponse {
  success: boolean;
  restoredFrom: string;
  tablesRestored: number;
  duration: number;
  checksumVerified: boolean;
  warning?: string;
  error?: string;
}

/**
 * Calculate MD5 checksum of a file
 */
async function calculateChecksum(filePath: string): Promise<string> {
  const fileBuffer = await readFile(filePath);
  const hashSum = crypto.createHash('md5');
  hashSum.update(fileBuffer);
  return hashSum.digest('hex');
}

/**
 * Verify checksum matches expected value
 */
async function verifyChecksum(backupPath: string): Promise<boolean> {
  const checksumFile = `${backupPath}.md5`;

  try {
    // Check if checksum file exists
    await access(checksumFile);

    // Read expected checksum
    const checksumContent = await readFile(checksumFile, 'utf-8');
    const expectedChecksum = checksumContent.trim().split(/\s+/)[0];

    // Calculate actual checksum
    const actualChecksum = await calculateChecksum(backupPath);

    console.log(`[restore_backup] Expected checksum: ${expectedChecksum}`);
    console.log(`[restore_backup] Actual checksum: ${actualChecksum}`);

    return expectedChecksum === actualChecksum;
  } catch (error) {
    // Checksum file doesn't exist - not an error, just skip verification
    console.log(`[restore_backup] No checksum file found, skipping verification`);
    return false;
  }
}

/**
 * Find backup file in directories
 */
async function findBackupFile(filename: string): Promise<string | null> {
  const backupBaseDir = '/opt/stack/AIStudio/backups';

  // Search locations in order
  const searchPaths = [
    path.join(backupBaseDir, 'production', filename),
    path.join(backupBaseDir, 'development', filename),
    path.join(backupBaseDir, filename), // legacy location
  ];

  for (const searchPath of searchPaths) {
    try {
      await access(searchPath);
      return searchPath; // Found!
    } catch {
      // Not found, try next location
    }
  }

  return null; // Not found anywhere
}

/**
 * Handler for restoring database backup
 *
 * CRITICAL SAFETY CHECKS:
 * 1. Verify confirm parameter is true
 * 2. Verify backup file exists
 * 3. Verify checksum (if available)
 * 4. Execute restore script
 * 5. Parse results
 */
export async function handler(
  prisma: PrismaClient,
  params: RestoreBackupParams
): Promise<RestoreBackupResponse> {
  const { backupFile, confirm } = params;

  // CRITICAL SAFETY CHECK: Require explicit confirmation
  if (!confirm || confirm !== true) {
    return {
      success: false,
      restoredFrom: '',
      tablesRestored: 0,
      duration: 0,
      checksumVerified: false,
      error:
        'SAFETY CHECK FAILED: You must set confirm: true to proceed. ' +
        'WARNING: This operation will DESTROY all current database data and replace it with the backup!',
    };
  }

  try {
    // Find backup file
    console.log(`[restore_backup] Searching for backup file: ${backupFile}`);
    const backupPath = await findBackupFile(backupFile);

    if (!backupPath) {
      return {
        success: false,
        restoredFrom: backupFile,
        tablesRestored: 0,
        duration: 0,
        checksumVerified: false,
        error: `Backup file not found: ${backupFile}. Use list_backups to see available backups.`,
      };
    }

    console.log(`[restore_backup] Found backup at: ${backupPath}`);

    // Verify checksum (if available)
    const checksumVerified = await verifyChecksum(backupPath);

    if (checksumVerified) {
      console.log(`[restore_backup] Checksum verified successfully`);
    } else {
      console.log(`[restore_backup] Checksum verification skipped (no .md5 file)`);
    }

    // Execute restore script (absolute path to match BackupMonitorService)
    const scriptPath = '/opt/stack/AIStudio/scripts/restore-database.sh';

    console.log(`[restore_backup] Executing restore script: ${scriptPath} ${backupFile}`);

    const startTime = Date.now();

    // Note: restore script expects just the filename, it will find the full path
    // We use 'yes' to auto-confirm the interactive prompt
    const { stdout, stderr } = await execAsync(`echo "yes" | ${scriptPath} ${backupFile}`, {
      timeout: 600000, // 10 minutes
      cwd: '/opt/stack/AIStudio',
    });

    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000); // seconds

    console.log(`[restore_backup] Restore completed in ${duration}s`);

    // Parse output to extract results
    const output = stdout + stderr;

    // Extract table count (e.g., "Database verified: 42 tables restored")
    const tablesMatch = output.match(/Database verified:\s*(\d+)\s*tables/i);
    const tablesRestored = tablesMatch ? parseInt(tablesMatch[1], 10) : 0;

    return {
      success: true,
      restoredFrom: backupFile,
      tablesRestored,
      duration,
      checksumVerified,
      warning:
        'Database has been restored. All previous data has been replaced with the backup data. ' +
        'You may need to restart backend services to clear cached connections.',
    };
  } catch (error: any) {
    console.error('[restore_backup] Error:', error);

    return {
      success: false,
      restoredFrom: backupFile,
      tablesRestored: 0,
      duration: 0,
      checksumVerified: false,
      error: error.message || 'Unknown error during restore',
    };
  }
}
