/**
 * Docker command execution utilities
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { DockerExecOptions, DockerExecResult } from '../types/migration.types';

const execAsync = promisify(exec);

/**
 * Execute a command in a Docker container
 */
export async function dockerExec(
  options: DockerExecOptions
): Promise<DockerExecResult> {
  const { containerName, command, timeout = 600000 } = options;

  try {
    const { stdout, stderr } = await execAsync(
      `docker exec ${containerName} ${command}`,
      { timeout, maxBuffer: 10 * 1024 * 1024 } // 10MB buffer
    );

    return {
      success: true,
      stdout: stdout.trim(),
      stderr: stderr.trim(),
      exitCode: 0,
    };
  } catch (error: any) {
    return {
      success: false,
      stdout: error.stdout?.trim() || '',
      stderr: error.stderr?.trim() || error.message,
      exitCode: error.code || 1,
    };
  }
}

/**
 * Check if Docker container is running
 */
export async function isContainerRunning(
  containerName: string
): Promise<boolean> {
  try {
    const { stdout } = await execAsync(
      `docker ps --filter name=${containerName} --format "{{.Names}}"`
    );
    return stdout.trim() === containerName;
  } catch {
    return false;
  }
}

/**
 * Get database connection count
 */
export async function getDatabaseConnections(
  containerName: string,
  database: string
): Promise<number> {
  const result = await dockerExec({
    containerName,
    command: `psql -U postgres -d ${database} -t -c "SELECT count(*) FROM pg_stat_activity WHERE datname='${database}';"`,
  });

  if (result.success) {
    return parseInt(result.stdout.trim(), 10) || 0;
  }

  return 0;
}

/**
 * Terminate all database connections
 */
export async function terminateConnections(
  containerName: string,
  database: string
): Promise<DockerExecResult> {
  return dockerExec({
    containerName,
    command: `psql -U postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${database}' AND pid <> pg_backend_pid();"`,
  });
}
