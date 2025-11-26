/**
 * Docker Utilities for Deployment
 *
 * Provides safe wrappers for Docker Compose operations:
 * - Building containers with cache strategies
 * - Restarting services
 * - Fetching container status and logs
 *
 * SAFETY: Production operations are blocked when agent testing mode is active.
 */

import { execSync } from 'child_process';
import {
  isAgentTestingMode,
  assertSafeDockerCommand,
  ProductionSafetyError,
} from '../../../../config/environments.js';

/**
 * Ensure a Docker buildx builder exists, creating it if necessary
 * This provides isolated build caches for test and production environments
 */
async function ensureBuilderExists(builderName: string): Promise<void> {
  try {
    // Check if builder already exists
    execSync(`docker buildx inspect ${builderName}`, {
      encoding: 'utf-8',
      stdio: 'pipe'
    });
    console.log(`Builder ${builderName} already exists, reusing...`);
  } catch (error) {
    // Builder doesn't exist, create it
    console.log(`Creating Docker buildx builder: ${builderName}...`);
    try {
      execSync(`docker buildx create --name ${builderName} --driver docker-container --use`, {
        encoding: 'utf-8',
        stdio: 'pipe'
      });
      console.log(`✓ Builder ${builderName} created successfully`);
    } catch (createError: any) {
      throw new Error(`Failed to create buildx builder ${builderName}: ${createError.message}`);
    }
  }
}

export interface ContainerStatus {
  name: string;
  state: string; // running, stopped, restarting, unhealthy
  healthy: boolean;
}

/**
 * Execute Docker Compose command safely
 * SAFETY: Blocks production container operations when in agent testing mode
 */
