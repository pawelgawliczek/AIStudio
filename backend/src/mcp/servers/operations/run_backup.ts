/**
 * Run Backup Tool - ST-78
 * Execute database backup for specified environment
 *
 * Features:
 * - Execute backup script for production or development
 * - Capture backup results (filename, size, duration)
 * - Parse script output for structured data
 * - Handle errors gracefully
 */

import { exec } from 'child_process';
import path from 'path';
import { promisify } from 'util';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';

const execAsync = promisify(exec);

export const tool: Tool = {
  name: 'mcp__vibestudio__run_backup',
  description:
    'Execute database backup for specified environment (production or development). Returns backup filename, size, and execution time.',
  inputSchema: {
    type: 'object',
    properties: {
      environment: {
        type: 'string',
        enum: ['production', 'development'],
        description: 'Environment to backup (production or development)',
      },
    },
    required: ['environment'],
  },
};

export const metadata = {
  category: 'operations',
  domain: 'database',
  tags: ['backup', 'database', 'operations', 'automation'],
  version: '1.0.0',
  since: 'ST-78',
};

/**
 * Input parameters for run_backup
 */
export interface RunBackupParams {
  environment: 'production' | 'development';
}

/**
 * Response type for run_backup
 */
export interface RunBackupResponse {
  success: boolean;
  backupFile: string;
  backupPath: string;
  size: number;
  sizeMB: number;
  duration: number;
  checksum: string;
  environment: string;
  timestamp: string;
  error?: string;
}

/**
 * Handler for running database backup
 *
 * Executes the backup-database.sh script and parses output:
 * 1. Run backup script with specified environment
 * 2. Capture stdout/stderr
 * 3. Parse output for backup filename, size, checksum
 * 4. Return structured results
 */
export async function handler(
  prisma: PrismaClient,
  params: RunBackupParams
): Promise<RunBackupResponse> {
  const { environment } = params;

  try {
    // Path to backup script (absolute path to match BackupMonitorService)
    const scriptPath = '/opt/stack/AIStudio/scripts/backup-database.sh';

    console.log(`[run_backup] Executing backup script: ${scriptPath} ${environment}`);

    // Execute backup script with timeout (5 minutes)
    const startTime = Date.now();
    const { stdout, stderr } = await execAsync(`${scriptPath} ${environment}`, {
      timeout: 300000, // 5 minutes
      cwd: '/opt/stack/AIStudio', // Run from project root
    });

    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000); // seconds

    console.log(`[run_backup] Script completed in ${duration}s`);

    // Parse output to extract backup details
    // Strip ANSI color codes before parsing (e.g., [0;32m, [0m)
    const output = (stdout + stderr).replace(/\x1b\[[0-9;]*m/g, '');

    // Extract backup filename (e.g., "vibestudio_production_20251122_115533.sql.gz")
    const filenameMatch = output.match(/Backup File:\s*([^\s]+\.sql\.gz)/);
    const backupFile = filenameMatch ? filenameMatch[1] : '';

    // Extract backup path
    const pathMatch = output.match(/Location:\s*(.+\.sql\.gz)/);
    const backupPath = pathMatch ? pathMatch[1].trim() : '';

    // Extract checksum
    const checksumMatch = output.match(/Checksum:\s*([a-f0-9]{32})/i);
    const checksum = checksumMatch ? checksumMatch[1] : '';

    // Extract size from output (e.g., "Size: 5 MB")
    const sizeMatch = output.match(/Size:\s*(\d+)\s*MB/);
    const sizeMB = sizeMatch ? parseInt(sizeMatch[1], 10) : 0;
    const size = sizeMB * 1024 * 1024; // Convert to bytes

    // Extract timestamp from filename
    const timestampMatch = backupFile.match(/_(\d{8}_\d{6})\./);
    const timestamp = timestampMatch ? timestampMatch[1] : '';

    if (!backupFile) {
      throw new Error('Failed to parse backup filename from script output');
    }

    return {
      success: true,
      backupFile,
      backupPath,
      size,
      sizeMB,
      duration,
      checksum,
      environment,
      timestamp,
    };
  } catch (error: any) {
    console.error('[run_backup] Error:', error);

    return {
      success: false,
      backupFile: '',
      backupPath: '',
      size: 0,
      sizeMB: 0,
      duration: 0,
      checksum: '',
      environment,
      timestamp: '',
      error: error.message || 'Unknown error during backup',
    };
  }
}
