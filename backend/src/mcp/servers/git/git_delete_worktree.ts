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

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import { NotFoundError, ValidationError } from '../../types';
import { validateRequired, handlePrismaError } from '../../utils';
import { execGit, validateWorktreePath, validateBranchName } from './git_utils';

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
}

interface DeleteActions {
  filesystemRemoved: boolean;
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
}

export async function handler(
  prisma: PrismaClient,
  params: DeleteWorktreeParams,
): Promise<DeleteWorktreeResponse> {
  try {
    validateRequired(params, ['storyId']);

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

    const repoPath = '/opt/stack/AIStudio';

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

    // Validate worktree path for security
    validateWorktreePath(worktree.worktreePath);
    validateBranchName(worktree.branchName);

    // Track actions and warnings
    const actions: DeleteActions = {
      filesystemRemoved: false,
      branchDeleted: false,
      databaseUpdated: false,
      databaseDeleted: false,
    };
    const warnings: string[] = [];

    // Step 1: Remove worktree from filesystem
    try {
      const forceFlag = forceDelete ? '--force' : '';
      execGit(`git worktree remove ${forceFlag} "${worktree.worktreePath}"`, repoPath);
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

    // Step 2: Delete git branch (local only)
    if (deleteBranch) {
      try {
        execGit(`git branch -D ${worktree.branchName}`, repoPath);
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
    };
  } catch (error: any) {
    if (error.name === 'MCPError') {
      throw error;
    }
    throw handlePrismaError(error, 'git_delete_worktree');
  }
}
