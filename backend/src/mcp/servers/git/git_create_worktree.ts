/**
 * Git Create Worktree Tool
 * Creates a git worktree for a story with automatic branch naming and database tracking
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import {
  NotFoundError,
  ValidationError,
} from '../../types';
import {
  validateRequired,
  handlePrismaError,
} from '../../utils';

export const tool: Tool = {
  name: 'git_create_worktree',
  description: 'Create a git worktree for a story with automatic branch naming and database tracking',
  inputSchema: {
    type: 'object',
    properties: {
      storyId: {
        type: 'string',
        description: 'Story UUID (required)',
      },
      branchName: {
        type: 'string',
        description: 'Git branch name (optional - auto-generated from story key and title if not provided)',
      },
      baseBranch: {
        type: 'string',
        description: 'Base branch to create from (default: main)',
      },
    },
    required: ['storyId'],
  },
};

export const metadata = {
  category: 'git',
  domain: 'development',
  tags: ['git', 'worktree', 'development'],
  version: '1.0.0',
  since: 'sprint-5',
};

interface CreateWorktreeParams {
  storyId: string;
  branchName?: string;
  baseBranch?: string;
}

interface CreateWorktreeResponse {
  worktreeId: string;
  storyId: string;
  branchName: string;
  worktreePath: string;
  baseBranch: string;
  message: string;
}

/**
 * Generate a branch name from story key and title
 */
function generateBranchName(storyKey: string, title: string): string {
  // Convert title to kebab-case and remove special characters
  const sanitizedTitle = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 50); // Limit length

  return `${storyKey.toLowerCase()}-${sanitizedTitle}`.replace(/^-+|-+$/g, '');
}

/**
 * Check available disk space
 */
function checkDiskSpace(pathToCheck: string): number {
  try {
    const df = execSync(`df -BG "${pathToCheck}" | tail -1 | awk '{print $4}'`, {
      encoding: 'utf-8',
    });
    // Remove 'G' and convert to number
    return parseInt(df.replace('G', '').trim());
  } catch (error) {
    throw new Error(`Failed to check disk space: ${error}`);
  }
}

/**
 * Execute git command and return output
 */
