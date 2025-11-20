/**
 * Get Pull Request Status Tool
 * Query GitHub for PR status and retrieve comprehensive PR metadata
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import { NotFoundError, ValidationError } from '../../types';
import type {
  GetPrStatusParams,
  GetPrStatusResponse,
  ReviewInfo,
  CheckInfo,
} from '../../types';
import { handlePrismaError } from '../../utils';
import {
  execGitHub,
  parsePrNumber,
  getPrFromStory,
  syncPrStatus,
  validateGitHubCLI,
} from './pr_utils';

export const tool: Tool = {
  name: 'get_pr_status',
  description:
    'Query GitHub for Pull Request status including approvals, checks, and merge readiness',
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
      prUrl: {
        type: 'string',
        description: 'GitHub PR URL (optional)',
      },
      includeComments: {
        type: 'boolean',
        description: 'Include comment threads (default: false)',
      },
      includeReviews: {
        type: 'boolean',
        description: 'Include review status (default: true)',
      },
    },
    required: [],
  },
};

export const metadata = {
  category: 'pull-requests',
  domain: 'development',
  tags: ['github', 'pr', 'status', 'ci', 'checks'],
  version: '1.0.0',
  since: 'sprint-6',
};

/**
 * Get PR Status Handler
 *
 * Workflow:
 * 1. Validate at least one identifier provided (storyId, prNumber, or prUrl)
 * 2. Resolve PR number from provided identifier
 * 3. Query GitHub for PR status via gh CLI
 * 4. Parse and map GitHub data to response format
 * 5. Sync status with database
 * 6. Return comprehensive status response
 */
export async function handler(
  prisma: PrismaClient,
  params: GetPrStatusParams
): Promise<GetPrStatusResponse> {
  try {
    // Validate GitHub CLI availability
    validateGitHubCLI();

    const {
      storyId,
      prNumber: providedPrNumber,
      prUrl,
      includeComments = false,
      includeReviews = true,
    } = params;

    // Validate at least one identifier provided
    if (!storyId && !providedPrNumber && !prUrl) {
      throw new ValidationError(
        'At least one identifier required: storyId, prNumber, or prUrl'
      );
    }

    // Resolve PR number
    let prNumber: number;
    let prId: string | undefined;

    if (storyId) {
      // Lookup PR from story
      const pr = await getPrFromStory(prisma, storyId);
      prNumber = pr.prNumber;
      prId = pr.id;
    } else if (prUrl) {
      // Extract PR number from URL
      prNumber = parsePrNumber(prUrl);
    } else if (providedPrNumber) {
      // Use provided PR number directly
      prNumber = providedPrNumber;
    } else {
      throw new ValidationError('Unable to resolve PR number');
    }

    // Query GitHub for PR status
    const fields = [
      'number',
      'title',
      'state',
      'mergeable',
      'statusCheckRollup',
    ];
    if (includeReviews) fields.push('reviews');
    if (includeComments) fields.push('comments');

    const ghOutput = execGitHub(`gh pr view ${prNumber} --json ${fields.join(',')}`);
    const ghData = JSON.parse(ghOutput);

    // Map checks status
    let checksStatus: 'PASSING' | 'FAILING' | 'PENDING' | 'NONE' = 'NONE';
    const ciChecks: CheckInfo[] = [];

    if (ghData.statusCheckRollup && ghData.statusCheckRollup.length > 0) {
      const checks = ghData.statusCheckRollup;
      const hasFailing = checks.some(
        (c: any) => c.conclusion === 'FAILURE' || c.status === 'FAILED'
      );
      const hasPending = checks.some((c: any) => c.status === 'PENDING');

      if (hasFailing) {
        checksStatus = 'FAILING';
      } else if (hasPending) {
        checksStatus = 'PENDING';
      } else {
        checksStatus = 'PASSING';
      }

      // Map checks to CheckInfo format
      checks.forEach((check: any) => {
        ciChecks.push({
          name: check.name || check.context || 'Unknown',
          status: check.status || 'UNKNOWN',
          conclusion: check.conclusion || 'UNKNOWN',
        });
      });
    }

    // Map approvals
    const approvals: ReviewInfo[] = [];
    if (includeReviews && ghData.reviews) {
      // Get latest review from each reviewer
      const reviewerMap = new Map<string, any>();
      ghData.reviews.forEach((review: any) => {
        const reviewer = review.author?.login || 'Unknown';
        const existing = reviewerMap.get(reviewer);
        if (
          !existing ||
          new Date(review.submittedAt) > new Date(existing.submittedAt)
        ) {
          reviewerMap.set(reviewer, review);
        }
      });

      reviewerMap.forEach((review) => {
        approvals.push({
          reviewer: review.author?.login || 'Unknown',
          status: review.state,
          submittedAt: review.submittedAt,
        });
      });
    }

    // Map GitHub state to database status
    let dbStatus: string;
    if (ghData.state === 'MERGED') {
      dbStatus = 'merged';
    } else if (ghData.state === 'CLOSED') {
      dbStatus = 'closed';
    } else if (ghData.mergeable === 'CONFLICTING') {
      dbStatus = 'conflict';
    } else {
      const hasApproval = approvals.some((r) => r.status === 'APPROVED');
      const hasChangesRequested = approvals.some(
        (r) => r.status === 'CHANGES_REQUESTED'
      );

      if (hasChangesRequested) {
        dbStatus = 'changes_requested';
      } else if (hasApproval) {
        dbStatus = 'approved';
      } else {
        dbStatus = 'open';
      }
    }

    // Sync status with database if prId available
    if (prId) {
      await syncPrStatus(prisma, prId, prNumber);
    }

    // Map conflict status
    let conflictStatus: 'NONE' | 'CONFLICTING' | 'UNKNOWN' = 'NONE';
    if (ghData.mergeable === 'CONFLICTING') {
      conflictStatus = 'CONFLICTING';
    } else if (ghData.mergeable === 'UNKNOWN') {
      conflictStatus = 'UNKNOWN';
    }

    // Build response
    const response: GetPrStatusResponse = {
      success: true,
      prNumber,
      prUrl: `https://github.com/${process.env.GITHUB_REPOSITORY || 'org/repo'}/pull/${prNumber}`,
      status: dbStatus,
      title: ghData.title,
      state: ghData.state,
      checksStatus,
      approvals,
      ciChecks,
      mergeable: ghData.mergeable === 'MERGEABLE',
      conflictStatus,
    };

    // Add comment count if requested
    if (includeComments && ghData.comments) {
      response.commentCount = ghData.comments.length;
    }

    return response;
  } catch (error: any) {
    if (
      error.name === 'ValidationError' ||
      error.name === 'NotFoundError' ||
      error.name === 'MCPError'
    ) {
      throw error;
    }
    throw handlePrismaError(error, 'get_pr_status');
  }
}
