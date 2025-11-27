/**
 * Record Worktree Created Tool (ST-125)
 *
 * Records a worktree in the database after local creation.
 * Used when MCP server runs remotely and worktree was created locally via slash command.
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import * as os from 'os';
import {
  NotFoundError,
  ValidationError,
} from '../../types';
import {
  validateRequired,
  handlePrismaError,
} from '../../utils';

export const tool: Tool = {
  name: 'record_worktree_created',
  description: `Record a worktree in the database after local creation.

Use this tool AFTER creating a worktree locally (via slash command or manual git commands).
This records the worktree in the database with hostType='local'.

Workflow:
1. User runs /git_create_worktree or manual git commands locally
2. User calls this tool to record the worktree in the database
3. Worktree is tracked with hostType='local' and hostName from the local machine`,
  inputSchema: {
    type: 'object',
    properties: {
      storyId: {
        type: 'string',
        description: 'Story UUID (required)',
      },
      branchName: {
        type: 'string',
        description: 'Git branch name (required)',
      },
      worktreePath: {
        type: 'string',
        description: 'Local filesystem path to the worktree (required)',
      },
      baseBranch: {
        type: 'string',
        description: 'Base branch worktree was created from (default: main)',
      },
      hostName: {
        type: 'string',
        description: 'Hostname where worktree was created (auto-detected if not provided)',
      },
    },
    required: ['storyId', 'branchName', 'worktreePath'],
  },
};

export const metadata = {
  category: 'git',
  domain: 'development',
  tags: ['git', 'worktree', 'development', 'local'],
  version: '1.0.0',
  since: 'ST-125',
};

interface RecordWorktreeParams {
  storyId: string;
  branchName: string;
  worktreePath: string;
  baseBranch?: string;
  hostName?: string;
}

interface RecordWorktreeResponse {
  worktreeId: string;
  storyId: string;
  branchName: string;
  worktreePath: string;
  baseBranch: string;
  hostType: string;
  hostName: string;
  message: string;
}

export async function handler(
  prisma: PrismaClient,
  params: RecordWorktreeParams,
): Promise<RecordWorktreeResponse> {
  try {
    validateRequired(params, ['storyId', 'branchName', 'worktreePath']);

    const baseBranch = params.baseBranch || 'main';
    const hostName = params.hostName || os.hostname();

    // 1. Verify story exists
    const story = await prisma.story.findUnique({
      where: { id: params.storyId },
      select: { id: true, key: true, title: true },
    });

    if (!story) {
      throw new NotFoundError('Story', params.storyId);
    }

    // 2. Check if worktree already exists for this story
    const existingWorktree = await prisma.worktree.findFirst({
      where: {
        storyId: params.storyId,
        status: { in: ['active', 'idle'] },
      },
    });

    if (existingWorktree) {
      throw new ValidationError(
        `Worktree already exists for story ${story.key} at ${existingWorktree.worktreePath}`
      );
    }

    // 3. Record worktree in database with hostType='local'
    const worktree = await prisma.worktree.create({
      data: {
        storyId: params.storyId,
        branchName: params.branchName,
        worktreePath: params.worktreePath,
        baseBranch,
        status: 'active',
        hostType: 'local',
        hostName,
      },
    });

    // 4. Update story phase to implementation
    await prisma.story.update({
      where: { id: params.storyId },
      data: {
        currentPhase: 'implementation',
      },
    });

    return {
      worktreeId: worktree.id,
      storyId: params.storyId,
      branchName: params.branchName,
      worktreePath: params.worktreePath,
      baseBranch,
      hostType: 'local',
      hostName,
      message: `Successfully recorded local worktree for ${story.key} at ${params.worktreePath}`,
    };
  } catch (error: any) {
    if (error.name === 'MCPError') {
      throw error;
    }
    throw handlePrismaError(error, 'record_worktree_created');
  }
}
