/**
 * Get Queue Lock Status Tool
 * Returns current test queue lock status with details
 *
 * Business Rules (from baAnalysis):
 * - Returns isLocked boolean with optional lock details
 * - Auto-expires locks past their timeout (lazy expiration)
 * - Read-only operation (except auto-expiry cleanup)
 * - Human-readable time formatting for expiresIn
 * - Fast query performance (<5ms target via indexed query)
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import {
  QueueLockStatusResponse,
} from '../../types';
import {
  handlePrismaError,
} from '../../utils';

export const tool: Tool = {
  name: 'mcp__vibestudio__get_queue_lock_status',
  description: 'Get current test queue lock status. Auto-expires locks past their timeout. Returns lock details if locked, null if unlocked.',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
};

export const metadata = {
  category: 'test-queue',
  domain: 'testing',
  tags: ['test', 'queue', 'status', 'lock', 'monitoring'],
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
 * Handler for getting queue lock status
 *
 * Implementation follows architectAnalysis specifications:
 * 1. Find active lock (indexed query for performance)
 * 2. Return unlocked if no lock exists
 * 3. Auto-expire if past expiration (lazy expiration - AC-5)
 * 4. Calculate time remaining
 * 5. Return lock details with human-readable times
 */
export async function handler(
  prisma: PrismaClient,
  params: object, // No params needed
): Promise<QueueLockStatusResponse> {
  try {
    // 1. Find active lock (indexed query on active + expiresAt for <5ms performance)
    const lock = await prisma.testQueueLock.findFirst({
      where: { active: true },
      orderBy: { lockedAt: 'desc' },
    });

    // 2. No lock exists
    if (!lock) {
      return { isLocked: false };
    }

    const now = new Date();

    // 3. Auto-expire if past expiration (lazy expiration - AC-5 from baAnalysis)
    if (lock.expiresAt < now) {
      await prisma.testQueueLock.update({
        where: { id: lock.id },
        data: { active: false },
      });
      return { isLocked: false };
    }

    // 4. Lock is active - calculate time remaining
    const expiresInMs = lock.expiresAt.getTime() - now.getTime();
    const expiresInMinutes = Math.ceil(expiresInMs / 60000);
    const expiresInStr = formatDuration(expiresInMinutes);

    // 5. Return lock details (AC-3 from baAnalysis)
    return {
      isLocked: true,
      lock: {
        id: lock.id,
        reason: lock.reason,
        lockedBy: lock.lockedBy,
        lockedAt: lock.lockedAt.toISOString(),
        expiresAt: lock.expiresAt.toISOString(),
        expiresIn: expiresInStr,
        isExpired: false,
      },
    };
  } catch (error: any) {
    // Re-throw MCP errors (ValidationError, NotFoundError, etc.)
    if (error.name === 'MCPError' || error.code === 'VALIDATION_ERROR' || error.code === 'NOT_FOUND') {
      throw error;
    }
    // Convert Prisma errors
    throw handlePrismaError(error, 'get_queue_lock_status');
  }
}
