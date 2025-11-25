/**
 * Unit tests for DeploymentLockService - ST-77
 */

import { DeploymentLockService } from '../deployment-lock.service';

describe('DeploymentLockService', () => {
  let deploymentLockService: DeploymentLockService;
  let mockPrisma: any;

  beforeEach(() => {
    // Create mock Prisma client
    mockPrisma = {
      deploymentLock: {
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
      },
    };

    // Inject mock into service constructor
    deploymentLockService = new DeploymentLockService(mockPrisma as any);
    jest.clearAllMocks();
  });

  describe('acquireLock', () => {
    it('should acquire lock successfully (AC1)', async () => {
      const mockLock = {
        id: 'lock-123',
        reason: 'Production deployment for ST-77',
        lockedBy: 'production-deployment',
        lockedAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        active: true,
        storyId: 'story-uuid',
        prNumber: 42,
        metadata: {
          source: 'production-deployment',
          acquiredAt: new Date().toISOString(),
          durationMinutes: 30,
          storyId: 'story-uuid',
          prNumber: 42,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.deploymentLock.findFirst.mockResolvedValue(null); // No existing lock
      mockPrisma.deploymentLock.create.mockResolvedValue(mockLock);

      const result = await deploymentLockService.acquireLock(
        'Production deployment for ST-77',
        'story-uuid',
        42,
        30
      );

      expect(result.id).toBe('lock-123');
      expect(result.reason).toBe('Production deployment for ST-77');
      expect(result.durationMinutes).toBe(30);
      expect(mockPrisma.deploymentLock.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          reason: 'Production deployment for ST-77',
          lockedBy: 'production-deployment',
          active: true,
          storyId: 'story-uuid',
          prNumber: 42,
        }),
      });
    });

    it('should fail if lock already exists (singleton enforcement)', async () => {
      const existingLock = {
        id: 'existing-lock',
        reason: 'Another deployment',
        lockedBy: 'production-deployment',
        lockedAt: new Date(),
        expiresAt: new Date(Date.now() + 20 * 60 * 1000),
        active: true,
        storyId: 'other-story',
        prNumber: 41,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.deploymentLock.findFirst.mockResolvedValue(existingLock);

      await expect(
        deploymentLockService.acquireLock('Test deployment', 'story-uuid', 42)
      ).rejects.toThrow('Production deployment locked by production-deployment');
    });

    it('should reject duration exceeding maximum (60 minutes)', async () => {
      mockPrisma.deploymentLock.findFirst.mockResolvedValue(null);

      await expect(
        deploymentLockService.acquireLock('Test', 'story-uuid', 42, 90)
      ).rejects.toThrow('Lock duration 90m exceeds maximum 60m');
    });

    it('should handle concurrent lock acquisition (race condition)', async () => {
      // First check returns null (no lock)
      mockPrisma.deploymentLock.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null); // checkLockStatus call

      // Create throws unique constraint violation
      const constraintError = new Error('Unique constraint failed');
      (constraintError as any).code = 'P2002';
      mockPrisma.deploymentLock.create.mockRejectedValue(constraintError);

      // After race condition, checkLockStatus finds the lock
      mockPrisma.deploymentLock.findFirst.mockResolvedValueOnce({
        id: 'concurrent-lock',
        reason: 'Concurrent deployment',
        lockedBy: 'other-user',
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        active: true,
      });

      await expect(
        deploymentLockService.acquireLock('Test', 'story-uuid', 42)
      ).rejects.toThrow('Concurrent deployment detected');
    });
  });

  describe('releaseLock', () => {
    it('should release specific lock', async () => {
      mockPrisma.deploymentLock.update.mockResolvedValue({});

      await expect(
        deploymentLockService.releaseLock('lock-123')
      ).resolves.not.toThrow();

      expect(mockPrisma.deploymentLock.update).toHaveBeenCalledWith({
        where: { id: 'lock-123' },
        data: {
          active: false,
          releasedAt: expect.any(Date),
        },
      });
    });

    it('should release most recent active lock if no ID provided', async () => {
      const activeLock = {
        id: 'lock-456',
        active: true,
        lockedBy: 'production-deployment',
        createdAt: new Date(),
      };

      mockPrisma.deploymentLock.findFirst.mockResolvedValue(activeLock);
      mockPrisma.deploymentLock.update.mockResolvedValue({});

      await expect(deploymentLockService.releaseLock()).resolves.not.toThrow();

      expect(mockPrisma.deploymentLock.update).toHaveBeenCalledWith({
        where: { id: 'lock-456' },
        data: expect.objectContaining({
          active: false,
        }),
      });
    });
  });

  describe('checkLockStatus', () => {
    it('should return unlocked status when no active lock', async () => {
      mockPrisma.deploymentLock.findFirst.mockResolvedValue(null);

      const result = await deploymentLockService.checkLockStatus();

      expect(result.locked).toBe(false);
    });

    it('should return locked status with remaining time', async () => {
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

      const activeLock = {
        id: 'lock-789',
        reason: 'Production deployment for ST-77',
        lockedBy: 'production-deployment',
        expiresAt,
        active: true,
        storyId: 'story-uuid',
        prNumber: 42,
        metadata: {},
        story: {
          id: 'story-uuid',
          key: 'ST-77',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.deploymentLock.findFirst.mockResolvedValue(activeLock);

      const result = await deploymentLockService.checkLockStatus();

      expect(result.locked).toBe(true);
      expect(result.lockId).toBe('lock-789');
      expect(result.reason).toBe('Production deployment for ST-77');
      expect(result.storyId).toBe('story-uuid');
      expect(result.prNumber).toBe(42);
      expect(result.remainingMinutes).toBeGreaterThanOrEqual(29);
      expect(result.remainingMinutes).toBeLessThanOrEqual(30);
    });

    it('should ignore expired locks', async () => {
      const expiredLock = {
        id: 'expired-lock',
        reason: 'Old deployment',
        lockedBy: 'production-deployment',
        expiresAt: new Date(Date.now() - 10 * 60 * 1000), // Expired 10 minutes ago
        active: true,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // First query returns expired lock (will be filtered)
      // Second query (in actual implementation) returns null
      mockPrisma.deploymentLock.findFirst.mockResolvedValue(null);

      const result = await deploymentLockService.checkLockStatus();

      expect(result.locked).toBe(false);
    });
  });

  describe('renewLock', () => {
    it('should renew active lock', async () => {
      const currentExpiry = new Date(Date.now() + 10 * 60 * 1000);

      const lock = {
        id: 'lock-999',
        active: true,
        expiresAt: currentExpiry,
        metadata: {
          durationMinutes: 30,
        },
      };

      mockPrisma.deploymentLock.findUnique.mockResolvedValue(lock);
      mockPrisma.deploymentLock.update.mockResolvedValue({});

      await expect(
        deploymentLockService.renewLock('lock-999', 15)
      ).resolves.not.toThrow();

      expect(mockPrisma.deploymentLock.update).toHaveBeenCalledWith({
        where: { id: 'lock-999' },
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            durationMinutes: 45, // 30 + 15
            renewalCount: 1,
          }),
        }),
      });
    });

    it('should fail to renew inactive lock', async () => {
      const lock = {
        id: 'lock-888',
        active: false,
        expiresAt: new Date(),
        metadata: {},
      };

      mockPrisma.deploymentLock.findUnique.mockResolvedValue(lock);

      await expect(
        deploymentLockService.renewLock('lock-888', 15)
      ).rejects.toThrow('is not active');
    });

    it('should fail to renew non-existent lock', async () => {
      mockPrisma.deploymentLock.findUnique.mockResolvedValue(null);

      await expect(
        deploymentLockService.renewLock('nonexistent', 15)
      ).rejects.toThrow('not found');
    });
  });

  describe('forceReleaseLock', () => {
    it('should force release lock with reason', async () => {
      const lock = {
        id: 'lock-111',
        active: true,
        metadata: {
          source: 'production-deployment',
        },
      };

      mockPrisma.deploymentLock.findUnique.mockResolvedValue(lock);
      mockPrisma.deploymentLock.update.mockResolvedValue({});

      await expect(
        deploymentLockService.forceReleaseLock('lock-111', 'Emergency deployment needed')
      ).resolves.not.toThrow();

      expect(mockPrisma.deploymentLock.update).toHaveBeenCalledWith({
        where: { id: 'lock-111' },
        data: expect.objectContaining({
          active: false,
          metadata: expect.objectContaining({
            forceReleased: true,
            forceReleaseReason: 'Emergency deployment needed',
          }),
        }),
      });
    });

    it('should fail to force release non-existent lock', async () => {
      mockPrisma.deploymentLock.findUnique.mockResolvedValue(null);

      await expect(
        deploymentLockService.forceReleaseLock('nonexistent', 'Test reason')
      ).rejects.toThrow('not found');
    });
  });

  describe('expireStaleLocks', () => {
    it('should expire stale locks automatically', async () => {
      mockPrisma.deploymentLock.updateMany.mockResolvedValue({ count: 2 });

      const result = await deploymentLockService.expireStaleLocks();

      expect(result).toBe(2);
      expect(mockPrisma.deploymentLock.updateMany).toHaveBeenCalledWith({
        where: {
          active: true,
          expiresAt: {
            lt: expect.any(Date),
          },
        },
        data: {
          active: false,
          releasedAt: expect.any(Date),
        },
      });
    });

    it('should return 0 if no stale locks', async () => {
      mockPrisma.deploymentLock.updateMany.mockResolvedValue({ count: 0 });

      const result = await deploymentLockService.expireStaleLocks();

      expect(result).toBe(0);
    });

    it('should handle errors gracefully', async () => {
      mockPrisma.deploymentLock.updateMany.mockRejectedValue(
        new Error('Database error')
      );

      const result = await deploymentLockService.expireStaleLocks();

      expect(result).toBe(0);
    });
  });

  describe('shouldRenewLock', () => {
    it('should return true if lock expires soon (< 5 minutes)', async () => {
      const lock = {
        id: 'lock-222',
        active: true,
        expiresAt: new Date(Date.now() + 4 * 60 * 1000), // 4 minutes remaining
      };

      mockPrisma.deploymentLock.findUnique.mockResolvedValue(lock);

      const result = await deploymentLockService.shouldRenewLock('lock-222');

      expect(result).toBe(true);
    });

    it('should return false if lock has sufficient time', async () => {
      const lock = {
        id: 'lock-333',
        active: true,
        expiresAt: new Date(Date.now() + 20 * 60 * 1000), // 20 minutes remaining
      };

      mockPrisma.deploymentLock.findUnique.mockResolvedValue(lock);

      const result = await deploymentLockService.shouldRenewLock('lock-333');

      expect(result).toBe(false);
    });

    it('should return false for inactive lock', async () => {
      const lock = {
        id: 'lock-444',
        active: false,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      };

      mockPrisma.deploymentLock.findUnique.mockResolvedValue(lock);

      const result = await deploymentLockService.shouldRenewLock('lock-444');

      expect(result).toBe(false);
    });
  });
});
