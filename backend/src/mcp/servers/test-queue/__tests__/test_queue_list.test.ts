/**
 * Unit tests for test_queue_list tool
 * Tests all acceptance criteria from baAnalysis
 */

import { PrismaClient } from '@prisma/client';
import { createTestPrismaClient } from '@/test-utils/safe-prisma-client';
import { handler, tool } from '../test_queue_list';

describe('test_queue_list', () => {
  let prisma: PrismaClient;

  beforeEach(() => {
    prisma = createTestPrismaClient();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await prisma.$disconnect();
  });

  describe('Tool Definition', () => {
    it('should have correct tool name', () => {
      expect(tool.name).toBe('mcp__vibestudio__test_queue_list');
    });

    it('should have optional status, limit, and offset parameters', () => {
      expect(tool.inputSchema.properties).toHaveProperty('status');
      expect(tool.inputSchema.properties).toHaveProperty('limit');
      expect(tool.inputSchema.properties).toHaveProperty('offset');
      expect(tool.inputSchema.required).toBeUndefined();
    });

    it('should define status enum values', () => {
      expect((tool.inputSchema.properties.status as any).enum).toEqual([
        'pending', 'running', 'passed', 'failed', 'cancelled', 'skipped'
      ]);
    });

    it('should define limit range as 1-100 with default 20', () => {
      expect((tool.inputSchema.properties.limit as any).minimum).toBe(1);
      expect((tool.inputSchema.properties.limit as any).maximum).toBe(100);
      expect((tool.inputSchema.properties.limit as any).default).toBe(20);
    });
  });

  describe('Handler Function - Listing', () => {
    it('should list all entries when no status filter provided (AC-2)', async () => {
      const mockEntries = [
        {
          id: 'entry-1',
          storyId: 'story-1',
          position: 100,
          priority: 10,
          status: 'pending',
          submittedBy: 'user-1',
          testResults: null,
          errorMessage: null,
          createdAt: new Date('2025-01-01'),
          updatedAt: new Date('2025-01-01'),
          story: { id: 'story-1', key: 'ST-1', title: 'Story 1' },
        },
        {
          id: 'entry-2',
          storyId: 'story-2',
          position: 200,
          priority: 5,
          status: 'running',
          submittedBy: 'user-2',
          testResults: null,
          errorMessage: null,
          createdAt: new Date('2025-01-01'),
          updatedAt: new Date('2025-01-01'),
          story: { id: 'story-2', key: 'ST-2', title: 'Story 2' },
        },
      ];

      prisma.testQueue.count = jest.fn().mockResolvedValue(2);
      prisma.testQueue.findMany = jest.fn().mockResolvedValue(mockEntries);

      const result = await handler(prisma, {});

      expect(result.entries).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(prisma.testQueue.count).toHaveBeenCalledWith({ where: {} });
    });

    it('should filter by status correctly (AC-2)', async () => {
      prisma.testQueue.count = jest.fn().mockResolvedValue(1);
      prisma.testQueue.findMany = jest.fn().mockResolvedValue([
        {
          id: 'entry-1',
          storyId: 'story-1',
          position: 100,
          priority: 5,
          status: 'pending',
          submittedBy: 'user-1',
          testResults: null,
          errorMessage: null,
          createdAt: new Date('2025-01-01'),
          updatedAt: new Date('2025-01-01'),
          story: { id: 'story-1', key: 'ST-1', title: 'Story 1' },
        },
      ]);

      await handler(prisma, { status: 'pending' });

      expect(prisma.testQueue.count).toHaveBeenCalledWith({
        where: { status: 'pending' },
      });
      expect(prisma.testQueue.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'pending' },
        })
      );
    });

    it('should order by priority DESC, position ASC (AC-2, AC-7)', async () => {
      prisma.testQueue.count = jest.fn().mockResolvedValue(0);
      prisma.testQueue.findMany = jest.fn().mockResolvedValue([]);

      await handler(prisma, {});

      expect(prisma.testQueue.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [
            { priority: 'desc' },
            { position: 'asc' },
          ],
        })
      );
    });

    it('should include story key and title (AC-2)', async () => {
      const mockEntry = {
        id: 'entry-1',
        storyId: 'story-1',
        position: 100,
        priority: 5,
        status: 'pending',
        submittedBy: 'user-1',
        testResults: null,
        errorMessage: null,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
        story: { id: 'story-1', key: 'ST-1', title: 'Test Story' },
      };

      prisma.testQueue.count = jest.fn().mockResolvedValue(1);
      prisma.testQueue.findMany = jest.fn().mockResolvedValue([mockEntry]);

      const result = await handler(prisma, {});

      expect(result.entries[0].storyKey).toBe('ST-1');
      expect(result.entries[0].storyTitle).toBe('Test Story');
    });
  });

  describe('Handler Function - Pagination', () => {
    it('should respect limit parameter (max 100)', async () => {
      prisma.testQueue.count = jest.fn().mockResolvedValue(0);
      prisma.testQueue.findMany = jest.fn().mockResolvedValue([]);

      await handler(prisma, { limit: 50 });

      expect(prisma.testQueue.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 50,
        })
      );
    });

    it('should cap limit at 100', async () => {
      prisma.testQueue.count = jest.fn().mockResolvedValue(0);
      prisma.testQueue.findMany = jest.fn().mockResolvedValue([]);

      await handler(prisma, { limit: 200 });

      expect(prisma.testQueue.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 100,
        })
      );
    });

    it('should handle pagination with offset', async () => {
      prisma.testQueue.count = jest.fn().mockResolvedValue(100);
      prisma.testQueue.findMany = jest.fn().mockResolvedValue([]);

      await handler(prisma, { limit: 20, offset: 40 });

      expect(prisma.testQueue.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 40,
          take: 20,
        })
      );
    });

    it('should return correct total count', async () => {
      prisma.testQueue.count = jest.fn().mockResolvedValue(42);
      prisma.testQueue.findMany = jest.fn().mockResolvedValue([]);

      const result = await handler(prisma, {});

      expect(result.total).toBe(42);
    });

    it('should use default limit of 20 when not specified', async () => {
      prisma.testQueue.count = jest.fn().mockResolvedValue(0);
      prisma.testQueue.findMany = jest.fn().mockResolvedValue([]);

      await handler(prisma, {});

      expect(prisma.testQueue.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 20,
        })
      );
    });

    it('should use default offset of 0 when not specified', async () => {
      prisma.testQueue.count = jest.fn().mockResolvedValue(0);
      prisma.testQueue.findMany = jest.fn().mockResolvedValue([]);

      await handler(prisma, {});

      expect(prisma.testQueue.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
        })
      );
    });
  });

  describe('Handler Function - Response Format', () => {
    it('should format entries correctly with all fields', async () => {
      const mockEntry = {
        id: 'entry-1',
        storyId: 'story-1',
        position: 100,
        priority: 8,
        status: 'failed',
        submittedBy: 'user-1',
        testResults: { tests: 10, passed: 8, failed: 2 },
        errorMessage: 'Test failed',
        createdAt: new Date('2025-01-01T10:00:00Z'),
        updatedAt: new Date('2025-01-01T11:00:00Z'),
        story: { id: 'story-1', key: 'ST-1', title: 'Test Story' },
      };

      prisma.testQueue.count = jest.fn().mockResolvedValue(1);
      prisma.testQueue.findMany = jest.fn().mockResolvedValue([mockEntry]);

      const result = await handler(prisma, {});

      expect(result.entries[0]).toEqual({
        id: 'entry-1',
        storyId: 'story-1',
        storyKey: 'ST-1',
        storyTitle: 'Test Story',
        position: 100,
        priority: 8,
        status: 'failed',
        submittedBy: 'user-1',
        testResults: { tests: 10, passed: 8, failed: 2 },
        errorMessage: 'Test failed',
        createdAt: '2025-01-01T10:00:00.000Z',
        updatedAt: '2025-01-01T11:00:00.000Z',
      });
    });

    it('should handle null testResults and errorMessage', async () => {
      const mockEntry = {
        id: 'entry-1',
        storyId: 'story-1',
        position: 100,
        priority: 5,
        status: 'pending',
        submittedBy: 'user-1',
        testResults: null,
        errorMessage: null,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
        story: { id: 'story-1', key: 'ST-1', title: 'Test Story' },
      };

      prisma.testQueue.count = jest.fn().mockResolvedValue(1);
      prisma.testQueue.findMany = jest.fn().mockResolvedValue([mockEntry]);

      const result = await handler(prisma, {});

      expect(result.entries[0].testResults).toBeUndefined();
      expect(result.entries[0].errorMessage).toBeUndefined();
    });
  });
});
