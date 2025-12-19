/**
 * Unit tests for Story MCP Tools
 * ST-355: Add unit tests for top 20 uncovered backend files
 */

import { PrismaClient } from '@prisma/client';
import {
  createStory,
  listStories,
  getStory,
  updateStory,
  getStorySummary,
} from '../story.tools';

// Mock the utils module
jest.mock('../../utils', () => ({
  formatStory: jest.fn((story) => story),
  generateNextKey: jest.fn().mockResolvedValue('ST-123'),
  validateRequired: jest.fn((params, fields) => {
    fields.forEach((field) => {
      if (!(field in params) || params[field] === undefined) {
        throw new Error(`${field} is required`);
      }
    });
  }),
  handlePrismaError: jest.fn((error) => error),
  getSystemUserId: jest.fn().mockResolvedValue('system-user-id'),
}));

describe('Story Tools', () => {
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      project: {
        findUnique: jest.fn(),
      },
      epic: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      agentFramework: {
        findUnique: jest.fn(),
      },
      story: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
        groupBy: jest.fn(),
      },
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createStory', () => {
    const mockProject = { id: 'project-1', name: 'Test Project' };
    const mockStory = {
      id: 'story-1',
      key: 'ST-123',
      title: 'Test Story',
      projectId: 'project-1',
    };

    it('should create a story successfully', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(mockProject);
      mockPrisma.story.create.mockResolvedValue(mockStory);

      const result = await createStory(mockPrisma as PrismaClient, {
        projectId: 'project-1',
        title: 'Test Story',
      });

      expect(result).toEqual(mockStory);
      expect(mockPrisma.project.findUnique).toHaveBeenCalledWith({
        where: { id: 'project-1' },
      });
      expect(mockPrisma.story.create).toHaveBeenCalled();
    });

    it('should throw error when project not found', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(null);

      await expect(
        createStory(mockPrisma as PrismaClient, {
          projectId: 'project-1',
          title: 'Test Story',
        }),
      ).rejects.toThrow();
    });

    it('should validate epic belongs to project', async () => {
      const mockEpic = { id: 'epic-1', projectId: 'project-2' };

      mockPrisma.project.findUnique.mockResolvedValue(mockProject);
      mockPrisma.epic.findUnique.mockResolvedValue(mockEpic);

      await expect(
        createStory(mockPrisma as PrismaClient, {
          projectId: 'project-1',
          title: 'Test Story',
          epicId: 'epic-1',
        }),
      ).rejects.toThrow();
    });

    it('should validate framework exists', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(mockProject);
      mockPrisma.agentFramework.findUnique.mockResolvedValue(null);

      await expect(
        createStory(mockPrisma as PrismaClient, {
          projectId: 'project-1',
          title: 'Test Story',
          assignedFrameworkId: 'framework-1',
        }),
      ).rejects.toThrow();
    });

    it('should create story with all optional fields', async () => {
      const mockEpic = { id: 'epic-1', projectId: 'project-1' };
      const mockFramework = { id: 'framework-1' };

      mockPrisma.project.findUnique.mockResolvedValue(mockProject);
      mockPrisma.epic.findUnique.mockResolvedValue(mockEpic);
      mockPrisma.agentFramework.findUnique.mockResolvedValue(mockFramework);
      mockPrisma.story.create.mockResolvedValue(mockStory);

      await createStory(mockPrisma as PrismaClient, {
        projectId: 'project-1',
        title: 'Test Story',
        description: 'Description',
        epicId: 'epic-1',
        type: 'feature',
        businessImpact: 8,
        businessComplexity: 5,
        technicalComplexity: 7,
        assignedFrameworkId: 'framework-1',
      });

      expect(mockPrisma.story.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: 'Test Story',
          description: 'Description',
          type: 'feature',
          businessImpact: 8,
          businessComplexity: 5,
          technicalComplexity: 7,
        }),
      });
    });
  });

  describe('listStories', () => {
    const mockStories = [
      { id: 'story-1', key: 'ST-1', title: 'Story 1' },
      { id: 'story-2', key: 'ST-2', title: 'Story 2' },
    ];

    it('should list stories with default pagination', async () => {
      mockPrisma.story.count.mockResolvedValue(2);
      mockPrisma.story.findMany.mockResolvedValue(mockStories);

      const result = await listStories(mockPrisma as PrismaClient);

      expect(result.data).toHaveLength(2);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.pageSize).toBe(20);
      expect(result.pagination.total).toBe(2);
    });

    it('should filter by projectId', async () => {
      mockPrisma.story.count.mockResolvedValue(1);
      mockPrisma.story.findMany.mockResolvedValue([mockStories[0]]);

      await listStories(mockPrisma as PrismaClient, {
        projectId: 'project-1',
      });

      expect(mockPrisma.story.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ projectId: 'project-1' }),
        }),
      );
    });

    it('should filter by epicId', async () => {
      mockPrisma.story.count.mockResolvedValue(1);
      mockPrisma.story.findMany.mockResolvedValue([mockStories[0]]);

      await listStories(mockPrisma as PrismaClient, {
        epicId: 'epic-1',
      });

      expect(mockPrisma.story.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ epicId: 'epic-1' }),
        }),
      );
    });

    it('should filter by status', async () => {
      mockPrisma.story.count.mockResolvedValue(1);
      mockPrisma.story.findMany.mockResolvedValue([mockStories[0]]);

      await listStories(mockPrisma as PrismaClient, {
        status: 'impl',
      });

      expect(mockPrisma.story.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'impl' }),
        }),
      );
    });

    it('should filter by type', async () => {
      mockPrisma.story.count.mockResolvedValue(1);
      mockPrisma.story.findMany.mockResolvedValue([mockStories[0]]);

      await listStories(mockPrisma as PrismaClient, {
        type: 'bug',
      });

      expect(mockPrisma.story.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ type: 'bug' }),
        }),
      );
    });

    it('should handle pagination correctly', async () => {
      mockPrisma.story.count.mockResolvedValue(50);
      mockPrisma.story.findMany.mockResolvedValue(mockStories);

      const result = await listStories(mockPrisma as PrismaClient, {
        page: 2,
        pageSize: 10,
      });

      expect(mockPrisma.story.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        }),
      );
      expect(result.pagination.page).toBe(2);
      expect(result.pagination.totalPages).toBe(5);
      expect(result.pagination.hasNext).toBe(true);
      expect(result.pagination.hasPrev).toBe(true);
    });

    it('should limit pageSize to 100', async () => {
      mockPrisma.story.count.mockResolvedValue(200);
      mockPrisma.story.findMany.mockResolvedValue(mockStories);

      await listStories(mockPrisma as PrismaClient, {
        pageSize: 500,
      });

      expect(mockPrisma.story.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 100,
        }),
      );
    });

    it('should calculate hasNext and hasPrev correctly', async () => {
      mockPrisma.story.count.mockResolvedValue(30);
      mockPrisma.story.findMany.mockResolvedValue(mockStories);

      const result = await listStories(mockPrisma as PrismaClient, {
        page: 2,
        pageSize: 10,
      });

      expect(result.pagination.hasNext).toBe(true);
      expect(result.pagination.hasPrev).toBe(true);
    });
  });

  describe('getStory', () => {
    const mockStory = {
      id: 'story-1',
      key: 'ST-1',
      title: 'Story 1',
    };

    it('should get story by ID', async () => {
      mockPrisma.story.findUnique.mockResolvedValue(mockStory);

      const result = await getStory(mockPrisma as PrismaClient, {
        storyId: 'story-1',
      });

      expect(result).toEqual(mockStory);
      expect(mockPrisma.story.findUnique).toHaveBeenCalledWith({
        where: { id: 'story-1' },
        include: undefined,
      });
    });

    it('should throw error when story not found', async () => {
      mockPrisma.story.findUnique.mockResolvedValue(null);

      await expect(
        getStory(mockPrisma as PrismaClient, {
          storyId: 'story-1',
        }),
      ).rejects.toThrow();
    });

    it('should include subtasks when requested', async () => {
      mockPrisma.story.findUnique.mockResolvedValue({
        ...mockStory,
        subtasks: [],
      });

      await getStory(mockPrisma as PrismaClient, {
        storyId: 'story-1',
        includeSubtasks: true,
      });

      expect(mockPrisma.story.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            subtasks: { orderBy: { createdAt: 'asc' } },
          }),
        }),
      );
    });

    it('should include use cases when requested', async () => {
      mockPrisma.story.findUnique.mockResolvedValue({
        ...mockStory,
        useCaseLinks: [],
      });

      await getStory(mockPrisma as PrismaClient, {
        storyId: 'story-1',
        includeUseCases: true,
      });

      expect(mockPrisma.story.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            useCaseLinks: expect.any(Object),
          }),
        }),
      );
    });

    it('should include commits when requested', async () => {
      mockPrisma.story.findUnique.mockResolvedValue({
        ...mockStory,
        commits: [],
      });

      await getStory(mockPrisma as PrismaClient, {
        storyId: 'story-1',
        includeCommits: true,
      });

      expect(mockPrisma.story.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            commits: {
              include: { files: true },
              orderBy: { timestamp: 'desc' },
              take: 10,
            },
          }),
        }),
      );
    });
  });

  describe('updateStory', () => {
    const mockStory = {
      id: 'story-1',
      key: 'ST-1',
      title: 'Story 1',
    };

    it('should update story successfully', async () => {
      mockPrisma.story.findUnique.mockResolvedValue(mockStory);
      mockPrisma.story.update.mockResolvedValue({
        ...mockStory,
        title: 'Updated',
      });

      const result = await updateStory(mockPrisma as PrismaClient, {
        storyId: 'story-1',
        title: 'Updated',
      });

      expect(result.title).toBe('Updated');
      expect(mockPrisma.story.update).toHaveBeenCalled();
    });

    it('should throw error when story not found', async () => {
      mockPrisma.story.findUnique.mockResolvedValue(null);

      await expect(
        updateStory(mockPrisma as PrismaClient, {
          storyId: 'story-1',
          title: 'Updated',
        }),
      ).rejects.toThrow();
    });

    it('should validate framework exists', async () => {
      mockPrisma.story.findUnique.mockResolvedValue(mockStory);
      mockPrisma.agentFramework.findUnique.mockResolvedValue(null);

      await expect(
        updateStory(mockPrisma as PrismaClient, {
          storyId: 'story-1',
          assignedFrameworkId: 'framework-1',
        }),
      ).rejects.toThrow();
    });

    it('should only update provided fields', async () => {
      mockPrisma.story.findUnique.mockResolvedValue(mockStory);
      mockPrisma.story.update.mockResolvedValue(mockStory);

      await updateStory(mockPrisma as PrismaClient, {
        storyId: 'story-1',
        title: 'Updated',
      });

      expect(mockPrisma.story.update).toHaveBeenCalledWith({
        where: { id: 'story-1' },
        data: expect.objectContaining({
          title: 'Updated',
        }),
      });
    });

    it('should update multiple fields', async () => {
      mockPrisma.story.findUnique.mockResolvedValue(mockStory);
      mockPrisma.story.update.mockResolvedValue(mockStory);

      await updateStory(mockPrisma as PrismaClient, {
        storyId: 'story-1',
        title: 'Updated',
        description: 'New description',
        status: 'impl',
        businessImpact: 9,
        businessComplexity: 6,
        technicalComplexity: 8,
      });

      expect(mockPrisma.story.update).toHaveBeenCalledWith({
        where: { id: 'story-1' },
        data: expect.objectContaining({
          title: 'Updated',
          description: 'New description',
          status: 'impl',
          businessImpact: 9,
          businessComplexity: 6,
          technicalComplexity: 8,
        }),
      });
    });
  });

  describe('getStorySummary', () => {
    it('should group by status', async () => {
      const mockGrouped = [
        {
          status: 'planning',
          _count: 5,
          _avg: { technicalComplexity: 5.5 },
        },
        {
          status: 'impl',
          _count: 3,
          _avg: { technicalComplexity: 7.0 },
        },
      ];

      mockPrisma.story.groupBy.mockResolvedValue(mockGrouped);

      const result = await getStorySummary(mockPrisma as PrismaClient, {
        projectId: 'project-1',
        groupBy: 'status',
      });

      expect(result.groupBy).toBe('status');
      expect(result.summary).toHaveLength(2);
      expect(result.summary[0]).toHaveProperty('status');
      expect(result.summary[0]).toHaveProperty('count');
      expect(result.summary[0]).toHaveProperty('avgComplexity');
    });

    it('should group by type', async () => {
      const mockGrouped = [
        { type: 'feature', _count: 10 },
        { type: 'bug', _count: 5 },
      ];

      mockPrisma.story.groupBy.mockResolvedValue(mockGrouped);

      const result = await getStorySummary(mockPrisma as PrismaClient, {
        projectId: 'project-1',
        groupBy: 'type',
      });

      expect(result.groupBy).toBe('type');
      expect(result.summary).toHaveLength(2);
    });

    it('should group by epic', async () => {
      const mockGrouped = [
        { epicId: 'epic-1', _count: 7 },
        { epicId: 'epic-2', _count: 3 },
      ];

      const mockEpics = [
        { id: 'epic-1', key: 'EP-1', title: 'Epic 1' },
        { id: 'epic-2', key: 'EP-2', title: 'Epic 2' },
      ];

      mockPrisma.story.groupBy.mockResolvedValue(mockGrouped);
      mockPrisma.epic.findMany.mockResolvedValue(mockEpics);

      const result = await getStorySummary(mockPrisma as PrismaClient, {
        projectId: 'project-1',
        groupBy: 'epic',
      });

      expect(result.groupBy).toBe('epic');
      expect(result.summary).toHaveLength(2);
      expect(result.summary[0]).toHaveProperty('epic');
    });

    it('should group by complexity', async () => {
      const mockGrouped = [
        { technicalComplexity: 3, _count: 5 },
        { technicalComplexity: 7, _count: 8 },
        { technicalComplexity: null, _count: 2 },
      ];

      mockPrisma.story.groupBy.mockResolvedValue(mockGrouped);

      const result = await getStorySummary(mockPrisma as PrismaClient, {
        projectId: 'project-1',
        groupBy: 'complexity',
      });

      expect(result.groupBy).toBe('complexity');
      expect(result.summary).toHaveLength(2); // null filtered out
      expect(result.summary[0].complexity).toBe(3);
      expect(result.summary[1].complexity).toBe(7);
    });

    it('should throw error for invalid groupBy', async () => {
      await expect(
        getStorySummary(mockPrisma as PrismaClient, {
          projectId: 'project-1',
          groupBy: 'invalid' as any,
        }),
      ).rejects.toThrow();
    });
  });
});
