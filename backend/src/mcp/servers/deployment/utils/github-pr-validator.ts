/**
 * GitHub PR Validation Utilities - ST-77
 *
 * Validates PR approval status and merge state before production deployment.
 * Implements AC2 (PR Approval Workflow) and AC3 (Merge Conflict Detection).
 *
 * Uses GitHub REST API to verify:
 * - PR is approved by at least 1 reviewer
 * - PR is merged to main branch
 * - PR has no merge conflicts
 * - CI checks are passing (optional)
 */

import { execSync } from 'child_process';

// ============================================================================
// Types
// ============================================================================

export interface PRValidationResult {
  valid: boolean;
  prNumber: number;
  prState: string; // 'open', 'closed', 'merged'
  mergedAt?: string;
  mergedBy?: string;
  approved: boolean;
  approvers: string[];
  approvedAt?: string;
  conflictsExist: boolean;
  ciChecksPassing: boolean;
  errors: string[];
  warnings: string[];
  metadata?: Record<string, any>;
}

export interface PRDetails {
  number: number;
  state: string;
  merged: boolean;
  merged_at?: string;
  merged_by?: {
    login: string;
  };
  mergeable_state?: string;
  base: {
    ref: string;
  };
  head: {
    ref: string;
  };
  title: string;
  body?: string;
}

export interface PRReview {
  id: number;
  user: {
    login: string;
  };
  state: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'DISMISSED';
  submitted_at: string;
}

// ============================================================================
// GitHub PR Validator
// ============================================================================

export class GitHubPRValidator {
  private owner: string;
  private repo: string;

  constructor(owner?: string, repo?: string) {
    // Default to vibestudio repo (can be overridden for testing)
    this.owner = owner || this.extractOwnerFromGit();
    this.repo = repo || this.extractRepoFromGit();
  }

  /**
   * Validate PR is approved, merged, and has no conflicts (AC2, AC3)
   */
  async validatePR(prNumber: number): Promise<PRValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      console.log(`[GitHubPRValidator] Validating PR #${prNumber}...`);

      // Fetch PR details
      const prDetails = await this.fetchPRDetails(prNumber);

      // Check if PR is merged
      const isMerged = prDetails.merged;
      if (!isMerged) {
        errors.push(`PR #${prNumber} is not merged. State: ${prDetails.state}`);
      }

      // Check merge target is main
      if (prDetails.base.ref !== 'main') {
        warnings.push(
          `PR #${prNumber} was merged to ${prDetails.base.ref}, not main. ` +
          `Verify this is intentional.`
        );
      }

      // Fetch PR reviews
      const reviews = await this.fetchPRReviews(prNumber);

      // Get latest review per user (most recent state)
      const latestReviewsByUser = this.getLatestReviewsByUser(reviews);

      // Check for approvals
      const approvers = latestReviewsByUser
        .filter(review => review.state === 'APPROVED')
        .map(review => review.user.login);

      const isApproved = approvers.length > 0;

      if (!isApproved) {
        errors.push(
          `PR #${prNumber} has no approvals. At least 1 approval required for production deployment.`
        );
      }

      // Get most recent approval timestamp
      const approvalReviews = latestReviewsByUser.filter(r => r.state === 'APPROVED');
      const approvedAt = approvalReviews.length > 0
        ? approvalReviews.sort((a, b) =>
            new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()
          )[0].submitted_at
        : undefined;

      // Check for merge conflicts (AC3)
      const conflictsExist = prDetails.mergeable_state === 'dirty' || prDetails.mergeable_state === 'conflict';

      if (conflictsExist) {
        errors.push(
          `PR #${prNumber} has merge conflicts. Resolve conflicts before deploying.`
        );
      }

      // Check CI checks (optional - not blocking)
      const ciChecksPassing = await this.checkCIStatus(prNumber);
      if (!ciChecksPassing) {
        warnings.push(
          `PR #${prNumber} has failing CI checks. Verify this is acceptable before deploying.`
        );
      }

      // Validation passed if no errors
      const valid = errors.length === 0;

