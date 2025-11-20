/**
 * Delete Story Tool
 * Deletes a story by ID with cascade deletes for related records
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import {
  NotFoundError,
  ValidationError,
} from '../../types';
import {
  validateRequired,
  handlePrismaError,
} from '../../utils';

export interface DeleteStoryParams {
  storyId: string;
  confirm: boolean;
}

export interface DeleteStoryResponse {
  id: string;
  key: string;
  title: string;
  cascadeDeleted: {
    subtasks: number;
    useCaseLinks: number;
    storyFiles: number;
    workflowRuns: number;
    componentRuns: number;
    testCases: number;
  };
}

export const tool: Tool = {
  name: 'delete_story',
  description: 'Delete a story by ID with cascade deletes for related records. Requires confirm: true parameter for safety.',
  inputSchema: {
    type: 'object',
    properties: {
      storyId: {
        type: 'string',
        description: 'Story UUID to delete',
      },
      confirm: {
        type: 'boolean',
        description: 'Must be set to true to confirm deletion',
      },
    },
    required: ['storyId', 'confirm'],
  },
};

export const metadata = {
  category: 'stories',
  domain: 'project_management',
  tags: ['story', 'delete', 'cascade'],
  version: '1.0.0',
  since: 'sprint-5',
};

export async function handler(
  prisma: PrismaClient,
  params: DeleteStoryParams,
): Promise<DeleteStoryResponse> {
  try {
    validateRequired(params, ['storyId', 'confirm']);

    // Safety check: require explicit confirmation
    if (params.confirm !== true) {
      throw new ValidationError('Deletion requires explicit confirmation. Set confirm: true to proceed.');
    }

    // Verify story exists and get its data before deletion
    const story = await prisma.story.findUnique({
      where: { id: params.storyId },
      include: {
        subtasks: true,
        useCaseLinks: true,
        workflowRuns: {
          include: {
            componentRuns: true,
          },
        },
      },
    });

    if (!story) {
      throw new NotFoundError('Story', params.storyId);
    }

    // Count records that will be cascade deleted
    const [
      subtasksCount,
      useCaseLinksCount,
      storyFilesCount,
      workflowRunsCount,
      componentRunsCount,
      testCasesCount,
    ] = await Promise.all([
      prisma.subtask.count({ where: { storyId: params.storyId } }),
      prisma.storyUseCaseLink.count({ where: { storyId: params.storyId } }),
      prisma.commitFile.count({
        where: {
          commit: {
            storyId: params.storyId,
          },
        },
      }),
      prisma.workflowRun.count({ where: { storyId: params.storyId } }),
      prisma.componentRun.count({
        where: {
          workflowRun: {
            storyId: params.storyId,
          },
        },
      }),
      prisma.testCase.count({
        where: {
          useCase: {
            storyLinks: {
              some: {
                storyId: params.storyId,
              },
            },
          },
        },
      }),
    ]);

    // Perform deletion in a transaction
    await prisma.$transaction(async (tx) => {
      // Delete component runs first (they depend on workflow runs)
      await tx.componentRun.deleteMany({
        where: {
          workflowRun: {
            storyId: params.storyId,
          },
        },
      });

      // Delete workflow runs
      await tx.workflowRun.deleteMany({
        where: { storyId: params.storyId },
      });

      // Delete test cases linked to this story's use cases
      // Note: This finds test cases for use cases that are ONLY linked to this story
      const useCasesLinkedOnlyToThisStory = await tx.useCase.findMany({
        where: {
          storyLinks: {
            every: {
              storyId: params.storyId,
            },
          },
        },
        select: { id: true },
      });

      if (useCasesLinkedOnlyToThisStory.length > 0) {
        await tx.testCase.deleteMany({
          where: {
            useCaseId: {
              in: useCasesLinkedOnlyToThisStory.map((uc) => uc.id),
            },
          },
        });
      }

      // Delete story use case links
      await tx.storyUseCaseLink.deleteMany({
        where: { storyId: params.storyId },
      });

      // Delete subtasks
      await tx.subtask.deleteMany({
        where: { storyId: params.storyId },
      });

      // Delete the story itself
      // Note: Commits are set to null (onDelete: SetNull), not deleted
      // Note: Runs are cascade deleted by Prisma schema
      await tx.story.delete({
        where: { id: params.storyId },
      });
    });

    return {
      id: story.id,
      key: story.key,
      title: story.title,
      cascadeDeleted: {
        subtasks: subtasksCount,
        useCaseLinks: useCaseLinksCount,
        storyFiles: storyFilesCount,
        workflowRuns: workflowRunsCount,
        componentRuns: componentRunsCount,
        testCases: testCasesCount,
      },
    };
  } catch (error: any) {
    if (error.name === 'MCPError') {
      throw error;
    }
    throw handlePrismaError(error, 'delete_story');
  }
}
