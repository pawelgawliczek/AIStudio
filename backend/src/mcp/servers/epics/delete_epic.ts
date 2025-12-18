/**
 * Delete Epic Tool
 * Deletes an epic by ID with optional cascade delete of stories
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

export interface DeleteEpicParams {
  epicId: string;
  confirm: boolean;
  deleteStories?: boolean;
}

export interface DeleteEpicResponse {
  id: string;
  key: string;
  title: string;
  storiesDeleted: number;
  cascadeDeleted: {
    subtasks: number;
    useCaseLinks: number;
    workflowRuns: number;
    componentRuns: number;
    testCases: number;
  };
}

export const tool: Tool = {
  name: 'delete_epic',
  description: 'Delete epic by ID with optional cascade. Requires confirm: true for safety.',
  inputSchema: {
    type: 'object',
    properties: {
      epicId: {
        type: 'string',
        description: 'Epic UUID to delete',
      },
      confirm: {
        type: 'boolean',
        description: 'Must be set to true to confirm deletion',
      },
      deleteStories: {
        type: 'boolean',
        description: 'If true, cascade delete all stories in this epic. If false (default), deletion fails if epic has stories.',
      },
    },
    required: ['epicId', 'confirm'],
  },
};

export const metadata = {
  category: 'epics',
  domain: 'project_management',
  tags: ['epic', 'delete', 'cascade'],
  version: '1.0.0',
  since: 'sprint-5',
};

export async function handler(
  prisma: PrismaClient,
  params: DeleteEpicParams,
): Promise<DeleteEpicResponse> {
  try {
    validateRequired(params as unknown as Record<string, unknown>, ['epicId', 'confirm']);

    // Safety check: require explicit confirmation
    if (params.confirm !== true) {
      throw new ValidationError('Deletion requires explicit confirmation. Set confirm: true to proceed.');
    }

    // Verify epic exists and get its data before deletion
    const epic = await prisma.epic.findUnique({
      where: { id: params.epicId },
      include: {
        stories: {
          include: {
            subtasks: true,
            useCaseLinks: true,
            workflowRuns: {
              include: {
                componentRuns: true,
              },
            },
          },
        },
      },
    });

    if (!epic) {
      throw new NotFoundError('Epic', params.epicId);
    }

    // Check if epic has stories and handle accordingly
    const storyCount = epic.stories.length;
    if (storyCount > 0 && !params.deleteStories) {
      throw new ValidationError(
        `Epic has ${storyCount} stories. Set deleteStories: true to cascade delete all stories, or delete/move stories first.`
      );
    }

    // Count all records that will be cascade deleted
    let totalSubtasks = 0;
    let totalUseCaseLinks = 0;
    let totalWorkflowRuns = 0;
    let totalComponentRuns = 0;
    let totalTestCases = 0;

    if (storyCount > 0) {
      const storyIds = epic.stories.map((s) => s.id);

      const [
        subtasksCount,
        useCaseLinksCount,
        workflowRunsCount,
        componentRunsCount,
        testCasesCount,
      ] = await Promise.all([
        prisma.subtask.count({ where: { storyId: { in: storyIds } } }),
        prisma.storyUseCaseLink.count({ where: { storyId: { in: storyIds } } }),
        prisma.workflowRun.count({ where: { storyId: { in: storyIds } } }),
        prisma.componentRun.count({
          where: {
            workflowRun: {
              storyId: { in: storyIds },
            },
          },
        }),
        prisma.testCase.count({
          where: {
            useCase: {
              storyLinks: {
                some: {
                  storyId: { in: storyIds },
                },
              },
            },
          },
        }),
      ]);

      totalSubtasks = subtasksCount;
      totalUseCaseLinks = useCaseLinksCount;
      totalWorkflowRuns = workflowRunsCount;
      totalComponentRuns = componentRunsCount;
      totalTestCases = testCasesCount;
    }

    // Perform deletion in a transaction
    await prisma.$transaction(async (tx) => {
      if (storyCount > 0 && params.deleteStories) {
        const storyIds = epic.stories.map((s) => s.id);

        // Delete component runs first (they depend on workflow runs)
        await tx.componentRun.deleteMany({
          where: {
            workflowRun: {
              storyId: { in: storyIds },
            },
          },
        });

        // Delete workflow runs
        await tx.workflowRun.deleteMany({
          where: { storyId: { in: storyIds } },
        });

        // Delete test cases linked to stories' use cases
        const useCasesLinkedOnlyToTheseStories = await tx.useCase.findMany({
          where: {
            storyLinks: {
              every: {
                storyId: { in: storyIds },
              },
            },
          },
          select: { id: true },
        });

        if (useCasesLinkedOnlyToTheseStories.length > 0) {
          await tx.testCase.deleteMany({
            where: {
              useCaseId: {
                in: useCasesLinkedOnlyToTheseStories.map((uc) => uc.id),
              },
            },
          });
        }

        // Delete story use case links
        await tx.storyUseCaseLink.deleteMany({
          where: { storyId: { in: storyIds } },
        });

        // Delete subtasks
        await tx.subtask.deleteMany({
          where: { storyId: { in: storyIds } },
        });

        // Delete all stories in the epic
        await tx.story.deleteMany({
          where: { epicId: params.epicId },
        });
      }

      // Delete epic workflow runs (if any)
      await tx.componentRun.deleteMany({
        where: {
          workflowRun: {
            epicId: params.epicId,
          },
        },
      });

      await tx.workflowRun.deleteMany({
        where: { epicId: params.epicId },
      });

      // Delete the epic itself
      // Note: Commits are set to null (onDelete: SetNull), not deleted
      await tx.epic.delete({
        where: { id: params.epicId },
      });
    });

    return {
      id: epic.id,
      key: epic.key,
      title: epic.title,
      storiesDeleted: storyCount,
      cascadeDeleted: {
        subtasks: totalSubtasks,
        useCaseLinks: totalUseCaseLinks,
        workflowRuns: totalWorkflowRuns,
        componentRuns: totalComponentRuns,
        testCases: totalTestCases,
      },
    };
  } catch (error: any) {
    if (error.name === 'MCPError') {
      throw error;
    }
    throw handlePrismaError(error, 'delete_epic');
  }
}
