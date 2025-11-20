/**
 * MCP Tool: Rebase on Main
 *
 * Rebase worktree branch on latest main with conflict detection and pause mechanism.
 * Handles three outcomes: success, paused (conflicts), and failed (errors).
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient, Prisma } from '@prisma/client';
import {
  NotFoundError,
  ValidationError,
} from '../../types.js';
import {
  validateRequired,
  handlePrismaError,
} from '../../utils.js';
import { execGit, parseGitStatus, validateWorktreePath } from './git_utils.js';

// Tool definition
export const tool: Tool = {
  name: 'mcp__vibestudio__rebase_on_main',
  description: `Rebase worktree branch on latest main with conflict detection and pause mechanism.

This tool safely rebases a story branch on the latest main branch, handling three outcomes:
- Success: Branch cleanly rebased, returns new HEAD commit
- Paused: Conflicts detected, leaves rebase paused for manual resolution
- Failed: Unexpected error, automatically aborts rebase

Features:
- Fetches latest main before rebasing
- Validates clean worktree (no uncommitted changes)
- Creates subtask for manual resolution when conflicts detected
- Updates Story.metadata with rebase status
- Automatic rollback on errors (git rebase --abort)`,
  inputSchema: {
    type: 'object',
    properties: {
      storyId: {
        type: 'string',
        description: 'Story UUID (required)',
      },
      autoAbortOnConflict: {
        type: 'boolean',
        description: 'Auto-abort if conflicts (default: false, leaves rebase paused for manual resolution)',
      },
    },
    required: ['storyId'],
  },
};

export const metadata = {
  category: 'git',
  domain: 'development',
  tags: ['git', 'rebase', 'conflicts', 'resolution'],
  version: '1.0.0',
  since: 'sprint-6',
};

// Types
export interface RebaseOnMainParams {
  storyId: string;
  autoAbortOnConflict?: boolean;
}

export interface RebaseOnMainResult {
  success: boolean;
  status: 'completed' | 'paused' | 'failed';
  newHeadCommit?: string;
  rebasedCommits?: number;
  conflictFiles?: string[];
  message: string;
  actionRequired?: string;
}

/**
 * Check if worktree has uncommitted changes
 */
function validateCleanWorktree(worktreePath: string): void {
  const statusOutput = execGit('git status --porcelain', worktreePath);

  if (statusOutput.trim() !== '') {
    throw new ValidationError(
      `Worktree has uncommitted changes. Commit or stash changes before rebase.\n\nUncommitted files:\n${statusOutput}`
    );
  }
}

/**
 * Parse conflicting files from git status --porcelain output
 * Looks for UU, UA, AU, etc. status codes that indicate conflicts
 */
function parseConflictFiles(statusOutput: string): string[] {
  const conflictFiles: string[] = [];
  const lines = statusOutput.trim().split('\n');

  for (const line of lines) {
    if (!line.trim()) continue;

    const status = line.substring(0, 2);

    // Check for conflict markers (U in either position)
    if (status.includes('U')) {
      // Extract filename (after status code)
      const filename = line.substring(3).trim();
      conflictFiles.push(filename);
    }
  }

  return conflictFiles;
}

/**
 * Count commits to be rebased
 */
function countRebasedCommits(worktreePath: string, baseBranch: string): number {
  try {
    const output = execGit(
      `git log --oneline ${baseBranch}..HEAD`,
      worktreePath
    );
    const lines = output.trim().split('\n').filter(line => line.trim() !== '');
    return lines.length;
  } catch (error) {
    // If log command fails, return 0
    return 0;
  }
}

/**
 * Check if rebase is already in progress
 */
function isRebaseInProgress(worktreePath: string): boolean {
  const rebaseDir = path.join(worktreePath, '.git', 'rebase-apply');
  const rebaseMergeDir = path.join(worktreePath, '.git', 'rebase-merge');

  return fs.existsSync(rebaseDir) || fs.existsSync(rebaseMergeDir);
}

/**
 * Check if stale rebase exists (older than 1 hour)
 */
function isStaleRebase(worktreePath: string): boolean {
  const rebaseDir = path.join(worktreePath, '.git', 'rebase-apply');
  const rebaseMergeDir = path.join(worktreePath, '.git', 'rebase-merge');

  const checkStale = (dir: string): boolean => {
    if (!fs.existsSync(dir)) return false;

    const stats = fs.statSync(dir);
    const ageMs = Date.now() - stats.mtimeMs;
    const oneHourMs = 60 * 60 * 1000;

    return ageMs > oneHourMs;
  };

  return checkStale(rebaseDir) || checkStale(rebaseMergeDir);
}

