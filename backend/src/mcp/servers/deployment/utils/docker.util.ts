/**
 * Docker Utilities for Deployment
 *
 * Provides safe wrappers for Docker Compose operations:
 * - Building containers with cache strategies
 * - Restarting services
 * - Fetching container status and logs
 */

import { execSync } from 'child_process';

export interface ContainerStatus {
  name: string;
  state: string; // running, stopped, restarting, unhealthy
  healthy: boolean;
}

/**
 * Execute Docker Compose command safely
 */
function execDockerCompose(
  command: string,
  cwd: string,
  timeoutMs: number = 120000
): string {
  try {
    return execSync(`docker compose ${command}`, {
      cwd,
      encoding: 'utf-8',
      timeout: timeoutMs,
      stdio: ['pipe', 'pipe', 'pipe']
    });
  } catch (error: any) {
    // Include stderr in error message
    const stderr = error.stderr?.toString() || '';
    const stdout = error.stdout?.toString() || '';
    throw new Error(
      `Docker Compose command failed: ${command}\n${stderr}\n${stdout}`
    );
  }
}

/**
 * Build containers with appropriate cache strategy
 * - Frontend: Always no-cache (per CLAUDE.md)
 * - Backend: Selective cache
 */
export async function buildContainers(
  mainWorktreePath: string,
  rebuildFrontend: boolean = true,
  rebuildBackend: boolean = true
): Promise<void> {
  console.log('Building Docker containers...');

  const buildCommands: string[] = [];

  if (rebuildFrontend) {
    console.log('Building frontend (no-cache)...');
    buildCommands.push('build --no-cache frontend');
  }

  if (rebuildBackend) {
    console.log('Building backend (with cache)...');
    buildCommands.push('build backend');
  }

  // Execute builds sequentially
  for (const command of buildCommands) {
    try {
      execDockerCompose(command, mainWorktreePath, 600000); // 10 min timeout
      console.log(`Successfully built: ${command}`);
    } catch (error) {
      console.error(`Build failed for: ${command}`);
      throw error;
    }
  }
}

/**
 * Restart backend and frontend services
 */
export async function restartServices(
  mainWorktreePath: string
): Promise<void> {
  console.log('Recreating containers with new images...');

  try {
    execDockerCompose('up -d backend frontend', mainWorktreePath, 120000); // 2 min timeout (may need to pull/create)
    console.log('Containers recreated successfully');
  } catch (error) {
    console.error('Container recreation failed');
    throw error;
  }
}

/**
 * Get container status for a specific service
 */
export function getContainerStatus(
  mainWorktreePath: string,
  serviceName: string
): ContainerStatus {
  try {
    const output = execDockerCompose(
      `ps --format json ${serviceName}`,
      mainWorktreePath,
      5000
    );

    // Parse JSON output (may be multiple lines for multiple containers)
    const lines = output.trim().split('\n').filter(l => l.trim());
    if (lines.length === 0) {
      return {
        name: serviceName,
        state: 'stopped',
        healthy: false
      };
    }

    const status = JSON.parse(lines[0]);

    // Determine health status
    const state = status.State || 'unknown';
    const health = status.Health || 'none';

    return {
      name: serviceName,
      state,
      healthy: state === 'running' && (health === 'healthy' || health === 'none')
    };
  } catch (error) {
    console.error(`Failed to get status for ${serviceName}:`, error);
    return {
      name: serviceName,
      state: 'unknown',
      healthy: false
    };
  }
}

/**
 * Get container logs (last N lines)
 */
export function getContainerLogs(
  mainWorktreePath: string,
  serviceName: string,
  lines: number = 50
): string {
  try {
    return execDockerCompose(
      `logs --tail ${lines} ${serviceName}`,
      mainWorktreePath,
      10000
    );
  } catch (error: any) {
    console.error(`Failed to get logs for ${serviceName}:`, error);
    return error.message || 'Failed to retrieve logs';
  }
}

/**
 * Check if all required services are healthy
 */
export function checkAllServicesHealthy(
  mainWorktreePath: string,
  services: string[] = ['backend', 'frontend']
): { healthy: boolean; statuses: ContainerStatus[] } {
  const statuses = services.map(service =>
    getContainerStatus(mainWorktreePath, service)
  );

  const allHealthy = statuses.every(s => s.healthy);

  return { healthy: allHealthy, statuses };
}
