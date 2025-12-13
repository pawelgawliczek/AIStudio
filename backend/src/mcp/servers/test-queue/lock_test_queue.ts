/**
 * Lock Test Queue Tool
 * Locks the test queue to prevent test execution during schema migrations
 *
 * Business Rules (from baAnalysis):
 * - Only one active lock permitted at any time (singleton pattern)
 * - Lock must include human-readable reason (min 10 characters)
 * - Default timeout: 60 minutes (configurable 1-480 minutes)
 * - Audit trail: locked_by, locked_at, expires_at tracked
 * - Auto-expiry prevents permanent deadlock
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import {
  ValidationError,
  LockTestQueueParams,
  LockTestQueueResponse,
} from '../../types';
import {
  validateRequired,
  handlePrismaError,
} from '../../utils';

export const tool: Tool = {
  name: 'mcp__vibestudio__lock_test_queue',
  description: 'Lock test queue to prevent execution during migrations. Singleton lock with expiration (default 60 min). Returns lock ID.',
  inputSchema: {
    type: 'object',
    properties: {
      reason: {
        type: 'string',
        description: 'Human-readable reason for lock (e.g., "Schema migration in progress"). Min 10 characters.',
        minLength: 10,
      },
      durationMinutes: {
        type: 'number',
        description: 'Lock timeout in minutes (default: 60, range: 1-480)',
        minimum: 1,
        maximum: 480,
        default: 60,
      },
      lockedBy: {
        type: 'string',
        description: 'User/agent identifier (default: "mcp-user")',
      },
      metadata: {
        type: 'object',
        description: 'Optional metadata (story ID, breaking patterns, migration details)',
      },
    },
    required: ['reason'],
  },
};

export const metadata = {
  category: 'test-queue',
  domain: 'testing',
  tags: ['test', 'queue', 'lock', 'migration', 'safety'],
  version: '1.0.0',
  since: 'sprint-6',
};

/**
 * Handler for locking test queue
 *
 * Implementation follows architectAnalysis specifications:
 * 1. Validate reason length (min 10 chars)
 * 2. Validate duration range (1-480 minutes)
 * 3. Check for existing active lock (singleton enforcement)
 * 4. Calculate expiry time
 * 5. Create lock record
 * 6. Return lock details and confirmation
 */
export async function handler(
  prisma: PrismaClient,
  params: LockTestQueueParams,
): Promise<LockTestQueueResponse> {
  try {
    // 1. Validation (AC-1 from baAnalysis)
    validateRequired(params, ['reason']);

    if (params.reason.length < 10) {
      throw new ValidationError(
        'Lock reason must be at least 10 characters for clarity',
        {
          reason: params.reason,
          minLength: 10,
          actualLength: params.reason.length,
          suggestion: 'Provide a clear explanation like "Breaking schema migration: user roles table restructure"',
        }
      );
    }

    const durationMinutes = params.durationMinutes ?? 60;
    if (durationMinutes < 1 || durationMinutes > 480) {
      throw new ValidationError(
        `Duration must be between 1-480 minutes, received: ${durationMinutes}`,
        {
          durationMinutes,
          validRange: [1, 480],
          recommendation: 'Use 60-90 minutes for typical migrations, up to 480 for complex changes',
        }
      );
    }

    const lockedBy = params.lockedBy || 'mcp-user';

    // 2. Check for existing active lock (singleton enforcement - AC-4)
    const existingLock = await prisma.testQueueLock.findFirst({
      where: {
        active: true,
        expiresAt: { gt: new Date() },
      },
      orderBy: { lockedAt: 'desc' },
    });

    if (existingLock) {
      throw new ValidationError(
        `Test queue is already locked: ${existingLock.reason}`,
        {
          lockId: existingLock.id,
          lockedBy: existingLock.lockedBy,
          lockedAt: existingLock.lockedAt.toISOString(),
          expiresAt: existingLock.expiresAt.toISOString(),
          suggestions: [
            'Wait for current lock to expire',
            'Use mcp__vibestudio__get_queue_lock_status to check lock details',
            'Use mcp__vibestudio__unlock_test_queue if you own this lock',
            'Contact lock owner if urgent',
          ],
        }
      );
    }

    // 3. Calculate expiry time (AC-5)
    const lockedAt = new Date();
    const expiresAt = new Date(lockedAt.getTime() + durationMinutes * 60 * 1000);

    // 4. Create lock (AC-1)
    const lock = await prisma.testQueueLock.create({
      data: {
        reason: params.reason,
        lockedBy,
        lockedAt,
        expiresAt,
        active: true,
        metadata: params.metadata || null,
      },
    });

    // 5. Return response
    return {
      id: lock.id,
      reason: lock.reason,
      lockedBy: lock.lockedBy,
      lockedAt: lock.lockedAt.toISOString(),
      expiresAt: lock.expiresAt.toISOString(),
      message: `Test queue locked successfully. Lock expires in ${durationMinutes} minutes at ${lock.expiresAt.toISOString()}. Use mcp__vibestudio__unlock_test_queue to unlock manually.`,
    };
  } catch (error: any) {
    // Re-throw MCP errors (ValidationError, NotFoundError, etc.)
    if (error.name === 'MCPError' || error.code === 'VALIDATION_ERROR' || error.code === 'NOT_FOUND') {
      throw error;
    }
    // Convert Prisma errors
    throw handlePrismaError(error, 'lock_test_queue');
  }
}
