/**
 * Unit tests for QueueLockService
 */

import { QueueLockService } from '../queue-lock.service';
import { PrismaClient } from '@prisma/client';

// Mock Prisma
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    testQueueLock: {
      create: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
  })),
}));

describe('QueueLockService', () => {
  let queueLockService: QueueLockService;
  let mockPrisma: any;

  beforeEach(() => {
    queueLockService = new QueueLockService();
    const PrismaClientMock = PrismaClient as jest.MockedClass<typeof PrismaClient>;
    mockPrisma = new PrismaClientMock();
    jest.clearAllMocks();
  });

  describe('acquireLock', () => {
    it('should acquire lock successfully', async () => {
      const mockLock = {
        id: 'lock-123',
        reason: 'Test migration',
        lockedBy: 'safe-migrate',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        active: true,
        metadata: {
          source: 'safe-migrate',
          acquiredAt: new Date().toISOString(),
          durationMinutes: 60,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.testQueueLock.findFirst.mockResolvedValue(null); // No existing lock
      mockPrisma.testQueueLock.create.mockResolvedValue(mockLock);

      const result = await queueLockService.acquireLock('Test migration', 60);

      expect(result.id).toBe('lock-123');
      expect(result.reason).toBe('Test migration');
      expect(result.durationMinutes).toBe(60);
    });

    it('should fail if lock already exists', async () => {
      const existingLock = {
        id: 'existing-lock',
        reason: 'Another migration',
        lockedBy: 'other-source',
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        active: true,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.testQueueLock.findFirst.mockResolvedValue(existingLock);

      await expect(queueLockService.acquireLock('Test migration')).rejects.toThrow(
        'Queue is already locked'
      );
    });

    it('should reject duration exceeding maximum', async () => {
      await expect(queueLockService.acquireLock('Test', 600)).rejects.toThrow(
        'Lock duration 600m exceeds maximum'
      );
    });
  });

  describe('releaseLock', () => {
    it('should release specific lock', async () => {
      mockPrisma.testQueueLock.update.mockResolvedValue({});

      await expect(queueLockService.releaseLock('lock-123')).resolves.not.toThrow();

      expect(mockPrisma.testQueueLock.update).toHaveBeenCalledWith({
        where: { id: 'lock-123' },
        data: {
          active: false,
          metadata: expect.objectContaining({
            releasedAt: expect.any(String),
          }),
        },
      });
    });

    it('should release most recent active lock if no ID provided', async () => {
      const activeLock = {
        id: 'lock-456',
        active: true,
        metadata: {},
      };

      mockPrisma.testQueueLock.findFirst.mockResolvedValue(activeLock);
      mockPrisma.testQueueLock.update.mockResolvedValue({});

      await expect(queueLockService.releaseLock()).resolves.not.toThrow();

      expect(mockPrisma.testQueueLock.update).toHaveBeenCalledWith({
        where: { id: 'lock-456' },
        data: expect.objectContaining({
          active: false,
        }),
      });
    });
  });

  describe('checkLockStatus', () => {
    it('should return unlocked status when no active lock', async () => {
      mockPrisma.testQueueLock.findFirst.mockResolvedValue(null);

      const result = await queueLockService.checkLockStatus();

      expect(result.locked).toBe(false);
    });

    it('should return locked status with remaining time', async () => {
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

      const activeLock = {
        id: 'lock-789',
        reason: 'Migration in progress',
        lockedBy: 'safe-migrate',
        expiresAt,
        active: true,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.testQueueLock.findFirst.mockResolvedValue(activeLock);

      const result = await queueLockService.checkLockStatus();

      expect(result.locked).toBe(true);
      expect(result.lockId).toBe('lock-789');
      expect(result.reason).toBe('Migration in progress');
      expect(result.remainingMinutes).toBeGreaterThan(29);
      expect(result.remainingMinutes).toBeLessThan(31);
    });
  });

  describe('estimateLockDuration', () => {
    it('should estimate duration for simple migration', () => {
      const duration = queueLockService.estimateLockDuration(2, false);

      expect(duration).toBe(70); // 60 base + 2*5
    });

    it('should apply multiplier for breaking changes', () => {
      const duration = queueLockService.estimateLockDuration(2, true);

      expect(duration).toBe(105); // (60 + 2*5) * 1.5
    });

    it('should cap at maximum duration', () => {
      const duration = queueLockService.estimateLockDuration(100, true);

      expect(duration).toBe(480); // Capped at maximum
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
          durationMinutes: 60,
        },
      };

      mockPrisma.testQueueLock.findUnique.mockResolvedValue(lock);
      mockPrisma.testQueueLock.update.mockResolvedValue({});

      await expect(queueLockService.renewLock('lock-999', 30)).resolves.not.toThrow();

      expect(mockPrisma.testQueueLock.update).toHaveBeenCalledWith({
        where: { id: 'lock-999' },
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            durationMinutes: 90,
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

      mockPrisma.testQueueLock.findUnique.mockResolvedValue(lock);

      await expect(queueLockService.renewLock('lock-888', 30)).rejects.toThrow(
        'is not active'
      );
    });
  });
});
