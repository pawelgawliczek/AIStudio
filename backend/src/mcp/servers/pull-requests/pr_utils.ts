/**
 * Pull Request Utilities - Shared helper functions for PR operations
 *
 * This module provides reusable utilities for:
 * - Executing GitHub CLI commands safely
 * - Parsing GitHub output
 * - Generating PR titles and descriptions
 * - Validating PR state and requirements
 * - Syncing PR status with database
 */

import { execSync } from 'child_process';
import { PrismaClient } from '@prisma/client';
import { ValidationError, NotFoundError } from '../../types';

/**
 * GitHub PR status information
 */
export interface GitHubPrStatus {
  number: number;
  title: string;
  state: 'OPEN' | 'CLOSED' | 'MERGED';
  mergeable: 'MERGEABLE' | 'CONFLICTING' | 'UNKNOWN';
  statusCheckRollup?: Array<{
    name: string;
    status: string;
    conclusion: string;
  }>;
  reviews?: Array<{
    author: { login: string };
    state: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED';
    submittedAt: string;
  }>;
  comments?: Array<any>;
}

/**
 * Pre-merge validation result
 */
export interface PreMergeValidation {
  valid: boolean;
  errors: string[];
}

/**
 * Execute GitHub CLI command with error handling
 *
 * @param command - GitHub CLI command to execute
 * @param cwd - Working directory (defaults to /opt/stack/AIStudio)
 * @returns Command output as string
 * @throws Error if GitHub CLI command fails
 */
export function execGitHub(command: string, cwd?: string): string {
  try {
    return execSync(command, {
      cwd: cwd || '/opt/stack/AIStudio',
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, GITHUB_TOKEN: process.env.GITHUB_TOKEN },
    });
  } catch (error: any) {
    const stderr = error.stderr?.toString() || error.message;

    // Handle specific GitHub CLI errors
    if (stderr.includes('gh: command not found') || stderr.includes('gh: not found')) {
      throw new ValidationError(
        'GitHub CLI (gh) not available. Install from https://cli.github.com'
      );
    }
    if (stderr.includes('rate limit')) {
      throw new ValidationError('GitHub API rate limit exceeded');
    }
    if (stderr.includes('authentication') || stderr.includes('401')) {
      throw new ValidationError(
        'GitHub authentication failed - GITHUB_TOKEN invalid or not set'
      );
    }
    if (stderr.includes('not found') && stderr.includes('pull request')) {
      throw new NotFoundError('PullRequest', 'GitHub PR not found');
    }

    throw new Error(`GitHub CLI command failed: ${stderr}\nCommand: ${command}`);
  }
}

/**
 * Parse PR number from gh pr create output
 *
 * Handles various output formats:
 * - "https://github.com/org/repo/pull/123"
 * - "Created pull request #123"
 * - Full URL in JSON output
 *
 * @param output - GitHub CLI output
 * @returns PR number as integer
 * @throws Error if PR number cannot be parsed
 */
