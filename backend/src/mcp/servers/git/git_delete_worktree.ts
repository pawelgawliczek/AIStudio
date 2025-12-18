/**
 * Git Delete Worktree Tool
 *
 * Safely deletes a git worktree with proper cleanup:
 * - Removes worktree from filesystem
 * - Deletes git branch (local only)
 * - Updates database status to 'removed'
 * - Clears story.currentPhase
 *
 * Business Requirements (from baAnalysis):
 * - AC3: Delete worktree with filesystem, git, and database cleanup
 * - AC4: Handles errors gracefully
 * - AC5: Formatted data for agent consumption
 *
 * Architecture (from architectAnalysis):
 * - Requires explicit confirmation (confirm: true)
 * - Path validation to prevent deletion outside /opt/stack/worktrees/
 * - Atomic transactions for database updates
 * - Idempotent operations (safe to retry)
 * - CRITICAL: Use status='removed' NOT deletedAt (field doesn't exist)
 */

import { readdirSync, rmdirSync } from 'fs';
import { dirname } from 'path';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import { NotFoundError, ValidationError } from '../../types';
import { validateRequired, handlePrismaError } from '../../utils';
import { execGit, execGitLocationAware, validateWorktreePath, validateBranchName } from './git_utils';

const WORKTREES_ROOT = '/opt/stack/worktrees';

/**
 * Remove empty parent directories up to WORKTREES_ROOT
 */
function cleanupEmptyParentDirs(worktreePath: string): string[] {
  const cleaned: string[] = [];
  let dir = dirname(worktreePath);

  while (dir.startsWith(WORKTREES_ROOT) && dir !== WORKTREES_ROOT) {
    try {
      const contents = readdirSync(dir);
      if (contents.length === 0) {
        rmdirSync(dir);
        cleaned.push(dir);
        dir = dirname(dir);
      } else {
        break; // Directory not empty
      }
    } catch {
      break; // Can't read/remove, stop
    }
  }
  return cleaned;
}

export const tool: Tool = {
  name: 'git_delete_worktree',
  description: 'Delete a git worktree with proper cleanup (filesystem, git branch, database). Requires explicit confirmation.',
  inputSchema: {
    type: 'object',
    properties: {
      storyId: {
        type: 'string',
        description: 'Story UUID (required)',
      },
      worktreeId: {
        type: 'string',
        description: 'Specific worktree ID (optional - if story has multiple)',
      },
      confirm: {
        type: 'boolean',
        description: 'Must be set to true to confirm deletion (required)',
      },
      deleteBranch: {
        type: 'boolean',
        description: 'Delete git branch (local only) - default: true',
      },
      forceDelete: {
        type: 'boolean',
        description: 'Force delete even with uncommitted changes - default: false',
      },
      preserveDatabase: {
        type: 'boolean',
        description: 'Keep database record with status=removed instead of deleting - default: true',
      },
      target: {
        type: 'string',
        enum: ['auto', 'laptop', 'kvm'],
        description: 'ST-153: Override target host for git execution (default: auto-detect from worktree hostType)',
      },
    },
    required: ['storyId', 'confirm'],
  },
};

export const metadata = {
  category: 'git',
  domain: 'development',
  tags: ['git', 'worktree', 'delete', 'cleanup'],
  version: '1.0.0',
  since: 'sprint-5',
};

interface DeleteWorktreeParams {
  storyId: string;
  worktreeId?: string;
  confirm: boolean;
  deleteBranch?: boolean;
  forceDelete?: boolean;
  preserveDatabase?: boolean;
  target?: 'auto' | 'laptop' | 'kvm';
}

interface DeleteActions {
  filesystemRemoved: boolean;
  emptyDirsRemoved: string[];
  branchDeleted: boolean;
  databaseUpdated: boolean;
  databaseDeleted: boolean;
}

interface DeleteWorktreeResponse {
  id: string;
  storyId: string;
  storyKey: string;
  storyTitle: string;
  branchName: string;
  worktreePath: string;
  actions: DeleteActions;
  warnings?: string[];
  message: string;
  executedOn?: 'kvm' | 'laptop';
}

