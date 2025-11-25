/**
 * Unit tests for GitHub PR Validator - ST-77
 *
 * Tests cover PR validation logic for production deployments:
 * - PR approval status validation
 * - Merge state validation
 * - Merge conflict detection
 * - GitHub API interaction
 * - Edge cases and error handling
 */

import { GitHubPRValidator, validatePRForProduction, isPRReadyForProduction } from '../github-pr-validator';
import { execSync } from 'child_process';

// Mock child_process for GitHub CLI commands
jest.mock('child_process', () => ({
  execSync: jest.fn(),
}));

describe('GitHubPRValidator', () => {
  let validator: GitHubPRValidator;

  beforeEach(() => {
    validator = new GitHubPRValidator('test-owner', 'test-repo');
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // GROUP 1: validatePR() - Main Function (6 tests)
  // ==========================================================================

  describe('validatePR', () => {
    it('should validate approved and merged PR successfully', async () => {
      // Mock gh pr view command
      (execSync as jest.Mock).mockImplementationOnce(() => {
        return JSON.stringify({
          number: 42,
          state: 'CLOSED',
          merged: true,
          mergedAt: '2025-11-22T10:00:00Z',
          mergedBy: { login: 'deploy-bot' },
          mergeableState: 'CLEAN',
          baseRefName: 'main',
          headRefName: 'feature/ST-77',
          title: 'Production Deployment Safety',
          body: 'Implements ST-77',
        });
      });

      // Mock gh api reviews command
      (execSync as jest.Mock).mockImplementationOnce(() => {
        return JSON.stringify({
          id: 1,
          user: 'reviewer1',
          state: 'APPROVED',
          submitted_at: '2025-11-22T09:30:00Z',
        }) + '\n' + JSON.stringify({
          id: 2,
          user: 'reviewer2',
          state: 'APPROVED',
          submitted_at: '2025-11-22T09:45:00Z',
        });
      });

      // Mock gh pr checks command
      (execSync as jest.Mock).mockImplementationOnce(() => {
        return 'true';
      });

      const result = await validator.validatePR(42);

      expect(result.valid).toBe(true);
      expect(result.approved).toBe(true);
      expect(result.approvers).toEqual(['reviewer1', 'reviewer2']);
      expect(result.prState).toBe('closed');
      expect(result.mergedAt).toBe('2025-11-22T10:00:00Z');
      expect(result.mergedBy).toBe('deploy-bot');
      expect(result.conflictsExist).toBe(false);
      expect(result.ciChecksPassing).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail if PR not found (404)', async () => {
      (execSync as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Command failed: gh: Could not resolve to a PullRequest with the number of 999');
      });

      const result = await validator.validatePR(999);

      expect(result.valid).toBe(false);
      expect(result.approved).toBe(false);
      expect(result.prState).toBe('unknown');
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Failed to validate PR');
    });

    it('should fail if PR not merged', async () => {
      (execSync as jest.Mock).mockImplementationOnce(() => {
        return JSON.stringify({
          number: 42,
          state: 'OPEN',
          merged: false, // Not merged yet
          mergedAt: null,
          mergedBy: null,
          mergeableState: 'CLEAN',
          baseRefName: 'main',
          headRefName: 'feature/ST-77',
          title: 'Production Deployment Safety',
        });
      });

      (execSync as jest.Mock).mockImplementationOnce(() => {
        return JSON.stringify({
          id: 1,
          user: 'reviewer1',
          state: 'APPROVED',
          submitted_at: '2025-11-22T09:30:00Z',
        });
      });

      (execSync as jest.Mock).mockImplementationOnce(() => {
        return 'true';
      });

      const result = await validator.validatePR(42);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('PR #42 is not merged. State: open');
    });

    it('should fail if PR has merge conflicts', async () => {
      (execSync as jest.Mock).mockImplementationOnce(() => {
        return JSON.stringify({
          number: 42,
          state: 'CLOSED',
          merged: true,
          mergedAt: '2025-11-22T10:00:00Z',
          mergedBy: { login: 'deploy-bot' },
          mergeableState: 'DIRTY', // Merge conflicts!
          baseRefName: 'main',
          headRefName: 'feature/ST-77',
          title: 'Production Deployment Safety',
        });
      });

      (execSync as jest.Mock).mockImplementationOnce(() => {
        return JSON.stringify({
          id: 1,
          user: 'reviewer1',
          state: 'APPROVED',
          submitted_at: '2025-11-22T09:30:00Z',
        });
      });

      (execSync as jest.Mock).mockImplementationOnce(() => {
        return 'true';
      });

      const result = await validator.validatePR(42);

      expect(result.valid).toBe(false);
      expect(result.conflictsExist).toBe(true);
      expect(result.errors).toContain('PR #42 has merge conflicts. Resolve conflicts before deploying.');
    });

    it('should fail if PR not approved', async () => {
      (execSync as jest.Mock).mockImplementationOnce(() => {
        return JSON.stringify({
          number: 42,
          state: 'CLOSED',
          merged: true,
          mergedAt: '2025-11-22T10:00:00Z',
          mergedBy: { login: 'deploy-bot' },
          mergeableState: 'CLEAN',
          baseRefName: 'main',
          headRefName: 'feature/ST-77',
          title: 'Production Deployment Safety',
        });
      });

      // No reviews submitted
      (execSync as jest.Mock).mockImplementationOnce(() => {
        return ''; // Empty response (no reviews)
      });

      (execSync as jest.Mock).mockImplementationOnce(() => {
        return 'true';
      });

      const result = await validator.validatePR(42);

      expect(result.valid).toBe(false);
      expect(result.approved).toBe(false);
      expect(result.approvers).toHaveLength(0);
      expect(result.errors).toContain(
        'PR #42 has no approvals. At least 1 approval required for production deployment.'
      );
    });

    it('should fail if PR has "changes requested" review', async () => {
      (execSync as jest.Mock).mockImplementationOnce(() => {
        return JSON.stringify({
          number: 42,
          state: 'CLOSED',
          merged: true,
          mergedAt: '2025-11-22T10:00:00Z',
          mergedBy: { login: 'deploy-bot' },
          mergeableState: 'CLEAN',
          baseRefName: 'main',
          headRefName: 'feature/ST-77',
          title: 'Production Deployment Safety',
        });
      });

      // Reviewer1 approved, but Reviewer2 requested changes (most recent)
      (execSync as jest.Mock).mockImplementationOnce(() => {
        return JSON.stringify({
          id: 1,
          user: 'reviewer1',
          state: 'APPROVED',
          submitted_at: '2025-11-22T09:00:00Z',
        }) + '\n' + JSON.stringify({
          id: 2,
          user: 'reviewer1',
          state: 'CHANGES_REQUESTED', // Changed their mind
          submitted_at: '2025-11-22T09:30:00Z',
        });
      });

      (execSync as jest.Mock).mockImplementationOnce(() => {
        return 'true';
      });

      const result = await validator.validatePR(42);

      expect(result.valid).toBe(false);
      expect(result.approved).toBe(false);
      expect(result.approvers).toHaveLength(0); // Latest review is CHANGES_REQUESTED
      expect(result.errors).toContain(
        'PR #42 has no approvals. At least 1 approval required for production deployment.'
      );
    });
  });

  // ==========================================================================
  // GROUP 2: fetchPRDetails() - GitHub API (5 tests)
  // ==========================================================================

  describe('fetchPRDetails', () => {
    it('should fetch PR details with all required fields', async () => {
      (execSync as jest.Mock).mockReturnValue(JSON.stringify({
        number: 42,
        state: 'CLOSED',
        merged: true,
        mergedAt: '2025-11-22T10:00:00Z',
        mergedBy: { login: 'deploy-bot' },
        mergeableState: 'CLEAN',
        baseRefName: 'main',
        headRefName: 'feature/ST-77',
        title: 'Production Deployment Safety',
        body: 'Implements ST-77 with full test coverage',
      }));

      const result = await (validator as any).fetchPRDetails(42);

      expect(result.number).toBe(42);
      expect(result.state).toBe('closed');
      expect(result.merged).toBe(true);
      expect(result.merged_at).toBe('2025-11-22T10:00:00Z');
      expect(result.merged_by?.login).toBe('deploy-bot');
      expect(result.mergeable_state).toBe('clean');
      expect(result.base.ref).toBe('main');
      expect(result.head.ref).toBe('feature/ST-77');
      expect(result.title).toBe('Production Deployment Safety');
      expect(result.body).toBe('Implements ST-77 with full test coverage');
    });

    it('should handle GitHub CLI error (network timeout)', async () => {
      (execSync as jest.Mock).mockImplementation(() => {
        throw new Error('Command failed: timeout: failed to connect to github.com');
      });

      await expect(
        (validator as any).fetchPRDetails(42)
      ).rejects.toThrow('Failed to fetch PR details');
    });

    it('should handle invalid JSON response', async () => {
      (execSync as jest.Mock).mockReturnValue('invalid json {]');

      await expect(
        (validator as any).fetchPRDetails(42)
      ).rejects.toThrow();
    });

    it('should handle missing required fields in response', async () => {
      (execSync as jest.Mock).mockReturnValue(JSON.stringify({
        number: 42,
        // Missing state, merged, etc.
      }));

      const result = await (validator as any).fetchPRDetails(42);

      expect(result.number).toBe(42);
      expect(result.merged).toBe(false); // Default value
    });

    it('should handle repository not found error', async () => {
      (execSync as jest.Mock).mockImplementation(() => {
        throw new Error('Command failed: Could not resolve to a Repository');
      });

      await expect(
        (validator as any).fetchPRDetails(42)
      ).rejects.toThrow('Failed to fetch PR details');
    });
  });

  // ==========================================================================
  // GROUP 3: fetchPRReviews() - Approval Logic (5 tests)
  // ==========================================================================

  describe('fetchPRReviews', () => {
    it('should fetch multiple approvals from different reviewers', async () => {
      (execSync as jest.Mock).mockReturnValue(
        JSON.stringify({
          id: 1,
          user: 'reviewer1',
          state: 'APPROVED',
          submitted_at: '2025-11-22T09:00:00Z',
        }) + '\n' + JSON.stringify({
          id: 2,
          user: 'reviewer2',
          state: 'APPROVED',
          submitted_at: '2025-11-22T09:30:00Z',
        })
      );

      const result = await (validator as any).fetchPRReviews(42);

      expect(result).toHaveLength(2);
      expect(result[0].user.login).toBe('reviewer1');
      expect(result[0].state).toBe('APPROVED');
      expect(result[1].user.login).toBe('reviewer2');
      expect(result[1].state).toBe('APPROVED');
    });

    it('should fetch single approval (minimum requirement)', async () => {
      (execSync as jest.Mock).mockReturnValue(JSON.stringify({
        id: 1,
        user: 'reviewer1',
        state: 'APPROVED',
        submitted_at: '2025-11-22T09:00:00Z',
      }));

      const result = await (validator as any).fetchPRReviews(42);

      expect(result).toHaveLength(1);
      expect(result[0].state).toBe('APPROVED');
    });

    it('should return empty array if no reviews submitted', async () => {
      (execSync as jest.Mock).mockReturnValue(''); // Empty response

      const result = await (validator as any).fetchPRReviews(42);

      expect(result).toHaveLength(0);
    });

    it('should handle mixed reviews (approved + changes requested)', async () => {
      (execSync as jest.Mock).mockReturnValue(
        JSON.stringify({
          id: 1,
          user: 'reviewer1',
          state: 'APPROVED',
          submitted_at: '2025-11-22T09:00:00Z',
        }) + '\n' + JSON.stringify({
          id: 2,
          user: 'reviewer2',
          state: 'CHANGES_REQUESTED',
          submitted_at: '2025-11-22T09:30:00Z',
        })
      );

      const result = await (validator as any).fetchPRReviews(42);

      expect(result).toHaveLength(2);
      expect(result[0].state).toBe('APPROVED');
      expect(result[1].state).toBe('CHANGES_REQUESTED');
    });

    it('should return empty array on Not Found error', async () => {
      (execSync as jest.Mock).mockImplementation(() => {
        throw new Error('Command failed: Not Found');
      });

      const result = await (validator as any).fetchPRReviews(42);

      expect(result).toHaveLength(0);
    });
  });

  // ==========================================================================
  // GROUP 4: Edge Cases (4 tests)
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle missing GitHub token gracefully', async () => {
      const originalToken = process.env.GITHUB_TOKEN;
      delete process.env.GITHUB_TOKEN;

      (execSync as jest.Mock).mockImplementation(() => {
        throw new Error('Command failed: gh: To use GitHub CLI, please authenticate');
      });

      const result = await validator.validatePR(42);

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Failed to validate PR');

      // Restore token
      if (originalToken) {
        process.env.GITHUB_TOKEN = originalToken;
      }
    });

    it('should handle malformed PR number (non-numeric)', async () => {
      // TypeScript prevents this at compile time, but test runtime behavior
      (execSync as jest.Mock).mockImplementation(() => {
        throw new Error('Command failed: invalid argument');
      });

      const result = await validator.validatePR(NaN);

      expect(result.valid).toBe(false);
    });

    it('should handle API returning empty reviews array', async () => {
      (execSync as jest.Mock).mockImplementationOnce(() => {
        return JSON.stringify({
          number: 42,
          state: 'CLOSED',
          merged: true,
          mergedAt: '2025-11-22T10:00:00Z',
          mergedBy: { login: 'deploy-bot' },
          mergeableState: 'CLEAN',
          baseRefName: 'main',
          headRefName: 'feature/ST-77',
          title: 'Production Deployment Safety',
        });
      });

      (execSync as jest.Mock).mockImplementationOnce(() => {
        return ''; // Empty reviews
      });

      (execSync as jest.Mock).mockImplementationOnce(() => {
        return 'true';
      });

      const result = await validator.validatePR(42);

      expect(result.approved).toBe(false);
      expect(result.approvers).toHaveLength(0);
    });

    it('should warn if PR merged to non-main branch', async () => {
      (execSync as jest.Mock).mockImplementationOnce(() => {
        return JSON.stringify({
          number: 42,
          state: 'CLOSED',
          merged: true,
          mergedAt: '2025-11-22T10:00:00Z',
          mergedBy: { login: 'deploy-bot' },
          mergeableState: 'CLEAN',
          baseRefName: 'develop', // Not main!
          headRefName: 'feature/ST-77',
          title: 'Production Deployment Safety',
        });
      });

      (execSync as jest.Mock).mockImplementationOnce(() => {
        return JSON.stringify({
          id: 1,
          user: 'reviewer1',
          state: 'APPROVED',
          submitted_at: '2025-11-22T09:30:00Z',
        });
      });

      (execSync as jest.Mock).mockImplementationOnce(() => {
        return 'true';
      });

      const result = await validator.validatePR(42);

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('was merged to develop, not main');
    });
  });

  // ==========================================================================
  // GROUP 5: Helper Methods (3 tests)
  // ==========================================================================

  describe('Helper Methods', () => {
    it('should get latest review per user', () => {
      const reviews = [
        {
          id: 1,
          user: { login: 'reviewer1' },
          state: 'APPROVED' as const,
          submitted_at: '2025-11-22T09:00:00Z',
        },
        {
          id: 2,
          user: { login: 'reviewer1' },
          state: 'CHANGES_REQUESTED' as const,
          submitted_at: '2025-11-22T09:30:00Z', // Later
        },
        {
          id: 3,
          user: { login: 'reviewer2' },
          state: 'APPROVED' as const,
          submitted_at: '2025-11-22T09:15:00Z',
        },
      ];

      const result = (validator as any).getLatestReviewsByUser(reviews);

      expect(result).toHaveLength(2);
      expect(result.find((r: any) => r.user.login === 'reviewer1')?.state).toBe('CHANGES_REQUESTED');
      expect(result.find((r: any) => r.user.login === 'reviewer2')?.state).toBe('APPROVED');
    });

    it('should extract owner from git remote (HTTPS)', () => {
      (execSync as jest.Mock).mockReturnValue('https://github.com/vibestudios/AIStudio.git\n');

      const validatorWithGit = new GitHubPRValidator();
      expect((validatorWithGit as any).owner).toBe('vibestudios');
    });

    it('should extract repo from git remote (SSH)', () => {
      (execSync as jest.Mock).mockReturnValue('git@github.com:vibestudios/AIStudio.git\n');

      const validatorWithGit = new GitHubPRValidator();
      expect((validatorWithGit as any).repo).toBe('AIStudio');
    });
  });

  // ==========================================================================
  // GROUP 6: CI Checks (2 tests)
  // ==========================================================================

  describe('CI Checks', () => {
    it('should return true if all CI checks pass', async () => {
      (execSync as jest.Mock).mockReturnValue('true');

      const result = await (validator as any).checkCIStatus(42);

      expect(result).toBe(true);
    });

    it('should return true if CI check query fails (non-blocking)', async () => {
      (execSync as jest.Mock).mockImplementation(() => {
        throw new Error('Command failed: API rate limit exceeded');
      });

      const result = await (validator as any).checkCIStatus(42);

      // Should not block deployment on CI check failure
      expect(result).toBe(true);
    });
  });
});