export function parsePrNumber(output: string): number {
  // Pattern 1: URL format
  const urlMatch = output.match(/pull\/(\d+)/);
  if (urlMatch) return parseInt(urlMatch[1], 10);

  // Pattern 2: Text format with #
  const textMatch = output.match(/#(\d+)/);
  if (textMatch) return parseInt(textMatch[1], 10);

  throw new Error(`Failed to parse PR number from output: ${output}`);
}

/**
 * Parse PR URL from gh pr create output
 *
 * @param output - GitHub CLI output
 * @returns PR URL as string
 * @throws Error if PR URL cannot be parsed
 */
export function parsePrUrl(output: string): string {
  const match = output.match(/(https:\/\/github\.com\/[^\s]+)/);
  if (match) return match[1].trim();
  throw new Error(`Failed to parse PR URL from output: ${output}`);
}

/**
 * Generate PR title from story key and title
 *
 * Format: [ST-46] Story Title
 * Truncates if exceeds GitHub's 200 character limit
 *
 * @param storyKey - Story key (e.g., "ST-46")
 * @param storyTitle - Story title
 * @returns Formatted PR title
 */
export function generatePrTitle(storyKey: string, storyTitle: string): string {
  const maxLength = 200;
  const prefix = `[${storyKey}] `;
  const availableLength = maxLength - prefix.length;

  const truncatedTitle =
    storyTitle.length > availableLength
      ? storyTitle.substring(0, availableLength - 3) + '...'
      : storyTitle;

  return prefix + truncatedTitle;
}

/**
 * Generate PR description from story and git history
 *
 * Includes:
 * - Story description
 * - Recent commits (from git log)
 * - Files changed summary (from git diff --stat)
 * - Schema change warnings (if applicable)
 * - Testing checklist
 *
 * @param storyId - Story UUID
 * @param storyDescription - Story description text
 * @param worktreePath - Path to worktree
 * @param prisma - Prisma client instance
 * @returns Formatted PR description in markdown
 */
export async function generatePrDescription(
  storyId: string,
  storyDescription: string | null,
  worktreePath: string,
  prisma: PrismaClient
): Promise<string> {
  let description = '## Story Description\n\n';
  description += storyDescription || 'No description provided';
  description += '\n\n';

  // Add commit history
  try {
    const commits = execSync('git log origin/main..HEAD --oneline', {
      cwd: worktreePath,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    if (commits.trim()) {
      description += '## Recent Commits\n\n';
      description += commits
        .split('\n')
        .filter((c) => c.trim())
        .map((c) => `- ${c}`)
        .join('\n');
      description += '\n\n';
    }
  } catch (error) {
    // Ignore if git log fails
  }

  // Add files changed
  try {
    const diffStat = execSync('git diff --stat origin/main...HEAD', {
      cwd: worktreePath,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    if (diffStat.trim()) {
      description += '## Files Changed\n\n```\n';
      description += diffStat;
      description += '\n```\n\n';
    }
  } catch (error) {
    // Ignore if diff fails
  }

  // Add schema change warnings (optional - integrate with ST-42 if available)
  try {
    // Check if schema changes exist
    const schemaChanges = await prisma.worktree.findFirst({
      where: { storyId },
      select: { id: true },
    });

    // Try to detect schema changes via prisma migrations
    const migrationsChanged = execSync(
      'git diff origin/main...HEAD --name-only | grep "prisma/migrations"',
      {
        cwd: worktreePath,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      }
    );

    if (migrationsChanged.trim()) {
      description += '## ⚠️ Database Schema Changes Detected\n\n';
      description += 'This PR includes Prisma schema migrations:\n';
      const migrationFiles = migrationsChanged.split('\n').filter((f) => f.trim());
      migrationFiles.forEach((file: string) => {
        const migrationName = file.split('/').pop();
        description += `- Migration: ${migrationName}\n`;
      });
      description += '\n**Action Required**: Review schema changes before merge\n\n';
    }
  } catch (error) {
    // Ignore if schema detection fails
  }

  // Add testing checklist
  description += '## Testing Checklist\n\n';
  description += '- [ ] Unit tests pass\n';
  description += '- [ ] Integration tests pass\n';
  description += '- [ ] Manual testing completed\n';
  description += '- [ ] Documentation updated\n\n';

  description += '---\n';
  description += '🤖 Generated with [Claude Code](https://claude.com/claude-code)\n';

  // Truncate if too long (GitHub limit: 65535 chars)
  if (description.length > 65000) {
    description = description.substring(0, 65000) + '\n\n[Description truncated]';
  }

  return description;
}

/**
 * Get PR record from story ID
 *
 * Finds the most recent non-closed PR for a story
 *
 * @param prisma - Prisma client instance
 * @param storyId - Story UUID
 * @returns PR record
 * @throws NotFoundError if no PR found
 */
export async function getPrFromStory(prisma: PrismaClient, storyId: string): Promise<any> {
  const pr = await prisma.pullRequest.findFirst({
    where: {
      storyId,
      status: { not: 'closed' }, // Ignore closed PRs
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!pr) {
    throw new NotFoundError('PullRequest', `No active PR found for story ${storyId}`);
  }

  return pr;
}

/**
 * Validate GitHub CLI is available and configured
 *
 * Checks:
 * - gh command exists
 * - GITHUB_TOKEN is set
 *
 * @throws ValidationError if GitHub CLI is not available or configured
 */
export function validateGitHubCLI(): void {
  try {
    execSync('gh --version', { stdio: 'pipe' });
  } catch (error) {
    throw new ValidationError(
      'GitHub CLI (gh) not available. Install from https://cli.github.com'
    );
  }

  // Check GITHUB_TOKEN
  if (!process.env.GITHUB_TOKEN) {
    throw new ValidationError(
      'GITHUB_TOKEN environment variable not set'
    );
  }
}

/**
 * Sync PR status from GitHub to database
 *
 * Maps GitHub PR state to database PRStatus enum:
 * - MERGED → merged
 * - CLOSED → closed
 * - OPEN + conflicting → conflict
 * - OPEN + changes requested → changes_requested
 * - OPEN + approved → approved
 * - OPEN → open
 *
 * @param prisma - Prisma client instance
 * @param prId - PR database UUID
 * @param prNumber - GitHub PR number
 */
export async function syncPrStatus(
  prisma: PrismaClient,
  prId: string,
  prNumber: number
): Promise<void> {
  try {
    const ghData = execGitHub(
      `gh pr view ${prNumber} --json state,reviews,mergeable,statusCheckRollup`
    );
    const parsed: GitHubPrStatus = JSON.parse(ghData);

    // Map GitHub state to PRStatus
    let dbStatus: string;
    if (parsed.state === 'MERGED') {
      dbStatus = 'merged';
    } else if (parsed.state === 'CLOSED') {
      dbStatus = 'closed';
    } else if (parsed.mergeable === 'CONFLICTING') {
      dbStatus = 'conflict';
    } else {
      const approved = parsed.reviews?.some((r: any) => r.state === 'APPROVED') || false;
      const changesRequested =
        parsed.reviews?.some((r: any) => r.state === 'CHANGES_REQUESTED') || false;

      if (changesRequested) {
        dbStatus = 'changes_requested';
      } else if (approved) {
        dbStatus = 'approved';
      } else {
        dbStatus = 'open';
      }
    }

    // Update database
    await prisma.pullRequest.update({
      where: { id: prId },
      data: {
        status: dbStatus as any,
        updatedAt: new Date(),
      },
    });
  } catch (error) {
    // Log but don't throw - sync failures shouldn't block operations
    console.error(`Failed to sync PR status: ${error}`);
  }
}

/**
 * Check pre-merge conditions (approval, checks, conflicts)
 *
 * Validates:
 * - Approval requirements (if enabled)
 * - CI check requirements (if enabled)
 * - Merge conflict status
 *
 * @param prNumber - GitHub PR number
 * @param requireApproval - Whether approval is required
 * @param requireChecks - Whether passing checks are required
 * @returns Validation result with errors if any
 */
export async function checkPreMergeConditions(
  prNumber: number,
  requireApproval: boolean,
  requireChecks: boolean
): Promise<PreMergeValidation> {
  const errors: string[] = [];

  // Query GitHub
  const ghData = execGitHub(
    `gh pr view ${prNumber} --json reviews,statusCheckRollup,mergeable`
  );
  const prData: GitHubPrStatus = JSON.parse(ghData);

  // Check approval
  if (requireApproval) {
    const approved = prData.reviews?.some((r: any) => r.state === 'APPROVED') || false;
    const changesRequested =
      prData.reviews?.some((r: any) => r.state === 'CHANGES_REQUESTED') || false;
    if (!approved || changesRequested) {
      errors.push('PR not approved or changes requested');
    }
  }

  // Check CI
  if (requireChecks && prData.statusCheckRollup && prData.statusCheckRollup.length > 0) {
    const failedChecks = prData.statusCheckRollup.filter(
      (c: any) => c.conclusion === 'FAILURE' || c.status === 'FAILED'
    );
    if (failedChecks.length > 0) {
      const checkNames = failedChecks.map((c: any) => c.name).join(', ');
      errors.push(`CI checks failing: ${checkNames}`);
    }
  }

  // Check conflicts
  if (prData.mergeable === 'CONFLICTING') {
    errors.push('Merge conflicts detected - manual resolution required');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Sanitize input to prevent command injection
 *
 * @param input - Input string to sanitize
 * @returns Sanitized string
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/[`$()]/g, '') // Remove shell special chars
    .replace(/\n/g, ' ') // Replace newlines
    .trim();
}
