/**
 * Start Runner Tool
 * Launches the Story Runner Docker container for a workflow run
 *
 * ST-145: Story Runner - Terminal First Implementation
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import { spawn } from 'child_process';

export const tool: Tool = {
  name: 'start_runner',
  description: `Start the Story Runner for a workflow run.

Launches a Docker container that:
1. Loads workflow and states from backend
2. Starts persistent Master CLI session
3. Executes states sequentially (pre → agent → post)
4. Saves checkpoints for crash recovery
5. Reports status back to backend

**Prerequisites:**
- Workflow must have states defined
- WorkflowRun must exist (use start_team_run first)
- Docker must be available

**Usage:**
\`\`\`typescript
start_runner({
  runId: "uuid-here",
  workflowId: "workflow-uuid",
  storyId: "story-uuid"  // optional
})
\`\`\``,
  inputSchema: {
    type: 'object',
    properties: {
      runId: {
        type: 'string',
        description: 'WorkflowRun ID to execute (required)',
      },
      workflowId: {
        type: 'string',
        description: 'Workflow ID (required)',
      },
      storyId: {
        type: 'string',
        description: 'Story ID for context (optional)',
      },
      triggeredBy: {
        type: 'string',
        description: 'User/agent that triggered the run (default: "mcp-tool")',
      },
      detached: {
        type: 'boolean',
        description: 'Run in background (default: true)',
      },
    },
    required: ['runId', 'workflowId'],
  },
};

export const metadata = {
  category: 'runner',
  domain: 'Story Runner',
  tags: ['runner', 'start', 'workflow', 'docker'],
  version: '1.0.0',
  since: '2025-11-29',
};

export async function handler(prisma: PrismaClient, params: {
  runId: string;
  workflowId: string;
  storyId?: string;
  triggeredBy?: string;
  detached?: boolean;
}) {
  const { runId, workflowId, storyId, triggeredBy = 'mcp-tool', detached = true } = params;

  // Validate workflow exists
  const workflow = await prisma.workflow.findUnique({
    where: { id: workflowId },
    include: {
      states: true,
    },
  });

  if (!workflow) {
    throw new Error(`Workflow not found: ${workflowId}`);
  }

  if (workflow.states.length === 0) {
    throw new Error(`Workflow has no states defined: ${workflowId}`);
  }

  // Validate run exists
  const run = await prisma.workflowRun.findUnique({
    where: { id: runId },
  });

  if (!run) {
    throw new Error(`WorkflowRun not found: ${runId}`);
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
    'start',
    '--run-id', runId,
    '--workflow-id', workflowId,
  );

  if (storyId) {
    args.push('--story-id', storyId);
  }

  args.push('--triggered-by', triggeredBy);

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
      startedAt: new Date(),
    },
  });

  if (detached) {
    // For detached mode, return immediately
    return {
      success: true,
      runId,
      workflowId,
      storyId,
      status: 'started',
      message: `Story Runner started for run ${runId}. Use get_runner_status to monitor progress.`,
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
          workflowId,
          storyId,
          status: 'completed',
          message: `Story Runner completed successfully`,
          stdout,
        });
      } else {
        reject(new Error(`Story Runner failed with code ${code}: ${stderr}`));
      }
    });

    dockerProcess.on('error', (error) => {
      reject(new Error(`Failed to start Story Runner: ${error.message}`));
    });
  });
}