/**
 * Abort rebase operation
 */
function abortRebase(worktreePath: string): void {
  try {
    execGit('git rebase --abort', worktreePath);
    console.log('Rebase aborted successfully');
  } catch (error: any) {
    console.warn('Failed to abort rebase:', error.message);
  }
}

/**
 * Retry operation with exponential backoff
 */
async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxAttempts: number = 3,
  initialDelay: number = 2000
): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === maxAttempts) throw error;

      const delay = initialDelay * Math.pow(2, attempt - 1);
      console.log(`Retry attempt ${attempt}/${maxAttempts} after ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Retry logic failed');
}

/**
 * Main handler for rebase_on_main tool
 */
export async function handler(
  prisma: PrismaClient,
  params: RebaseOnMainParams
): Promise<RebaseOnMainResult> {
  let rebaseStarted = false;

  try {
    validateRequired(params, ['storyId']);

    const autoAbortOnConflict = params.autoAbortOnConflict || false;

    // 1. Fetch story and worktree from database
    const story = await prisma.story.findUnique({
      where: { id: params.storyId },
      include: {
        worktrees: {
          where: {
            status: { in: ['active', 'idle'] },
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
        },
      },
    });

    if (!story) {
      throw new NotFoundError('Story', params.storyId);
    }

    if (!story.worktrees || story.worktrees.length === 0) {
      throw new NotFoundError(
        'Worktree',
        `No active worktree found for story ${story.key}. Use git_create_worktree to create one.`
      );
    }

    const worktree = story.worktrees[0];
    const worktreePath = worktree.worktreePath;

    // 2. Validate worktree path (security check)
    validateWorktreePath(worktreePath);

    // 3. Check for stale rebase and auto-abort if needed
    if (isRebaseInProgress(worktreePath)) {
      if (isStaleRebase(worktreePath)) {
        console.warn('Detected stale rebase (>1 hour old), aborting...');
        abortRebase(worktreePath);
      } else {
        throw new ValidationError(
          'Rebase already in progress. Complete or abort the current rebase before starting a new one.\n' +
          'To abort: Run `git rebase --abort` in worktree directory'
        );
      }
    }

    // 4. Pre-rebase validation: Check worktree is clean
    validateCleanWorktree(worktreePath);

    console.log(`Starting rebase for ${story.key} on origin/main...`);

    // 5. Fetch latest main with retry logic (network resilience)
    console.log('Fetching latest from origin/main...');
    await retryWithBackoff(async () => {
      execGit('git fetch origin main', worktreePath, 30000);
      return Promise.resolve();
    }, 3, 2000);

    // 6. Execute rebase
    console.log('Rebasing branch on origin/main...');
    rebaseStarted = true;

    try {
      execGit('git rebase origin/main', worktreePath, 60000); // 60 second timeout

      // **SUCCESS PATH**: Rebase completed without conflicts
      const newHeadCommit = execGit('git rev-parse HEAD', worktreePath).trim();
      const rebasedCommits = countRebasedCommits(worktreePath, 'origin/main');

      console.log(`✓ Rebase completed successfully`);
      console.log(`New HEAD: ${newHeadCommit.substring(0, 7)}`);
      console.log(`Rebased commits: ${rebasedCommits}`);

      // Update Story.metadata with success status
      const currentMetadata = (story.metadata as Prisma.JsonObject) || {};
      await prisma.story.update({
        where: { id: params.storyId },
        data: {
          metadata: {
            ...currentMetadata,
            rebaseStatus: {
              status: 'completed',
              lastAttemptAt: new Date().toISOString(),
              completedAt: new Date().toISOString(),
              rebasedCommits,
              newHeadCommit,
            },
          } as Prisma.InputJsonValue,
        },
      });

      return {
        success: true,
        status: 'completed',
        newHeadCommit,
        rebasedCommits,
        message: `Successfully rebased ${story.key} on origin/main. ${rebasedCommits} commit(s) rebased.`,
      };

    } catch (rebaseError: any) {
      const stderr = rebaseError.message || '';

      // Check if this is a conflict (expected outcome, not an error)
      if (stderr.includes('CONFLICT') || rebaseError.status === 1) {
        // **PAUSED PATH**: Conflicts detected during rebase
        console.log('✗ Conflicts detected during rebase');

        // Parse conflict files from git status
        const statusOutput = execGit('git status --porcelain', worktreePath);
        const conflictFiles = parseConflictFiles(statusOutput);

        console.log(`Conflicts in ${conflictFiles.length} file(s):`);
        conflictFiles.forEach(file => console.log(`  - ${file}`));

        // Decide whether to abort or leave paused
        if (autoAbortOnConflict) {
          console.log('Auto-abort enabled, aborting rebase...');
          abortRebase(worktreePath);

          // Update metadata with aborted status
          const currentMetadata = (story.metadata as Prisma.JsonObject) || {};
          await prisma.story.update({
            where: { id: params.storyId },
            data: {
              metadata: {
                ...currentMetadata,
                rebaseStatus: {
                  status: 'failed',
                  lastAttemptAt: new Date().toISOString(),
                  failedAt: new Date().toISOString(),
                  conflictFiles,
                  errorMessage: 'Rebase aborted due to conflicts (auto-abort enabled)',
                },
              } as Prisma.InputJsonValue,
            },
          });

          return {
            success: false,
            status: 'failed',
            conflictFiles,
            message: `Rebase aborted due to conflicts in ${conflictFiles.length} file(s).`,
            actionRequired: 'Resolve conflicts manually or use rebase tool without auto-abort flag',
          };
        }

        // Leave rebase paused for manual resolution
        console.log('Leaving rebase paused for manual resolution');

        // Update Story.metadata with paused status
        const currentMetadata = (story.metadata as Prisma.JsonObject) || {};
        await prisma.story.update({
          where: { id: params.storyId },
          data: {
            metadata: {
              ...currentMetadata,
              rebaseStatus: {
                status: 'paused',
                lastAttemptAt: new Date().toISOString(),
                pausedAt: new Date().toISOString(),
                conflictFiles,
              },
            } as Prisma.InputJsonValue,
          },
        });

        // Update Worktree status to idle
        const worktreeData: any = {
          status: 'idle' as const,
          notes: `Rebase paused due to conflicts. Manual resolution required.`,
        };
        await prisma.worktree.update({
          where: { id: worktree.id },
          data: worktreeData,
        });

        // Create subtask for manual resolution
        await prisma.subtask.create({
          data: {
            storyId: params.storyId,
            title: `Resolve merge conflicts in ${conflictFiles.length} file(s)`,
            description: `Rebase paused due to conflicts. Resolve conflicts in the following files:\n\n${conflictFiles.map(f => `- ${f}`).join('\n')}\n\nAfter resolving:\n1. Stage resolved files: git add <file>\n2. Continue rebase: git rebase --continue\n3. Or abort: git rebase --abort`,
            status: 'todo',
          },
        });

        // Update story status to blocked
        await prisma.story.update({
          where: { id: params.storyId },
          data: {
            status: 'blocked', // Mark story as blocked due to conflicts
          },
        });

        return {
          success: false,
          status: 'paused',
          conflictFiles,
          message: `Rebase paused due to conflicts in ${conflictFiles.length} file(s). Manual resolution required.`,
          actionRequired: `Resolve conflicts in worktree at ${worktreePath}, then continue or abort rebase`,
        };
      }

      // **FAILED PATH**: Unexpected error during rebase
      throw rebaseError;
    }

  } catch (error: any) {
    // Rollback: Abort rebase if it was started
    if (rebaseStarted) {
      console.error('Rebase failed with unexpected error, attempting to abort...');
      try {
        const story = await prisma.story.findUnique({
          where: { id: params.storyId },
          include: {
            worktrees: {
              where: { status: { in: ['active', 'idle'] } },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        });

        if (story?.worktrees?.[0]) {
          abortRebase(story.worktrees[0].worktreePath);

          // Update metadata with failed status
          const currentMetadata = (story.metadata as Prisma.JsonObject) || {};
          await prisma.story.update({
            where: { id: params.storyId },
            data: {
              metadata: {
                ...currentMetadata,
                rebaseStatus: {
                  status: 'failed',
                  lastAttemptAt: new Date().toISOString(),
                  failedAt: new Date().toISOString(),
                  errorMessage: error.message,
                },
              } as Prisma.InputJsonValue,
            },
          });
        }
      } catch (abortError: any) {
        console.error('Failed to abort rebase during rollback:', abortError.message);
      }
    }

    if (error.name === 'MCPError') {
      throw error;
    }
    throw handlePrismaError(error, 'rebase_on_main');
  }
}
