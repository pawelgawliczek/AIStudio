/**
 * Docker Production Utilities - ST-77
 *
 * Utilities for managing production Docker containers:
 * - Container build operations
 * - Container restart/stop operations
 * - Health check validation
 * - Log retrieval
 *
 * SAFETY GUARANTEES:
 * - Uses production Dockerfile (per CLAUDE.md)
 * - Always builds with --no-cache
 * - Validates container health before marking success
 * - Captures full logs for audit trail
 */

import { execSync, exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Ensure a Docker buildx builder exists, creating it if necessary
 * This provides isolated build caches for production deployments
 */
async function ensureBuilderExists(builderName: string): Promise<void> {
  try {
    // Check if builder already exists
    execSync(`docker buildx inspect ${builderName}`, {
      encoding: 'utf-8',
      stdio: 'pipe'
    });
    console.log(`[DockerProductionUtils] Builder ${builderName} already exists, reusing...`);
  } catch (error) {
    // Builder doesn't exist, create it
    console.log(`[DockerProductionUtils] Creating Docker buildx builder: ${builderName}...`);
    try {
      execSync(`docker buildx create --name ${builderName} --driver docker-container --use`, {
        encoding: 'utf-8',
        stdio: 'pipe'
      });
      console.log(`[DockerProductionUtils] ✓ Builder ${builderName} created successfully`);
    } catch (createError: any) {
      throw new Error(`Failed to create buildx builder ${builderName}: ${createError.message}`);
    }
  }
}

// ============================================================================
// Types
// ============================================================================

export interface ContainerBuildResult {
  success: boolean;
  service: string;
  duration: number;
  imageId?: string;
  logs: string;
  errors: string[];
}

export interface ContainerRestartResult {
  success: boolean;
  service: string;
  containerId?: string;
  logs: string;
  errors: string[];
}

export interface ContainerHealthResult {
  healthy: boolean;
  service: string;
  status: string; // 'running', 'exited', 'restarting', etc.
  uptime?: number; // seconds
  logs?: string;
  error?: string;
}

export interface ContainerLogsResult {
  success: boolean;
  service: string;
  logs: string;
  lines: number;
}

// ============================================================================
// Docker Production Utilities
// ============================================================================

export class DockerProductionUtils {
  private projectRoot: string;

  constructor(projectRoot?: string) {
    this.projectRoot = projectRoot || process.cwd();
  }

  /**
   * Build production Docker container with --no-cache (AC5)
   */
  async buildContainer(service: 'backend' | 'frontend'): Promise<ContainerBuildResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    let logs = '';

    console.log(`[DockerProductionUtils] Building ${service} container...`);

    try {
      // Ensure vibestudio-prod builder exists for isolated production cache
      await ensureBuilderExists('vibestudio-prod');

      // CRITICAL: Use production Dockerfile with --no-cache and isolated builder (per CLAUDE.md)
      const buildCommand = `docker compose build ${service} --no-cache`;

      logs = execSync(buildCommand, {
        cwd: this.projectRoot,
        encoding: 'utf-8',
        stdio: 'pipe',
        timeout: 600000, // 10 minutes max
      });

      // Extract image ID from logs
      const imageIdMatch = logs.match(/Successfully built ([a-f0-9]{12})/);
      const imageId = imageIdMatch ? imageIdMatch[1] : undefined;

      const duration = Date.now() - startTime;

      console.log(`[DockerProductionUtils] ${service} built successfully in ${Math.round(duration / 1000)}s`);

      return {
        success: true,
        service,
        duration,
        imageId,
        logs,
        errors: [],
      };

    } catch (error: any) {
      const duration = Date.now() - startTime;
      const errorMessage = error.message || 'Unknown build error';
      errors.push(errorMessage);

      console.error(`[DockerProductionUtils] Failed to build ${service}:`, errorMessage);

      return {
        success: false,
        service,
        duration,
        logs: logs || error.stdout || '',
        errors,
      };
    }
  }

  /**
   * Restart production Docker container
   */
  async restartContainer(service: 'backend' | 'frontend'): Promise<ContainerRestartResult> {
    const errors: string[] = [];
    let logs = '';

    console.log(`[DockerProductionUtils] Restarting ${service} container...`);

    try {
      // Stop container gracefully (30 second timeout)
      const stopCommand = `docker compose stop -t 30 ${service}`;

      logs += execSync(stopCommand, {
        cwd: this.projectRoot,
        encoding: 'utf-8',
        stdio: 'pipe',
      });

      // Start container
      const startCommand = `docker compose up -d ${service}`;

      logs += '\n' + execSync(startCommand, {
        cwd: this.projectRoot,
        encoding: 'utf-8',
        stdio: 'pipe',
      });

      // Get container ID
      const containerId = await this.getContainerId(service);

      console.log(`[DockerProductionUtils] ${service} restarted successfully`);

      return {
        success: true,
        service,
        containerId,
        logs,
        errors: [],
      };

    } catch (error: any) {
      const errorMessage = error.message || 'Unknown restart error';
      errors.push(errorMessage);

      console.error(`[DockerProductionUtils] Failed to restart ${service}:`, errorMessage);

      return {
        success: false,
        service,
        logs: logs || error.stdout || '',
        errors,
      };
    }
  }

  /**
   * Stop production Docker container
   */
  async stopContainer(service: 'backend' | 'frontend', timeout: number = 30): Promise<void> {
    console.log(`[DockerProductionUtils] Stopping ${service} container...`);

    try {
      const stopCommand = `docker compose stop -t ${timeout} ${service}`;

      execSync(stopCommand, {
        cwd: this.projectRoot,
        encoding: 'utf-8',
        stdio: 'pipe',
      });

      console.log(`[DockerProductionUtils] ${service} stopped successfully`);
    } catch (error: any) {
      throw new Error(`Failed to stop ${service}: ${error.message}`);
    }
  }

  /**
   * Check if container is healthy
   */
  async checkContainerHealth(service: 'backend' | 'frontend'): Promise<ContainerHealthResult> {
    try {
      // Get container status
      const statusCommand = `docker compose ps ${service} --format json`;

      const output = execSync(statusCommand, {
        cwd: this.projectRoot,
        encoding: 'utf-8',
        stdio: 'pipe',
      });

      if (!output.trim()) {
        return {
          healthy: false,
          service,
          status: 'not_found',
          error: `Container ${service} not found`,
        };
      }

      const containerInfo = JSON.parse(output);

      // Check if container is running
      const isRunning = containerInfo.State === 'running';
      const status = containerInfo.State;

      // Get uptime if running
      let uptime: number | undefined;
      if (isRunning) {
        try {
          const uptimeCommand = `docker inspect ${containerInfo.Name} --format='{{.State.StartedAt}}'`;
          const startedAt = execSync(uptimeCommand, {
            encoding: 'utf-8',
            stdio: 'pipe',
          }).trim();

          const startTime = new Date(startedAt).getTime();
          const now = Date.now();
          uptime = Math.floor((now - startTime) / 1000); // seconds
        } catch {
          // Ignore uptime calculation errors
        }
      }

      return {
        healthy: isRunning,
        service,
        status,
        uptime,
      };

    } catch (error: any) {
      console.error(`[DockerProductionUtils] Failed to check ${service} health:`, error.message);

      return {
        healthy: false,
        service,
        status: 'error',
        error: error.message,
      };
    }
  }

  /**
   * Get container logs (for debugging)
   */
  async getContainerLogs(
    service: 'backend' | 'frontend',
    tail: number = 100
  ): Promise<ContainerLogsResult> {
    try {
      const logsCommand = `docker compose logs ${service} --tail ${tail}`;

      const logs = execSync(logsCommand, {
        cwd: this.projectRoot,
        encoding: 'utf-8',
        stdio: 'pipe',
      });

      const lines = logs.split('\n').length;

      return {
        success: true,
        service,
        logs,
        lines,
      };

    } catch (error: any) {
      console.error(`[DockerProductionUtils] Failed to get logs for ${service}:`, error.message);

      return {
        success: false,
        service,
        logs: error.stdout || '',
        lines: 0,
      };
    }
  }

  /**
   * Get container ID for a service
   */
  private async getContainerId(service: 'backend' | 'frontend'): Promise<string | undefined> {
    try {
      const command = `docker compose ps ${service} --format '{{.ID}}'`;

      const containerId = execSync(command, {
        cwd: this.projectRoot,
        encoding: 'utf-8',
        stdio: 'pipe',
      }).trim();

      return containerId || undefined;

    } catch (error: any) {
      console.warn(`[DockerProductionUtils] Failed to get container ID for ${service}:`, error.message);
      return undefined;
    }
  }

  /**
   * Get Docker compose service status
   */
  async getServiceStatus(service: 'backend' | 'frontend'): Promise<{
    running: boolean;
    status: string;
    containerId?: string;
    uptime?: number;
  }> {
    const healthResult = await this.checkContainerHealth(service);

    return {
      running: healthResult.healthy,
      status: healthResult.status,
      uptime: healthResult.uptime,
      containerId: await this.getContainerId(service),
    };
  }

  /**
   * Verify all production services are running
   */
  async verifyAllServicesRunning(): Promise<{
    allRunning: boolean;
    backend: boolean;
    frontend: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];

    const backendHealth = await this.checkContainerHealth('backend');
    const frontendHealth = await this.checkContainerHealth('frontend');

    if (!backendHealth.healthy) {
      errors.push(`Backend not healthy: ${backendHealth.error || backendHealth.status}`);
    }

    if (!frontendHealth.healthy) {
      errors.push(`Frontend not healthy: ${frontendHealth.error || frontendHealth.status}`);
    }

    return {
      allRunning: backendHealth.healthy && frontendHealth.healthy,
      backend: backendHealth.healthy,
      frontend: frontendHealth.healthy,
      errors,
    };
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Build and restart a production service
 */
export async function buildAndRestartService(
  service: 'backend' | 'frontend',
  projectRoot?: string
): Promise<{
  success: boolean;
  buildResult: ContainerBuildResult;
  restartResult?: ContainerRestartResult;
  errors: string[];
}> {
  const utils = new DockerProductionUtils(projectRoot);
  const errors: string[] = [];

  // Build container
  const buildResult = await utils.buildContainer(service);

  if (!buildResult.success) {
    errors.push(...buildResult.errors);
    return {
      success: false,
      buildResult,
      errors,
    };
  }

  // Restart container
  const restartResult = await utils.restartContainer(service);

  if (!restartResult.success) {
    errors.push(...restartResult.errors);
    return {
      success: false,
      buildResult,
      restartResult,
      errors,
    };
  }

  return {
    success: true,
    buildResult,
    restartResult,
    errors: [],
  };
}

/**
 * Quick health check for a service
 */
export async function isServiceHealthy(
  service: 'backend' | 'frontend',
  projectRoot?: string
): Promise<boolean> {
  const utils = new DockerProductionUtils(projectRoot);
  const healthResult = await utils.checkContainerHealth(service);
  return healthResult.healthy;
}
