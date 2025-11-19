/**
 * Test Queue List Tool
 * Lists queue entries with optional status filtering and pagination
 *
 * Business Rules (from baAnalysis):
 * - Queue ordered by priority DESC, then position ASC (AC-2, AC-7)
 * - Include story metadata (key, title) for context
 * - Support status filtering (pending, running, passed, failed, cancelled, skipped)
 * - Support pagination for large queues (default 20, max 100 per page)
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import {
  TestQueueListParams,
  TestQueueListResponse,
  TestQueueEntryResponse,
} from '../../types';
import {
  handlePrismaError,
} from '../../utils';

export const tool: Tool = {
  name: 'mcp__vibestudio__test_queue_list',
  description: 'List test queue entries with optional status filter and pagination. Results ordered by priority DESC, position ASC.',
  inputSchema: {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        enum: ['pending', 'running', 'passed', 'failed', 'cancelled', 'skipped'],
        description: 'Filter by queue status (optional)',
      },
      limit: {
        type: 'number',
        description: 'Max results (default: 20, max: 100)',
        minimum: 1,
        maximum: 100,
        default: 20,
      },
      offset: {
        type: 'number',
        description: 'Pagination offset (default: 0)',
        minimum: 0,
        default: 0,
      },
    },
  },
};

export const metadata = {
  category: 'test-queue',
  domain: 'testing',
  tags: ['test', 'queue', 'automation', 'workflow', 'list'],
  version: '1.0.0',
  since: 'sprint-5',
};

/**
 * Handler for listing test queue entries
 *
 * Implementation follows architectAnalysis specifications:
 * 1. Build where clause with optional status filter
 * 2. Get total count for pagination metadata
 * 3. Query entries ordered by priority DESC, position ASC
 * 4. Include story details (key, title) via join
 * 5. Return paginated response
 */
export async function handler(
  prisma: PrismaClient,
  params: TestQueueListParams,
): Promise<TestQueueListResponse> {
  try {
    // Apply defaults
    const limit = Math.min(params.limit || 20, 100); // Cap at 100
    const offset = params.offset || 0;

    // 1. Build where clause with optional status filter (AC-2)
    const whereClause: any = {};
    if (params.status) {
      whereClause.status = params.status;
    }

    // 2. Get total count and entries in parallel (AC-2)
    const [total, entries] = await Promise.all([
      prisma.testQueue.count({ where: whereClause }),
      prisma.testQueue.findMany({
        where: whereClause,
        // 3. Order by priority DESC (higher priority first), then position ASC (FIFO within priority)
        orderBy: [
          { priority: 'desc' },
          { position: 'asc' },
        ],
        // 4. Include story details (key, title) via join
        include: {
          story: {
            select: { id: true, key: true, title: true },
          },
        },
        skip: offset,
        take: limit,
      }),
    ]);

    // 5. Format entries for response
    const formattedEntries: TestQueueEntryResponse[] = entries.map(entry => ({
      id: entry.id,
      storyId: entry.storyId,
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
    }));

    return {
      entries: formattedEntries,
      total,
      limit,
      offset,
    };
  } catch (error: any) {
    // Re-throw MCP errors
    if (error.name === 'MCPError') {
      throw error;
    }
    // Convert Prisma errors
    throw handlePrismaError(error, 'test_queue_list');
  }
}
