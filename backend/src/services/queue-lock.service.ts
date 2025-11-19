/**
 * Queue Lock Service - Integration with ST-43 queue locking system
 */

import { PrismaClient } from '@prisma/client';
import { Lock, LockStatus } from '../types/migration.types';
import { migrationConfig } from '../config/migration.config';

const prisma = new PrismaClient();

export class QueueLockService {
  private source: string;

  constructor() {
    this.source = migrationConfig.lock.source;
  }

  /**
   * Acquire queue lock for migration
   */
  async acquireLock(reason: string, durationMinutes?: number): Promise<Lock> {
    const duration = durationMinutes || migrationConfig.lock.defaultDuration;

    // Validate duration
    if (duration > migrationConfig.lock.maxDuration) {
      throw new Error(
        `Lock duration ${duration}m exceeds maximum ${migrationConfig.lock.maxDuration}m`
      );
    }

    console.log(`[QueueLockService] Acquiring lock: ${reason} (${duration}m)...`);

    try {
      // Check if lock already exists
      const existingLock = await this.checkLockStatus();
      if (existingLock.locked) {
        throw new Error(
          `Queue is already locked: ${existingLock.reason} (expires at ${existingLock.expiresAt})`
        );
      }

      // Calculate expiry time
      const expiresAt = new Date(Date.now() + duration * 60 * 1000);

      // Create lock in database
      const lock = await prisma.testQueueLock.create({
        data: {
          reason,
          lockedBy: this.source,
          expiresAt,
          active: true,
          metadata: {
            source: this.source,
            acquiredAt: new Date().toISOString(),
            durationMinutes: duration,
          },
        },
      });

      console.log(`[QueueLockService] Lock acquired: ${lock.id}`);

      return {
        id: lock.id,
        reason: lock.reason,
        durationMinutes: duration,
        expiresAt: lock.expiresAt,
        metadata: lock.metadata,
      };
    } catch (error: any) {
      console.error(`[QueueLockService] Failed to acquire lock: ${error.message}`);
      throw error;
    }
  }

  /**
   * Release queue lock
   */
  async releaseLock(lockId?: string): Promise<void> {
    console.log(`[QueueLockService] Releasing lock${lockId ? `: ${lockId}` : ''}...`);

    try {
      if (lockId) {
        // Release specific lock
        await prisma.testQueueLock.update({
          where: { id: lockId },
          data: {
            active: false,
            metadata: {
              releasedAt: new Date().toISOString(),
            },
          },
        });
      } else {
        // Release most recent active lock
        const activeLock = await prisma.testQueueLock.findFirst({
          where: {
            active: true,
            lockedBy: this.source,
          },
          orderBy: {
            createdAt: 'desc',
          },
        });

        if (activeLock) {
          await prisma.testQueueLock.update({
            where: { id: activeLock.id },
            data: {
              active: false,
              metadata: {
                ...(typeof activeLock.metadata === 'object' ? activeLock.metadata : {}),
                releasedAt: new Date().toISOString(),
              },
            },
          });
        }
      }

      console.log('[QueueLockService] Lock released successfully');
    } catch (error: any) {
      console.error(`[QueueLockService] Failed to release lock: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check current lock status
   */
  async checkLockStatus(): Promise<LockStatus> {
    try {
      // Find most recent active lock
      const activeLock = await prisma.testQueueLock.findFirst({
        where: {
          active: true,
          expiresAt: {
            gt: new Date(),
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      if (!activeLock) {
        return { locked: false };
      }

      const now = Date.now();
      const expiresAt = activeLock.expiresAt.getTime();
      const remainingMs = expiresAt - now;
      const remainingMinutes = Math.max(0, Math.floor(remainingMs / 60000));

      return {
        locked: true,
        lockId: activeLock.id,
        reason: activeLock.reason,
        expiresAt: activeLock.expiresAt,
        remainingMinutes,
        lockedBy: activeLock.lockedBy,
      };
    } catch (error: any) {
      console.error(`[QueueLockService] Failed to check lock status: ${error.message}`);
      return { locked: false };
    }
  }

  /**
   * Estimate lock duration based on migration complexity
   */
  estimateLockDuration(migrationCount: number, hasBreakingChanges: boolean): number {
    const baseTime = migrationConfig.lock.defaultDuration;
    const perMigrationTime = 5; // 5 minutes per migration
    const breakingChangeMultiplier = 1.5;

    let duration = baseTime + migrationCount * perMigrationTime;

    if (hasBreakingChanges) {
      duration *= breakingChangeMultiplier;
    }

    // Cap at maximum duration
    return Math.min(duration, migrationConfig.lock.maxDuration);
  }

  /**
   * Renew lock if approaching expiry
   */
  async renewLock(lockId: string, additionalMinutes: number): Promise<void> {
    console.log(`[QueueLockService] Renewing lock ${lockId} for ${additionalMinutes}m...`);

    try {
      const lock = await prisma.testQueueLock.findUnique({
        where: { id: lockId },
      });

      if (!lock) {
        throw new Error(`Lock ${lockId} not found`);
      }

      if (!lock.active) {
        throw new Error(`Lock ${lockId} is not active`);
      }

      // Get current duration from metadata
      const currentDuration = typeof lock.metadata === 'object' && lock.metadata !== null && 'durationMinutes' in lock.metadata
        ? (lock.metadata as any).durationMinutes
        : 60;

      // Calculate new expiry
      const currentExpiry = lock.expiresAt.getTime();
      const newExpiry = new Date(currentExpiry + additionalMinutes * 60 * 1000);

      // Update lock
      await prisma.testQueueLock.update({
        where: { id: lockId },
        data: {
          expiresAt: newExpiry,
          metadata: {
            ...(typeof lock.metadata === 'object' ? lock.metadata : {}),
            durationMinutes: currentDuration + additionalMinutes,
          },
        },
      });

      console.log(`[QueueLockService] Lock renewed until ${newExpiry.toISOString()}`);
    } catch (error: any) {
      console.error(`[QueueLockService] Failed to renew lock: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check if lock needs renewal
   */
  async shouldRenewLock(lockId: string): Promise<boolean> {
    try {
      const lock = await prisma.testQueueLock.findUnique({
        where: { id: lockId },
      });

      if (!lock || !lock.active) {
        return false;
      }

      const now = Date.now();
      const expiresAt = lock.expiresAt.getTime();
      const remainingMs = expiresAt - now;
      const remainingMinutes = Math.floor(remainingMs / 60000);

      // Renew if less than threshold remaining
      return remainingMinutes < migrationConfig.lock.renewThreshold;
    } catch {
      return false;
    }
  }
}
