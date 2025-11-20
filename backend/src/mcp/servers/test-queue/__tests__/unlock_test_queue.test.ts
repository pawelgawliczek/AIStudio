/**
 * Tests for unlock_test_queue MCP tool (ST-43)
 *
 * Coverage:
 * - Tool definition validation
 * - Unlock by lock ID
 * - Unlock most recent active lock
 * - Idempotent operation (no error if already unlocked)
 * - Lock not found error
 * - Duration calculation and formatting
 * - Force unlock option
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import { NotFoundError } from '../../../types';
import { tool, handler, metadata } from '../unlock_test_queue';

// Mock Prisma
jest.mock('@prisma/client');

describe('unlock_test_queue', () => {
  let prisma: PrismaClient;
  let mockTestQueueLock: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockTestQueueLock = {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
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
      expect(tool.name).toBe('mcp__vibestudio__unlock_test_queue');
    });

    it('should have description', () => {
      expect(tool.description).toBeTruthy();
      expect(tool.description).toContain('Unlock test queue');
      expect(tool.description).toContain('Idempotent');
    });

    it('should have no required parameters', () => {
      expect(tool.inputSchema.required).toHaveLength(0);
    });

    it('should have optional lockId parameter', () => {
      const lockIdProp = (tool.inputSchema.properties as any).lockId;
      expect(lockIdProp).toBeDefined();
      expect(lockIdProp.type).toBe('string');
    });

    it('should have optional force parameter', () => {
      const forceProp = (tool.inputSchema.properties as any).force;
      expect(forceProp).toBeDefined();
      expect(forceProp.type).toBe('boolean');
      expect(forceProp.default).toBe(false);
    });

    it('should have correct metadata tags', () => {
      expect(metadata.category).toBe('test-queue');
      expect(metadata.tags).toContain('unlock');
      expect(metadata.tags).toContain('resume');
    });
  });

  // ============================================================================
  // UNLOCK BY ID
  // ============================================================================

  describe('Handler Function - Unlock by ID', () => {
    it('should unlock lock by specific ID', async () => {
      const lockId = 'lock-123';
      const lockedAt = new Date(Date.now() - 45 * 60000); // 45 minutes ago

      const lock = {
        id: lockId,
        reason: 'Schema migration completed',
        lockedBy: 'deploy-agent',
        lockedAt,
        expiresAt: new Date(Date.now() + 15 * 60000), // 15 minutes from now
        active: true,
      };

      mockTestQueueLock.findUnique.mockResolvedValue(lock);
      mockTestQueueLock.update.mockResolvedValue({ ...lock, active: false });

      const result = await handler(prisma, { lockId });

      expect(result.id).toBe(lockId);
      expect(result.reason).toBe('Schema migration completed');
      expect(result.duration).toContain('45 minute');
      expect(result.message).toContain('unlocked successfully');

      expect(mockTestQueueLock.update).toHaveBeenCalledWith({
        where: { id: lockId },
        data: { active: false },
      });
    });

    it('should throw NotFoundError if lock ID does not exist', async () => {
      const lockId = 'non-existent-lock';
      mockTestQueueLock.findUnique.mockResolvedValue(null);

      await expect(
        handler(prisma, { lockId })
      ).rejects.toThrow(NotFoundError);

      try {
        await handler(prisma, { lockId });
      } catch (error: any) {
        expect(error.message).toContain('TestQueueLock');
        expect(error.context.resourceId).toBe(lockId);
        expect(error.context.suggestions).toBeDefined();
      }
    });
  });

  // ============================================================================
  // UNLOCK MOST RECENT
  // ============================================================================

  describe('Handler Function - Unlock Most Recent', () => {
    it('should unlock most recent active lock when no ID provided', async () => {
      const lockedAt = new Date(Date.now() - 30 * 60000); // 30 minutes ago

      const lock = {
        id: 'most-recent-lock',
        reason: 'Recent migration',
        lockedBy: 'mcp-user',
        lockedAt,
        expiresAt: new Date(Date.now() + 30 * 60000),
        active: true,
      };

      mockTestQueueLock.findFirst.mockResolvedValue(lock);
      mockTestQueueLock.update.mockResolvedValue({ ...lock, active: false });

      const result = await handler(prisma, {});

      expect(result.id).toBe('most-recent-lock');
      expect(result.duration).toContain('30 minute');

      expect(mockTestQueueLock.findFirst).toHaveBeenCalledWith({
        where: { active: true },
        orderBy: { lockedAt: 'desc' },
      });
    });
  });

  // ============================================================================
  // IDEMPOTENT OPERATION
  // ============================================================================

  describe('Handler Function - Idempotent', () => {
    it('should succeed gracefully if no active lock exists', async () => {
      mockTestQueueLock.findFirst.mockResolvedValue(null);

      const result = await handler(prisma, {});

      expect(result.id).toBe('none');
      expect(result.reason).toBe('No active lock');
      expect(result.duration).toBe('0 minutes');
      expect(result.message).toContain('already unlocked');

      expect(mockTestQueueLock.update).not.toHaveBeenCalled();
    });

    it('should succeed gracefully if lock already inactive', async () => {
      const lock = {
        id: 'inactive-lock',
        reason: 'Already unlocked',
        lockedBy: 'mcp-user',
        lockedAt: new Date(Date.now() - 60 * 60000),
        expiresAt: new Date(Date.now() - 30 * 60000),
        active: false, // Already inactive
      };

      mockTestQueueLock.findFirst.mockResolvedValue(lock);

      const result = await handler(prisma, {});

      expect(result.id).toBe('inactive-lock');
      expect(result.message).toContain('already unlocked');

      expect(mockTestQueueLock.update).not.toHaveBeenCalled();
    });

    it('should handle idempotent unlock with lock ID', async () => {
      const lockId = 'already-inactive-lock';
      const lock = {
        id: lockId,
        reason: 'Already unlocked',
        lockedBy: 'mcp-user',
        lockedAt: new Date(),
        expiresAt: new Date(),
        active: false,
      };

      mockTestQueueLock.findUnique.mockResolvedValue(lock);

      const result = await handler(prisma, { lockId });

      expect(result.message).toContain('already unlocked');
      expect(mockTestQueueLock.update).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // DURATION FORMATTING
  // ============================================================================

  describe('Duration Formatting', () => {
    it('should format duration less than 1 minute', async () => {
      const lockedAt = new Date(Date.now() - 30000); // 30 seconds ago

      const lock = {
        id: 'quick-lock',
        reason: 'Quick test',
        lockedBy: 'mcp-user',
        lockedAt,
        expiresAt: new Date(),
        active: true,
      };

      mockTestQueueLock.findFirst.mockResolvedValue(lock);
      mockTestQueueLock.update.mockResolvedValue({ ...lock, active: false });

      const result = await handler(prisma, {});

      expect(result.duration).toBe('less than 1 minute');
    });

    it('should format duration of exactly 1 minute', async () => {
      const lockedAt = new Date(Date.now() - 60000); // 1 minute ago

      const lock = {
        id: 'one-minute-lock',
        reason: 'One minute test',
        lockedBy: 'mcp-user',
        lockedAt,
        expiresAt: new Date(),
        active: true,
      };

      mockTestQueueLock.findFirst.mockResolvedValue(lock);
      mockTestQueueLock.update.mockResolvedValue({ ...lock, active: false });

      const result = await handler(prisma, {});

      expect(result.duration).toBe('1 minute');
    });

    it('should format duration in minutes (< 60 minutes)', async () => {
      const lockedAt = new Date(Date.now() - 45 * 60000); // 45 minutes ago

      const lock = {
        id: 'minutes-lock',
        reason: 'Minutes test',
        lockedBy: 'mcp-user',
        lockedAt,
        expiresAt: new Date(),
        active: true,
      };

      mockTestQueueLock.findFirst.mockResolvedValue(lock);
      mockTestQueueLock.update.mockResolvedValue({ ...lock, active: false });

      const result = await handler(prisma, {});

      expect(result.duration).toBe('45 minutes');
    });

    it('should format duration in hours (exactly 1 hour)', async () => {
      const lockedAt = new Date(Date.now() - 60 * 60000); // 60 minutes ago

      const lock = {
        id: 'one-hour-lock',
        reason: 'One hour test',
        lockedBy: 'mcp-user',
        lockedAt,
        expiresAt: new Date(),
        active: true,
      };

      mockTestQueueLock.findFirst.mockResolvedValue(lock);
      mockTestQueueLock.update.mockResolvedValue({ ...lock, active: false });

      const result = await handler(prisma, {});

      expect(result.duration).toBe('1 hour');
    });

    it('should format duration in hours and minutes', async () => {
      const lockedAt = new Date(Date.now() - 95 * 60000); // 1h 35m ago

      const lock = {
        id: 'mixed-lock',
        reason: 'Mixed duration test',
        lockedBy: 'mcp-user',
        lockedAt,
        expiresAt: new Date(),
        active: true,
      };

      mockTestQueueLock.findFirst.mockResolvedValue(lock);
      mockTestQueueLock.update.mockResolvedValue({ ...lock, active: false });

      const result = await handler(prisma, {});

      expect(result.duration).toBe('1h 35m');
    });

    it('should format duration in hours (multiple hours)', async () => {
      const lockedAt = new Date(Date.now() - 180 * 60000); // 3 hours ago

      const lock = {
        id: 'hours-lock',
        reason: 'Hours test',
        lockedBy: 'mcp-user',
        lockedAt,
        expiresAt: new Date(),
        active: true,
      };

      mockTestQueueLock.findFirst.mockResolvedValue(lock);
      mockTestQueueLock.update.mockResolvedValue({ ...lock, active: false });

      const result = await handler(prisma, {});

      expect(result.duration).toBe('3 hours');
    });
  });

  // ============================================================================
  // FORCE UNLOCK
  // ============================================================================

  describe('Force Unlock', () => {
    it('should accept force parameter', async () => {
      const lock = {
        id: 'force-lock',
        reason: 'Force test',
        lockedBy: 'other-user',
        lockedAt: new Date(Date.now() - 10 * 60000),
        expiresAt: new Date(),
        active: true,
      };

      mockTestQueueLock.findFirst.mockResolvedValue(lock);
      mockTestQueueLock.update.mockResolvedValue({ ...lock, active: false });

      const result = await handler(prisma, { force: true });

      expect(result.id).toBe('force-lock');
      expect(mockTestQueueLock.update).toHaveBeenCalled();
    });
  });
});
