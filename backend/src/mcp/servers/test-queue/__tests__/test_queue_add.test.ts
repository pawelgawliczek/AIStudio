/**
 * Unit tests for test_queue_add tool
 * Tests all acceptance criteria from baAnalysis and edge cases from architectAnalysis
 */

import { PrismaClient } from '@prisma/client';
import { createTestPrismaClient } from '@/test-utils/safe-prisma-client';
import { NotFoundError, ValidationError } from '../../../types';
import { handler, tool } from '../test_queue_add';

describe('test_queue_add', () => {
  let prisma: PrismaClient;
  const testStoryId = 'test-story-id-123';
  const testStoryKey = 'ST-41';

  beforeEach(() => {
    prisma = createTestPrismaClient();
    jest.clearAllMocks();

    // Mock testQueueLock to always return null (no active lock) by default
    // Individual tests can override this if they need to test lock behavior
    if (!prisma.testQueueLock) {
      (prisma as any).testQueueLock = {};
    }
    (prisma as any).testQueueLock.findFirst = jest.fn().mockResolvedValue(null);
  });

  afterEach(async () => {
    await prisma.$disconnect();
  });

  describe('Tool Definition', () => {
    it('should have correct tool name', () => {
      expect(tool.name).toBe('mcp__vibestudio__test_queue_add');
    });

    it('should have required storyId parameter', () => {
      expect(tool.inputSchema.required).toContain('storyId');
    });

    it('should have optional priority and submittedBy parameters', () => {
      expect(tool.inputSchema.properties).toHaveProperty('priority');
      expect(tool.inputSchema.properties).toHaveProperty('submittedBy');
    });

    it('should define priority range as 0-10', () => {
      expect((tool.inputSchema.properties.priority as any).minimum).toBe(0);
      expect((tool.inputSchema.properties.priority as any).maximum).toBe(10);
      expect((tool.inputSchema.properties.priority as any).default).toBe(5);
    });
  });

  describe('Handler Function - Validation', () => {
    it('should throw NotFoundError when story does not exist (AC-1)', async () => {
      prisma.story.findUnique = jest.fn().mockResolvedValue(null);

      await expect(
        handler(prisma, { storyId: testStoryId })
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError for priority < 0', async () => {
      await expect(
        handler(prisma, { storyId: testStoryId, priority: -1 })
      ).rejects.toThrow(ValidationError);
      await expect(
        handler(prisma, { storyId: testStoryId, priority: -1 })
      ).rejects.toThrow('Priority must be between 0 and 10');
    });

    it('should throw ValidationError for priority > 10', async () => {
      await expect(
        handler(prisma, { storyId: testStoryId, priority: 11 })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when story already in queue with pending status (AC-6)', async () => {
      prisma.story.findUnique = jest.fn().mockResolvedValue({
        id: testStoryId,
        key: testStoryKey,
      });

      prisma.testQueue.findFirst = jest.fn().mockResolvedValue({
        id: 'existing-entry-id',
        storyId: testStoryId,
        status: 'pending',
      });

      await expect(
        handler(prisma, { storyId: testStoryId })
      ).rejects.toThrow(ValidationError);
      await expect(
        handler(prisma, { storyId: testStoryId })
      ).rejects.toThrow('already in queue');
    });

    it('should throw ValidationError when story already in queue with running status (AC-6)', async () => {
      prisma.story.findUnique = jest.fn().mockResolvedValue({
        id: testStoryId,
        key: testStoryKey,
      });

      prisma.testQueue.findFirst = jest.fn().mockResolvedValue({
        id: 'existing-entry-id',
        storyId: testStoryId,
        status: 'running',
      });

      await expect(
        handler(prisma, { storyId: testStoryId })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('Handler Function - Position Calculation', () => {
    it('should add story to empty queue at position 100 (Edge Case)', async () => {
      prisma.story.findUnique = jest.fn().mockResolvedValue({
        id: testStoryId,
        key: testStoryKey,
      });

      prisma.testQueue.findFirst = jest.fn().mockResolvedValue(null);
      prisma.testQueue.aggregate = jest.fn().mockResolvedValue({
        _max: { position: null },
      });
      prisma.testQueue.count = jest.fn()
        .mockResolvedValueOnce(0) // entriesAhead
        .mockResolvedValueOnce(0); // totalInQueue

      prisma.testQueue.create = jest.fn().mockResolvedValue({
        id: 'new-entry-id',
        storyId: testStoryId,
        position: 100,
        priority: 5,
        status: 'pending',
        submittedBy: 'mcp-user',
      });

      const result = await handler(prisma, { storyId: testStoryId });

      expect(result.position).toBe(100);
      expect(result.queuePosition).toBe(1);
      expect(result.estimatedWaitMinutes).toBe(0);
      expect(result.priority).toBe(5); // default priority
    });

    it('should use 100-unit position gaps (AC-7)', async () => {
      prisma.story.findUnique = jest.fn().mockResolvedValue({
        id: testStoryId,
        key: testStoryKey,
      });

      prisma.testQueue.findFirst = jest.fn().mockResolvedValue(null);
      prisma.testQueue.aggregate = jest.fn().mockResolvedValue({
        _max: { position: 300 }, // 3 existing entries at 100, 200, 300
      });
      prisma.testQueue.count = jest.fn()
        .mockResolvedValueOnce(3) // entriesAhead
        .mockResolvedValueOnce(3); // totalInQueue

      prisma.testQueue.create = jest.fn().mockResolvedValue({
        id: 'new-entry-id',
        storyId: testStoryId,
        position: 400,
        priority: 5,
        status: 'pending',
        submittedBy: 'mcp-user',
      });

      const result = await handler(prisma, { storyId: testStoryId });

      expect(result.position).toBe(400);
      expect(prisma.testQueue.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            position: 400,
          }),
        })
      );
    });

    it('should calculate queue position correctly with mixed priorities (AC-7)', async () => {
      // Queue: [p=10, pos=100], [p=8, pos=200], [p=5, pos=300]
      // Adding story with p=7 should be queuePosition=3
      prisma.story.findUnique = jest.fn().mockResolvedValue({
        id: testStoryId,
        key: testStoryKey,
      });

      prisma.testQueue.findFirst = jest.fn().mockResolvedValue(null);
      prisma.testQueue.aggregate = jest.fn().mockResolvedValue({
        _max: { position: 300 },
      });
      prisma.testQueue.count = jest.fn()
        .mockResolvedValueOnce(2) // entriesAhead: p=10 and p=8
        .mockResolvedValueOnce(3); // totalInQueue

      prisma.testQueue.create = jest.fn().mockResolvedValue({
        id: 'new-entry-id',
        storyId: testStoryId,
        position: 400,
        priority: 7,
        status: 'pending',
        submittedBy: 'mcp-user',
      });

      const result = await handler(prisma, { storyId: testStoryId, priority: 7 });

      expect(result.queuePosition).toBe(3); // Behind p=10 and p=8, ahead of p=5
      expect(result.estimatedWaitMinutes).toBe(10); // 2 entries × 5 minutes
    });

    it('should use default priority 5 when not specified (AC-1)', async () => {
      prisma.story.findUnique = jest.fn().mockResolvedValue({
        id: testStoryId,
        key: testStoryKey,
      });

      prisma.testQueue.findFirst = jest.fn().mockResolvedValue(null);
      prisma.testQueue.aggregate = jest.fn().mockResolvedValue({
        _max: { position: null },
      });
      prisma.testQueue.count = jest.fn()
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      prisma.testQueue.create = jest.fn().mockResolvedValue({
        id: 'new-entry-id',
        storyId: testStoryId,
        position: 100,
        priority: 5,
        status: 'pending',
        submittedBy: 'mcp-user',
      });

      const result = await handler(prisma, { storyId: testStoryId });

      expect(result.priority).toBe(5);
      expect(prisma.testQueue.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            priority: 5,
          }),
        })
      );
    });

    it('should calculate estimated wait time correctly (5 min per entry ahead)', async () => {
      prisma.story.findUnique = jest.fn().mockResolvedValue({
        id: testStoryId,
        key: testStoryKey,
      });

      prisma.testQueue.findFirst = jest.fn().mockResolvedValue(null);
      prisma.testQueue.aggregate = jest.fn().mockResolvedValue({
        _max: { position: 500 },
      });
      prisma.testQueue.count = jest.fn()
        .mockResolvedValueOnce(4) // 4 entries ahead
        .mockResolvedValueOnce(5); // total

      prisma.testQueue.create = jest.fn().mockResolvedValue({
        id: 'new-entry-id',
        storyId: testStoryId,
        position: 600,
        priority: 5,
        status: 'pending',
        submittedBy: 'mcp-user',
      });

      const result = await handler(prisma, { storyId: testStoryId });

      expect(result.estimatedWaitMinutes).toBe(20); // 4 × 5
      expect(result.queuePosition).toBe(5);
    });
  });

  describe('Handler Function - Response', () => {
    it('should return all required fields (AC-1)', async () => {
      prisma.story.findUnique = jest.fn().mockResolvedValue({
        id: testStoryId,
        key: testStoryKey,
      });

      prisma.testQueue.findFirst = jest.fn().mockResolvedValue(null);
      prisma.testQueue.aggregate = jest.fn().mockResolvedValue({
        _max: { position: null },
      });
      prisma.testQueue.count = jest.fn()
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      prisma.testQueue.create = jest.fn().mockResolvedValue({
        id: 'new-entry-id',
        storyId: testStoryId,
        position: 100,
        priority: 5,
        status: 'pending',
        submittedBy: 'mcp-user',
      });

      const result = await handler(prisma, { storyId: testStoryId });

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('storyId');
      expect(result).toHaveProperty('storyKey');
      expect(result).toHaveProperty('position');
      expect(result).toHaveProperty('priority');
      expect(result).toHaveProperty('queuePosition');
      expect(result).toHaveProperty('estimatedWaitMinutes');
      expect(result).toHaveProperty('totalInQueue');
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('message');
    });

    it('should use custom submittedBy when provided', async () => {
      prisma.story.findUnique = jest.fn().mockResolvedValue({
        id: testStoryId,
        key: testStoryKey,
      });

      prisma.testQueue.findFirst = jest.fn().mockResolvedValue(null);
      prisma.testQueue.aggregate = jest.fn().mockResolvedValue({
        _max: { position: null },
      });
      prisma.testQueue.count = jest.fn()
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      prisma.testQueue.create = jest.fn().mockResolvedValue({
        id: 'new-entry-id',
        storyId: testStoryId,
        position: 100,
        priority: 8,
        status: 'pending',
        submittedBy: 'workflow-agent-123',
      });

      await handler(prisma, {
        storyId: testStoryId,
        priority: 8,
        submittedBy: 'workflow-agent-123',
      });

      expect(prisma.testQueue.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            submittedBy: 'workflow-agent-123',
          }),
        })
      );
    });

    it('should always have status=pending on add (AC-1)', async () => {
      prisma.story.findUnique = jest.fn().mockResolvedValue({
        id: testStoryId,
        key: testStoryKey,
      });

      prisma.testQueue.findFirst = jest.fn().mockResolvedValue(null);
      prisma.testQueue.aggregate = jest.fn().mockResolvedValue({
        _max: { position: null },
      });
      prisma.testQueue.count = jest.fn()
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      prisma.testQueue.create = jest.fn().mockResolvedValue({
        id: 'new-entry-id',
        storyId: testStoryId,
        position: 100,
        priority: 5,
        status: 'pending',
        submittedBy: 'mcp-user',
      });

      const result = await handler(prisma, { storyId: testStoryId });

      expect(result.status).toBe('pending');
    });
  });
});
