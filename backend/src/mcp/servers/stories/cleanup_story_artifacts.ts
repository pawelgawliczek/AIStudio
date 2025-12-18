/**
 * Cleanup Story Artifacts Tool
 *
 * Comprehensive cleanup tool for stories after PR merge or cancellation.
 * Performs safe cleanup of all story-related artifacts:
 * - Removes worktree from filesystem
 * - Deletes local git branch
 * - Updates Worktree status to 'removed'
 * - Removes from test queue if present
 * - Updates Story.currentPhase to 'done'
 *
 * Safety Requirements (ST-47):
 * - Only cleanup if PR is merged OR story is cancelled
 * - Preserves all database records (status updates only, no deletions)
 * - Returns comprehensive cleanup summary
 * - Idempotent operations (safe to retry)
 *
 * Business Requirements:
 * - AC1-AC10: Complete artifact cleanup with safety checks
 * - Prevents accidental cleanup of active development
 * - Maintains audit trail through database records
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import { NotFoundError, ValidationError } from '../../types';
import { validateRequired, handlePrismaError } from '../../utils';
import { execGit, validateWorktreePath, validateBranchName } from '../git/git_utils';

export const tool: Tool = {
  name: 'cleanup_story_artifacts',
  description:
    'Cleanup worktrees and artifacts after story completion. Only works if PR is merged or story is cancelled. Removes worktree, deletes branch, updates database records.',
  inputSchema: {
    type: 'object',
    properties: {
      storyId: {
        type: 'string',
        description: 'Story UUID (required)',
      },
      forceCleanup: {
        type: 'boolean',
        description:
          'Skip safety checks (USE WITH CAUTION - bypasses PR merge validation). Default: false',
      },
    },
    required: ['storyId'],
  },
};

export const metadata = {
  category: 'stories',
  domain: 'development',
  tags: ['cleanup', 'worktree', 'test-queue', 'lifecycle', 'automation'],
  version: '1.0.0',
  since: 'sprint-6',
};

interface CleanupStoryArtifactsParams {
  storyId: string;
  forceCleanup?: boolean;
}

interface CleanupActions {
  worktreeRemoved: boolean;
  branchDeleted: boolean;
  worktreeStatusUpdated: boolean;
  testQueueRemoved: boolean;
  storyPhaseUpdated: boolean;
}

interface CleanupStoryArtifactsResponse {
  storyId: string;
  storyKey: string;
  storyTitle: string;
  actions: CleanupActions;
  warnings: string[];
  safetyChecksPassed: boolean;
  message: string;
}

/**
 * Cleanup Story Artifacts Handler
 *
 * Workflow:
 * 1. Validate story exists
 * 2. Safety check: Verify PR is merged OR story is cancelled
 * 3. Find and cleanup worktree (filesystem + git branch)
 * 4. Remove from test queue if present
 * 5. Update database records (status updates only)
 * 6. Return cleanup summary
 */
