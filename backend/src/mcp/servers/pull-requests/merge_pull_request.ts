/**
 * Merge Pull Request Tool
 * Merge a GitHub Pull Request with pre-merge validations
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import { NotFoundError, ValidationError } from '../../types';
import type {
  MergePullRequestParams,
  MergePullRequestResponse,
} from '../../types';
import { handlePrismaError } from '../../utils';
import {
  execGitHub,
  getPrFromStory,
  checkPreMergeConditions,
  validateGitHubCLI,
} from './pr_utils';

export const tool: Tool = {
  name: 'merge_pull_request',
  description:
    'Merge a GitHub Pull Request with validation of approvals, checks, and conflicts',
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
      mergeMethod: {
        type: 'string',
        enum: ['merge', 'squash', 'rebase'],
        description: 'Merge strategy (default: squash)',
      },
      deleteBranch: {
        type: 'boolean',
        description: 'Delete branch after merge (default: true)',
      },
      requireApproval: {
        type: 'boolean',
        description: 'Require approval before merge (default: true)',
      },
      requireChecks: {
        type: 'boolean',
        description: 'Require passing CI checks (default: true)',
      },
    },
    required: [],
  },
};

export const metadata = {
  category: 'pull-requests',
  domain: 'development',
  tags: ['github', 'pr', 'merge', 'deploy'],
  version: '1.0.0',
  since: 'sprint-6',
};

/**
 * Merge Pull Request Handler
 *
 * Workflow:
 * 1. Validate parameters and GitHub CLI
 * 2. Resolve PR number from storyId or prNumber
 * 3. Check PR status in database (not already merged)
 * 4. Run pre-merge validations (approval, checks, conflicts)
 * 5. Execute gh pr merge command
 * 6. Update database PR status to 'merged'
 * 7. Return success response with merge details
 */
export async function handler(
  prisma: PrismaClient,
  params: MergePullRequestParams
): Promise<MergePullRequestResponse> {
  try {
    // Validate GitHub CLI availability
    validateGitHubCLI();

    const {
      storyId,
      prNumber: providedPrNumber,
      mergeMethod = 'squash',
      deleteBranch = true,
      requireApproval = true,
      requireChecks = true,
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

    // Check PR status - cannot merge if already merged or closed
    if (prRecord && prRecord.status === 'merged') {
      throw new ValidationError(
        `Pull request #${prNumber} already merged at ${prRecord.updatedAt}`
      );
    }

    if (prRecord && prRecord.status === 'closed') {
      throw new ValidationError(
        `Pull request #${prNumber} is closed. Cannot merge closed PR.`
      );
    }

    // Run pre-merge validations
    const validation = await checkPreMergeConditions(
      prNumber,
      requireApproval,
      requireChecks
    );

    if (!validation.valid) {
      const errorMessage = validation.errors.join('; ');
      let suggestion = '';

      if (errorMessage.includes('not approved')) {
        suggestion =
          'Wait for reviewer approval or use requireApproval=false for admin override';
      } else if (errorMessage.includes('checks failing')) {
        suggestion =
          'Fix failing checks or use requireChecks=false for emergency override';
      } else if (errorMessage.includes('conflicts')) {
        suggestion = 'Resolve conflicts by rebasing on latest main';
      }

      throw new ValidationError(
        `Cannot merge PR #${prNumber}: ${errorMessage}. ${suggestion}`
      );
    }

    // Execute GitHub CLI merge
    let ghOutput: string;
    try {
      const deleteBranchFlag = deleteBranch ? '--delete-branch' : '';
      const command = `gh pr merge ${prNumber} --${mergeMethod} ${deleteBranchFlag}`;
      ghOutput = execGitHub(command);
    } catch (error: any) {
      throw new ValidationError(
        `Failed to merge PR on GitHub: ${error.message}`
      );
    }

    // Parse merge commit SHA from output (if available)
    const shaMatch = ghOutput.match(/([a-f0-9]{40})|([a-f0-9]{7})/);
    const mergeCommitSha = shaMatch ? shaMatch[0] : 'unknown';

    // Update database PR status
    if (prRecord) {
      try {
        await prisma.pullRequest.update({
          where: { id: prRecord.id },
          data: {
            status: 'merged',
            updatedAt: new Date(),
          },
        });
      } catch (dbError) {
        // Log but don't fail - PR is merged on GitHub
        console.error(
          `Failed to update PR status in database: ${dbError}. PR #${prNumber} is merged on GitHub.`
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
      mergeCommitSha,
      mergedAt: new Date().toISOString(),
      branchDeleted: deleteBranch,
      message: `Pull request #${prNumber} merged successfully using ${mergeMethod} strategy`,
    };
  } catch (error: any) {
    if (
      error.name === 'ValidationError' ||
      error.name === 'NotFoundError' ||
      error.name === 'MCPError'
    ) {
      throw error;
    }
    throw handlePrismaError(error, 'merge_pull_request');
  }
}
