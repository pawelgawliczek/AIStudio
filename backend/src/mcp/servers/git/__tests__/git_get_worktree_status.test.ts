/**
 * Tests for git_get_worktree_status tool
 */

import { PrismaClient } from '@prisma/client';
import { createTestPrismaClient } from '@/test-utils/safe-prisma-client';
import { handler, tool } from '../git_get_worktree_status';
import * as gitUtils from '../git_utils';

jest.mock('../git_utils');

describe('git_get_worktree_status', () => {
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
      expect(tool.name).toBe('git_get_worktree_status');
    });

    it('should require storyId parameter', () => {
      expect(tool.inputSchema.required).toContain('storyId');
    });

    it('should have optional parameters', () => {
      expect(tool.inputSchema.properties).toHaveProperty('worktreeId');
      expect(tool.inputSchema.properties).toHaveProperty('includeGitStatus');
      expect(tool.inputSchema.properties).toHaveProperty('includeDiskUsage');
    });
  });

  describe('Handler Function', () => {
    const mockWorktree = {
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
        currentPhase: 'implementation',
      },
    };

    const mockGitStatus = {
      branch: 'st-1-feature',
      tracking: 'origin/main',
      ahead: 2,
      behind: 0,
      modified: 1,
      staged: 2,
      untracked: 1,
      conflicted: 0,
      isClean: false,
      rawStatus: '## st-1-feature...origin/main [ahead 2]\nM  file1.ts\n A file2.ts\n?? file3.ts',
    };

    describe('Worktree found', () => {
      it('should return worktree status when filesystem exists', async () => {
        prisma.worktree.findFirst = jest.fn().mockResolvedValue(mockWorktree);

        const mockCheckFilesystemExists = gitUtils.checkFilesystemExists as jest.MockedFunction<
          typeof gitUtils.checkFilesystemExists
        >;
        mockCheckFilesystemExists.mockReturnValue(true);

        const mockExecGit = gitUtils.execGit as jest.MockedFunction<typeof gitUtils.execGit>;
        mockExecGit.mockReturnValue('## st-1-feature...origin/main [ahead 2]\nM  file1.ts');

        const mockParseGitStatus = gitUtils.parseGitStatus as jest.MockedFunction<
          typeof gitUtils.parseGitStatus
        >;
        mockParseGitStatus.mockReturnValue(mockGitStatus);

        const result = await handler(prisma, { storyId: 'story-1' });

        expect(result.exists).toBe(true);
        expect(result.worktree).toBeDefined();
        expect(result.worktree?.storyKey).toBe('ST-1');
        expect(result.worktree?.filesystemExists).toBe(true);
        expect(result.worktree?.gitStatus).toEqual(mockGitStatus);
      });

      it('should return status without git status when filesystem missing', async () => {
        prisma.worktree.findFirst = jest.fn().mockResolvedValue(mockWorktree);

        const mockCheckFilesystemExists = gitUtils.checkFilesystemExists as jest.MockedFunction<
          typeof gitUtils.checkFilesystemExists
        >;
        mockCheckFilesystemExists.mockReturnValue(false);

        const result = await handler(prisma, { storyId: 'story-1' });

        expect(result.exists).toBe(true);
        expect(result.worktree?.filesystemExists).toBe(false);
        expect(result.worktree?.gitStatus).toBeUndefined();
        expect(gitUtils.execGit).not.toHaveBeenCalled();
      });

      it('should include disk usage when requested', async () => {
        prisma.worktree.findFirst = jest.fn().mockResolvedValue(mockWorktree);

        const mockCheckFilesystemExists = gitUtils.checkFilesystemExists as jest.MockedFunction<
          typeof gitUtils.checkFilesystemExists
        >;
        mockCheckFilesystemExists.mockReturnValue(true);

        const mockGetDiskUsageMB = gitUtils.getDiskUsageMB as jest.MockedFunction<
          typeof gitUtils.getDiskUsageMB
        >;
        mockGetDiskUsageMB.mockReturnValue(512);

        const mockExecGit = gitUtils.execGit as jest.MockedFunction<typeof gitUtils.execGit>;
        mockExecGit.mockReturnValue('## st-1-feature');

        const mockParseGitStatus = gitUtils.parseGitStatus as jest.MockedFunction<
          typeof gitUtils.parseGitStatus
        >;
        mockParseGitStatus.mockReturnValue(mockGitStatus);

        const result = await handler(prisma, {
          storyId: 'story-1',
          includeDiskUsage: true,
        });

        expect(result.worktree?.diskUsageMB).toBe(512);
        expect(mockGetDiskUsageMB).toHaveBeenCalledWith('/opt/stack/worktrees/st-1-feature');
      });

      it('should not include disk usage by default', async () => {
        prisma.worktree.findFirst = jest.fn().mockResolvedValue(mockWorktree);

        const mockCheckFilesystemExists = gitUtils.checkFilesystemExists as jest.MockedFunction<
          typeof gitUtils.checkFilesystemExists
        >;
        mockCheckFilesystemExists.mockReturnValue(true);

        const mockExecGit = gitUtils.execGit as jest.MockedFunction<typeof gitUtils.execGit>;
        mockExecGit.mockReturnValue('## st-1-feature');

        const mockParseGitStatus = gitUtils.parseGitStatus as jest.MockedFunction<
          typeof gitUtils.parseGitStatus
        >;
        mockParseGitStatus.mockReturnValue(mockGitStatus);

        const result = await handler(prisma, { storyId: 'story-1' });

        expect(result.worktree?.diskUsageMB).toBeUndefined();
        expect(gitUtils.getDiskUsageMB).not.toHaveBeenCalled();
      });

      it('should handle git status errors gracefully', async () => {
        prisma.worktree.findFirst = jest.fn().mockResolvedValue(mockWorktree);

        const mockCheckFilesystemExists = gitUtils.checkFilesystemExists as jest.MockedFunction<
          typeof gitUtils.checkFilesystemExists
        >;
        mockCheckFilesystemExists.mockReturnValue(true);

        const mockExecGit = gitUtils.execGit as jest.MockedFunction<typeof gitUtils.execGit>;
        mockExecGit.mockImplementation(() => {
          throw new Error('fatal: not a git repository');
        });

        const result = await handler(prisma, { storyId: 'story-1' });

        expect(result.exists).toBe(true);
        expect(result.worktree?.gitStatus).toBeDefined();
        expect(result.worktree?.gitStatus?.rawStatus).toContain('Error:');
      });

      it('should skip git status when includeGitStatus is false', async () => {
        prisma.worktree.findFirst = jest.fn().mockResolvedValue(mockWorktree);

        const mockCheckFilesystemExists = gitUtils.checkFilesystemExists as jest.MockedFunction<
          typeof gitUtils.checkFilesystemExists
        >;
        mockCheckFilesystemExists.mockReturnValue(true);

        const result = await handler(prisma, {
          storyId: 'story-1',
          includeGitStatus: false,
        });

        expect(result.worktree?.gitStatus).toBeUndefined();
        expect(gitUtils.execGit).not.toHaveBeenCalled();
      });
    });

    describe('Worktree not found', () => {
      it('should return exists: false when no worktree found', async () => {
        prisma.worktree.findFirst = jest.fn().mockResolvedValue(null);

        const result = await handler(prisma, { storyId: 'story-1' });

        expect(result.exists).toBe(false);
        expect(result.worktree).toBeUndefined();
        expect(result.message).toContain('No active worktree found');
      });

      it('should filter out removed worktrees', async () => {
        prisma.worktree.findFirst = jest.fn().mockResolvedValue(null);

        await handler(prisma, { storyId: 'story-1' });

        expect(prisma.worktree.findFirst).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              status: { in: ['active', 'idle', 'cleaning'] },
            }),
          })
        );
      });
    });

    describe('Specific worktree ID', () => {
      it('should filter by worktree ID when provided', async () => {
        prisma.worktree.findFirst = jest.fn().mockResolvedValue(mockWorktree);

        const mockCheckFilesystemExists = gitUtils.checkFilesystemExists as jest.MockedFunction<
          typeof gitUtils.checkFilesystemExists
        >;
        mockCheckFilesystemExists.mockReturnValue(true);

        const mockExecGit = gitUtils.execGit as jest.MockedFunction<typeof gitUtils.execGit>;
        mockExecGit.mockReturnValue('## st-1-feature');

        const mockParseGitStatus = gitUtils.parseGitStatus as jest.MockedFunction<
          typeof gitUtils.parseGitStatus
        >;
        mockParseGitStatus.mockReturnValue(mockGitStatus);

        await handler(prisma, { storyId: 'story-1', worktreeId: 'wt-1' });

        expect(prisma.worktree.findFirst).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              storyId: 'story-1',
              id: 'wt-1',
            }),
          })
        );
      });
    });

    describe('Validation', () => {
      it('should require storyId parameter', async () => {
        await expect(handler(prisma, {} as any)).rejects.toThrow('Missing required fields');
      });
    });
  });
});
