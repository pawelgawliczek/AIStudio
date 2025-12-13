/**
 * Run Backup Tool - ST-78, ST-130
 * Execute database backup for specified environment
 *
 * Features:
 * - Execute pg_dump via postgres container for Docker environments
 * - Fall back to backup script on host for MCP calls
 * - Capture backup results (filename, size, duration)
 * - MD5 checksum generation
 * - Handle errors gracefully
 */

import { exec } from 'child_process';
import crypto from 'crypto';
import { stat, writeFile, readFile } from 'fs/promises';
import path from 'path';
import { promisify } from 'util';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';

const execAsync = promisify(exec);

export const tool: Tool = {
  name: 'mcp__vibestudio__run_backup',
  description: 'Execute database backup for production or development. Returns backup filename, size, and execution time.',
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
 * Detect if running inside Docker container
 */
function isRunningInDocker(): boolean {
  try {
    // Check for Docker-specific files
    const fs = require('fs');
    return fs.existsSync('/.dockerenv') ||
           (fs.existsSync('/proc/1/cgroup') &&
            fs.readFileSync('/proc/1/cgroup', 'utf8').includes('docker'));
  } catch {
    return false;
  }
}

/**
 * Run backup using pg_dump directly (for Docker environment)
 * Connects to postgres container via network and uses pg_dump
 *
 * NOTE: This requires pg_dump to be available in the backend container.
 * If not available, falls back to returning an error with instructions.
 */
async function runDockerBackup(environment: 'production' | 'development'): Promise<RunBackupResponse> {
  const startTime = Date.now();

  // Backup configuration
  const backupBaseDir = '/opt/stack/AIStudio/backups';
  const backupDir = path.join(backupBaseDir, environment);
  const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 15).replace(/(\d{8})(\d{6})/, '$1_$2');
  const backupFile = `vibestudio_${environment}_${timestamp}.sql.gz`;
  const backupPath = path.join(backupDir, backupFile);

  // Database credentials - in Docker, connect to postgres container via hostname
  const dbPassword = process.env.POSTGRES_PASSWORD || 'CHANGE_ME_POSTGRES_PASSWORD';
  const dbName = 'vibestudio';
  const dbUser = 'postgres';
  const dbHost = 'postgres'; // Docker network hostname

  console.log(`[run_backup] Running Docker backup for ${environment}`);
  console.log(`[run_backup] Output: ${backupPath}`);

  try {
    // Check if pg_dump is available
    try {
      await execAsync('which pg_dump');
    } catch {
      // pg_dump not available - this is expected in the current setup
      // Return informative error
      throw new Error(
        'pg_dump not available in backend container. ' +
        'Backups should be run from the host using: npm run db:backup or via MCP tool directly. ' +
        'To enable backups from web UI, install postgresql-client in backend Dockerfile.'
      );
    }

    // Run pg_dump directly, piping to gzip
    const dumpCmd = `PGPASSWORD='${dbPassword}' pg_dump -U ${dbUser} -h ${dbHost} ${dbName} | gzip > ${backupPath}`;

    await execAsync(dumpCmd, { timeout: 300000 });

    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000);

    // Get file stats
    const stats = await stat(backupPath);
    const size = stats.size;
    const sizeMB = Math.round((size / 1024 / 1024) * 100) / 100;

    // Generate MD5 checksum
    const fileContent = await readFile(backupPath);
    const checksum = crypto.createHash('md5').update(fileContent).digest('hex');

    // Write checksum file
    await writeFile(`${backupPath}.md5`, `${checksum}  ${backupFile}\n`);

    // Update manifest
    await updateManifest(backupDir, {
      filename: backupFile,
      checksum,
      size,
      created_at: new Date().toISOString(),
      environment,
    });

    console.log(`[run_backup] Backup completed: ${backupFile} (${sizeMB}MB) in ${duration}s`);

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
    console.error('[run_backup] Docker backup error:', error);
    throw error;
  }
}

/**
 * Update manifest.json with new backup entry
 */
async function updateManifest(backupDir: string, entry: {
  filename: string;
  checksum: string;
  size: number;
  created_at: string;
  environment: string;
}): Promise<void> {
  const manifestPath = path.join(backupDir, 'manifest.json');

  let manifest: { backups: any[] } = { backups: [] };

  try {
    const content = await readFile(manifestPath, 'utf-8');
    manifest = JSON.parse(content);
  } catch {
    // Manifest doesn't exist, use empty
  }

  // Add new entry at beginning
  manifest.backups.unshift(entry);

  // Keep only last 10 entries in manifest
  manifest.backups = manifest.backups.slice(0, 10);

  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
}

/**
 * Run backup using shell script (for host/MCP environment)
 */
async function runScriptBackup(environment: 'production' | 'development'): Promise<RunBackupResponse> {
  const scriptPath = '/opt/stack/AIStudio/scripts/backup-database.sh';

  console.log(`[run_backup] Executing backup script: ${scriptPath} ${environment}`);

  const startTime = Date.now();
  const { stdout, stderr } = await execAsync(`${scriptPath} ${environment}`, {
    timeout: 300000,
    cwd: '/opt/stack/AIStudio',
  });

  const endTime = Date.now();
  const duration = Math.round((endTime - startTime) / 1000);

  console.log(`[run_backup] Script completed in ${duration}s`);

  // Parse output (strip ANSI codes)
  const output = (stdout + stderr).replace(/\x1b\[[0-9;]*m/g, '');

  const filenameMatch = output.match(/Backup File:\s*([^\s]+\.sql\.gz)/);
  const backupFile = filenameMatch ? filenameMatch[1] : '';

  const pathMatch = output.match(/Location:\s*(.+\.sql\.gz)/);
  const backupPath = pathMatch ? pathMatch[1].trim() : '';

  const checksumMatch = output.match(/Checksum:\s*([a-f0-9]{32})/i);
  const checksum = checksumMatch ? checksumMatch[1] : '';

  const sizeMatch = output.match(/Size:\s*(\d+)\s*MB/);
  const sizeMB = sizeMatch ? parseInt(sizeMatch[1], 10) : 0;
  const size = sizeMB * 1024 * 1024;

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
}

/**
 * Handler for running database backup
 *
 * Detects environment and uses appropriate method:
 * - Docker: Uses docker exec with pg_dump via postgres container
 * - Host: Uses backup-database.sh script
 */
export async function handler(
  prisma: PrismaClient,
  params: RunBackupParams
): Promise<RunBackupResponse> {
  const { environment } = params;

  try {
    // Detect if running in Docker and use appropriate method
    if (isRunningInDocker()) {
      return await runDockerBackup(environment);
    } else {
      return await runScriptBackup(environment);
    }
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
