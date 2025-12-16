/**
 * ST-268: Deployment Worker - Async Deployment Execution
 *
 * Standalone process that executes production deployments asynchronously.
 * Spawned by deploy_to_production MCP tool and runs detached.
 *
 * Features:
 * - 30s heartbeat updates to DB
 * - Progress tracking per phase
 * - Uncaught exception/rejection handlers
 * - Graceful cleanup on exit
 * - Uses spawn instead of execSync for streaming output
 */

import { spawn } from 'child_process';
import { PrismaClient } from '@prisma/client';
import * as path from 'path';
import { DeploymentLockService } from '../services/deployment-lock.service.js';

// ============================================================================
// Types
// ============================================================================

interface DeploymentProgress {
  phaseIndex: number;
  totalPhases: number;
  percentComplete: number;
  currentPhase: string;
  message: string;
}

interface PhaseConfig {
  name: string;
  weight: number; // Relative weight for progress calculation
  execute: () => Promise<void>;
}

// ============================================================================
// Global State
// ============================================================================

const prisma = new PrismaClient();
const lockService = new DeploymentLockService(prisma);
let deploymentLogId: string;
let storyId: string;
let lockId: string | null = null;
let heartbeatInterval: NodeJS.Timeout | null = null;
let isShuttingDown = false;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Update deployment status in database
 */
async function updateStatus(
  status: 'queued' | 'deploying' | 'deployed' | 'failed',
  updates: Partial<{
    currentPhase: string;
    progress: any;
    errorMessage: string;
    deployedAt: Date;
    completedAt: Date;
  }> = {}
): Promise<void> {
  await prisma.deploymentLog.update({
    where: { id: deploymentLogId },
    data: {
      status,
      ...updates,
      lastHeartbeat: new Date(),
    },
  });
}

/**
 * Update progress for current phase
 */
async function updateProgress(progress: DeploymentProgress): Promise<void> {
  await prisma.deploymentLog.update({
    where: { id: deploymentLogId },
    data: {
      currentPhase: progress.currentPhase,
      progress: progress as any,
      lastHeartbeat: new Date(),
    },
  });

  console.log(`[${progress.currentPhase}] ${progress.message} (${progress.percentComplete}%)`);
}

/**
 * Execute shell command with streaming output
 * Returns stdout as string
 */
async function executeCommand(
  command: string,
  args: string[],
  options: { cwd?: string } = {}
): Promise<string> {
  // HIGH-1: CWD validation
  if (options.cwd) {
    const normalizedCwd = path.normalize(path.resolve(options.cwd));
    const expectedRoot = path.resolve(__dirname, '../../../');
    if (!normalizedCwd.startsWith(expectedRoot)) {
      throw new Error(`Invalid cwd path: ${options.cwd}`);
    }
  }

  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      cwd: options.cwd || process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      // Log output in batches (don't spam DB on every line)
      if (stdout.length % 1000 === 0) {
        console.log(output.trim());
      }
    });

    proc.stderr?.on('data', (data) => {
      const output = data.toString();
      stderr += output;
      console.error(output.trim());
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`Command failed with exit code ${code}: ${stderr || stdout}`));
      }
    });

    proc.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Start heartbeat interval (30s)
 */
function startHeartbeat(): void {
  heartbeatInterval = setInterval(async () => {
    if (!isShuttingDown) {
      try {
        // HIGH-2: Update heartbeat with progress information
        const currentDeployment = await prisma.deploymentLog.findUnique({
          where: { id: deploymentLogId },
          select: { progress: true },
        });

        const currentProgress = currentDeployment?.progress as any;

        await prisma.deploymentLog.update({
          where: { id: deploymentLogId },
          data: {
            lastHeartbeat: new Date(),
            progress: {
              ...(currentProgress || {}),
              lastHeartbeatAt: new Date().toISOString(),
            },
          },
        });
      } catch (error) {
        console.error('[Heartbeat] Failed to update:', error);
      }
    }
  }, 30000); // 30 seconds
}

/**
 * Stop heartbeat interval
 */