export async function handler(
  prisma: PrismaClient,
  params: DeleteWorktreeParams,
): Promise<DeleteWorktreeResponse> {
  try {
    validateRequired(params as unknown as Record<string, unknown>, ['storyId']);

    // Require explicit confirmation (check both presence and value)
    if (params.confirm === undefined || params.confirm === null) {
      throw new ValidationError('Missing required fields: confirm');
    }
    if (params.confirm !== true) {
      throw new ValidationError(
        'Deletion requires explicit confirmation. Set confirm: true to proceed.'
      );
    }

    // Default values
    const deleteBranch = params.deleteBranch !== false; // Default true
    const forceDelete = params.forceDelete === true;   // Default false
    const preserveDatabase = params.preserveDatabase !== false; // Default true

    let repoPath = '/opt/stack/AIStudio'; // Default KVM path
    let executedOn: 'kvm' | 'laptop' | undefined;

    // Build where clause
    const whereClause: any = { storyId: params.storyId };
    if (params.worktreeId) {
      whereClause.id = params.worktreeId;
    }

    // Find worktree (include removed for idempotency)
    const worktree = await prisma.worktree.findFirst({
      where: whereClause,
      include: {
        story: {
          select: {
            key: true,
            title: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' }, // Most recent if multiple
    });

    if (!worktree) {
      throw new NotFoundError('Worktree', params.storyId);
    }

    // Validate worktree path for security (ST-158: pass hostType for laptop worktrees)
    validateWorktreePath(worktree.worktreePath, worktree.hostType || undefined);
    validateBranchName(worktree.branchName);

    // ST-158: Determine target and get correct repo path
    const effectiveTarget = params.target || (worktree.hostType === 'local' ? 'laptop' : 'kvm');
    if (effectiveTarget === 'laptop') {
      // Query agent config for laptop project path
      const agent = await prisma.remoteAgent.findFirst({
        where: {
          status: 'online',
          capabilities: { has: 'git-execute' },
        },
      });
      if (agent) {
        const agentConfig = (agent.config as Record<string, unknown>) || {};
        repoPath = (agentConfig.projectPath as string) || '/Users/pawelgawliczek/projects/AIStudio';
      } else {
        // Fallback to laptop default if agent offline
        repoPath = '/Users/pawelgawliczek/projects/AIStudio';
      }
      console.log(`[ST-158] Deleting worktree on laptop, using repoPath: ${repoPath}`);
    }

    // Track actions and warnings
    const actions: DeleteActions = {
      filesystemRemoved: false,
      emptyDirsRemoved: [],
      branchDeleted: false,
      databaseUpdated: false,
      databaseDeleted: false,
    };
    const warnings: string[] = [];

    // Step 1: Remove worktree from filesystem (ST-153: location-aware)
    try {
      const forceFlag = forceDelete ? '--force' : '';
      const result = await execGitLocationAware(
        `git worktree remove ${forceFlag} "${worktree.worktreePath}"`,
        repoPath,
        {
          storyId: params.storyId,
          worktreeId: worktree.id,
          target: params.target || 'auto',
          prisma,
        }
      );
      executedOn = result.executedOn;
      if (!result.success) {
        throw new Error(result.error || 'Failed to remove worktree');
      }
      actions.filesystemRemoved = true;
    } catch (error: any) {
      const errorMsg = error.message.toLowerCase();

      // Check if worktree already removed (idempotent)
      if (errorMsg.includes('not found') || errorMsg.includes('is not a working tree')) {
        warnings.push(`Worktree already removed from filesystem: ${worktree.worktreePath}`);
        actions.filesystemRemoved = true; // Consider it success
      } else if (errorMsg.includes('uncommitted changes') || errorMsg.includes('modified files')) {
        throw new ValidationError(
          `Cannot delete worktree with uncommitted changes. Use forceDelete: true to override.\n` +
          `Worktree: ${worktree.worktreePath}`
        );
      } else {
        throw new Error(`Failed to remove worktree: ${error.message}`);
      }
    }

    // Step 1b: Cleanup empty parent directories
    if (actions.filesystemRemoved) {
      actions.emptyDirsRemoved = cleanupEmptyParentDirs(worktree.worktreePath);
    }

    // Step 2: Delete git branch (local only) - ST-153: location-aware
    if (deleteBranch) {
      try {
        const branchResult = await execGitLocationAware(
          `git branch -D ${worktree.branchName}`,
          repoPath,
          {
            storyId: params.storyId,
            worktreeId: worktree.id,
            target: params.target || 'auto',
            prisma,
          }
        );
        if (!executedOn) executedOn = branchResult.executedOn;
        if (!branchResult.success) {
          throw new Error(branchResult.error || 'Failed to delete branch');
        }
        actions.branchDeleted = true;
      } catch (error: any) {
        const errorMsg = error.message.toLowerCase();

        // Check if branch already deleted (idempotent)
        if (errorMsg.includes('not found') || errorMsg.includes('no such ref')) {
          warnings.push(`Branch already deleted: ${worktree.branchName}`);
          actions.branchDeleted = true; // Consider it success
        } else {
          // Non-fatal: branch deletion failed but continue
          warnings.push(`Failed to delete branch ${worktree.branchName}: ${error.message}`);
        }
      }
    }

    // Step 3: Update database (atomic transaction)
    await prisma.$transaction(async (tx) => {
      if (preserveDatabase) {
        // Soft delete: Update status to 'removed'
        // CRITICAL: Use status='removed' NOT deletedAt (field doesn't exist)
        await tx.worktree.update({
          where: { id: worktree.id },
          data: {
            status: 'removed',
            updatedAt: new Date(),
          },
        });
        actions.databaseUpdated = true;
      } else {
        // Hard delete: Remove from database
        await tx.worktree.delete({
          where: { id: worktree.id },
        });
        actions.databaseDeleted = true;
      }

      // Clear story's currentPhase if this was the active worktree
      if (worktree.status === 'active') {
        await tx.story.update({
          where: { id: worktree.storyId },
          data: {
            currentPhase: null,
          },
        });
      }
    });

    // Build success message
    let message = `Successfully deleted worktree for ${worktree.story.key}`;
    if (actions.filesystemRemoved) message += '\n- Removed from filesystem';
    if (actions.emptyDirsRemoved.length > 0) message += `\n- Cleaned empty dirs: ${actions.emptyDirsRemoved.join(', ')}`;
    if (actions.branchDeleted) message += `\n- Deleted branch: ${worktree.branchName}`;
    if (actions.databaseUpdated) message += '\n- Updated database (status: removed)';
    if (actions.databaseDeleted) message += '\n- Removed from database';
    if (warnings.length > 0) {
      message += `\n\nWarnings:\n${warnings.map(w => `- ${w}`).join('\n')}`;
    }

    return {
      id: worktree.id,
      storyId: worktree.storyId,
      storyKey: worktree.story.key,
      storyTitle: worktree.story.title,
      branchName: worktree.branchName,
      worktreePath: worktree.worktreePath,
      actions,
      warnings: warnings.length > 0 ? warnings : undefined,
      message,
      executedOn,
    };
  } catch (error: any) {
    if (error.name === 'MCPError') {
      throw error;
    }
    throw handlePrismaError(error, 'git_delete_worktree');
  }
}
