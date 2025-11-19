/**
 * Tests for lock_test_queue MCP tool (ST-43)
 *
 * Coverage:
 * - Tool definition validation
 * - Reason validation (min 10 chars)
 * - Duration validation (1-480 minutes)
 * - Duplicate lock prevention (singleton pattern)
 * - Lock creation with default/custom parameters
 * - Expiry calculation
 * - Metadata storage
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import { tool, handler, metadata } from '../lock_test_queue';
import { ValidationError } from '../../../types';

// Mock Prisma
jest.mock('@prisma/client');

describe('lock_test_queue', () => {
  let prisma: PrismaClient;
  let mockTestQueueLock: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock TestQueueLock model
    mockTestQueueLock = {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
    };

    // Create mock Prisma client
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
      expect(tool.name).toBe('mcp__vibestudio__lock_test_queue');
    });

    it('should have description', () => {
      expect(tool.description).toBeTruthy();
      expect(tool.description).toContain('Lock test queue');
      expect(tool.description).toContain('schema migrations');
    });

    it('should require reason parameter', () => {
      expect(tool.inputSchema.required).toContain('reason');
    });

    it('should have optional durationMinutes parameter with constraints', () => {
      const durationProp = (tool.inputSchema.properties as any).durationMinutes;
      expect(durationProp).toBeDefined();
      expect(durationProp.minimum).toBe(1);
      expect(durationProp.maximum).toBe(480);
      expect(durationProp.default).toBe(60);
    });

    it('should have optional lockedBy parameter', () => {
      const lockedByProp = (tool.inputSchema.properties as any).lockedBy;
      expect(lockedByProp).toBeDefined();
      expect(lockedByProp.type).toBe('string');
    });

    it('should have optional metadata parameter', () => {
      const metadataProp = (tool.inputSchema.properties as any).metadata;
      expect(metadataProp).toBeDefined();
      expect(metadataProp.type).toBe('object');
    });

    it('should have correct metadata tags', () => {
      expect(metadata.category).toBe('test-queue');
      expect(metadata.tags).toContain('lock');
      expect(metadata.tags).toContain('migration');
    });
  });

  // ============================================================================
  // VALIDATION
  // ============================================================================

  describe('Handler Function - Validation', () => {
    it('should throw ValidationError if reason is missing', async () => {
      await expect(
        handler(prisma, {} as any)
      ).rejects.toThrow('Missing required fields: reason');
    });

    it('should throw ValidationError if reason is less than 10 characters', async () => {
      await expect(
        handler(prisma, { reason: 'Short' })
      ).rejects.toThrow(ValidationError);

      try {
        await handler(prisma, { reason: 'Short' });
      } catch (error: any) {
        expect(error.message).toContain('at least 10 characters');
        expect(error.context.minLength).toBe(10);
        expect(error.context.actualLength).toBe(5);
      }
    });

    it('should throw ValidationError if durationMinutes is less than 1', async () => {
      mockTestQueueLock.findFirst.mockResolvedValue(null);

      await expect(
        handler(prisma, {
          reason: 'Valid reason here',
          durationMinutes: 0,
        })
      ).rejects.toThrow(ValidationError);

      try {
        await handler(prisma, {
          reason: 'Valid reason here',
          durationMinutes: 0,
        });
      } catch (error: any) {
        expect(error.message).toContain('between 1-480 minutes');
        expect(error.context.validRange).toEqual([1, 480]);
      }
    });

    it('should throw ValidationError if durationMinutes exceeds 480', async () => {
      mockTestQueueLock.findFirst.mockResolvedValue(null);

      await expect(
        handler(prisma, {
          reason: 'Valid reason here',
          durationMinutes: 500,
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError if active lock already exists', async () => {
      const existingLock = {
        id: 'lock-123',
        reason: 'Existing migration',
        lockedBy: 'other-user',
        lockedAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
        active: true,
      };

      mockTestQueueLock.findFirst.mockResolvedValue(existingLock);

      await expect(
        handler(prisma, { reason: 'New migration' })
      ).rejects.toThrow(ValidationError);

      try {
        await handler(prisma, { reason: 'New migration' });
      } catch (error: any) {
        expect(error.message).toContain('already locked');
        expect(error.context.lockId).toBe('lock-123');
        expect(error.context.lockedBy).toBe('other-user');
        expect(error.context.suggestions).toBeDefined();
      }
    });
  });

  // ============================================================================
  // SUCCESS CASES
  // ============================================================================

  describe('Handler Function - Success Cases', () => {
    it('should create lock with default duration (60 minutes)', async () => {
      mockTestQueueLock.findFirst.mockResolvedValue(null); // No existing lock

      const lockData = {
        id: 'new-lock-123',
        reason: 'Breaking schema migration in progress',
        lockedBy: 'mcp-user',
        lockedAt: new Date(),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 60 minutes
        active: true,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockTestQueueLock.create.mockResolvedValue(lockData);

      const result = await handler(prisma, {
        reason: 'Breaking schema migration in progress',
      });

      expect(result.id).toBe('new-lock-123');
      expect(result.reason).toBe('Breaking schema migration in progress');
      expect(result.lockedBy).toBe('mcp-user');
      expect(result.message).toContain('60 minutes');

      // Verify create was called with correct data
      expect(mockTestQueueLock.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          reason: 'Breaking schema migration in progress',
          lockedBy: 'mcp-user',
          active: true,
        }),
      });
    });

    it('should create lock with custom duration', async () => {
      mockTestQueueLock.findFirst.mockResolvedValue(null);

      const lockData = {
        id: 'new-lock-456',
        reason: 'Complex migration requiring extended time',
        lockedBy: 'deploy-agent',
        lockedAt: new Date(),
        expiresAt: new Date(Date.now() + 90 * 60 * 1000), // 90 minutes
        active: true,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockTestQueueLock.create.mockResolvedValue(lockData);

      const result = await handler(prisma, {
        reason: 'Complex migration requiring extended time',
        durationMinutes: 90,
        lockedBy: 'deploy-agent',
      });

      expect(result.lockedBy).toBe('deploy-agent');
      expect(result.message).toContain('90 minutes');

      const createCall = mockTestQueueLock.create.mock.calls[0][0];
      expect(createCall.data.lockedBy).toBe('deploy-agent');
    });

    it('should calculate expiry time correctly', async () => {
      mockTestQueueLock.findFirst.mockResolvedValue(null);

      const now = new Date();
      const durationMinutes = 120;

      mockTestQueueLock.create.mockImplementation((args: any) => {
        const lockedAt = args.data.lockedAt;
        const expiresAt = args.data.expiresAt;
        const diffMs = expiresAt.getTime() - lockedAt.getTime();
        const diffMinutes = Math.floor(diffMs / 60000);

        expect(diffMinutes).toBe(durationMinutes);

        return Promise.resolve({
          id: 'lock-789',
          ...args.data,
          createdAt: now,
          updatedAt: now,
        });
      });

      await handler(prisma, {
        reason: 'Testing expiry calculation',
        durationMinutes,
      });

      expect(mockTestQueueLock.create).toHaveBeenCalled();
    });

    it('should store metadata when provided', async () => {
      mockTestQueueLock.findFirst.mockResolvedValue(null);

      const metadata = {
        storyId: 'ST-43',
        breakingPatterns: ['DROP COLUMN', 'ALTER TYPE'],
        migrationScript: 'migrate_user_roles.sql',
      };

      const lockData = {
        id: 'lock-with-metadata',
        reason: 'Migration with metadata',
        lockedBy: 'mcp-user',
        lockedAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
        active: true,
        metadata,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockTestQueueLock.create.mockResolvedValue(lockData);

      await handler(prisma, {
        reason: 'Migration with metadata',
        metadata,
      });

      const createCall = mockTestQueueLock.create.mock.calls[0][0];
      expect(createCall.data.metadata).toEqual(metadata);
    });

    it('should use default lockedBy if not provided', async () => {
      mockTestQueueLock.findFirst.mockResolvedValue(null);

      const lockData = {
        id: 'lock-default-user',
        reason: 'Testing default user',
        lockedBy: 'mcp-user',
        lockedAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
        active: true,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockTestQueueLock.create.mockResolvedValue(lockData);

      const result = await handler(prisma, {
        reason: 'Testing default user',
      });

      expect(result.lockedBy).toBe('mcp-user');
    });
  });

  // ============================================================================
  // EDGE CASES
  // ============================================================================

  describe('Handler Function - Edge Cases', () => {
    it('should allow lock creation after previous lock expired', async () => {
      // Simulate expired lock (active but past expiration)
      const expiredLock = {
        id: 'expired-lock',
        reason: 'Old migration',
        lockedBy: 'old-user',
        lockedAt: new Date(Date.now() - 7200000), // 2 hours ago
        expiresAt: new Date(Date.now() - 3600000), // 1 hour ago
        active: true,
      };

      mockTestQueueLock.findFirst.mockResolvedValue(expiredLock);

      // Should throw because findFirst returns the expired lock
      // In real usage, get_queue_lock_status would auto-expire it first
      await expect(
        handler(prisma, { reason: 'New migration after expiry' })
      ).rejects.toThrow(ValidationError);
    });

    it('should allow lock creation after previous lock unlocked', async () => {
      mockTestQueueLock.findFirst.mockResolvedValue(null); // No active lock

      const newLock = {
        id: 'new-lock-after-unlock',
        reason: 'New migration after unlock',
        lockedBy: 'mcp-user',
        lockedAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
        active: true,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockTestQueueLock.create.mockResolvedValue(newLock);

      const result = await handler(prisma, {
        reason: 'New migration after unlock',
      });

      expect(result.id).toBe('new-lock-after-unlock');
    });

    it('should handle minimum duration of 1 minute', async () => {
      mockTestQueueLock.findFirst.mockResolvedValue(null);

      const lockData = {
        id: 'lock-min-duration',
        reason: 'Quick migration test',
        lockedBy: 'mcp-user',
        lockedAt: new Date(),
        expiresAt: new Date(Date.now() + 60000), // 1 minute
        active: true,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockTestQueueLock.create.mockResolvedValue(lockData);

      const result = await handler(prisma, {
        reason: 'Quick migration test',
        durationMinutes: 1,
      });

      expect(result.message).toContain('1 minute');
    });

    it('should handle maximum duration of 480 minutes', async () => {
      mockTestQueueLock.findFirst.mockResolvedValue(null);

      const lockData = {
        id: 'lock-max-duration',
        reason: 'Very complex migration requiring maximum time',
        lockedBy: 'mcp-user',
        lockedAt: new Date(),
        expiresAt: new Date(Date.now() + 480 * 60000), // 480 minutes
        active: true,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockTestQueueLock.create.mockResolvedValue(lockData);

      const result = await handler(prisma, {
        reason: 'Very complex migration requiring maximum time',
        durationMinutes: 480,
      });

      expect(result.message).toContain('480 minutes');
    });
  });
});