function execGit(command: string, cwd?: string): string {
  try {
    return execSync(command, {
      cwd: cwd || '/opt/stack/AIStudio',
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch (error: any) {
    throw new Error(`Git command failed: ${error.message}\nCommand: ${command}`);
  }
}

export async function handler(
  prisma: PrismaClient,
  params: CreateWorktreeParams,
): Promise<CreateWorktreeResponse | { runLocally: true; slashCommand: string; params: CreateWorktreeParams; instructions: string; story: { key: string; title: string } }> {
  try {
    validateRequired(params, ['storyId']);

    // Detect if running remotely via SSH or in Docker (ST-125)
    const isRunningRemotely = !!process.env.SSH_CONNECTION ||
      process.env.VIBESTUDIO_REMOTE === 'true' ||
      !!process.env.DOCKER_CONTAINER ||
      fs.existsSync('/.dockerenv');

    if (isRunningRemotely) {
      // Get story info for the slash command
      const story = await prisma.story.findUnique({
        where: { id: params.storyId },
        select: { key: true, title: true },
      });

      if (!story) {
        throw new NotFoundError('Story', params.storyId);
      }

      return {
        runLocally: true,
        slashCommand: '/git_create_worktree',
        params: {
          storyId: params.storyId,
          branchName: params.branchName,
          baseBranch: params.baseBranch || 'main',
        },
        instructions: `MCP server is running remotely. Use the slash command to create worktree locally:

/git_create_worktree ${params.storyId}

This will:
1. Create the git worktree on your LOCAL machine
2. Record the worktree in the database via record_worktree_created MCP tool

After creating the worktree locally, call record_worktree_created to update the database.`,
        story: { key: story.key, title: story.title },
      };
    }

    const baseBranch = params.baseBranch || 'main';
    const repoPath = '/opt/stack/AIStudio';

    // 1. Verify story exists
    const story = await prisma.story.findUnique({
      where: { id: params.storyId },
      include: {
        project: true,
      },
    });

    if (!story) {
      throw new NotFoundError('Story', params.storyId);
    }

    // 2. Check if worktree already exists for this story
    const existingWorktree = await prisma.worktree.findFirst({
      where: {
        storyId: params.storyId,
        status: { in: ['active', 'idle'] },
      },
    });

    if (existingWorktree) {
      throw new ValidationError(
        `Worktree already exists for story ${story.key} at ${existingWorktree.worktreePath}`
      );
    }

    // 3. Check disk space before creating worktree (ST-54)
    const criticalThresholdGB = parseInt(process.env.DISK_ALERT_CRITICAL_GB || '2', 10);
    const worktreeRoot = process.env.DISK_WORKTREE_ROOT_PATH || '/opt/stack/worktrees';

    try {
      const dfOutput = execSync(`df -BG ${worktreeRoot} | tail -1`, {
        encoding: 'utf-8',
        timeout: 10000,
      });
      const parts = dfOutput.trim().split(/\s+/);
      const availableSpaceGB = parseInt(parts[3].replace('G', ''), 10);

      if (availableSpaceGB < criticalThresholdGB) {
        throw new ValidationError(
          `Insufficient disk space: ${availableSpaceGB}GB available (minimum required: ${criticalThresholdGB}GB). ` +
          `Please cleanup stale worktrees or contact administrator. Use get_disk_usage tool for details.`
        );
      }
    } catch (error: any) {
      // If it's our validation error, re-throw it
      if (error.message.includes('Insufficient disk space')) {
        throw error;
      }
      // Otherwise, log warning but allow worktree creation (df command failed)
      console.warn(`Failed to check disk space: ${error.message}`);
    }

    // 4. Generate or validate branch name
    const branchName = params.branchName || generateBranchName(story.key, story.title);

    // Check if branch already exists
    try {
      execGit(`git rev-parse --verify ${branchName}`, repoPath);
      throw new ValidationError(`Branch ${branchName} already exists`);
    } catch (error: any) {
      // Expected - branch should not exist
      if (!error.message.includes('already exists')) {
        // Branch doesn't exist, which is what we want
      } else {
        throw error;
      }
    }

    // 4. Check disk space (minimum 5GB free)
    const availableGB = checkDiskSpace('/opt/stack');
    if (availableGB < 5) {
      throw new ValidationError(
        `Insufficient disk space. Available: ${availableGB}GB, Required: 5GB`
      );
    }

    // 5. Create git branch from base branch
    execGit(`git fetch origin ${baseBranch}`, repoPath);
    execGit(`git branch ${branchName} origin/${baseBranch}`, repoPath);

    // 6. Create worktree
    // Use ../worktrees directory to avoid permission issues in /opt/stack
    const worktreesDir = '/opt/stack/worktrees';
    if (!fs.existsSync(worktreesDir)) {
      fs.mkdirSync(worktreesDir, { recursive: true, mode: 0o755 });
    }

    const worktreePath = path.join(worktreesDir, branchName);

    // Check if worktree path already exists
    if (fs.existsSync(worktreePath)) {
      // Clean up branch we just created
      execGit(`git branch -D ${branchName}`, repoPath);
      throw new ValidationError(`Worktree path already exists: ${worktreePath}`);
    }

    execGit(`git worktree add ${worktreePath} ${branchName}`, repoPath);

    // 7. Symlink shared node_modules to save disk space
    const sourceNodeModules = path.join(repoPath, 'node_modules');
    const targetNodeModules = path.join(worktreePath, 'node_modules');

    if (fs.existsSync(sourceNodeModules)) {
      if (fs.existsSync(targetNodeModules)) {
        // Remove the directory created by worktree if it exists
        fs.rmSync(targetNodeModules, { recursive: true, force: true });
      }
      fs.symlinkSync(sourceNodeModules, targetNodeModules, 'dir');
    }

    // Also symlink backend and frontend node_modules if they exist
    const backendNodeModules = path.join(repoPath, 'backend/node_modules');
    const frontendNodeModules = path.join(repoPath, 'frontend/node_modules');

    if (fs.existsSync(backendNodeModules)) {
      const targetBackend = path.join(worktreePath, 'backend/node_modules');
      if (fs.existsSync(targetBackend)) {
        fs.rmSync(targetBackend, { recursive: true, force: true });
      }
      fs.symlinkSync(backendNodeModules, targetBackend, 'dir');
    }

    if (fs.existsSync(frontendNodeModules)) {
      const targetFrontend = path.join(worktreePath, 'frontend/node_modules');
      if (fs.existsSync(targetFrontend)) {
        fs.rmSync(targetFrontend, { recursive: true, force: true });
      }
      fs.symlinkSync(frontendNodeModules, targetFrontend, 'dir');
    }

    // 8. Record worktree in database and update story phase
    const worktree = await prisma.worktree.create({
      data: {
        storyId: params.storyId,
        branchName,
        worktreePath,
        baseBranch,
        status: 'active',
      },
    });

    // Update story phase to implementation
    await prisma.story.update({
      where: { id: params.storyId },
      data: {
        currentPhase: 'implementation',
      },
    });

    return {
      worktreeId: worktree.id,
      storyId: params.storyId,
      branchName,
      worktreePath,
      baseBranch,
      message: `Successfully created worktree for ${story.key} at ${worktreePath}`,
    };
  } catch (error: any) {
    if (error.name === 'MCPError') {
      throw error;
    }
    throw handlePrismaError(error, 'git_create_worktree');
  }
}
