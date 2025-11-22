/**
 * Deployment Lock Service - ST-77 Production Deployment Safety System
 *
 * Implements singleton deployment lock to prevent concurrent production deployments.
 * Based on QueueLockService pattern from ST-43.
 *
 * Key features:
 * - Database-level singleton enforcement (unique index on active=true)
 * - Auto-expiry after configurable duration (default 30 minutes)
 * - Lock renewal for long-running deployments
 * - Force release for emergencies
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface DeploymentLockResult {
  id: string;
  reason: string;
  durationMinutes: number;
  expiresAt: Date;
  metadata: Record<string, any>;
}

export interface DeploymentLockStatus {
  locked: boolean;
  lockId?: string;
  reason?: string;
  lockedBy?: string;
  expiresAt?: Date;
  remainingMinutes?: number;
  storyId?: string;
  prNumber?: number;
}

export class DeploymentLockService {
  private source: string = 'production-deployment';
  private defaultDuration: number = 30; // 30 minutes
  private maxDuration: number = 60; // 60 minutes
  private renewThreshold: number = 5; // Renew if < 5 minutes remaining

  /**
   * Acquire production deployment lock (singleton)
   * @throws Error if lock already held by another deployment
   */
  async acquireLock(
    reason: string,
    storyId?: string,
    prNumber?: number,
    durationMinutes?: number
  ): Promise<DeploymentLockResult> {
    const duration = durationMinutes || this.defaultDuration;

    // Validate duration
    if (duration > this.maxDuration) {
      throw new Error(
        `Lock duration ${duration}m exceeds maximum ${this.maxDuration}m`
      );
    }

    console.log(`[DeploymentLockService] Acquiring lock: ${reason} (${duration}m)...`);

    try {
      // Check if lock already exists
      const existingLock = await this.checkLockStatus();
      if (existingLock.locked) {
        const error = new Error(
          `Production deployment locked by ${existingLock.lockedBy}. ` +
          `Reason: ${existingLock.reason}. ` +
          `Expires at ${existingLock.expiresAt?.toISOString()} ` +
          `(${existingLock.remainingMinutes} minutes remaining)`
        );
        (error as any).lockStatus = existingLock;
        throw error;
      }

      // Calculate expiry time
      const expiresAt = new Date(Date.now() + duration * 60 * 1000);

      // Create lock in database (unique index enforces singleton)
      const lock = await prisma.deploymentLock.create({
        data: {
          reason,
          lockedBy: this.source,
          lockedAt: new Date(),
          expiresAt,
          active: true,
          storyId: storyId || null,
          prNumber: prNumber || null,
          metadata: {
            source: this.source,
            acquiredAt: new Date().toISOString(),
            durationMinutes: duration,
            storyId,
            prNumber,
          },
        },
      });

      console.log(`[DeploymentLockService] Lock acquired: ${lock.id}`);

      return {
        id: lock.id,
        reason: lock.reason,
        durationMinutes: duration,
        expiresAt: lock.expiresAt,
        metadata: lock.metadata as Record<string, any>,
      };
    } catch (error: any) {
      // Check if unique constraint violation (another deployment acquired lock concurrently)
      if (error.code === '23505' || error.code === 'P2002') {
        const existingLock = await this.checkLockStatus();
        const concurrencyError = new Error(
          `Concurrent deployment detected. Lock acquired by ${existingLock.lockedBy}`
        );
        (concurrencyError as any).lockStatus = existingLock;
        throw concurrencyError;
      }

      console.error(`[DeploymentLockService] Failed to acquire lock: ${error.message}`);
      throw error;
    }
  }

  /**
   * Release deployment lock and record release timestamp
   */
  async releaseLock(lockId?: string): Promise<void> {
    console.log(`[DeploymentLockService] Releasing lock${lockId ? `: ${lockId}` : ''}...`);

    try {
      if (lockId) {
        // Release specific lock
        await prisma.deploymentLock.update({
          where: { id: lockId },
          data: {
            active: false,
            releasedAt: new Date(),
          },
        });
      } else {
        // Release most recent active lock
        const activeLock = await prisma.deploymentLock.findFirst({
          where: {
            active: true,
            lockedBy: this.source,
          },
          orderBy: {
            createdAt: 'desc',
          },
        });

        if (activeLock) {
          await prisma.deploymentLock.update({
            where: { id: activeLock.id },
            data: {
              active: false,
              releasedAt: new Date(),
            },
          });
        }
      }

      console.log('[DeploymentLockService] Lock released successfully');
    } catch (error: any) {
      console.error(`[DeploymentLockService] Failed to release lock: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check current lock status
   * @returns Lock details if active, {locked: false} if unlocked
   */
  async checkLockStatus(): Promise<DeploymentLockStatus> {
    try {
      // Find most recent active lock (not expired)
      const activeLock = await prisma.deploymentLock.findFirst({
        where: {
          active: true,
          expiresAt: {
            gt: new Date(),
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          story: {
            select: {
              id: true,
              key: true,
            },
          },
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
        lockedBy: activeLock.lockedBy,
        expiresAt: activeLock.expiresAt,
        remainingMinutes,
        storyId: activeLock.storyId || undefined,
        prNumber: activeLock.prNumber || undefined,
      };
    } catch (error: any) {
      console.error(`[DeploymentLockService] Failed to check lock status: ${error.message}`);
      return { locked: false };
    }
  }

  /**
   * Renew lock expiration (for long deployments)
   */
  async renewLock(lockId: string, additionalMinutes: number): Promise<void> {
    console.log(`[DeploymentLockService] Renewing lock ${lockId} for ${additionalMinutes}m...`);

    try {
      const lock = await prisma.deploymentLock.findUnique({
        where: { id: lockId },
      });

      if (!lock) {
        throw new Error(`Lock ${lockId} not found`);
      }

      if (!lock.active) {
        throw new Error(`Lock ${lockId} is not active`);
      }

      // Get current duration from metadata
      const metadata = lock.metadata as any;
      const currentDuration = metadata?.durationMinutes || this.defaultDuration;

      // Calculate new expiry
      const currentExpiry = lock.expiresAt.getTime();
      const newExpiry = new Date(currentExpiry + additionalMinutes * 60 * 1000);

      // Update lock
      await prisma.deploymentLock.update({
        where: { id: lockId },
        data: {
          expiresAt: newExpiry,
          metadata: {
            ...(metadata || {}),
            durationMinutes: currentDuration + additionalMinutes,
            renewalCount: (metadata?.renewalCount || 0) + 1,
            lastRenewedAt: new Date().toISOString(),
          },
        },
      });

      console.log(`[DeploymentLockService] Lock renewed until ${newExpiry.toISOString()}`);
    } catch (error: any) {
      console.error(`[DeploymentLockService] Failed to renew lock: ${error.message}`);
      throw error;
    }
  }

  /**
   * Force release lock (emergency use only)
   * @param reason - Justification for force release
   */
  async forceReleaseLock(lockId: string, reason: string): Promise<void> {
    console.log(`[DeploymentLockService] Force releasing lock ${lockId}. Reason: ${reason}`);

    try {
      const lock = await prisma.deploymentLock.findUnique({
        where: { id: lockId },
      });

      if (!lock) {
        throw new Error(`Lock ${lockId} not found`);
      }

      await prisma.deploymentLock.update({
        where: { id: lockId },
        data: {
          active: false,
          releasedAt: new Date(),
          metadata: {
            ...(lock.metadata as any || {}),
            forceReleased: true,
            forceReleaseReason: reason,
            forceReleasedAt: new Date().toISOString(),
          },
        },
      });

      console.log('[DeploymentLockService] Lock force released successfully');
    } catch (error: any) {
      console.error(`[DeploymentLockService] Failed to force release lock: ${error.message}`);
      throw error;
    }
  }

  /**
   * Auto-expire stale locks (background job)
   * Should be called periodically (e.g., every 5 minutes)
   */
  async expireStaleLocks(): Promise<number> {
    console.log('[DeploymentLockService] Checking for expired locks...');

    try {
      const expiredLocks = await prisma.deploymentLock.updateMany({
        where: {
          active: true,
          expiresAt: {
            lt: new Date(),
          },
        },
        data: {
          active: false,
          releasedAt: new Date(),
        },
      });

      if (expiredLocks.count > 0) {
        console.log(`[DeploymentLockService] Expired ${expiredLocks.count} stale lock(s)`);
      }

      return expiredLocks.count;
    } catch (error: any) {
      console.error(`[DeploymentLockService] Failed to expire stale locks: ${error.message}`);
      return 0;
    }
  }

  /**
   * Check if lock needs renewal
   */
  async shouldRenewLock(lockId: string): Promise<boolean> {
    try {
      const lock = await prisma.deploymentLock.findUnique({
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
      return remainingMinutes < this.renewThreshold;
    } catch {
      return false;
    }
  }
}