// ==========================================================================
// Convenience Functions Tests
// ==========================================================================

describe('Convenience Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validatePRForProduction', () => {
    it('should create validator and validate PR', async () => {
      (execSync as jest.Mock).mockImplementationOnce(() => {
        return JSON.stringify({
          number: 42,
          state: 'CLOSED',
          merged: true,
          mergedAt: '2025-11-22T10:00:00Z',
          mergedBy: { login: 'deploy-bot' },
          mergeableState: 'CLEAN',
          baseRefName: 'main',
          headRefName: 'feature/ST-77',
          title: 'Production Deployment Safety',
        });
      });

      (execSync as jest.Mock).mockImplementationOnce(() => {
        return JSON.stringify({
          id: 1,
          user: 'reviewer1',
          state: 'APPROVED',
          submitted_at: '2025-11-22T09:30:00Z',
        });
      });

      (execSync as jest.Mock).mockImplementationOnce(() => {
        return 'true';
      });

      const result = await validatePRForProduction(42);

      expect(result.valid).toBe(true);
      expect(result.approved).toBe(true);
    });
  });

  describe('isPRReadyForProduction', () => {
    it('should return true if PR is ready', async () => {
      (execSync as jest.Mock).mockImplementationOnce(() => {
        return JSON.stringify({
          number: 42,
          state: 'CLOSED',
          merged: true,
          mergedAt: '2025-11-22T10:00:00Z',
          mergedBy: { login: 'deploy-bot' },
          mergeableState: 'CLEAN',
          baseRefName: 'main',
          headRefName: 'feature/ST-77',
          title: 'Production Deployment Safety',
        });
      });

      (execSync as jest.Mock).mockImplementationOnce(() => {
        return JSON.stringify({
          id: 1,
          user: 'reviewer1',
          state: 'APPROVED',
          submitted_at: '2025-11-22T09:30:00Z',
        });
      });

      (execSync as jest.Mock).mockImplementationOnce(() => {
        return 'true';
      });

      const result = await isPRReadyForProduction(42);

      expect(result).toBe(true);
    });

    it('should return false if PR is not ready', async () => {
      (execSync as jest.Mock).mockImplementationOnce(() => {
        return JSON.stringify({
          number: 42,
          state: 'OPEN', // Not merged
          merged: false,
          mergedAt: null,
          mergedBy: null,
          mergeableState: 'CLEAN',
          baseRefName: 'main',
          headRefName: 'feature/ST-77',
          title: 'Production Deployment Safety',
        });
      });

      (execSync as jest.Mock).mockImplementationOnce(() => {
        return JSON.stringify({
          id: 1,
          user: 'reviewer1',
          state: 'APPROVED',
          submitted_at: '2025-11-22T09:30:00Z',
        });
      });

      (execSync as jest.Mock).mockImplementationOnce(() => {
        return 'true';
      });

      const result = await isPRReadyForProduction(42);

      expect(result).toBe(false);
    });
  });
});
