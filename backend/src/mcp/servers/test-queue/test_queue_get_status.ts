/**
 * Test Queue Get Status Tool
 * Gets comprehensive status details for a story's queue entry
 *
 * Business Rules (from baAnalysis):
 * - Status values: pending, running, passed, failed, cancelled, skipped (AC-4)
 * - Include test results JSON when available (passed/failed)
 * - Include error message when status = failed
 * - Include timestamps (created, updated) for audit trail
 * - If status = pending, also include queue position and estimated wait time
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import {
  NotFoundError,
  TestQueueGetStatusParams,
  TestQueueStatusResponse,
} from '../../types';
import {
  validateRequired,
  handlePrismaError,
} from '../../utils';

export const tool: Tool = {
  name: 'mcp__vibestudio__test_queue_get_status',
  description: 'Get comprehensive status details for a story\'s queue entry. Returns most recent entry if multiple exist. Includes queue position and estimated wait for pending entries.',
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
  tags: ['test', 'queue', 'automation', 'workflow', 'status'],
  version: '1.0.0',
  since: 'sprint-5',
};

/**
 * Handler for getting status details for a story's queue entry
 *
 * Implementation follows architectAnalysis specifications:
 * 1. Find most recent queue entry for story (any status)
 * 2. If not found → NotFoundError
 * 3. Include story details (key, title)
 * 4. If status = pending: calculate queue position and estimated wait time
 * 5. Return comprehensive status response
 */
export async function handler(
  prisma: PrismaClient,
  params: TestQueueGetStatusParams,
): Promise<TestQueueStatusResponse> {
  try {
    // Validation (AC-4)
    validateRequired(params as unknown as Record<string, unknown>, ['storyId']);

    // 1. Find most recent queue entry for story (any status) (AC-4)
    const entry = await prisma.testQueue.findFirst({
      where: { storyId: params.storyId },
      orderBy: { createdAt: 'desc' },
      include: {
        story: {
          select: { key: true, title: true },
        },
      },
    });

    // 2. If not found → NotFoundError
    if (!entry) {
      throw new NotFoundError(
        'TestQueue entry for story',
        params.storyId,
        {
          searchTool: 'mcp__vibestudio__test_queue_list',
          createTool: 'mcp__vibestudio__test_queue_add',
        }
      );
    }

    // Base response with all fields (AC-4)
    const response: TestQueueStatusResponse = {
      id: entry.id,
      storyId: params.storyId,
      storyKey: entry.story.key,
      storyTitle: entry.story.title,
      position: entry.position,
      priority: entry.priority,
      status: entry.status,
      submittedBy: entry.submittedBy,
      testResults: entry.testResults || undefined,
      errorMessage: entry.errorMessage || undefined,
      createdAt: entry.createdAt.toISOString(),
      updatedAt: entry.updatedAt.toISOString(),
    };

    // 4. If status = pending, calculate queue position and estimated wait time
    if (entry.status === 'pending') {
      const entriesAhead = await prisma.testQueue.count({
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
      });

      response.queuePosition = entriesAhead + 1;
      response.estimatedWaitMinutes = entriesAhead * 5;
    }

    return response;
  } catch (error: any) {
    // Re-throw MCP errors
    if (error.name === 'MCPError') {
      throw error;
    }
    // Convert Prisma errors
    throw handlePrismaError(error, 'test_queue_get_status');
  }
}
