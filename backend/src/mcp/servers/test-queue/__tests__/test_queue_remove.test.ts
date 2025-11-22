/**
 * Unit tests for test_queue_remove tool
 * Tests all acceptance criteria from baAnalysis
 */

import { PrismaClient } from '@prisma/client';
import { createTestPrismaClient } from '@/test-utils/safe-prisma-client';
import { NotFoundError } from '../../../types';
import { handler, tool } from '../test_queue_remove';

describe('test_queue_remove', () => {
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
      expect(tool.name).toBe('mcp__vibestudio__test_queue_remove');
    });

    it('should have required storyId parameter', () => {
      expect(tool.inputSchema.required).toContain('storyId');
    });
  });

  describe('Handler Function - Validation', () => {
    it('should throw NotFoundError if no pending/running entry exists (AC-5)', async () => {
      prisma.testQueue.findFirst = jest.fn().mockResolvedValue(null);

      await expect(
        handler(prisma, { storyId: testStoryId })
      ).rejects.toThrow(NotFoundError);
      await expect(
        handler(prisma, { storyId: testStoryId })
      ).rejects.toThrow('Pending or running TestQueue entry for story');
    });

    it('should only look for pending or running entries', async () => {
      await handler(prisma, { storyId: testStoryId }).catch(() => {});

      expect(prisma.testQueue.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            storyId: testStoryId,
            status: { in: ['pending', 'running'] },
          }),
        })
      );
    });

    it('should not remove completed entries (passed/failed)', async () => {
      // This test verifies the where clause only includes pending/running
      prisma.testQueue.findFirst = jest.fn().mockResolvedValue(null);

      await expect(
        handler(prisma, { storyId: testStoryId })
      ).rejects.toThrow(NotFoundError);

      // Verify we only searched for pending/running
      expect(prisma.testQueue.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: ['pending', 'running'] },
          }),
        })
      );
    });
  });

  describe('Handler Function - Cancellation', () => {
    it('should cancel pending entry (AC-5)', async () => {
      const mockEntry = {
        id: 'entry-1',
        storyId: testStoryId,
        status: 'pending',
        story: { key: 'ST-1' },
      };

      prisma.testQueue.findFirst = jest.fn().mockResolvedValue(mockEntry);
      prisma.testQueue.update = jest.fn().mockResolvedValue({
        ...mockEntry,
        status: 'cancelled',
      });

      const result = await handler(prisma, { storyId: testStoryId });

      expect(prisma.testQueue.update).toHaveBeenCalledWith({
        where: { id: 'entry-1' },
        data: { status: 'cancelled' },
      });
      expect(result.previousStatus).toBe('pending');
    });

    it('should cancel running entry (AC-5)', async () => {
      const mockEntry = {
        id: 'entry-2',
        storyId: testStoryId,
        status: 'running',
        story: { key: 'ST-2' },
      };

      prisma.testQueue.findFirst = jest.fn().mockResolvedValue(mockEntry);
      prisma.testQueue.update = jest.fn().mockResolvedValue({
        ...mockEntry,
        status: 'cancelled',
      });

      const result = await handler(prisma, { storyId: testStoryId });

      expect(result.previousStatus).toBe('running');
    });

    it('should update status to cancelled (soft delete) (AC-5)', async () => {
      const mockEntry = {
        id: 'entry-1',
        storyId: testStoryId,
        status: 'pending',
        story: { key: 'ST-1' },
      };

      prisma.testQueue.findFirst = jest.fn().mockResolvedValue(mockEntry);
      prisma.testQueue.update = jest.fn().mockResolvedValue({
        ...mockEntry,
        status: 'cancelled',
      });

      await handler(prisma, { storyId: testStoryId });

      // Verify it's an UPDATE not DELETE (soft delete)
      expect(prisma.testQueue.update).toHaveBeenCalled();
      expect(prisma.testQueue.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'cancelled' },
        })
      );
    });
  });

  describe('Handler Function - Response', () => {
    it('should return all required fields (AC-5)', async () => {
      const mockEntry = {
        id: 'entry-1',
        storyId: testStoryId,
        status: 'pending',
        story: { key: 'ST-42' },
      };

      prisma.testQueue.findFirst = jest.fn().mockResolvedValue(mockEntry);
      prisma.testQueue.update = jest.fn().mockResolvedValue({
        ...mockEntry,
        status: 'cancelled',
      });

      const result = await handler(prisma, { storyId: testStoryId });

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('storyId');
      expect(result).toHaveProperty('storyKey');
      expect(result).toHaveProperty('previousStatus');
      expect(result).toHaveProperty('message');
    });

    it('should return previous status in response', async () => {
      const mockEntry = {
        id: 'entry-1',
        storyId: testStoryId,
        status: 'running',
        story: { key: 'ST-1' },
      };

      prisma.testQueue.findFirst = jest.fn().mockResolvedValue(mockEntry);
      prisma.testQueue.update = jest.fn().mockResolvedValue({
        ...mockEntry,
        status: 'cancelled',
      });

      const result = await handler(prisma, { storyId: testStoryId });

      expect(result.previousStatus).toBe('running');
    });

    it('should include story key in response', async () => {
      const mockEntry = {
        id: 'entry-1',
        storyId: testStoryId,
        status: 'pending',
        story: { key: 'ST-99' },
      };

      prisma.testQueue.findFirst = jest.fn().mockResolvedValue(mockEntry);
      prisma.testQueue.update = jest.fn().mockResolvedValue({
        ...mockEntry,
        status: 'cancelled',
      });

      const result = await handler(prisma, { storyId: testStoryId });

      expect(result.storyKey).toBe('ST-99');
    });

    it('should return success message', async () => {
      const mockEntry = {
        id: 'entry-1',
        storyId: testStoryId,
        status: 'pending',
        story: { key: 'ST-1' },
      };

      prisma.testQueue.findFirst = jest.fn().mockResolvedValue(mockEntry);
      prisma.testQueue.update = jest.fn().mockResolvedValue({
        ...mockEntry,
        status: 'cancelled',
      });

      const result = await handler(prisma, { storyId: testStoryId });

      expect(result.message).toContain('Successfully cancelled');
      expect(result.message).toContain('ST-1');
      expect(result.message).toContain('pending');
    });
  });
});
