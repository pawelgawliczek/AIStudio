/**
 * Git Get Worktree Status Tool
 *
 * Gets detailed status for a specific story's worktree including:
 * - Database information
 * - Filesystem existence check
 * - Git status (branch, commits, file changes)
 * - Optional disk usage calculation
 *
 * Business Requirements (from baAnalysis):
 * - AC2: Returns status for specific story's worktree
 * - AC4: Handles errors gracefully
 * - AC5: Formatted data for agent consumption
 *
 * Architecture (from architectAnalysis):
 * - Check database + filesystem consistency
 * - Parse git status for branch info and file counts
 * - Optional disk usage (can be slow)
 * - Return comprehensive status information
 *
 * ST-153: Location-Aware Git Operations
 * - Auto-detects execution location based on worktree hostType
 * - Supports target override: 'auto' | 'laptop' | 'kvm'
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient, WorktreeStatus } from '@prisma/client';
import { validateRequired, handlePrismaError } from '../../utils';
import {
  execGit,
  parseGitStatus,
  getDiskUsageMB,
  checkFilesystemExists,
  GitStatusInfo,
  execGitLocationAware,
} from './git_utils';

export const tool: Tool = {
  name: 'git_get_worktree_status',
  description: 'Get detailed status for a specific story\'s worktree including git status, file changes, and filesystem info',
  inputSchema: {
    type: 'object',
    properties: {
      storyId: {
        type: 'string',
        description: 'Story UUID (required)',
      },
      worktreeId: {
        type: 'string',
        description: 'Specific worktree ID (optional - if story has multiple worktrees)',
      },
      includeGitStatus: {
        type: 'boolean',
        description: 'Include detailed git status analysis (default: true)',
      },
      includeDiskUsage: {
        type: 'boolean',
        description: 'Include disk usage calculation (default: false, can be slow)',
      },
      target: {
        type: 'string',
        enum: ['auto', 'laptop', 'kvm'],
        description: 'ST-153: Override target host for git execution (default: auto-detect from worktree hostType)',
      },
    },
    required: ['storyId'],
  },
};

export const metadata = {
  category: 'git',
  domain: 'development',
  tags: ['git', 'worktree', 'status', 'analysis'],
  version: '1.0.0',
  since: 'sprint-5',
};

interface GetWorktreeStatusParams {
  storyId: string;
  worktreeId?: string;
  includeGitStatus?: boolean;
  includeDiskUsage?: boolean;
  target?: 'auto' | 'laptop' | 'kvm';
}

interface WorktreeStatusDetail {
  id: string;
  storyId: string;
  storyKey: string;
  storyTitle: string;
  branchName: string;
  worktreePath: string;
  baseBranch: string;
  status: WorktreeStatus;
  hostType: string;
  hostName?: string;
  createdAt: string;
  updatedAt: string;
  filesystemExists: boolean;
  gitStatus?: GitStatusInfo;
  diskUsageMB?: number;
  executedOn?: 'kvm' | 'laptop'; // ST-153: Where git command was executed
}

interface GetWorktreeStatusResponse {
  exists: boolean;
  worktree?: WorktreeStatusDetail;
  message?: string;
}

export async function handler(
  prisma: PrismaClient,
  params: GetWorktreeStatusParams,
): Promise<GetWorktreeStatusResponse> {
  try {
    validateRequired(params, ['storyId']);

    // Default values
    const includeGitStatus = params.includeGitStatus !== false;
    const includeDiskUsage = params.includeDiskUsage === true;

    // Build where clause
    const whereClause: any = { storyId: params.storyId };

    if (params.worktreeId) {
      whereClause.id = params.worktreeId;
    }

    // Filter to active worktrees only (exclude 'removed')
    whereClause.status = { in: ['active', 'idle', 'cleaning'] };

    // Find worktree
    const worktree = await prisma.worktree.findFirst({
      where: whereClause,
      include: {
        story: {
          select: {
            key: true,
            title: true,
            status: true,
            currentPhase: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' }, // Most recent if multiple
    });

    // No worktree found
    if (!worktree) {
      return {
        exists: false,
        message: `No active worktree found for story ${params.storyId}`,
      };
    }

    // Check filesystem existence
    const filesystemExists = checkFilesystemExists(worktree.worktreePath);

    // Build response
    const detail: WorktreeStatusDetail = {
      id: worktree.id,
      storyId: worktree.storyId,
      storyKey: worktree.story.key,
      storyTitle: worktree.story.title,
      branchName: worktree.branchName,
      worktreePath: worktree.worktreePath,
      baseBranch: worktree.baseBranch,
      status: worktree.status,
      hostType: worktree.hostType,
      hostName: worktree.hostName || undefined,
      createdAt: worktree.createdAt.toISOString(),
      updatedAt: worktree.updatedAt.toISOString(),
      filesystemExists,
    };

    // Get git status if requested (ST-153: location-aware execution)
    if (includeGitStatus) {
      try {
        // ST-153: Use location-aware execution
        const result = await execGitLocationAware(
          'git status --porcelain --branch',
          worktree.worktreePath,
          {
            storyId: params.storyId,
            worktreeId: worktree.id,
            target: params.target || 'auto',
            prisma,
          }
        );

        detail.executedOn = result.executedOn;

        if (result.success && result.output) {
          detail.gitStatus = parseGitStatus(result.output);
        } else {
          // Git command failed
          detail.gitStatus = {
            branch: worktree.branchName,
            ahead: 0,
            behind: 0,
            modified: 0,
            staged: 0,
            untracked: 0,
            conflicted: 0,
            isClean: false,
            rawStatus: `Error: ${result.error}`,
          };
        }
      } catch (error: any) {
        // Non-fatal: git status failed but continue
        console.warn(`Failed to get git status for ${worktree.worktreePath}:`, error.message);
        detail.gitStatus = {
          branch: worktree.branchName,
          ahead: 0,
          behind: 0,
          modified: 0,
          staged: 0,
          untracked: 0,
          conflicted: 0,
          isClean: false,
          rawStatus: `Error: ${error.message}`,
        };
      }
    }

    // Get disk usage if filesystem exists and requested
    if (filesystemExists && includeDiskUsage) {
      detail.diskUsageMB = getDiskUsageMB(worktree.worktreePath);
    }

    return {
      exists: true,
      worktree: detail,
    };
  } catch (error: any) {
    if (error.name === 'MCPError') {
      throw error;
    }
    throw handlePrismaError(error, 'git_get_worktree_status');
  }
}
