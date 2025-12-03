/**
 * Git Utilities - Shared helper functions for git worktree operations
 *
 * This module provides reusable utilities for:
 * - Executing git commands safely
 * - Parsing git status output
 * - Filesystem operations
 * - Path validation
 * - ST-153: Location-aware git execution (laptop vs KVM)
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import { PrismaClient } from '@prisma/client';
import { ValidationError, MCPError } from '../../types';

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
 * - Operating outside allowed worktree directories
 *
 * ST-158: Support both KVM worktrees (/opt/stack/worktrees) and
 * laptop worktrees (~/worktrees or project/worktrees)
 *
 * @param worktreePath - Path to validate
 * @param hostType - Optional host type ('local' for laptop, undefined for KVM)
 * @throws ValidationError if path is invalid or unsafe
 */
export function validateWorktreePath(worktreePath: string, hostType?: string): void {
  // Never delete main repositories
  const forbiddenPaths = [
    '/opt/stack/AIStudio',
    '/Users/pawelgawliczek/projects/AIStudio', // Laptop main repo
  ];

  if (forbiddenPaths.includes(worktreePath)) {
    throw new ValidationError('Cannot delete main repository worktree');
  }

  // Prevent path traversal
  const normalized = worktreePath.replace(/\/+/g, '/');
  if (normalized.includes('..')) {
    throw new ValidationError(
      `Invalid worktree path: ${worktreePath}. Path traversal detected.`
    );
  }

  // ST-158: For laptop worktrees (hostType='local'), allow paths in user's project worktrees
  if (hostType === 'local') {
    // Laptop worktree paths - must contain 'worktrees' or be in user's home
    const isValidLaptopPath =
      worktreePath.includes('/worktrees/') ||
      worktreePath.startsWith('/Users/') ||
      worktreePath.startsWith(process.env.HOME || '');

    if (!isValidLaptopPath) {
      throw new ValidationError(
        `Invalid laptop worktree path: ${worktreePath}. Must be within a worktrees directory.`
      );
    }
    return;
  }

  // KVM worktrees - must be within /opt/stack/worktrees/
  if (!worktreePath.startsWith('/opt/stack/worktrees/')) {
    throw new ValidationError(
      `Invalid worktree path: ${worktreePath}. Must be within /opt/stack/worktrees/`
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

// =============================================================================
// ST-153: Location-Aware Git Execution
// =============================================================================

/**
 * Options for location-aware git execution
 */
export interface LocationAwareOptions {
  storyId?: string;
  worktreeId?: string;
  target?: 'auto' | 'laptop' | 'kvm';
  prisma: PrismaClient;
  timeout?: number;
}

/**
 * Result of location-aware git execution
 */
export interface LocationAwareResult {
  success: boolean;
  output?: string;
  error?: string;
  executedOn: 'kvm' | 'laptop';
}

// Reference to RemoteExecutionService (set via setRemoteExecutionService)
let remoteExecutionService: any = null;

/**
 * Set the RemoteExecutionService reference for remote git execution
 * Called during NestJS module initialization
 */
export function setRemoteExecutionService(service: any): void {
  remoteExecutionService = service;
}

/**
 * Execute git command with location-aware routing
 *
 * Automatically determines whether to execute locally (KVM) or remotely (laptop)
 * based on worktree's hostType/hostName.
 *
 * @param command - Git command to execute
 * @param cwd - Working directory (worktree path)
 * @param options - Location-aware options (storyId, target, prisma)
 * @returns Promise<LocationAwareResult>
 */
export async function execGitLocationAware(
  command: string,
  cwd: string,
  options: LocationAwareOptions
): Promise<LocationAwareResult> {
  // 1. Resolve target host
  const target = await resolveTargetHost(cwd, options);

  // 2. Route to appropriate executor
  if (target === 'kvm') {
    return execGitLocal(command, cwd, options.timeout);
  } else {
    return execGitRemote(command, cwd, options.timeout);
  }
}

/**
 * Execute git command locally on KVM
 */
function execGitLocal(command: string, cwd: string, timeout?: number): LocationAwareResult {
  try {
    const output = execGit(command, cwd, timeout);
    return {
      success: true,
      output: output.trim(),
      executedOn: 'kvm',
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
      executedOn: 'kvm',
    };
  }
}

/**
 * Execute git command remotely on laptop via HTTP API
 * ST-158: Fallback to HTTP when RemoteExecutionService is not available (MCP server context)
 */
async function execGitViaHttp(
  command: string,
  cwd: string,
  timeout?: number
): Promise<LocationAwareResult> {
  const backendUrl = process.env.BACKEND_INTERNAL_URL || 'http://127.0.0.1:3000';
  const apiSecret = process.env.INTERNAL_API_SECRET || process.env.AGENT_SECRET || '';

  try {
    const response = await fetch(`${backendUrl}/api/remote-agent/git-execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Agent-Secret': apiSecret,
      },
      body: JSON.stringify({ command, cwd, timeout }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HTTP ${response.status}: ${text}`);
    }

    const result = await response.json() as {
      success: boolean;
      output?: string;
      error?: string;
      agentOffline?: boolean;
    };

    // Check for offline fallback
    if (result.agentOffline) {
      return {
        success: false,
        error: result.error || 'Laptop agent is offline. Cannot execute git command on remote worktree.',
        executedOn: 'laptop',
      };
    }

    return {
      success: result.success,
      output: result.output,
      error: result.error,
      executedOn: 'laptop',
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to execute git via HTTP: ${error.message}`,
      executedOn: 'laptop',
    };
  }
}

/**
 * Execute git command remotely on laptop via RemoteExecutionService or HTTP fallback
 */
async function execGitRemote(
  command: string,
  cwd: string,
  timeout?: number
): Promise<LocationAwareResult> {
  // ST-158: If RemoteExecutionService is available (NestJS context), use it directly
  if (remoteExecutionService) {
    try {
      const result = await remoteExecutionService.executeGitCommand({
        command,
        cwd,
        timeout,
      });

      // Check for offline fallback
      if ('agentOffline' in result && result.agentOffline) {
        return {
          success: false,
          error: result.error || 'Laptop agent is offline. Cannot execute git command on remote worktree.',
          executedOn: 'laptop',
        };
      }

      return {
        success: result.success,
        output: result.output,
        error: result.error,
        executedOn: 'laptop',
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        executedOn: 'laptop',
      };
    }
  }

  // ST-158: Fallback to HTTP API (MCP server context - separate process)
  return execGitViaHttp(command, cwd, timeout);
}

/**
 * Resolve target host (kvm or laptop) for git execution
 *
 * Priority:
 * 1. Explicit target override ('laptop' or 'kvm')
 * 2. Auto-detect from worktree's hostType
 * 3. Default to 'kvm' if no worktree found
 */
async function resolveTargetHost(
  cwd: string,
  options: LocationAwareOptions
): Promise<'laptop' | 'kvm'> {
  // Explicit override
  if (options.target === 'laptop') return 'laptop';
  if (options.target === 'kvm') return 'kvm';

  // Auto-detect from worktree
  const worktree = await options.prisma.worktree.findFirst({
    where: options.worktreeId
      ? { id: options.worktreeId }
      : options.storyId
        ? { storyId: options.storyId, status: { in: ['active', 'idle'] } }
        : { worktreePath: cwd, status: { in: ['active', 'idle'] } },
  });

  if (!worktree) {
    // No worktree found - check if path is on KVM
    if (cwd.startsWith('/opt/stack/')) {
      return 'kvm';
    }
    // Default to KVM if unsure
    return 'kvm';
  }

  // hostType='local' means created on laptop
  return worktree.hostType === 'local' ? 'laptop' : 'kvm';
}

/**
 * Check if laptop agent is online
 */
export async function isLaptopAgentOnline(prisma: PrismaClient): Promise<boolean> {
  const agent = await prisma.remoteAgent.findFirst({
    where: {
      status: 'online',
      capabilities: {
        has: 'git-execute',
      },
    },
  });
  return !!agent;
}