export async function handler(
  prisma: PrismaClient,
  params: CleanupStoryArtifactsParams
): Promise<CleanupStoryArtifactsResponse> {
  try {
    validateRequired(params as unknown as Record<string, unknown>, ['storyId']);

    const forceCleanup = params.forceCleanup === true;
    const repoPath = '/opt/stack/AIStudio';

    // Track actions and warnings
    const actions: CleanupActions = {
      worktreeRemoved: false,
      branchDeleted: false,
      worktreeStatusUpdated: false,
      testQueueRemoved: false,
      storyPhaseUpdated: false,
    };
    const warnings: string[] = [];

    // Step 1: Fetch story with related data
    const story = await prisma.story.findUnique({
      where: { id: params.storyId },
      include: {
        pullRequests: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        worktrees: {
          where: {
            status: { in: ['active', 'idle', 'cleaning'] }, // Only active worktrees
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!story) {
      throw new NotFoundError('Story', params.storyId);
    }

    // Step 2: Safety Check - Verify PR is merged OR story is cancelled
    let safetyChecksPassed = false;
    if (!forceCleanup) {
      const pr = story.pullRequests[0];
      const isCancelled = story.status === 'planning' && !pr; // Story never progressed

      if (pr && pr.status === 'merged') {
        safetyChecksPassed = true;
      } else if (isCancelled) {
        safetyChecksPassed = true;
        warnings.push('Story appears to be cancelled (no PR found)');
      } else {
        const prStatus = pr ? pr.status : 'no PR';
        throw new ValidationError(
          `Safety check failed: PR must be merged or story must be cancelled.\n` +
            `Current PR status: ${prStatus}\n` +
            `Story status: ${story.status}\n` +
            `Use forceCleanup: true to bypass this check (USE WITH CAUTION)`
        );
      }
    } else {
      safetyChecksPassed = false;
      warnings.push('Safety checks bypassed with forceCleanup flag');
    }

    // Step 3: Cleanup worktree if exists
    const worktree = story.worktrees[0];
    if (worktree) {
      // Validate worktree path for security
      validateWorktreePath(worktree.worktreePath);
      validateBranchName(worktree.branchName);

      // Step 3a: Remove worktree from filesystem
      try {
        execGit(`git worktree remove --force "${worktree.worktreePath}"`, repoPath);
        actions.worktreeRemoved = true;
      } catch (error: any) {
        const errorMsg = error.message.toLowerCase();
        if (
          errorMsg.includes('not found') ||
          errorMsg.includes('is not a working tree')
        ) {
          warnings.push(
            `Worktree already removed from filesystem: ${worktree.worktreePath}`
          );
          actions.worktreeRemoved = true; // Consider it success (idempotent)
        } else {
          warnings.push(`Failed to remove worktree: ${error.message}`);
        }
      }

      // Step 3b: Delete git branch
      try {
        execGit(`git branch -D ${worktree.branchName}`, repoPath);
        actions.branchDeleted = true;
      } catch (error: any) {
        const errorMsg = error.message.toLowerCase();
        if (errorMsg.includes('not found') || errorMsg.includes('no such ref')) {
          warnings.push(`Branch already deleted: ${worktree.branchName}`);
          actions.branchDeleted = true; // Consider it success (idempotent)
        } else {
          warnings.push(`Failed to delete branch: ${error.message}`);
        }
      }

      // Step 3c: Update worktree status in database
      try {
        await prisma.worktree.update({
          where: { id: worktree.id },
          data: {
            status: 'removed',
            updatedAt: new Date(),
          },
        });
        actions.worktreeStatusUpdated = true;
      } catch (error: any) {
        warnings.push(`Failed to update worktree status: ${error.message}`);
      }
    } else {
      warnings.push('No active worktree found for cleanup');
    }

    // Step 4: Remove from test queue if present
    const testQueueEntry = await prisma.testQueue.findFirst({
      where: {
        storyId: params.storyId,
        status: { in: ['pending', 'running'] },
      },
    });

    if (testQueueEntry) {
      try {
        await prisma.testQueue.update({
          where: { id: testQueueEntry.id },
          data: { status: 'cancelled' },
        });
        actions.testQueueRemoved = true;
      } catch (error: any) {
        warnings.push(`Failed to remove from test queue: ${error.message}`);
      }
    } else {
      // Check if already completed/cancelled
      const anyQueueEntry = await prisma.testQueue.findFirst({
        where: { storyId: params.storyId },
        orderBy: { createdAt: 'desc' },
      });
      if (anyQueueEntry) {
        warnings.push(
          `Story not in active test queue (status: ${anyQueueEntry.status})`
        );
      } else {
        warnings.push('Story was never added to test queue');
      }
    }

    // Step 5: Update Story.currentPhase to 'done'
    try {
      await prisma.story.update({
        where: { id: params.storyId },
        data: {
          currentPhase: 'done',
          updatedAt: new Date(),
        },
      });
      actions.storyPhaseUpdated = true;
    } catch (error: any) {
      warnings.push(`Failed to update story phase: ${error.message}`);
    }

    // Build success message
    let message = `Successfully cleaned up artifacts for ${story.key}: ${story.title}`;
    if (actions.worktreeRemoved) message += '\n- Removed worktree from filesystem';
    if (actions.branchDeleted) message += `\n- Deleted branch: ${worktree?.branchName}`;
    if (actions.worktreeStatusUpdated)
      message += '\n- Updated worktree status to removed';
    if (actions.testQueueRemoved) message += '\n- Removed from test queue';
    if (actions.storyPhaseUpdated) message += '\n- Updated story phase to done';

    if (warnings.length > 0) {
      message += `\n\nWarnings (${warnings.length}):\n${warnings.map((w) => `- ${w}`).join('\n')}`;
    }

    return {
      storyId: story.id,
      storyKey: story.key,
      storyTitle: story.title,
      actions,
      warnings,
      safetyChecksPassed,
      message,
    };
  } catch (error: any) {
    if (error.name === 'MCPError') {
      throw error;
    }
    throw handlePrismaError(error, 'cleanup_story_artifacts');
  }
}