function execDockerCompose(
  command: string,
  cwd: string,
  timeoutMs: number = 120000
): string {
  // Safety check: Block production operations in agent testing mode
  if (isAgentTestingMode()) {
    assertSafeDockerCommand(command);
  }

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
    console.log('Building backend (no-cache)...');
    buildCommands.push('build --no-cache backend');
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

// ============================================================================
// Test Stack Docker Utilities (ST-76)
// These functions manage the isolated test containers from docker-compose.test.yml
// ============================================================================

const TEST_COMPOSE_FILE = 'docker-compose.test.yml';

/**
 * Execute Docker Compose command for test stack
 */
function execDockerComposeTest(
  command: string,
  cwd: string,
  timeoutMs: number = 120000
): string {
  try {
    return execSync(`docker compose -f ${TEST_COMPOSE_FILE} ${command}`, {
      cwd,
      encoding: 'utf-8',
      timeout: timeoutMs,
      stdio: ['pipe', 'pipe', 'pipe']
    });
  } catch (error: any) {
    const stderr = error.stderr?.toString() || '';
    const stdout = error.stdout?.toString() || '';
    throw new Error(
      `Docker Compose (test) command failed: ${command}\n${stderr}\n${stdout}`
    );
  }
}

/**
 * Build test stack containers with worktree code
 * Uses docker build directly with explicit context path to ensure worktree code is used
 */
export async function buildTestContainers(
  mainWorktreePath: string,
  worktreePath: string,
  rebuildBackend: boolean = true,
  rebuildFrontend: boolean = true
): Promise<void> {
  console.log('Building test stack containers...');
  console.log(`Build context: ${worktreePath}`);

  // Ensure vibestudio-test builder exists
  await ensureBuilderExists('vibestudio-test');

  if (rebuildBackend) {
    console.log('Building test-backend from worktree...');
    try {
      // Remove node_modules symlinks from worktree (prevents docker COPY conflicts)
      const backendNodeModules = `${worktreePath}/backend/node_modules`;
      try {
        execSync(`rm -f ${backendNodeModules}`, { cwd: worktreePath });
      } catch {
        // Ignore if doesn't exist
      }

      // Use Dockerfile from main worktree, but build context from story worktree
      // Use vibestudio-test builder for isolated cache
      const dockerfilePath = `${mainWorktreePath}/backend/Dockerfile.test`;
      execSync(
        `docker buildx build --builder vibestudio-test --load --no-cache -t aistudio-test-backend -f ${dockerfilePath} ${worktreePath}`,
        {
          cwd: worktreePath,
          encoding: 'utf-8',
          timeout: 600000, // 10 min
          stdio: 'inherit'
        }
      );
      console.log('✓ test-backend built successfully');
    } catch (error) {
      console.error('✗ test-backend build failed');
      throw error;
    }
  }

  if (rebuildFrontend) {
    console.log('Building test-frontend from worktree...');
    try {
      // Remove node_modules symlinks from worktree (prevents docker COPY conflicts)
      const frontendNodeModules = `${worktreePath}/frontend/node_modules`;
      const sharedNodeModules = `${worktreePath}/shared/node_modules`;
      try {
        execSync(`rm -f ${frontendNodeModules} ${sharedNodeModules}`, { cwd: worktreePath });
      } catch {
        // Ignore if doesn't exist
      }

      // Use Dockerfile from main worktree, but build context from story worktree
      // Use vibestudio-test builder for isolated cache
      const dockerfilePath = `${mainWorktreePath}/frontend/Dockerfile`;
      execSync(
        `docker buildx build --builder vibestudio-test --load --no-cache -t aistudio-test-frontend -f ${dockerfilePath} --build-arg VITE_API_URL=/api --build-arg VITE_WS_URL=/socket.io --build-arg BACKEND_HOST=test-backend ${worktreePath}`,
        {
          cwd: worktreePath,
          encoding: 'utf-8',
          timeout: 600000, // 10 min
          stdio: 'inherit'
        }
      );
      console.log('✓ test-frontend built successfully');
    } catch (error) {
      console.error('✗ test-frontend build failed');
      throw error;
    }
  }
}

/**
 * Start/restart test stack services
 * @param mainWorktreePath - Path to main worktree (where docker-compose.test.yml is located)
 * @param worktreePath - Path to story worktree for volume mounts (optional, defaults to main worktree)
 */
export async function startTestStack(
  mainWorktreePath: string,
  worktreePath?: string
): Promise<void> {
  console.log('Starting test stack containers...');

  // Set WORKTREE_PATH environment variable if worktree path provided
  const env = worktreePath
    ? {
        ...process.env,
        WORKTREE_PATH: worktreePath
      }
    : process.env;

  if (worktreePath) {
    console.log(`Using WORKTREE_PATH: ${worktreePath}`);
  }

  try {
    // Start all test services (postgres, redis, backend, frontend)
    execSync(
      `docker compose -f ${TEST_COMPOSE_FILE} up -d test-postgres test-redis test-backend test-frontend`,
      {
        cwd: mainWorktreePath,
        encoding: 'utf-8',
        timeout: 180000, // 3 min
        stdio: 'inherit',
        env
      }
    );
    console.log('Test stack started successfully');
  } catch (error) {
    console.error('Failed to start test stack');
    throw error;
  }
}

/**
 * Stop test stack services (optional cleanup)
 */
export async function stopTestStack(mainWorktreePath: string): Promise<void> {
  console.log('Stopping test stack containers...');

  try {
    execDockerComposeTest(
      'down test-backend test-frontend',
      mainWorktreePath,
      60000
    );
    console.log('Test stack stopped');
  } catch (error: any) {
    console.warn('Failed to stop test stack:', error.message);
  }
}

/**
 * Get test container status
 */
export function getTestContainerStatus(
  mainWorktreePath: string,
  serviceName: string
): ContainerStatus {
  try {
    const output = execDockerComposeTest(
      `ps --format json ${serviceName}`,
      mainWorktreePath,
      5000
    );

    const lines = output.trim().split('\n').filter(l => l.trim());
    if (lines.length === 0) {
      return { name: serviceName, state: 'stopped', healthy: false };
    }

    const status = JSON.parse(lines[0]);
    const state = status.State || 'unknown';
    const health = status.Health || 'none';

    return {
      name: serviceName,
      state,
      healthy: state === 'running' && (health === 'healthy' || health === 'none')
    };
  } catch (error) {
    return { name: serviceName, state: 'unknown', healthy: false };
  }
}

/**
 * Get test container logs
 */
export function getTestContainerLogs(
  mainWorktreePath: string,
  serviceName: string,
  lines: number = 50
): string {
  try {
    return execDockerComposeTest(
      `logs --tail ${lines} ${serviceName}`,
      mainWorktreePath,
      10000
    );
  } catch (error: any) {
    return error.message || 'Failed to retrieve logs';
  }
}

/**
 * Check if test stack is healthy
 */
export function checkTestStackHealthy(
  mainWorktreePath: string
): { healthy: boolean; statuses: ContainerStatus[] } {
  const services = ['test-postgres', 'test-redis', 'test-backend', 'test-frontend'];
  const statuses = services.map(s => getTestContainerStatus(mainWorktreePath, s));
  const allHealthy = statuses.every(s => s.healthy);
  return { healthy: allHealthy, statuses };
}
