/**
 * Unlock Test Queue Tool
 * Unlocks the test queue to resume test execution after migrations
 *
 * Business Rules (from baAnalysis):
 * - Unlock by lock ID or most recent active lock
 * - Soft delete (set active=false) for audit trail
 * - Idempotent operation (no error if already unlocked)
 * - Force option available for emergency situations
 * - Returns lock duration for metrics
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import {
  NotFoundError,
  UnlockTestQueueParams,
  UnlockTestQueueResponse,
} from '../../types';
import {
  handlePrismaError,
} from '../../utils';

export const tool: Tool = {
  name: 'mcp__vibestudio__unlock_test_queue',
  description: 'Unlock test queue to resume test execution. Idempotent operation (no error if already unlocked).',
  inputSchema: {
    type: 'object',
    properties: {
      lockId: {
        type: 'string',
        description: 'Specific lock UUID to unlock (optional - unlocks most recent if not provided)',
      },
      force: {
        type: 'boolean',
        description: 'Force unlock regardless of ownership (default: false)',
        default: false,
      },
    },
    required: [],
  },
};

export const metadata = {
  category: 'test-queue',
  domain: 'testing',
  tags: ['test', 'queue', 'unlock', 'migration', 'resume'],
  version: '1.0.0',
  since: 'sprint-6',
};

/**
 * Helper function to format duration in human-readable format
 */
function formatDuration(minutes: number): string {
  if (minutes < 1) return 'less than 1 minute';
  if (minutes === 1) return '1 minute';
  if (minutes < 60) return `${minutes} minutes`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours} hour${hours > 1 ? 's' : ''}`;
}

/**
 * Handler for unlocking test queue
 *
 * Implementation follows architectAnalysis specifications:
 * 1. Find lock (by ID or most recent active)
 * 2. Handle no active lock gracefully (idempotent)
 * 3. Calculate lock duration
 * 4. Set active=false (soft delete for audit trail)
 * 5. Return confirmation with duration
 */
export async function handler(
  prisma: PrismaClient,
  params: UnlockTestQueueParams,
): Promise<UnlockTestQueueResponse> {
  try {
    let lock;

    // 1. Find lock (by ID or most recent active)
    if (params.lockId) {
      // Find specific lock by ID
      lock = await prisma.testQueueLock.findUnique({
        where: { id: params.lockId },
      });

      if (!lock) {
        throw new NotFoundError('TestQueueLock', params.lockId, {
          searchTool: 'mcp__vibestudio__get_queue_lock_status',
          suggestions: [
            'Use get_queue_lock_status to see current lock',
            'Lock may have already been unlocked',
            'Check if lock ID is correct',
          ],
        });
      }
    } else {
      // Find most recent active lock
      lock = await prisma.testQueueLock.findFirst({
        where: { active: true },
        orderBy: { lockedAt: 'desc' },
      });
    }

    // 2. Handle no active lock (idempotent - AC from baAnalysis BR-2)
    if (!lock || !lock.active) {
      return {
        id: lock?.id ?? 'none',
        reason: lock?.reason ?? 'No active lock',
        duration: '0 minutes',
        message: 'Test queue is already unlocked. No action taken.',
      };
    }

    // 3. Calculate lock duration
    const durationMs = new Date().getTime() - lock.lockedAt.getTime();
    const durationMinutes = Math.floor(durationMs / 60000);
    const durationStr = formatDuration(durationMinutes);

    // 4. Unlock (soft delete - AC-6)
    await prisma.testQueueLock.update({
      where: { id: lock.id },
      data: { active: false },
    });

    // 5. Return response
    return {
      id: lock.id,
      reason: lock.reason,
      duration: durationStr,
      message: `Test queue unlocked successfully. Lock was active for ${durationStr}. Test processing can now resume.`,
    };
  } catch (error: any) {
    // Re-throw MCP errors (NotFoundError, ValidationError, etc.)
    if (error.name === 'MCPError' || error.code === 'NOT_FOUND' || error.code === 'VALIDATION_ERROR') {
      throw error;
    }
    // Convert Prisma errors
    throw handlePrismaError(error, 'unlock_test_queue');
  }
}
