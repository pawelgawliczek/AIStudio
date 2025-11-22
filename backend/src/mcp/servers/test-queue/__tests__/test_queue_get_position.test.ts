/**
 * Unit tests for test_queue_get_position tool
 * Tests all acceptance criteria from baAnalysis
 */

import { PrismaClient } from '@prisma/client';
import { createTestPrismaClient } from '@/test-utils/safe-prisma-client';
import { NotFoundError } from '../../../types';
import { handler, tool } from '../test_queue_get_position';

describe('test_queue_get_position', () => {
  let prisma: PrismaClient;
  const testStoryId = 'test-story-id-123';

  beforeEach(() => {
    prisma = createTestPrismaClient();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await prisma.$disconnect();
  });

  describe('Tool Definition', () => {
    it('should have correct tool name', () => {
      expect(tool.name).toBe('mcp__vibestudio__test_queue_get_position');
    });

    it('should have required storyId parameter', () => {
      expect(tool.inputSchema.required).toContain('storyId');
    });
  });

  describe('Handler Function - Validation', () => {
    it('should throw NotFoundError if story not in queue (AC-3)', async () => {
      prisma.testQueue.findFirst = jest.fn().mockResolvedValue(null);

      await expect(
        handler(prisma, { storyId: testStoryId })
      ).rejects.toThrow(NotFoundError);
      await expect(
        handler(prisma, { storyId: testStoryId })
      ).rejects.toThrow('Pending TestQueue entry for story');
    });

    it('should only consider pending entries', async () => {
      await handler(prisma, { storyId: testStoryId }).catch(() => {});

      expect(prisma.testQueue.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            storyId: testStoryId,
            status: 'pending',
          }),
        })
      );
    });
  });

  describe('Handler Function - Position Calculation', () => {
    it('should calculate ordinal position correctly (AC-3)', async () => {
      const mockEntry = {
        id: 'entry-3',
        storyId: testStoryId,
        position: 300,
        priority: 5,
        status: 'pending',
        story: { key: 'ST-3' },
      };

      prisma.testQueue.findFirst = jest.fn().mockResolvedValue(mockEntry);
      prisma.testQueue.count = jest.fn()
        .mockResolvedValueOnce(2) // entriesAhead: 2 entries with higher priority or lower position
        .mockResolvedValueOnce(5); // totalPending: 5 total pending entries

      const result = await handler(prisma, { storyId: testStoryId });

      expect(result.queuePosition).toBe(3); // 2 ahead + 1
      expect(result.totalInQueue).toBe(5);
    });

    it('should calculate estimated wait time (entries ahead × 5)', async () => {
      const mockEntry = {
        id: 'entry-1',
        storyId: testStoryId,
        position: 400,
        priority: 5,
        status: 'pending',
        story: { key: 'ST-1' },
      };

      prisma.testQueue.findFirst = jest.fn().mockResolvedValue(mockEntry);
      prisma.testQueue.count = jest.fn()
        .mockResolvedValueOnce(3) // 3 entries ahead
        .mockResolvedValueOnce(4);

      const result = await handler(prisma, { storyId: testStoryId });

      expect(result.estimatedWaitMinutes).toBe(15); // 3 × 5
    });

    it('should return 0 estimated wait when first in queue', async () => {
      const mockEntry = {
        id: 'entry-1',
        storyId: testStoryId,
        position: 100,
        priority: 10,
        status: 'pending',
        story: { key: 'ST-1' },
      };

      prisma.testQueue.findFirst = jest.fn().mockResolvedValue(mockEntry);
      prisma.testQueue.count = jest.fn()
        .mockResolvedValueOnce(0) // no entries ahead
        .mockResolvedValueOnce(1);

      const result = await handler(prisma, { storyId: testStoryId });

      expect(result.queuePosition).toBe(1);
      expect(result.estimatedWaitMinutes).toBe(0);
    });

    it('should count entries with higher priority ahead', async () => {
      // Entry with priority 5 at position 300
      const mockEntry = {
        id: 'entry-3',
        storyId: testStoryId,
        position: 300,
        priority: 5,
        status: 'pending',
        story: { key: 'ST-3' },
      };

      prisma.testQueue.findFirst = jest.fn().mockResolvedValue(mockEntry);
      prisma.testQueue.count = jest.fn()
        .mockResolvedValueOnce(0) // Call for entriesAhead
        .mockResolvedValueOnce(0); // Call for totalPending

      await handler(prisma, { storyId: testStoryId });

      // Verify OR condition for higher priority
      expect(prisma.testQueue.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'pending',
            OR: expect.arrayContaining([
              { priority: { gt: 5 } },
              { priority: 5, position: { lt: 300 } },
            ]),
          }),
        })
      );
    });
  });

  describe('Handler Function - Response', () => {
    it('should return all required fields (AC-3)', async () => {
      const mockEntry = {
        id: 'entry-1',
        storyId: testStoryId,
        position: 200,
        priority: 7,
        status: 'pending',
        story: { key: 'ST-1' },
      };

      prisma.testQueue.findFirst = jest.fn().mockResolvedValue(mockEntry);
      prisma.testQueue.count = jest.fn()
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(3);

      const result = await handler(prisma, { storyId: testStoryId });

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('storyId');
      expect(result).toHaveProperty('storyKey');
      expect(result).toHaveProperty('position');
      expect(result).toHaveProperty('queuePosition');
      expect(result).toHaveProperty('priority');
      expect(result).toHaveProperty('estimatedWaitMinutes');
      expect(result).toHaveProperty('totalInQueue');
      expect(result).toHaveProperty('status');
    });

    it('should include story key in response', async () => {
      const mockEntry = {
        id: 'entry-1',
        storyId: testStoryId,
        position: 100,
        priority: 5,
        status: 'pending',
        story: { key: 'ST-42' },
      };

      prisma.testQueue.findFirst = jest.fn().mockResolvedValue(mockEntry);
      prisma.testQueue.count = jest.fn()
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(1);

      const result = await handler(prisma, { storyId: testStoryId });

      expect(result.storyKey).toBe('ST-42');
    });
  });
});
