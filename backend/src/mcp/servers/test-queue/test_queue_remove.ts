/**
 * Test Queue Remove Tool
 * Removes story from queue by setting status to 'cancelled'
 *
 * Business Rules (from baAnalysis):
 * - Can only remove entries with status pending or running (AC-5)
 * - Removal sets status = cancelled (soft delete for audit trail)
 * - If multiple entries exist for story, remove most recent pending/running
 * - Completed tests (passed/failed) cannot be cancelled
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import {
  NotFoundError,
  TestQueueRemoveParams,
  TestQueueRemoveResponse,
} from '../../types';
import {
  validateRequired,
  handlePrismaError,
} from '../../utils';

export const tool: Tool = {
  name: 'mcp__vibestudio__test_queue_remove',
  description: 'Remove story from queue by setting status to cancelled. Only works for pending or running entries. Completed tests cannot be cancelled.',
  inputSchema: {
    type: 'object',
    properties: {
      storyId: {
        type: 'string',
        description: 'Story UUID (required)',
      },
    },
    required: ['storyId'],
  },
};

export const metadata = {
  category: 'test-queue',
  domain: 'testing',
  tags: ['test', 'queue', 'automation', 'workflow', 'cancel'],
  version: '1.0.0',
  since: 'sprint-5',
};

/**
 * Handler for removing story from queue
 *
 * Implementation follows architectAnalysis specifications:
 * 1. Find pending or running entry for story
 * 2. If not found → NotFoundError with suggestions
 * 3. Update status to 'cancelled' (soft delete)
 * 4. Return confirmation with previous status
 */
export async function handler(
  prisma: PrismaClient,
  params: TestQueueRemoveParams,
): Promise<TestQueueRemoveResponse> {
  try {
    // Validation (AC-5)
    validateRequired(params as unknown as Record<string, unknown>, ['storyId']);

    // 1. Find pending or running entry for story (AC-5)
    const entry = await prisma.testQueue.findFirst({
      where: {
        storyId: params.storyId,
        status: { in: ['pending', 'running'] },
      },
      include: {
        story: {
          select: { key: true },
        },
      },
    });

    // 2. If not found → NotFoundError with suggestions
    if (!entry) {
      throw new NotFoundError(
        'Pending or running TestQueue entry for story',
        params.storyId,
        {
          searchTool: 'mcp__vibestudio__test_queue_get_status',
          createTool: 'mcp__vibestudio__test_queue_add',
        }
      );
    }

    const previousStatus = entry.status;

    // 3. Update status to 'cancelled' (soft delete) (AC-5)
    await prisma.testQueue.update({
      where: { id: entry.id },
      data: { status: 'cancelled' },
    });

    // 4. Return confirmation with previous status
    return {
      id: entry.id,
      storyId: params.storyId,
      storyKey: entry.story.key,
      previousStatus,
      message: `Successfully cancelled ${entry.story.key} from test queue (previous status: ${previousStatus})`,
    };
  } catch (error: any) {
    // Re-throw MCP errors
    if (error.name === 'MCPError') {
      throw error;
    }
    // Convert Prisma errors
    throw handlePrismaError(error, 'test_queue_remove');
  }
}
