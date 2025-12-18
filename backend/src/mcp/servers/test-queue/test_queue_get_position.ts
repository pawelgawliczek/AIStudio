/**
 * Test Queue Get Position Tool
 * Gets ordinal queue position and estimated wait time for a specific story
 *
 * Business Rules (from baAnalysis):
 * - Queue position is ordinal ranking (1st, 2nd, 3rd, not database position value) (AC-3)
 * - Position calculated based on: priority DESC, then position ASC
 * - Only count pending entries when calculating position
 * - Estimated wait time = 5 minutes × number of entries ahead
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import {
  NotFoundError,
  TestQueueGetPositionParams,
  TestQueuePositionResponse,
} from '../../types';
import {
  validateRequired,
  handlePrismaError,
} from '../../utils';

export const tool: Tool = {
  name: 'mcp__vibestudio__test_queue_get_position',
  description: 'Get ordinal queue position and estimated wait time for a specific story. Only returns data for pending entries.',
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
  tags: ['test', 'queue', 'automation', 'workflow', 'position'],
  version: '1.0.0',
  since: 'sprint-5',
};

/**
 * Handler for getting queue position for a story
 *
 * Implementation follows architectAnalysis specifications:
 * 1. Find pending queue entry for story
 * 2. If not found → NotFoundError
 * 3. Calculate ordinal position (entries ahead + 1)
 * 4. Calculate estimated wait time (entries ahead × 5 minutes)
 * 5. Get total queue depth
 * 6. Return position details
 */
export async function handler(
  prisma: PrismaClient,
  params: TestQueueGetPositionParams,
): Promise<TestQueuePositionResponse> {
  try {
    // Validation (AC-3)
    validateRequired(params as unknown as Record<string, unknown>, ['storyId']);

    // 1. Find pending queue entry for story (AC-3)
    const entry = await prisma.testQueue.findFirst({
      where: {
        storyId: params.storyId,
        status: 'pending',
      },
      include: {
        story: {
          select: { key: true },
        },
      },
    });

    // 2. If not found → NotFoundError
    if (!entry) {
      throw new NotFoundError(
        'Pending TestQueue entry for story',
        params.storyId,
        {
          searchTool: 'mcp__vibestudio__test_queue_get_status',
          createTool: 'mcp__vibestudio__test_queue_add',
        }
      );
    }

    // 3. Calculate ordinal position and total queue depth in parallel (AC-3)
    // Count entries with higher priority OR same priority but lower position
    const [entriesAhead, totalPending] = await Promise.all([
      prisma.testQueue.count({
        where: {
          status: 'pending',
          OR: [
            { priority: { gt: entry.priority } },
            {
              priority: entry.priority,
              position: { lt: entry.position },
            },
          ],
        },
      }),
      prisma.testQueue.count({ where: { status: 'pending' } }),
    ]);

    const queuePosition = entriesAhead + 1;

    // 4. Calculate estimated wait time (5 minutes per entry ahead)
    const estimatedWaitMinutes = entriesAhead * 5;

    // 6. Return position details
    return {
      id: entry.id,
      storyId: params.storyId,
      storyKey: entry.story.key,
      position: entry.position,
      queuePosition,
      priority: entry.priority,
      estimatedWaitMinutes,
      totalInQueue: totalPending,
      status: entry.status,
    };
  } catch (error: any) {
    // Re-throw MCP errors
    if (error.name === 'MCPError') {
      throw error;
    }
    // Convert Prisma errors
    throw handlePrismaError(error, 'test_queue_get_position');
  }
}