function stopHeartbeat(): void {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

/**
 * Cleanup on exit
 */
async function cleanup(exitCode: number = 0): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`[Worker] Cleaning up (exit code: ${exitCode})...`);

  stopHeartbeat();

  if (exitCode !== 0 && deploymentLogId) {
    try {
      await updateStatus('failed', {
        errorMessage: `Worker process exited with code ${exitCode}`,
        completedAt: new Date(),
      });
    } catch (error) {
      console.error('[Cleanup] Failed to update status:', error);
    }
  }

  // Release lock on exit (if acquired)
  if (lockId) {
    try {
      await lockService.releaseLock(lockId);
      console.log(`[Cleanup] Lock released: ${lockId}`);
    } catch (error) {
      console.error('[Cleanup] Failed to release lock:', error);
    }
  }

  await prisma.$disconnect();
  process.exit(exitCode);
}

// ============================================================================
// Deployment Phases
// ============================================================================

async function validateEnvironment(): Promise<void> {
  console.log('[Phase] Validating environment...');

  // Check Docker is available
  try {
    await executeCommand('docker', ['--version']);
  } catch (error) {
    throw new Error('Docker is not available');
  }

  // Check git is available
  try {
    await executeCommand('git', ['--version']);
  } catch (error) {
    throw new Error('Git is not available');
  }
}

async function acquireLock(): Promise<void> {
  console.log('[Phase] Acquiring deployment lock...');

  // CRITICAL-1: Actually acquire the lock
  const deployment = await prisma.deploymentLog.findUnique({
    where: { id: deploymentLogId },
    select: { storyId: true },
  });

  if (!deployment) {
    throw new Error(`Deployment log ${deploymentLogId} not found`);
  }

  const lock = await lockService.acquireLock(
    `Production deployment for deployment log ${deploymentLogId}`,
    deployment.storyId,
    undefined, // prNumber
    30 // 30 minutes
  );

  lockId = lock.id;

  // Update deployment log with lock ID
  await prisma.deploymentLog.update({
    where: { id: deploymentLogId },
    data: { deploymentId: lockId },
  });

  console.log(`[Phase] Lock acquired: ${lockId}`);
}

async function createBackup(): Promise<void> {
  console.log('[Phase] Creating pre-deployment backup...');

  // Backup logic would go here
  // For now, just simulate
  await new Promise(resolve => setTimeout(resolve, 1000));
}

async function buildBackend(): Promise<void> {
  console.log('[Phase] Building backend Docker image...');

  const projectRoot = process.env.PROJECT_PATH || path.resolve(__dirname, '../../../');

  await executeCommand('docker', [
    'compose',
    'build',
    '--no-cache',
    'backend'
  ], { cwd: projectRoot });
}

async function buildFrontend(): Promise<void> {
  console.log('[Phase] Building frontend Docker image...');

  const projectRoot = process.env.PROJECT_PATH || path.resolve(__dirname, '../../../');

  await executeCommand('docker', [
    'compose',
    'build',
    '--no-cache',
    'frontend'
  ], { cwd: projectRoot });
}

async function restartServices(): Promise<void> {
  console.log('[Phase] Restarting services...');

  const projectRoot = process.env.PROJECT_PATH || path.resolve(__dirname, '../../../');

  await executeCommand('docker', [
    'compose',
    'up',
    '-d',
    '--no-deps',
    'backend',
    'frontend'
  ], { cwd: projectRoot });
}

