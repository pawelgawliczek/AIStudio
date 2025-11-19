/**
 * Git List Worktrees Tool
 *
 * Lists all git worktrees with optional filtering by project, story, or status.
 * Supports pagination for efficient data retrieval.
 *
 * Business Requirements (from baAnalysis):
 * - AC1: Returns all active worktrees with pagination
 * - AC5: Formatted data for agent consumption
 *
 * Architecture (from architectAnalysis):
 * - Pagination: default 20, max 100 items per page
 * - Filtering: by projectId (via story), storyId, status
 * - Includes story details via Prisma join
 * - Optional filesystem existence check
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient, WorktreeStatus } from '@prisma/client';
import { ValidationError } from '../../types';
import { handlePrismaError } from '../../utils';
import { checkFilesystemExists } from './git_utils';

export const tool: Tool = {
  name: 'git_list_worktrees',
  description: 'List all git worktrees with optional filtering by project, story, or status. Supports pagination.',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: {
        type: 'string',
        description: 'Filter by project UUID (via story relationship)',
      },
      storyId: {
        type: 'string',
        description: 'Filter by specific story UUID',
      },
      status: {
        type: 'string',
        enum: ['active', 'idle', 'cleaning', 'removed'],
        description: 'Filter by worktree status',
      },
      includeStoryDetails: {
        type: 'boolean',
        description: 'Include full story details (default: true)',
      },
      includeFilesystemCheck: {
        type: 'boolean',
        description: 'Check if worktree path exists on filesystem (default: false, can be slow for many worktrees)',
      },
      page: {
        type: 'number',
        description: 'Page number (default: 1)',
        minimum: 1,
      },
      pageSize: {
        type: 'number',
        description: 'Items per page (default: 20, max: 100)',
        minimum: 1,
        maximum: 100,
      },
    },
  },
};

export const metadata = {
  category: 'git',
  domain: 'development',
  tags: ['git', 'worktree', 'list', 'pagination'],
  version: '1.0.0',
  since: 'sprint-5',
};

interface ListWorktreesParams {
  projectId?: string;
  storyId?: string;
  status?: WorktreeStatus;
  includeStoryDetails?: boolean;
  includeFilesystemCheck?: boolean;
  page?: number;
  pageSize?: number;
}

interface WorktreeListItem {
  id: string;
  storyId: string;
  storyKey: string;
  storyTitle: string;
  storyStatus: string;
  branchName: string;
  worktreePath: string;
  baseBranch: string;
  status: WorktreeStatus;
  createdAt: string;
  updatedAt: string;
  filesystemExists?: boolean;
}

interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

interface ListWorktreesResponse {
  data: WorktreeListItem[];
  pagination: PaginationInfo;
}

/**
 * Format worktree data for response
 */
function formatWorktreeListItem(
  worktree: any,
  includeFilesystemCheck: boolean
): WorktreeListItem {
  const item: WorktreeListItem = {
    id: worktree.id,
    storyId: worktree.storyId,
    storyKey: worktree.story.key,
    storyTitle: worktree.story.title,
    storyStatus: worktree.story.status,
    branchName: worktree.branchName,
    worktreePath: worktree.worktreePath,
    baseBranch: worktree.baseBranch,
    status: worktree.status,
    createdAt: worktree.createdAt.toISOString(),
    updatedAt: worktree.updatedAt.toISOString(),
  };

  // Optional filesystem check (can be slow for many worktrees)
  if (includeFilesystemCheck) {
    item.filesystemExists = checkFilesystemExists(worktree.worktreePath);
  }

  return item;
}

export async function handler(
  prisma: PrismaClient,
  params: ListWorktreesParams,
): Promise<ListWorktreesResponse> {
  try {
    // Default values
    const includeStoryDetails = params.includeStoryDetails !== false;
    const includeFilesystemCheck = params.includeFilesystemCheck === true;
    const page = params.page || 1;
    const pageSize = Math.min(params.pageSize || 20, 100);

    // Validate pagination parameters
    if (page < 1) {
      throw new ValidationError('Page number must be >= 1');
    }

    if (pageSize < 1 || pageSize > 100) {
      throw new ValidationError('Page size must be between 1 and 100');
    }

    // Build dynamic where clause
    const whereClause: any = {};

    if (params.storyId) {
      whereClause.storyId = params.storyId;
    }

    if (params.projectId) {
      whereClause.story = {
        projectId: params.projectId,
      };
    }

    if (params.status) {
      whereClause.status = params.status;
    }

    // Calculate skip for pagination
    const skip = (page - 1) * pageSize;

    // Execute query with count for pagination
    const [total, worktrees] = await Promise.all([
      prisma.worktree.count({ where: whereClause }),
      prisma.worktree.findMany({
        where: whereClause,
        include: {
          story: {
            select: {
              key: true,
              title: true,
              status: true,
              type: true,
            },
          },
        },
        orderBy: [
          { status: 'asc' },      // Active first (alphabetical: active, cleaning, idle, removed)
          { createdAt: 'desc' },  // Most recent first
        ],
        skip,
        take: pageSize,
      }),
    ]);

    // Calculate pagination metadata
    const totalPages = Math.ceil(total / pageSize);
    const hasNext = page < totalPages;
    const hasPrev = page > 1;

    // Format worktrees
    const data = worktrees.map((wt) => formatWorktreeListItem(wt, includeFilesystemCheck));

    return {
      data,
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
        hasNext,
        hasPrev,
      },
    };
  } catch (error: any) {
    if (error.name === 'MCPError') {
      throw error;
    }
    throw handlePrismaError(error, 'git_list_worktrees');
  }
}