      return {
        valid,
        prNumber,
        prState: prDetails.state,
        mergedAt: prDetails.merged_at,
        mergedBy: prDetails.merged_by?.login,
        approved: isApproved,
        approvers,
        approvedAt,
        conflictsExist,
        ciChecksPassing,
        errors,
        warnings,
        metadata: {
          prTitle: prDetails.title,
          baseBranch: prDetails.base.ref,
          headBranch: prDetails.head.ref,
          mergeableState: prDetails.mergeable_state,
        },
      };

    } catch (error: any) {
      console.error(`[GitHubPRValidator] Failed to validate PR #${prNumber}:`, error.message);

      return {
        valid: false,
        prNumber,
        prState: 'unknown',
        approved: false,
        approvers: [],
        conflictsExist: false,
        ciChecksPassing: false,
        errors: [`Failed to validate PR: ${error.message}`],
        warnings,
      };
    }
  }

  // ==========================================================================
  // GitHub API Methods
  // ==========================================================================

  /**
   * Fetch PR details from GitHub API
   */
  private async fetchPRDetails(prNumber: number): Promise<PRDetails> {
    try {
      const command = `gh pr view ${prNumber} --json number,state,merged,mergedAt,mergedBy,mergeableState,baseRefName,headRefName,title,body`;

      const output = execSync(command, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      const data = JSON.parse(output);

      // Map gh CLI output to our PRDetails interface
      return {
        number: data.number,
        state: (data.state || 'unknown').toLowerCase(),
        merged: data.merged || false,
        merged_at: data.mergedAt,
        merged_by: data.mergedBy ? { login: data.mergedBy.login } : undefined,
        mergeable_state: data.mergeableState?.toLowerCase(),
        base: { ref: data.baseRefName },
        head: { ref: data.headRefName },
        title: data.title,
        body: data.body,
      };

    } catch (error: any) {
      throw new Error(`Failed to fetch PR details: ${error.message}`);
    }
  }

  /**
   * Fetch PR reviews from GitHub API
   */
  private async fetchPRReviews(prNumber: number): Promise<PRReview[]> {
    try {
      const command = `gh api repos/${this.owner}/${this.repo}/pulls/${prNumber}/reviews --jq '.[] | {id, user: .user.login, state, submitted_at}'`;

      const output = execSync(command, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      if (!output.trim()) {
        return [];
      }

      // Parse line-by-line JSON output
      const reviews = output
        .trim()
        .split('\n')
        .map(line => {
          const parsed = JSON.parse(line);
          return {
            id: parsed.id,
            user: { login: parsed.user },
            state: parsed.state as PRReview['state'],
            submitted_at: parsed.submitted_at,
          };
        });

      return reviews;

    } catch (error: any) {
      // If no reviews exist, return empty array
      if (error.message.includes('Not Found')) {
        return [];
      }
      throw new Error(`Failed to fetch PR reviews: ${error.message}`);
    }
  }

  /**
   * Check CI status for PR
   */
  private async checkCIStatus(prNumber: number): Promise<boolean> {
    try {
      const command = `gh pr checks ${prNumber} --json state --jq 'all(.state == "SUCCESS" or .state == "SKIPPED")'`;

      const output = execSync(command, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      return output.trim() === 'true';

    } catch (error: any) {
      console.warn(`[GitHubPRValidator] Failed to check CI status: ${error.message}`);
      // Return true if we can't check (don't block deployment)
      return true;
    }
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  /**
   * Get latest review per user (users can submit multiple reviews)
   */
  private getLatestReviewsByUser(reviews: PRReview[]): PRReview[] {
    const reviewsByUser = new Map<string, PRReview>();

    // Sort by submission time (oldest to newest)
    const sortedReviews = reviews.sort((a, b) =>
      new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime()
    );

    // Keep only the latest review per user
    for (const review of sortedReviews) {
      reviewsByUser.set(review.user.login, review);
    }

    return Array.from(reviewsByUser.values());
  }

  /**
   * Extract GitHub owner from git remote
   */
  private extractOwnerFromGit(): string {
    try {
      const remoteUrl = execSync('git config --get remote.origin.url', {
        encoding: 'utf-8',
      }).trim();

      // Parse owner from URL (supports both HTTPS and SSH)
      // Example: git@github.com:owner/repo.git or https://github.com/owner/repo.git
      const match = remoteUrl.match(/github\.com[:/]([^/]+)\//);
      if (match) {
        return match[1];
      }

      throw new Error('Could not extract owner from git remote URL');
    } catch (error: any) {
      console.warn(`[GitHubPRValidator] Failed to extract owner from git: ${error.message}`);
      return 'unknown';
    }
  }

  /**
   * Extract GitHub repo from git remote
   */
  private extractRepoFromGit(): string {
    try {
      const remoteUrl = execSync('git config --get remote.origin.url', {
        encoding: 'utf-8',
      }).trim();

      // Parse repo from URL (supports both HTTPS and SSH)
      const match = remoteUrl.match(/github\.com[:/][^/]+\/(.+?)(\.git)?$/);
      if (match) {
        return match[1];
      }

      throw new Error('Could not extract repo from git remote URL');
    } catch (error: any) {
      console.warn(`[GitHubPRValidator] Failed to extract repo from git: ${error.message}`);
      return 'unknown';
    }
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Validate PR approval and merge status (convenience wrapper)
 */
export async function validatePRForProduction(prNumber: number): Promise<PRValidationResult> {
  const validator = new GitHubPRValidator();
  return validator.validatePR(prNumber);
}

/**
 * Quick check if PR is ready for production deployment
 */
export async function isPRReadyForProduction(prNumber: number): Promise<boolean> {
  const result = await validatePRForProduction(prNumber);
  return result.valid;
}
