/**
 * Tests for git_list_worktrees tool
 */

import { PrismaClient } from '@prisma/client';
import { createTestPrismaClient } from '@/test-utils/safe-prisma-client';
import { handler, tool } from '../git_list_worktrees';
import * as gitUtils from '../git_utils';

jest.mock('../git_utils');

describe('git_list_worktrees', () => {
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
      expect(tool.name).toBe('git_list_worktrees');
    });

    it('should have no required parameters', () => {
      expect(tool.inputSchema.required).toBeUndefined();
    });

    it('should have optional filter parameters', () => {
      expect(tool.inputSchema.properties).toHaveProperty('projectId');
      expect(tool.inputSchema.properties).toHaveProperty('storyId');
      expect(tool.inputSchema.properties).toHaveProperty('status');
      expect(tool.inputSchema.properties).toHaveProperty('page');
      expect(tool.inputSchema.properties).toHaveProperty('pageSize');
    });
  });

  describe('Handler Function', () => {
    const mockWorktrees = [
      {
        id: 'wt-1',
        storyId: 'story-1',
        branchName: 'st-1-feature',
        worktreePath: '/opt/stack/worktrees/st-1-feature',
        baseBranch: 'main',
        status: 'active',
        createdAt: new Date('2025-11-19T10:00:00Z'),
        updatedAt: new Date('2025-11-19T10:00:00Z'),
        story: {
          key: 'ST-1',
          title: 'Test Feature',
          status: 'impl',
          type: 'feature',
        },
      },
      {
        id: 'wt-2',
        storyId: 'story-2',
        branchName: 'st-2-bugfix',
        worktreePath: '/opt/stack/worktrees/st-2-bugfix',
        baseBranch: 'main',
        status: 'idle',
        createdAt: new Date('2025-11-19T09:00:00Z'),
        updatedAt: new Date('2025-11-19T09:00:00Z'),
        story: {
          key: 'ST-2',
          title: 'Bug Fix',
          status: 'review',
          type: 'bug',
        },
      },
    ];

    describe('List all worktrees', () => {
      it('should return all worktrees with default pagination', async () => {
        prisma.worktree.count = jest.fn().mockResolvedValue(2);
        prisma.worktree.findMany = jest.fn().mockResolvedValue(mockWorktrees);

        const result = await handler(prisma, {});

        expect(result.data).toHaveLength(2);
        expect(result.pagination).toEqual({
          page: 1,
          pageSize: 20,
          total: 2,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        });
      });

      it('should include story details', async () => {
        prisma.worktree.count = jest.fn().mockResolvedValue(1);
        prisma.worktree.findMany = jest.fn().mockResolvedValue([mockWorktrees[0]]);

        const result = await handler(prisma, {});

        expect(result.data[0]).toMatchObject({
          storyKey: 'ST-1',
          storyTitle: 'Test Feature',
          storyStatus: 'impl',
        });
      });
    });

    describe('Filtering', () => {
      it('should filter by storyId', async () => {
        prisma.worktree.count = jest.fn().mockResolvedValue(1);
        prisma.worktree.findMany = jest.fn().mockResolvedValue([mockWorktrees[0]]);

        await handler(prisma, { storyId: 'story-1' });

        expect(prisma.worktree.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({ storyId: 'story-1' }),
          })
        );
      });

      it('should filter by projectId via story relationship', async () => {
        prisma.worktree.count = jest.fn().mockResolvedValue(2);
        prisma.worktree.findMany = jest.fn().mockResolvedValue(mockWorktrees);

        await handler(prisma, { projectId: 'project-1' });

        expect(prisma.worktree.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              story: { projectId: 'project-1' },
            }),
          })
        );
      });

      it('should filter by status', async () => {
        prisma.worktree.count = jest.fn().mockResolvedValue(1);
        prisma.worktree.findMany = jest.fn().mockResolvedValue([mockWorktrees[0]]);

        await handler(prisma, { status: 'active' });

        expect(prisma.worktree.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({ status: 'active' }),
          })
        );
      });

      it('should combine multiple filters', async () => {
        prisma.worktree.count = jest.fn().mockResolvedValue(1);
        prisma.worktree.findMany = jest.fn().mockResolvedValue([mockWorktrees[0]]);

        await handler(prisma, {
          projectId: 'project-1',
          status: 'active',
        });

        expect(prisma.worktree.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              story: { projectId: 'project-1' },
              status: 'active',
            }),
          })
        );
      });
    });

    describe('Pagination', () => {
      it('should paginate results', async () => {
        prisma.worktree.count = jest.fn().mockResolvedValue(50);
        prisma.worktree.findMany = jest.fn().mockResolvedValue(mockWorktrees);

        const result = await handler(prisma, { page: 2, pageSize: 10 });

        expect(prisma.worktree.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            skip: 10, // (page 2 - 1) * pageSize 10
            take: 10,
          })
        );
        expect(result.pagination).toMatchObject({
          page: 2,
          pageSize: 10,
          total: 50,
          totalPages: 5,
          hasNext: true,
          hasPrev: true,
        });
      });

      it('should enforce max page size of 100', async () => {
        prisma.worktree.count = jest.fn().mockResolvedValue(200);
        prisma.worktree.findMany = jest.fn().mockResolvedValue(mockWorktrees);

        await handler(prisma, { pageSize: 200 });

        expect(prisma.worktree.findMany).toHaveBeenCalledWith(
          expect.objectContaining({ take: 100 })
        );
      });

      it('should validate page number >= 1', async () => {
        await expect(handler(prisma, { page: 0 })).rejects.toThrow();
      });

      it('should validate page size range', async () => {
        await expect(handler(prisma, { pageSize: 0 })).rejects.toThrow();
        await expect(handler(prisma, { pageSize: 101 })).rejects.toThrow();
      });
    });

    describe('Filesystem check', () => {
      it('should include filesystem check when requested', async () => {
        const mockCheckFilesystemExists = gitUtils.checkFilesystemExists as jest.MockedFunction<
          typeof gitUtils.checkFilesystemExists
        >;
        mockCheckFilesystemExists.mockReturnValue(true);

        prisma.worktree.count = jest.fn().mockResolvedValue(1);
        prisma.worktree.findMany = jest.fn().mockResolvedValue([mockWorktrees[0]]);

        const result = await handler(prisma, { includeFilesystemCheck: true });

        expect(result.data[0].filesystemExists).toBe(true);
        expect(mockCheckFilesystemExists).toHaveBeenCalledWith(
          '/opt/stack/worktrees/st-1-feature'
        );
      });

      it('should not include filesystem check by default', async () => {
        prisma.worktree.count = jest.fn().mockResolvedValue(1);
        prisma.worktree.findMany = jest.fn().mockResolvedValue([mockWorktrees[0]]);

        const result = await handler(prisma, {});

        expect(result.data[0].filesystemExists).toBeUndefined();
        expect(gitUtils.checkFilesystemExists).not.toHaveBeenCalled();
      });
    });

    describe('Empty results', () => {
      it('should return empty array when no worktrees found', async () => {
        prisma.worktree.count = jest.fn().mockResolvedValue(0);
        prisma.worktree.findMany = jest.fn().mockResolvedValue([]);

        const result = await handler(prisma, {});

        expect(result.data).toEqual([]);
        expect(result.pagination.total).toBe(0);
        expect(result.pagination.totalPages).toBe(0);
      });
    });
  });
});
