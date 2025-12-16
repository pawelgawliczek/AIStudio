/**
 * Unit tests for list_stories MCP tool
 * Tests the merged functionality from search_stories (ST-260)
 */

import { PrismaClient } from '@prisma/client';
import { handler } from '../list_stories';

// Mock PrismaClient
const mockPrisma = {
  story: {
    count: jest.fn(),
    findMany: jest.fn(),
  },
} as unknown as PrismaClient;

describe('list_stories handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Pagination', () => {
    it('should return paginated results with default page size', async () => {
      const now = new Date();
      const mockStories = [
        { id: '1', key: 'ST-1', title: 'Story 1', status: 'planning', type: 'feature', createdAt: now, updatedAt: now },
        { id: '2', key: 'ST-2', title: 'Story 2', status: 'planning', type: 'bug', createdAt: now, updatedAt: now },
      ];

      (mockPrisma.story.count as jest.Mock).mockResolvedValue(2);
      (mockPrisma.story.findMany as jest.Mock).mockResolvedValue(mockStories);

      const result = await handler(mockPrisma, { projectId: 'proj-1' });

      expect(result.pagination.page).toBe(1);
      expect(result.pagination.pageSize).toBe(20);
      expect(result.data.length).toBe(2);
    });

    it('should respect custom page and pageSize', async () => {
      (mockPrisma.story.count as jest.Mock).mockResolvedValue(50);
      (mockPrisma.story.findMany as jest.Mock).mockResolvedValue([]);

      await handler(mockPrisma, { projectId: 'proj-1', page: 2, pageSize: 10 });

      expect(mockPrisma.story.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        }),
      );
    });

    it('should cap pageSize at 100', async () => {
      (mockPrisma.story.count as jest.Mock).mockResolvedValue(200);
      (mockPrisma.story.findMany as jest.Mock).mockResolvedValue([]);

      await handler(mockPrisma, { projectId: 'proj-1', pageSize: 500 });

      expect(mockPrisma.story.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 100,
        }),
      );
    });
  });

  describe('Structured Filters', () => {
    it('should filter by projectId', async () => {
      (mockPrisma.story.count as jest.Mock).mockResolvedValue(0);
      (mockPrisma.story.findMany as jest.Mock).mockResolvedValue([]);

      await handler(mockPrisma, { projectId: 'proj-123' });

      expect(mockPrisma.story.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ projectId: 'proj-123' }),
        }),
      );
    });

    it('should filter by status', async () => {
      (mockPrisma.story.count as jest.Mock).mockResolvedValue(0);
      (mockPrisma.story.findMany as jest.Mock).mockResolvedValue([]);

      await handler(mockPrisma, { projectId: 'proj-1', status: 'planning' });

      expect(mockPrisma.story.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'planning' }),
        }),
      );
    });

    it('should filter by type', async () => {
      (mockPrisma.story.count as jest.Mock).mockResolvedValue(0);
      (mockPrisma.story.findMany as jest.Mock).mockResolvedValue([]);

      await handler(mockPrisma, { projectId: 'proj-1', type: 'bug' });

      expect(mockPrisma.story.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ type: 'bug' }),
        }),
      );
    });

    it('should filter by epicId', async () => {
      (mockPrisma.story.count as jest.Mock).mockResolvedValue(0);
      (mockPrisma.story.findMany as jest.Mock).mockResolvedValue([]);

      await handler(mockPrisma, { projectId: 'proj-1', epicId: 'epic-123' });

      expect(mockPrisma.story.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ epicId: 'epic-123' }),
        }),
      );
    });
  });

  describe('Text Search (query parameter)', () => {
    it('should add OR clause for text search when query provided', async () => {
      (mockPrisma.story.count as jest.Mock).mockResolvedValue(0);
      (mockPrisma.story.findMany as jest.Mock).mockResolvedValue([]);

      await handler(mockPrisma, { projectId: 'proj-1', query: 'authentication' });

      expect(mockPrisma.story.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            projectId: 'proj-1',
            OR: [
              { key: { contains: 'authentication', mode: 'insensitive' } },
              { title: { contains: 'authentication', mode: 'insensitive' } },
              { description: { contains: 'authentication', mode: 'insensitive' } },
            ],
          }),
        }),
      );
    });

    it('should combine text search with structured filters', async () => {
      (mockPrisma.story.count as jest.Mock).mockResolvedValue(0);
      (mockPrisma.story.findMany as jest.Mock).mockResolvedValue([]);

      await handler(mockPrisma, {
        projectId: 'proj-1',
        query: 'login',
        status: 'planning',
        type: 'feature',
      });

      expect(mockPrisma.story.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            projectId: 'proj-1',
            status: 'planning',
            type: 'feature',
            OR: expect.any(Array),
          }),
        }),
      );
    });
  });

  describe('Related Data Includes', () => {
    it('should include subtasks when requested', async () => {
      (mockPrisma.story.count as jest.Mock).mockResolvedValue(0);
      (mockPrisma.story.findMany as jest.Mock).mockResolvedValue([]);

      await handler(mockPrisma, { projectId: 'proj-1', includeSubtasks: true });

      expect(mockPrisma.story.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            subtasks: { orderBy: { createdAt: 'asc' } },
          }),
        }),
      );
    });

    it('should include use cases when requested', async () => {
      (mockPrisma.story.count as jest.Mock).mockResolvedValue(0);
      (mockPrisma.story.findMany as jest.Mock).mockResolvedValue([]);

      await handler(mockPrisma, { projectId: 'proj-1', includeUseCases: true });

      expect(mockPrisma.story.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            useCaseLinks: expect.objectContaining({
              include: expect.objectContaining({
                useCase: expect.any(Object),
              }),
            }),
          }),
        }),
      );
    });

    it('should include commits when requested', async () => {
      (mockPrisma.story.count as jest.Mock).mockResolvedValue(0);
      (mockPrisma.story.findMany as jest.Mock).mockResolvedValue([]);

      await handler(mockPrisma, { projectId: 'proj-1', includeCommits: true });

      expect(mockPrisma.story.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            commits: expect.objectContaining({
              take: 10,
              orderBy: { timestamp: 'desc' },
            }),
          }),
        }),
      );
    });

    it('should include multiple related data types', async () => {
      (mockPrisma.story.count as jest.Mock).mockResolvedValue(0);
      (mockPrisma.story.findMany as jest.Mock).mockResolvedValue([]);

      await handler(mockPrisma, {
        projectId: 'proj-1',
        includeSubtasks: true,
        includeCommits: true,
      });

      expect(mockPrisma.story.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            subtasks: expect.any(Object),
            commits: expect.any(Object),
          }),
        }),
      );
    });

    it('should not include related data by default', async () => {
      (mockPrisma.story.count as jest.Mock).mockResolvedValue(0);
      (mockPrisma.story.findMany as jest.Mock).mockResolvedValue([]);

      await handler(mockPrisma, { projectId: 'proj-1' });

      expect(mockPrisma.story.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: undefined,
        }),
      );
    });
  });

  describe('Field Selection', () => {
    it('should return only requested fields', async () => {
      const mockStories = [
        {
          id: '1',
          key: 'ST-1',
          title: 'Story 1',
          status: 'planning',
          type: 'feature',
          description: 'Long description here',
          summary: 'Short summary',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      (mockPrisma.story.count as jest.Mock).mockResolvedValue(1);
      (mockPrisma.story.findMany as jest.Mock).mockResolvedValue(mockStories);

      const result = await handler(mockPrisma, {
        projectId: 'proj-1',
        fields: ['id', 'key', 'title'],
      });

      expect(result.data[0]).toHaveProperty('id');
      expect(result.data[0]).toHaveProperty('key');
      expect(result.data[0]).toHaveProperty('title');
      // Description should be omitted
      expect((result.data[0] as any).description).toBeUndefined();
    });

    it('should always include id even if not requested', async () => {
      const mockStories = [
        {
          id: '1',
          key: 'ST-1',
          title: 'Story 1',
          status: 'planning',
          type: 'feature',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      (mockPrisma.story.count as jest.Mock).mockResolvedValue(1);
      (mockPrisma.story.findMany as jest.Mock).mockResolvedValue(mockStories);

      const result = await handler(mockPrisma, {
        projectId: 'proj-1',
        fields: ['key', 'title'], // id not requested
      });

      expect(result.data[0]).toHaveProperty('id');
    });
  });
});
