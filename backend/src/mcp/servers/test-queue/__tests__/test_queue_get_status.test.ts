/**
 * Unit tests for test_queue_get_status tool
 * Tests all acceptance criteria from baAnalysis
 */

import { PrismaClient } from '@prisma/client';
import { createTestPrismaClient } from '@/test-utils/safe-prisma-client';
import { NotFoundError } from '../../../types';
import { handler, tool } from '../test_queue_get_status';

describe('test_queue_get_status', () => {
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
      expect(tool.name).toBe('mcp__vibestudio__test_queue_get_status');
    });

    it('should have required storyId parameter', () => {
      expect(tool.inputSchema.required).toContain('storyId');
    });
  });

  describe('Handler Function - Validation', () => {
    it('should throw NotFoundError if no entry exists (AC-4)', async () => {
      prisma.testQueue.findFirst = jest.fn().mockResolvedValue(null);

      await expect(
        handler(prisma, { storyId: testStoryId })
      ).rejects.toThrow(NotFoundError);
      await expect(
        handler(prisma, { storyId: testStoryId })
      ).rejects.toThrow('TestQueue entry for story');
    });

    it('should find most recent entry when multiple exist', async () => {
      await handler(prisma, { storyId: testStoryId }).catch(() => {});

      expect(prisma.testQueue.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { storyId: testStoryId },
          orderBy: { createdAt: 'desc' },
        })
      );
    });
  });

  describe('Handler Function - Status Details', () => {
    it('should return full status details for pending entry (AC-4)', async () => {
      const mockEntry = {
        id: 'entry-1',
        storyId: testStoryId,
        position: 200,
        priority: 5,
        status: 'pending',
        submittedBy: 'user-1',
        testResults: null,
        errorMessage: null,
        createdAt: new Date('2025-01-01T10:00:00Z'),
        updatedAt: new Date('2025-01-01T11:00:00Z'),
        story: { key: 'ST-1', title: 'Test Story' },
      };

      prisma.testQueue.findFirst = jest.fn().mockResolvedValue(mockEntry);
      prisma.testQueue.count = jest.fn().mockResolvedValue(2); // 2 entries ahead

      const result = await handler(prisma, { storyId: testStoryId });

      expect(result.status).toBe('pending');
      expect(result.queuePosition).toBe(3); // 2 ahead + 1
      expect(result.estimatedWaitMinutes).toBe(10); // 2 × 5
    });

    it('should return test results for passed entry (AC-4)', async () => {
      const testResults = { tests: 20, passed: 20, failed: 0 };
      const mockEntry = {
        id: 'entry-1',
        storyId: testStoryId,
        position: 100,
        priority: 5,
        status: 'passed',
        submittedBy: 'user-1',
        testResults,
        errorMessage: null,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-02'),
        story: { key: 'ST-1', title: 'Test Story' },
      };

      prisma.testQueue.findFirst = jest.fn().mockResolvedValue(mockEntry);

      const result = await handler(prisma, { storyId: testStoryId });

      expect(result.status).toBe('passed');
      expect(result.testResults).toEqual(testResults);
      expect(result.queuePosition).toBeUndefined(); // not pending
      expect(result.estimatedWaitMinutes).toBeUndefined(); // not pending
    });

    it('should return error message for failed entry (AC-4)', async () => {
      const mockEntry = {
        id: 'entry-1',
        storyId: testStoryId,
        position: 100,
        priority: 5,
        status: 'failed',
        submittedBy: 'user-1',
        testResults: { tests: 10, passed: 8, failed: 2 },
        errorMessage: 'Test suite failed: auth.test.ts',
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-02'),
        story: { key: 'ST-1', title: 'Test Story' },
      };

      prisma.testQueue.findFirst = jest.fn().mockResolvedValue(mockEntry);

      const result = await handler(prisma, { storyId: testStoryId });

      expect(result.status).toBe('failed');
      expect(result.errorMessage).toBe('Test suite failed: auth.test.ts');
      expect(result.testResults).toEqual({ tests: 10, passed: 8, failed: 2 });
    });

    it('should include queue position for pending entries only', async () => {
      const mockEntry = {
        id: 'entry-1',
        storyId: testStoryId,
        position: 100,
        priority: 5,
        status: 'running',
        submittedBy: 'user-1',
        testResults: null,
        errorMessage: null,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
        story: { key: 'ST-1', title: 'Test Story' },
      };

      prisma.testQueue.findFirst = jest.fn().mockResolvedValue(mockEntry);

      const result = await handler(prisma, { storyId: testStoryId });

      expect(result.status).toBe('running');
      expect(result.queuePosition).toBeUndefined();
      expect(result.estimatedWaitMinutes).toBeUndefined();
    });
  });

  describe('Handler Function - Response', () => {
    it('should return all required fields (AC-4)', async () => {
      const mockEntry = {
        id: 'entry-1',
        storyId: testStoryId,
        position: 100,
        priority: 5,
        status: 'cancelled',
        submittedBy: 'user-1',
        testResults: null,
        errorMessage: null,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
        story: { key: 'ST-1', title: 'Test Story' },
      };

      prisma.testQueue.findFirst = jest.fn().mockResolvedValue(mockEntry);

      const result = await handler(prisma, { storyId: testStoryId });

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('storyId');
      expect(result).toHaveProperty('storyKey');
      expect(result).toHaveProperty('storyTitle');
      expect(result).toHaveProperty('position');
      expect(result).toHaveProperty('priority');
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('submittedBy');
      expect(result).toHaveProperty('createdAt');
      expect(result).toHaveProperty('updatedAt');
    });

    it('should include story key and title', async () => {
      const mockEntry = {
        id: 'entry-1',
        storyId: testStoryId,
        position: 100,
        priority: 5,
        status: 'skipped',
        submittedBy: 'user-1',
        testResults: null,
        errorMessage: 'Dependency failed',
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
        story: { key: 'ST-42', title: 'Important Feature' },
      };

      prisma.testQueue.findFirst = jest.fn().mockResolvedValue(mockEntry);

      const result = await handler(prisma, { storyId: testStoryId });

      expect(result.storyKey).toBe('ST-42');
      expect(result.storyTitle).toBe('Important Feature');
    });

    it('should handle undefined testResults and errorMessage', async () => {
      const mockEntry = {
        id: 'entry-1',
        storyId: testStoryId,
        position: 100,
        priority: 5,
        status: 'pending',
        submittedBy: 'user-1',
        testResults: null,
        errorMessage: null,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
        story: { key: 'ST-1', title: 'Test Story' },
      };

      prisma.testQueue.findFirst = jest.fn().mockResolvedValue(mockEntry);
      prisma.testQueue.count = jest.fn().mockResolvedValue(0);

      const result = await handler(prisma, { storyId: testStoryId });

      expect(result.testResults).toBeUndefined();
      expect(result.errorMessage).toBeUndefined();
    });
  });
});