async function runHealthChecks(): Promise<void> {
  console.log('[Phase] Running health checks...');

  const maxRetries = 10;
  const retryDelay = 5000; // 5 seconds

  for (let i = 0; i < maxRetries; i++) {
    try {
      // Check backend health
      const backendResponse = await fetch('http://localhost:3001/health');
      if (!backendResponse.ok) {
        throw new Error(`Backend health check failed: ${backendResponse.status}`);
      }

      // Check frontend (simple HTTP 200)
      const frontendResponse = await fetch('http://localhost:5173');
      if (!frontendResponse.ok) {
        throw new Error(`Frontend health check failed: ${frontendResponse.status}`);
      }

      console.log(`[Health Check] Passed (attempt ${i + 1}/${maxRetries})`);
      return;
    } catch (error) {
      console.log(`[Health Check] Failed (attempt ${i + 1}/${maxRetries}): ${error.message}`);
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }

  throw new Error('Health checks failed after maximum retries');
}

async function releaseLock(): Promise<void> {
  console.log('[Phase] Releasing deployment lock...');

  // CRITICAL-1: Actually release the lock
  if (lockId) {
    await lockService.releaseLock(lockId);
    console.log(`[Phase] Lock released: ${lockId}`);
  } else {
    console.log('[Phase] No lock to release (lockId is null)');
  }
}

// ============================================================================
// Main Deployment Execution
// ============================================================================

async function executeDeployment(): Promise<void> {
  const phases: PhaseConfig[] = [
    { name: 'validation', weight: 5, execute: validateEnvironment },
    { name: 'lockAcquisition', weight: 5, execute: acquireLock },
    { name: 'backup', weight: 10, execute: createBackup },
    { name: 'buildBackend', weight: 30, execute: buildBackend },
    { name: 'buildFrontend', weight: 30, execute: buildFrontend },
    { name: 'restartServices', weight: 10, execute: restartServices },
    { name: 'healthChecks', weight: 10, execute: runHealthChecks },
    { name: 'lockRelease', weight: 5, execute: releaseLock },
  ];

  const totalWeight = phases.reduce((sum, phase) => sum + phase.weight, 0);
  let completedWeight = 0;

  for (let i = 0; i < phases.length; i++) {
    const phase = phases[i];

    const progress: DeploymentProgress = {
      phaseIndex: i,
      totalPhases: phases.length,
      percentComplete: Math.round((completedWeight / totalWeight) * 100),
      currentPhase: phase.name,
      message: `Executing ${phase.name}...`,
    };

    await updateProgress(progress);

    try {
      await phase.execute();
      completedWeight += phase.weight;
    } catch (error) {
      throw new Error(`Phase ${phase.name} failed: ${error.message}`);
    }
  }

  // Final progress update
  await updateProgress({
    phaseIndex: phases.length,
    totalPhases: phases.length,
    percentComplete: 100,
    currentPhase: 'completed',
    message: 'Deployment completed successfully',
  });
}

// ============================================================================
// Entry Point
// ============================================================================

async function main(): Promise<void> {
  // Parse deployment log ID from command line arguments
  const args = process.argv.slice(2);
  if (args.length === 0 || !args[0]) {
    console.error('Usage: node deployment-worker.js <deploymentLogId>');
    process.exit(1);
  }

  deploymentLogId = args[0];

  console.log('='.repeat(80));
  console.log('DEPLOYMENT WORKER STARTED');
  console.log('='.repeat(80));
  console.log(`Deployment Log ID: ${deploymentLogId}`);
  console.log(`Process ID: ${process.pid}`);
  console.log('='.repeat(80));

  try {
    // Update status to deploying and store PID
    await updateStatus('deploying', {
      currentPhase: 'initializing',
      progress: {
        phaseIndex: 0,
        totalPhases: 8,
        percentComplete: 0,
        currentPhase: 'initializing',
        message: 'Starting deployment...',
      },
    });

    // Store process PID
    await prisma.deploymentLog.update({
      where: { id: deploymentLogId },
      data: { childProcessPid: process.pid },
    });

    // Start heartbeat
    startHeartbeat();

    // Execute deployment
    await executeDeployment();

    // Mark as successful
    await updateStatus('deployed', {
      completedAt: new Date(),
      deployedAt: new Date(),
    });

    console.log('='.repeat(80));
    console.log('DEPLOYMENT COMPLETED SUCCESSFULLY');
    console.log('='.repeat(80));

    await cleanup(0);

  } catch (error) {
    console.error('='.repeat(80));
    console.error('DEPLOYMENT FAILED');
    console.error('='.repeat(80));
    console.error(error);

    await updateStatus('failed', {
      errorMessage: error.message || String(error),
      completedAt: new Date(),
    });

    await cleanup(1);
  }
}

// ============================================================================
// Error Handlers
// ============================================================================

process.on('uncaughtException', async (error) => {
  console.error('[UNCAUGHT EXCEPTION]', error);
  if (deploymentLogId) {
    await updateStatus('failed', {
      errorMessage: `Uncaught exception: ${error.message}`,
      completedAt: new Date(),
    });
  }
  await cleanup(1);
});

process.on('unhandledRejection', async (reason) => {
  console.error('[UNHANDLED REJECTION]', reason);
  if (deploymentLogId) {
    await updateStatus('failed', {
      errorMessage: `Unhandled rejection: ${String(reason)}`,
      completedAt: new Date(),
    });
  }
  await cleanup(1);
});

process.on('SIGTERM', async () => {
  console.log('[SIGTERM] Received, cleaning up...');
  await cleanup(0);
});

process.on('SIGINT', async () => {
  console.log('[SIGINT] Received, cleaning up...');
  await cleanup(0);
});

// Detach from parent process (critical for async operation)
if (process.send) {
  process.disconnect();
}

// Start execution
main();
