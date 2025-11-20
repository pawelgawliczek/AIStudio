/**
 * Git Utilities - Shared helper functions for git worktree operations
 *
 * This module provides reusable utilities for:
 * - Executing git commands safely
 * - Parsing git status output
 * - Filesystem operations
 * - Path validation
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import { ValidationError } from '../../types';

/**
 * Git status information parsed from git status --porcelain --branch
 */
export interface GitStatusInfo {
  branch: string;           // Current branch name
  tracking?: string;        // Remote tracking branch (e.g., origin/main)
  ahead: number;            // Commits ahead of remote
  behind: number;           // Commits behind remote
  modified: number;         // Modified files (unstaged)
  staged: number;           // Staged files
  untracked: number;        // Untracked files
  conflicted: number;       // Files with merge conflicts
  isClean: boolean;         // No uncommitted changes
  rawStatus: string;        // Raw git status output
}

/**
 * Execute git command and return output
 *
 * @param command - Git command to execute
 * @param cwd - Working directory (defaults to /opt/stack/AIStudio)
 * @param timeout - Timeout in milliseconds (optional, defaults to no timeout)
 * @returns Command output as string
 * @throws Error if git command fails or times out
 */
export function execGit(command: string, cwd?: string, timeout?: number): string {
  try {
    const options: any = {
      cwd: cwd || '/opt/stack/AIStudio',
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    };

    if (timeout) {
      options.timeout = timeout;
    }

    return execSync(command, options);
  } catch (error: any) {
    // Check if this is a timeout error
    if (error.killed && error.signal === 'SIGTERM') {
      throw new Error(`Git command timed out after ${timeout}ms: ${command}`);
    }

    const stderr = error.stderr?.toString() || error.message;
    throw new Error(`Git command failed: ${stderr}\nCommand: ${command}`);
  }
}

/**
 * Parse git status --porcelain --branch output
 *
 * Output format example:
 * ## branch...origin/branch [ahead 2, behind 1]
 * M  modified-file.ts
 * A  staged-file.ts
 * ?? untracked-file.ts
 * UU conflicted-file.ts
 *
 * @param output - Raw git status output
 * @returns Parsed git status information
 */
export function parseGitStatus(output: string): GitStatusInfo {
  const lines = output.trim().split('\n');
  const branchLine = lines[0];

  // Parse branch info (format: ## branch...tracking [ahead X, behind Y])
  const branchMatch = branchLine.match(/^## ([^.\s]+)(?:\.{3}([^\s]+))?(?: \[(.+)\])?/);

  const info: GitStatusInfo = {
    branch: branchMatch?.[1] || 'unknown',
    tracking: branchMatch?.[2],
    ahead: 0,
    behind: 0,
    modified: 0,
    staged: 0,
    untracked: 0,
    conflicted: 0,
    isClean: lines.length === 1,
    rawStatus: output,
  };

  // Parse ahead/behind info from tracking line
  if (branchMatch?.[3]) {
    const aheadMatch = branchMatch[3].match(/ahead (\d+)/);
    const behindMatch = branchMatch[3].match(/behind (\d+)/);
    if (aheadMatch) info.ahead = parseInt(aheadMatch[1]);
    if (behindMatch) info.behind = parseInt(behindMatch[1]);
  }

  // Count file statuses
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    const status = line.substring(0, 2);

    if (status === '??') {
      // Untracked files
      info.untracked++;
    } else if (status.includes('U')) {
      // Merge conflicts (UU, UA, AU, etc.)
      info.conflicted++;
    } else {
      // Check staged changes (first character)
      if (status[0] !== ' ' && status[0] !== '?') {
        info.staged++;
      }
      // Check unstaged changes (second character)
      if (status[1] !== ' ' && status[1] !== '?') {
        info.modified++;
      }
    }
  }

  return info;
}

/**
 * Calculate disk usage for a directory in megabytes
 *
 * Uses 'du -sm' command with timeout for safety
 *
 * @param worktreePath - Path to directory
 * @returns Disk usage in MB, or undefined if calculation fails
 */
export function getDiskUsageMB(worktreePath: string): number | undefined {
  try {
    const output = execSync(`du -sm "${worktreePath}"`, {
      encoding: 'utf-8',
      timeout: 10000, // 10 second timeout
    });

    // Parse output: "123\t/path/to/worktree"
    const match = output.match(/^(\d+)/);
    return match ? parseInt(match[1]) : undefined;
  } catch (error: any) {
    // Non-fatal error, return undefined
    console.warn(`Failed to get disk usage for ${worktreePath}:`, error.message);
    return undefined;
  }
}

/**
 * Check if a path exists on the filesystem
 *
 * @param worktreePath - Path to check
 * @returns true if path exists, false otherwise
 */
export function checkFilesystemExists(worktreePath: string): boolean {
  try {
    return fs.existsSync(worktreePath);
  } catch {
    return false;
  }
}

/**
 * Validate worktree path for security
 *
 * Prevents:
 * - Deleting main repository
 * - Path traversal attacks
 * - Operating outside /opt/stack/worktrees directory
 *
 * @param worktreePath - Path to validate
 * @throws ValidationError if path is invalid or unsafe
 */
export function validateWorktreePath(worktreePath: string): void {
  // Never delete main repository
  if (worktreePath === '/opt/stack/AIStudio') {
    throw new ValidationError('Cannot delete main repository worktree');
  }

  // Must be within worktrees directory
  if (!worktreePath.startsWith('/opt/stack/worktrees/')) {
    throw new ValidationError(
      `Invalid worktree path: ${worktreePath}. Must be within /opt/stack/worktrees/`
    );
  }

  // Prevent path traversal
  const normalized = worktreePath.replace(/\/+/g, '/');
  if (normalized.includes('..')) {
    throw new ValidationError(
      `Invalid worktree path: ${worktreePath}. Path traversal detected.`
    );
  }
}

/**
 * Validate git branch name
 *
 * Ensures branch name doesn't contain shell metacharacters
 * to prevent command injection
 *
 * @param branchName - Branch name to validate
 * @throws ValidationError if branch name is invalid
 */
export function validateBranchName(branchName: string): void {
  if (!/^[a-zA-Z0-9/_-]+$/.test(branchName)) {
    throw new ValidationError(
      `Invalid branch name: ${branchName}. Only alphanumeric, slash, underscore, and hyphen allowed.`
    );
  }
}
