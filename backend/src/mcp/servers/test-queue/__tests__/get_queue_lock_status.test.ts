/**
 * Tests for get_queue_lock_status MCP tool (ST-43)
 *
 * Coverage:
 * - Tool definition validation
 * - Return unlocked status when no lock exists
 * - Return locked status with details
 * - Auto-expiry of expired locks
 * - Time remaining calculation
 * - Human-readable time formatting
 * - Fast query performance (indexed)
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import { tool, handler, metadata } from '../get_queue_lock_status';

// Mock Prisma
jest.mock('@prisma/client');

describe('get_queue_lock_status', () => {
  let prisma: PrismaClient;
  let mockTestQueueLock: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockTestQueueLock = {
      findFirst: jest.fn(),
      update: jest.fn(),
    };

    prisma = {
      testQueueLock: mockTestQueueLock,
    } as any;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ============================================================================
  // TOOL DEFINITION
  // ============================================================================

  describe('Tool Definition', () => {
    it('should have correct name', () => {
      expect(tool.name).toBe('mcp__vibestudio__get_queue_lock_status');
    });

    it('should have description', () => {
      expect(tool.description).toBeTruthy();
      expect(tool.description).toContain('lock status');
      expect(tool.description).toContain('Auto-expires');
    });

    it('should have no required parameters', () => {
      expect(tool.inputSchema.required).toHaveLength(0);
    });

    it('should have empty properties', () => {
      expect(Object.keys(tool.inputSchema.properties as any)).toHaveLength(0);
    });

    it('should have correct metadata tags', () => {
      expect(metadata.category).toBe('test-queue');
      expect(metadata.tags).toContain('status');
      expect(metadata.tags).toContain('monitoring');
    });
  });

  // ============================================================================
  // NO LOCK EXISTS
  // ============================================================================

  describe('Handler Function - No Lock', () => {
    it('should return isLocked=false when no lock exists', async () => {
      mockTestQueueLock.findFirst.mockResolvedValue(null);

      const result = await handler(prisma, {});

      expect(result.isLocked).toBe(false);
      expect(result.lock).toBeUndefined();

      expect(mockTestQueueLock.findFirst).toHaveBeenCalledWith({
        where: { active: true },
        orderBy: { lockedAt: 'desc' },
      });
    });
  });

  // ============================================================================
  // ACTIVE LOCK
  // ============================================================================

  describe('Handler Function - Active Lock', () => {
    it('should return lock details when lock is active', async () => {
      const now = new Date();
      const lockedAt = new Date(now.getTime() - 15 * 60000); // 15 minutes ago
      const expiresAt = new Date(now.getTime() + 45 * 60000); // 45 minutes from now

      const lock = {
        id: 'active-lock-123',
        reason: 'Schema migration in progress',
        lockedBy: 'deploy-agent',
        lockedAt,
        expiresAt,
        active: true,
      };

      mockTestQueueLock.findFirst.mockResolvedValue(lock);

      const result = await handler(prisma, {});

      expect(result.isLocked).toBe(true);
      expect(result.lock).toBeDefined();
      expect(result.lock!.id).toBe('active-lock-123');
      expect(result.lock!.reason).toBe('Schema migration in progress');
      expect(result.lock!.lockedBy).toBe('deploy-agent');
      expect(result.lock!.lockedAt).toBe(lockedAt.toISOString());
      expect(result.lock!.expiresAt).toBe(expiresAt.toISOString());
      expect(result.lock!.expiresIn).toContain('minute');
      expect(result.lock!.isExpired).toBe(false);

      expect(mockTestQueueLock.update).not.toHaveBeenCalled();
    });

    it('should calculate time remaining correctly', async () => {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 30 * 60000); // 30 minutes from now

      const lock = {
        id: 'lock-with-time',
        reason: 'Testing time calculation',
        lockedBy: 'mcp-user',
        lockedAt: new Date(now.getTime() - 30 * 60000),
        expiresAt,
        active: true,
      };

      mockTestQueueLock.findFirst.mockResolvedValue(lock);

      const result = await handler(prisma, {});

      expect(result.lock!.expiresIn).toContain('30 minute');
    });
  });

  // ============================================================================
  // AUTO-EXPIRY
  // ============================================================================

  describe('Handler Function - Auto-Expiry', () => {
    it('should auto-expire lock past its expiration time', async () => {
      const now = new Date();
      const lockedAt = new Date(now.getTime() - 90 * 60000); // 90 minutes ago
      const expiresAt = new Date(now.getTime() - 30 * 60000); // 30 minutes ago (expired)

      const lock = {
        id: 'expired-lock',
        reason: 'Old migration',
        lockedBy: 'old-agent',
        lockedAt,
        expiresAt,
        active: true, // Still marked active but expired
      };

      mockTestQueueLock.findFirst.mockResolvedValue(lock);
      mockTestQueueLock.update.mockResolvedValue({ ...lock, active: false });

      const result = await handler(prisma, {});

      expect(result.isLocked).toBe(false);
      expect(result.lock).toBeUndefined();

      expect(mockTestQueueLock.update).toHaveBeenCalledWith({
        where: { id: 'expired-lock' },
        data: { active: false },
      });
    });

    it('should handle lock exactly at expiration time', async () => {
      const now = new Date();
      const lockedAt = new Date(now.getTime() - 60 * 60000);
      const expiresAt = new Date(now.getTime() - 1000); // 1 second ago (expired)

      const lock = {
        id: 'just-expired-lock',
        reason: 'Just expired',
        lockedBy: 'mcp-user',
        lockedAt,
        expiresAt,
        active: true,
      };

      mockTestQueueLock.findFirst.mockResolvedValue(lock);
      mockTestQueueLock.update.mockResolvedValue({ ...lock, active: false });

      const result = await handler(prisma, {});

      expect(result.isLocked).toBe(false);
      expect(mockTestQueueLock.update).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // TIME FORMATTING
  // ============================================================================

  describe('Time Formatting', () => {
    it('should format less than 1 minute remaining (rounds up to 1 minute due to Math.ceil)', async () => {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 500); // 0.5 seconds from now

      const lock = {
        id: 'almost-expired',
        reason: 'Almost done',
        lockedBy: 'mcp-user',
        lockedAt: new Date(now.getTime() - 59 * 60000),
        expiresAt,
        active: true,
      };

      mockTestQueueLock.findFirst.mockResolvedValue(lock);

      const result = await handler(prisma, {});

      // Note: Math.ceil(500ms / 60000) = 1, so this shows as "1 minute"
      // This is acceptable behavior - better to overestimate than underestimate
      expect(result.lock!.expiresIn).toBe('1 minute');
    });

    it('should format exactly 1 minute remaining', async () => {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 60000); // 1 minute from now

      const lock = {
        id: 'one-minute-left',
        reason: 'One minute test',
        lockedBy: 'mcp-user',
        lockedAt: new Date(),
        expiresAt,
        active: true,
      };

      mockTestQueueLock.findFirst.mockResolvedValue(lock);

      const result = await handler(prisma, {});

      expect(result.lock!.expiresIn).toBe('1 minute');
    });

    it('should format minutes remaining (< 60 minutes)', async () => {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 25 * 60000); // 25 minutes from now

      const lock = {
        id: 'minutes-left',
        reason: 'Minutes test',
        lockedBy: 'mcp-user',
        lockedAt: new Date(),
        expiresAt,
        active: true,
      };

      mockTestQueueLock.findFirst.mockResolvedValue(lock);

      const result = await handler(prisma, {});

      expect(result.lock!.expiresIn).toContain('25 minute');
    });

    it('should format hours remaining (exactly 1 hour)', async () => {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 60 * 60000); // 1 hour from now

      const lock = {
        id: 'one-hour-left',
        reason: 'One hour test',
        lockedBy: 'mcp-user',
        lockedAt: new Date(),
        expiresAt,
        active: true,
      };

      mockTestQueueLock.findFirst.mockResolvedValue(lock);

      const result = await handler(prisma, {});

      expect(result.lock!.expiresIn).toBe('1 hour');
    });

    it('should format hours and minutes remaining', async () => {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 125 * 60000); // 2h 5m from now

      const lock = {
        id: 'mixed-time-left',
        reason: 'Mixed time test',
        lockedBy: 'mcp-user',
        lockedAt: new Date(),
        expiresAt,
        active: true,
      };

      mockTestQueueLock.findFirst.mockResolvedValue(lock);

      const result = await handler(prisma, {});

      expect(result.lock!.expiresIn).toBe('2h 5m');
    });

    it('should format multiple hours remaining', async () => {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 180 * 60000); // 3 hours from now

      const lock = {
        id: 'hours-left',
        reason: 'Hours test',
        lockedBy: 'mcp-user',
        lockedAt: new Date(),
        expiresAt,
        active: true,
      };

      mockTestQueueLock.findFirst.mockResolvedValue(lock);

      const result = await handler(prisma, {});

      expect(result.lock!.expiresIn).toBe('3 hours');
    });
  });

  // ============================================================================
  // QUERY PERFORMANCE
  // ============================================================================

  describe('Query Performance', () => {
    it('should use indexed query on active field', async () => {
      mockTestQueueLock.findFirst.mockResolvedValue(null);

      await handler(prisma, {});

      expect(mockTestQueueLock.findFirst).toHaveBeenCalledWith({
        where: { active: true },
        orderBy: { lockedAt: 'desc' },
      });
    });

    it('should order by lockedAt desc to get most recent', async () => {
      mockTestQueueLock.findFirst.mockResolvedValue(null);

      await handler(prisma, {});

      const callArgs = mockTestQueueLock.findFirst.mock.calls[0][0];
      expect(callArgs.orderBy).toEqual({ lockedAt: 'desc' });
    });
  });

  // ============================================================================
  // INTEGRATION SCENARIOS
  // ============================================================================

  describe('Integration Scenarios', () => {
    it('should handle workflow: check status before locking', async () => {
      // First call: no lock
      mockTestQueueLock.findFirst.mockResolvedValueOnce(null);

      const result1 = await handler(prisma, {});
      expect(result1.isLocked).toBe(false);

      // Second call: lock exists
      const lock = {
        id: 'new-lock',
        reason: 'New migration',
        lockedBy: 'mcp-user',
        lockedAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
        active: true,
      };

      mockTestQueueLock.findFirst.mockResolvedValueOnce(lock);

      const result2 = await handler(prisma, {});
      expect(result2.isLocked).toBe(true);
      expect(result2.lock!.id).toBe('new-lock');
    });

    it('should handle workflow: monitor expiry countdown', async () => {
      // Simulate checking status multiple times as lock approaches expiry
      const now = new Date();

      // First check: 10 minutes remaining
      const lock1 = {
        id: 'countdown-lock',
        reason: 'Monitoring test',
        lockedBy: 'mcp-user',
        lockedAt: new Date(now.getTime() - 50 * 60000),
        expiresAt: new Date(now.getTime() + 10 * 60000),
        active: true,
      };

      mockTestQueueLock.findFirst.mockResolvedValueOnce(lock1);
      const result1 = await handler(prisma, {});
      expect(result1.lock!.expiresIn).toContain('10 minute');

      // Second check: 1 minute remaining
      const lock2 = {
        ...lock1,
        expiresAt: new Date(now.getTime() + 60000),
      };

      mockTestQueueLock.findFirst.mockResolvedValueOnce(lock2);
      const result2 = await handler(prisma, {});
      expect(result2.lock!.expiresIn).toBe('1 minute');
    });
  });
});
