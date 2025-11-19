/**
 * Create Pull Request Tool
 * Creates a GitHub Pull Request and tracks it in the database
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import { NotFoundError, ValidationError } from '../../types';
import { validateRequired, handlePrismaError } from '../../utils';
import {
  execGitHub,
  parsePrNumber,
  parsePrUrl,
  generatePrTitle,
  generatePrDescription,
  validateGitHubCLI,
  sanitizeInput,
} from './pr_utils';
import type {
  CreatePullRequestParams,
  CreatePullRequestResponse,
} from '../../types';

export const tool: Tool = {
  name: 'create_pull_request',
  description:
    'Create a GitHub Pull Request for a story with auto-generated title and description',
  inputSchema: {
    type: 'object',
    properties: {
      storyId: {
        type: 'string',
        description: 'Story UUID (required)',
      },
      title: {
        type: 'string',
        description: 'PR title (optional - auto-generated from story if not provided)',
      },
      description: {
        type: 'string',
        description:
          'PR description (optional - auto-generated from story and commits if not provided)',
      },
      draft: {
        type: 'boolean',
        description: 'Create as draft PR (default: false)',
      },
      baseBranch: {
        type: 'string',
        description: 'Base branch to merge into (default: main)',
      },
    },
    required: ['storyId'],
  },
};

export const metadata = {
  category: 'pull-requests',
  domain: 'development',
  tags: ['github', 'pr', 'pull-request', 'code-review'],
  version: '1.0.0',
  since: 'sprint-6',
};

/**
 * Create Pull Request Handler
 *
 * Workflow:
 * 1. Validate parameters and GitHub CLI
 * 2. Query story and worktree from database
 * 3. Check for existing PR (prevent duplicates)
 * 4. Validate git state (branch pushed, commits exist)
 * 5. Generate title and description if not provided
 * 6. Execute gh pr create command
 * 7. Create database PR record
 * 8. Return success response
 */
export async function handler(
  prisma: PrismaClient,
  params: CreatePullRequestParams
): Promise<CreatePullRequestResponse> {
  try {
    // Validate required parameters
    validateRequired(params, ['storyId']);

    // Validate GitHub CLI availability
    validateGitHubCLI();

    const { storyId, title, description, draft = false, baseBranch = 'main' } = params;

    // Query story with project relation
    const story = await prisma.story.findUnique({
      where: { id: storyId },
      include: { project: true },
    });

    if (!story) {
      throw new NotFoundError('Story', storyId);
    }

    // Check for existing PR (prevent duplicates)
    const existingPr = await prisma.pullRequest.findFirst({
      where: {
        storyId,
        status: { not: 'closed' },
      },
    });

    if (existingPr) {
      throw new ValidationError(
        `Pull request already exists for story ${story.key} (PR #${existingPr.prNumber})`
      );
    }

    // Query worktree for branch information
    const worktree = await prisma.worktree.findFirst({
      where: {
        storyId,
        status: 'active',
      },
    });

    if (!worktree) {
      throw new ValidationError(
        'No active worktree found. Create worktree first using git_create_worktree()'
      );
    }

    const branchName = worktree.branchName;
    const worktreePath = worktree.worktreePath;

    // Validate branch exists and is pushed to remote
    try {
      execSync(`git ls-remote --heads origin refs/heads/${branchName}`, {
        cwd: worktreePath,
        stdio: 'pipe',
      });
    } catch (error) {
      throw new ValidationError(
        `Branch ${branchName} not pushed to remote. Push changes before creating PR.`
      );
    }

    // Validate commits exist ahead of base branch
    try {
      const commitCount = execSync(
        `git rev-list origin/${baseBranch}..HEAD --count`,
        {
          cwd: worktreePath,
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
        }
      ).trim();

      if (parseInt(commitCount) === 0) {
        throw new ValidationError(
          `No commits ahead of ${baseBranch}. Make code changes and commit before creating PR.`
        );
      }
    } catch (error: any) {
      if (error.name === 'ValidationError') {
        throw error;
      }
      throw new ValidationError(
        `Failed to check commit count: ${error.message}`
      );
    }

    // Generate title if not provided
    const prTitle = title
      ? sanitizeInput(title)
      : generatePrTitle(story.key, story.title);

    // Generate description if not provided
    const prDescription = description
      ? sanitizeInput(description)
      : await generatePrDescription(storyId, story.description, worktreePath, prisma);

    // Execute GitHub CLI to create PR
    let ghOutput: string;
    try {
      const draftFlag = draft ? '--draft' : '';
      const command = `gh pr create --title "${prTitle}" --body "${prDescription.replace(/"/g, '\\"')}" --head ${branchName} --base ${baseBranch} ${draftFlag}`;

      ghOutput = execGitHub(command, worktreePath);
    } catch (error: any) {
      throw new ValidationError(
        `Failed to create PR on GitHub: ${error.message}`
      );
    }

    // Parse PR number and URL from output
    const prNumber = parsePrNumber(ghOutput);
    const prUrl = parsePrUrl(ghOutput);

    // Create database PR record
    let prRecord;
    try {
      prRecord = await prisma.pullRequest.create({
        data: {
          storyId,
          prNumber,
          prUrl,
          title: prTitle,
          description: prDescription,
          status: draft ? 'draft' : 'open',
        },
      });
    } catch (dbError: any) {
      // Compensating transaction: close PR on GitHub if database fails
      try {
        execGitHub(`gh pr close ${prNumber} --delete-branch`, worktreePath);
      } catch (cleanupError) {
        console.error(
          `Failed to cleanup PR after database error: ${cleanupError}`
        );
      }
      throw handlePrismaError(dbError, 'create_pull_request');
    }

    // Return success response
    return {
      success: true,
      prId: prRecord.id,
      prNumber: prRecord.prNumber,
      prUrl: prRecord.prUrl,
      status: prRecord.status,
      message: `Pull request #${prRecord.prNumber} created successfully`,
    };
  } catch (error: any) {
    if (
      error.name === 'ValidationError' ||
      error.name === 'NotFoundError' ||
      error.name === 'MCPError'
    ) {
      throw error;
    }
    throw handlePrismaError(error, 'create_pull_request');
  }
}
