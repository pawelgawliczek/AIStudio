/**
 * Test Queue Add Tool
 * Adds a story to the test queue with priority-based positioning
 *
 * Business Rules (from baAnalysis):
 * - Default priority = 5 (medium priority on 0-10 scale)
 * - Higher priority values execute earlier in queue
 * - Within same priority, FIFO ordering applies
 * - Position gaps of 100 between entries for efficient insertion
 * - Only one pending/running entry per story allowed (prevents duplicates)
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import {
  NotFoundError,
  ValidationError,
  TestQueueAddParams,
  TestQueueAddResponse,
} from '../../types';
import {
  validateRequired,
  handlePrismaError,
} from '../../utils';

export const tool: Tool = {
  name: 'mcp__vibestudio__test_queue_add',
  description: 'Add story to test queue with priority-based positioning. Returns queue position and estimated wait time.',
  inputSchema: {
    type: 'object',
    properties: {
      storyId: {
        type: 'string',
        description: 'Story UUID (required)',
      },
      priority: {
        type: 'number',
        description: 'Priority (0-10, default: 5). Higher = more urgent. Use 5 for normal stories, 8-10 for critical bugs, 0-2 for low-priority chores.',
        minimum: 0,
        maximum: 10,
        default: 5,
      },
      submittedBy: {
        type: 'string',
        description: 'User/agent identifier (default: "mcp-user")',
      },
    },
    required: ['storyId'],
  },
};

export const metadata = {
  category: 'test-queue',
  domain: 'testing',
  tags: ['test', 'queue', 'automation', 'workflow'],
  version: '1.0.0',
  since: 'sprint-5',
};

/**
 * Handler for adding story to test queue
 *
 * Implementation follows architectAnalysis specifications:
 * 1. Validate storyId exists
 * 2. Check for duplicate pending/running entry (ValidationError if exists)
 * 3. Calculate next position (max position + 100)
 * 4. Calculate queue position (ordinal ranking based on priority)
 * 5. Calculate estimated wait time (entries ahead × 5 minutes)
 * 6. Insert entry with status='pending'
 * 7. Return response with position details
 */
export async function handler(
  prisma: PrismaClient,
  params: TestQueueAddParams,
): Promise<TestQueueAddResponse> {
  try {
    // Validation (AC-1 from baAnalysis)
    validateRequired(params, ['storyId']);

    const priority = params.priority !== undefined ? params.priority : 5;
    const submittedBy = params.submittedBy || 'mcp-user';

    // Validate priority range (0-10)
    if (priority < 0 || priority > 10) {
      throw new ValidationError(
        `Priority must be between 0 and 10, received: ${priority}`,
        {
          priority,
          validRange: [0, 10],
        }
      );
    }

    // 1. Verify story exists (AC-1)
    const story = await prisma.story.findUnique({
      where: { id: params.storyId },
      select: { id: true, key: true },
    });

    if (!story) {
      throw new NotFoundError('Story', params.storyId, {
        searchTool: 'mcp__vibestudio__search_stories',
        createTool: 'mcp__vibestudio__create_story',
      });
    }

    // 1.5. Check for active queue lock (ST-43 integration)
    const activeLock = await prisma.testQueueLock.findFirst({
      where: {
        active: true,
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        reason: true,
        expiresAt: true,
      },
    });

    if (activeLock) {
      throw new ValidationError(
        `Test queue is locked: ${activeLock.reason}. Unlocks at ${activeLock.expiresAt.toISOString()}.`,
        {
          lockId: activeLock.id,
          reason: activeLock.reason,
          expiresAt: activeLock.expiresAt.toISOString(),
          unlockTool: 'mcp__vibestudio__unlock_test_queue',
          statusTool: 'mcp__vibestudio__get_queue_lock_status',
        }
      );
    }

    // 2. Check for duplicate pending/running entry (AC-6 - duplicate prevention)
    const existingEntry = await prisma.testQueue.findFirst({
      where: {
        storyId: params.storyId,
        status: { in: ['pending', 'running'] },
      },
    });

    if (existingEntry) {
      throw new ValidationError(
        `Story ${story.key} already in queue with status=${existingEntry.status}`,
        {
          storyId: params.storyId,
          storyKey: story.key,
          currentStatus: existingEntry.status,
        }
      );
    }

    // 3. Calculate next position with 100-unit gaps (AC-7 - priority ordering)
    const maxPositionResult = await prisma.testQueue.aggregate({
      _max: { position: true },
      where: { status: 'pending' },
    });

    const nextPosition = (maxPositionResult._max.position || 0) + 100;

    // 4. Calculate ordinal queue position based on priority (AC-7)
    // Count entries with higher priority OR same priority but lower position
    const entriesAhead = await prisma.testQueue.count({
      where: {
        status: 'pending',
        OR: [
          { priority: { gt: priority } },
          {
            priority: priority,
            position: { lt: nextPosition },
          },
        ],
      },
    });

    const queuePosition = entriesAhead + 1;

    // 5. Calculate estimated wait time (5 minutes per entry ahead)
    const estimatedWaitMinutes = entriesAhead * 5;

    // Get total queue depth for context
    const totalInQueue = await prisma.testQueue.count({
      where: { status: 'pending' },
    });

    // 6. Insert entry with status='pending' (AC-1)
    const queueEntry = await prisma.testQueue.create({
      data: {
        storyId: params.storyId,
        position: nextPosition,
        priority,
        status: 'pending',
        submittedBy,
      },
    });

    // 7. Return response with position details (AC-1)
    return {
      id: queueEntry.id,
      storyId: params.storyId,
      storyKey: story.key,
      position: nextPosition,
      priority,
      queuePosition,
      estimatedWaitMinutes,
      totalInQueue: totalInQueue + 1, // Include the newly added entry
      status: 'pending',
      message: `Successfully added ${story.key} to test queue at position ${queuePosition} (estimated wait: ${estimatedWaitMinutes} minutes)`,
    };
  } catch (error: any) {
    // Re-throw MCP errors (ValidationError, NotFoundError, etc.)
    if (error.name === 'MCPError' || error.code === 'VALIDATION_ERROR' || error.code === 'NOT_FOUND') {
      throw error;
    }
    // Convert Prisma errors
    throw handlePrismaError(error, 'test_queue_add');
  }
}
