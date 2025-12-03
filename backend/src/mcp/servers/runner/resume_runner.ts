/**
 * Resume Runner Tool
 * Resume a paused or crashed Story Runner execution
 *
 * ST-145: Story Runner - Terminal First Implementation
 */

import { spawn } from 'child_process';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';

export const tool: Tool = {
  name: 'resume_runner',
  description: `Resume a paused or crashed Story Runner execution.

Resumes from the last checkpoint:
1. Loads checkpoint from database
2. Restores Master CLI session
3. Continues from current state/phase
4. Preserves resource usage counts

**When to use:**
- After manual pause via pause_runner
- After crash/timeout recovery
- After resolving a blocking error

**Usage:**
\`\`\`typescript
resume_runner({ runId: "uuid-here" })
\`\`\``,
  inputSchema: {
    type: 'object',
    properties: {
      runId: {
        type: 'string',
        description: 'WorkflowRun ID to resume (required)',
      },
      detached: {
        type: 'boolean',
        description: 'Run in background (default: true)',
      },
    },
    required: ['runId'],
  },
};

export const metadata = {
  category: 'runner',
  domain: 'Story Runner',
  tags: ['runner', 'resume', 'recovery'],
  version: '1.0.0',
  since: '2025-11-29',
};

export async function handler(prisma: PrismaClient, params: {
  runId: string;
  detached?: boolean;
}) {
  const { runId, detached = true } = params;

  // Get workflow run
  const run = await prisma.workflowRun.findUnique({
    where: { id: runId },
    include: {
      workflow: true,
    },
  });

  if (!run) {
    throw new Error(`WorkflowRun not found: ${runId}`);
  }

  // Check if run can be resumed
  if (!['paused', 'failed', 'running'].includes(run.status)) {
    throw new Error(`Cannot resume run with status: ${run.status}. Only paused, failed, or running (crashed) runs can be resumed.`);
  }

  // Check for checkpoint
  const metadata = run.metadata as Record<string, unknown> | null;
  const checkpoint = metadata?.checkpoint;

  if (!checkpoint) {
    throw new Error(`No checkpoint found for run ${runId}. Cannot resume without checkpoint.`);
  }

  // Build Docker command
  const args = [
    'compose',
    '-f', 'runner/docker-compose.runner.yml',
    'run',
    '--rm',
  ];

  if (detached) {
    args.push('-d');
  }

  args.push(
    'runner',
    'resume',
    '--run-id', runId,
  );

  // Spawn Docker process
  const dockerProcess = spawn('docker', args, {
    cwd: process.env.PROJECT_PATH || '/opt/stack/AIStudio',
    stdio: 'pipe',
    detached: detached,
  });

  // Update run status
  await prisma.workflowRun.update({
    where: { id: runId },
    data: {
      status: 'running',
      isPaused: false,
      pauseReason: null,
    },
  });

  if (detached) {
    return {
      success: true,
      runId,
      status: 'resuming',
      message: `Story Runner resuming for run ${runId}. Use get_runner_status to monitor progress.`,
      command: `docker ${args.join(' ')}`,
    };
  }

  // For attached mode, wait for completion
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';

    dockerProcess.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    dockerProcess.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    dockerProcess.on('exit', async (code) => {
      if (code === 0) {
        resolve({
          success: true,
          runId,
          status: 'completed',
          message: `Story Runner completed successfully after resume`,
          stdout,
        });
      } else {
        reject(new Error(`Story Runner failed with code ${code}: ${stderr}`));
      }
    });

    dockerProcess.on('error', (error) => {
      reject(new Error(`Failed to resume Story Runner: ${error.message}`));
    });
  });
}
