/**
 * Close Pull Request Tool
 * Close a GitHub Pull Request without merging (for cancelled/abandoned stories)
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import { NotFoundError, ValidationError } from '../../types';
import type {
  ClosePullRequestParams,
  ClosePullRequestResponse,
} from '../../types';
import { handlePrismaError } from '../../utils';
import {
  execGitHub,
  getPrFromStory,
  validateGitHubCLI,
  sanitizeInput,
} from './pr_utils';

export const tool: Tool = {
  name: 'close_pull_request',
  description:
    'Close a GitHub Pull Request without merging (for cancelled or abandoned stories)',
  inputSchema: {
    type: 'object',
    properties: {
      storyId: {
        type: 'string',
        description: 'Story UUID (optional - lookup PR by story)',
      },
      prNumber: {
        type: 'number',
        description: 'GitHub PR number (optional)',
      },
      reason: {
        type: 'string',
        description: 'Reason for closing (optional - stored in database)',
      },
      comment: {
        type: 'string',
        description: 'Comment to add to PR before closing (optional)',
      },
      deleteBranch: {
        type: 'boolean',
        description: 'Delete branch after closing (default: false)',
      },
    },
    required: [],
  },
};

export const metadata = {
  category: 'pull-requests',
  domain: 'development',
  tags: ['github', 'pr', 'close', 'cancel'],
  version: '1.0.0',
  since: 'sprint-6',
};

/**
 * Close Pull Request Handler
 *
 * Workflow:
 * 1. Validate parameters and GitHub CLI
 * 2. Resolve PR number from storyId or prNumber
 * 3. Check PR status in database (not already merged or closed)
 * 4. Add comment to PR if provided
 * 5. Execute gh pr close command
 * 6. Update database PR status to 'closed'
 * 7. Return success response
 */
export async function handler(
  prisma: PrismaClient,
  params: ClosePullRequestParams
): Promise<ClosePullRequestResponse> {
  try {
    // Validate GitHub CLI availability
    validateGitHubCLI();

    const {
      storyId,
      prNumber: providedPrNumber,
      reason,
      comment,
      deleteBranch = false,
    } = params;

    // Validate at least one identifier provided
    if (!storyId && !providedPrNumber) {
      throw new ValidationError(
        'Either storyId or prNumber must be provided'
      );
    }

    // Resolve PR number and get database record
    let prNumber: number;
    let prRecord: any;

    if (storyId) {
      prRecord = await getPrFromStory(prisma, storyId);
      prNumber = prRecord.prNumber;
    } else if (providedPrNumber) {
      prNumber = providedPrNumber;
      // Try to find PR in database (optional)
      prRecord = await prisma.pullRequest.findFirst({
        where: { prNumber },
      });
    } else {
      throw new ValidationError('Unable to resolve PR');
    }

    // Check PR status - cannot close if already merged
    if (prRecord && prRecord.status === 'merged') {
      throw new ValidationError(
        `Pull request #${prNumber} is already merged. Cannot close merged PR.`
      );
    }

    if (prRecord && prRecord.status === 'closed') {
      throw new ValidationError(
        `Pull request #${prNumber} is already closed.`
      );
    }

    // Add comment if provided
    if (comment) {
      try {
        const sanitizedComment = sanitizeInput(comment);
        execGitHub(`gh pr comment ${prNumber} --body "${sanitizedComment}"`);
      } catch (error: any) {
        // Log but don't fail - closing is more important
        console.error(`Failed to add comment to PR: ${error.message}`);
      }
    }

    // Execute GitHub CLI close
    try {
      const deleteBranchFlag = deleteBranch ? '--delete-branch' : '';
      const command = `gh pr close ${prNumber} ${deleteBranchFlag}`;
      execGitHub(command);
    } catch (error: any) {
      throw new ValidationError(
        `Failed to close PR on GitHub: ${error.message}`
      );
    }

    // Update database PR status
    if (prRecord) {
      try {
        await prisma.pullRequest.update({
          where: { id: prRecord.id },
          data: {
            status: 'closed',
            updatedAt: new Date(),
            // Store reason in description if provided
            description: reason
              ? `${prRecord.description}\n\n---\n**Closed Reason**: ${reason}`
              : prRecord.description,
          },
        });
      } catch (dbError) {
        // Log but don't fail - PR is closed on GitHub
        console.error(
          `Failed to update PR status in database: ${dbError}. PR #${prNumber} is closed on GitHub.`
        );
      }
    }

    // Get PR URL
    const prUrl = prRecord
      ? prRecord.prUrl
      : `https://github.com/${process.env.GITHUB_REPOSITORY || 'org/repo'}/pull/${prNumber}`;

    // Return success response
    return {
      success: true,
      prNumber,
      prUrl,
      closedAt: new Date().toISOString(),
      reason,
      branchDeleted: deleteBranch,
      message: `Pull request #${prNumber} closed successfully${reason ? `: ${reason}` : ''}`,
    };
  } catch (error: any) {
    if (
      error.name === 'ValidationError' ||
      error.name === 'NotFoundError' ||
      error.name === 'MCPError'
    ) {
      throw error;
    }
    throw handlePrismaError(error, 'close_pull_request');
  }
}
