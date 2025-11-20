/**
 * Unit Tests for rebase_on_main tool
 */

import * as fs from 'fs';
import { PrismaClient } from '@prisma/client';
import { NotFoundError, ValidationError } from '../../../types';
import * as gitUtils from '../git_utils';
import { handler } from '../rebase_on_main';

// Mock dependencies
jest.mock('fs');
jest.mock('../git_utils');
const mockExecGit = gitUtils.execGit as jest.MockedFunction<typeof gitUtils.execGit>;
const mockValidateWorktreePath = gitUtils.validateWorktreePath as jest.MockedFunction<typeof gitUtils.validateWorktreePath>;
const mockExistsSync = fs.existsSync as jest.MockedFunction<typeof fs.existsSync>;
const mockStatSync = fs.statSync as jest.MockedFunction<typeof fs.statSync>;

// Mock Prisma
const mockPrisma = {
  story: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  worktree: {
    update: jest.fn(),
  },
  subtask: {
    create: jest.fn(),
  },
} as unknown as PrismaClient;

describe('rebase_on_main', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockValidateWorktreePath.mockImplementation(() => {}); // No-op by default
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const mockStory = {
    id: 'story-123',
    key: 'ST-48',
    title: 'Test Story',
    metadata: {},
    worktrees: [
      {
        id: 'worktree-123',
        branchName: 'st-48-test-story',
        worktreePath: '/opt/stack/worktrees/st-48-test-story',
        status: 'active',
      },
    ],
  };

  describe('successful rebase', () => {
    it('should complete rebase without conflicts', async () => {
      (mockPrisma.story.findUnique as jest.Mock).mockResolvedValue(mockStory);
      (mockPrisma.story.update as jest.Mock).mockResolvedValue(mockStory);

      mockExistsSync.mockReturnValue(false); // No rebase in progress

      // Mock clean worktree check
      mockExecGit.mockReturnValueOnce(''); // git status --porcelain (clean)

      // Mock fetch
      mockExecGit.mockReturnValueOnce(''); // git fetch origin main

      // Mock successful rebase
      mockExecGit.mockReturnValueOnce(''); // git rebase origin/main

      // Mock new HEAD commit
      mockExecGit.mockReturnValueOnce('new-commit-hash\n'); // git rev-parse HEAD

      // Mock commit count
      mockExecGit.mockReturnValueOnce('commit1\ncommit2\ncommit3\n'); // git log

      const result = await handler(mockPrisma, { storyId: 'story-123' });

      expect(result).toEqual({
        success: true,
        status: 'completed',
        newHeadCommit: 'new-commit-hash',
        rebasedCommits: 3,
        message: expect.stringContaining('Successfully rebased'),
      });

      // Verify Story.metadata was updated
      expect(mockPrisma.story.update).toHaveBeenCalledWith({
        where: { id: 'story-123' },
        data: {
          metadata: expect.objectContaining({
            rebaseStatus: {
              status: 'completed',
              lastAttemptAt: expect.any(String),
              completedAt: expect.any(String),
              rebasedCommits: 3,
              newHeadCommit: 'new-commit-hash',
            },
          }),
        },
      });
    });
  });

  describe('conflict handling', () => {
    it('should pause rebase on conflicts and create subtask', async () => {
      (mockPrisma.story.findUnique as jest.Mock).mockResolvedValue(mockStory);
      (mockPrisma.story.update as jest.Mock).mockResolvedValue(mockStory);
      (mockPrisma.worktree.update as jest.Mock).mockResolvedValue(mockStory.worktrees[0]);
      (mockPrisma.subtask.create as jest.Mock).mockResolvedValue({ id: 'subtask-123' });

      mockExistsSync.mockReturnValue(false);
      mockExecGit.mockReturnValueOnce(''); // clean worktree
      mockExecGit.mockReturnValueOnce(''); // fetch

      // Mock rebase with conflicts
      const rebaseError: any = new Error('Git command failed');
      rebaseError.status = 1;
      rebaseError.message = 'CONFLICT (content): Merge conflict in file.ts';
      mockExecGit.mockImplementationOnce(() => {
        throw rebaseError;
      });

      // Mock git status to get conflict files
      mockExecGit.mockReturnValueOnce(`UU file1.ts
UU file2.ts`);

      const result = await handler(mockPrisma, { storyId: 'story-123' });

      expect(result).toEqual({
        success: false,
        status: 'paused',
        conflictFiles: ['file1.ts', 'file2.ts'],
        message: expect.stringContaining('paused due to conflicts'),
        actionRequired: expect.stringContaining('Resolve conflicts'),
      });

      // Verify Story.metadata was updated with paused status
      expect(mockPrisma.story.update).toHaveBeenCalledWith({
        where: { id: 'story-123' },
        data: {
          metadata: expect.objectContaining({
            rebaseStatus: {
              status: 'paused',
              lastAttemptAt: expect.any(String),
              pausedAt: expect.any(String),
              conflictFiles: ['file1.ts', 'file2.ts'],
            },
          }),
        },
      });

      // Verify worktree status updated to idle
      expect(mockPrisma.worktree.update).toHaveBeenCalledWith({
        where: { id: 'worktree-123' },
        data: {
          status: 'idle',
          notes: expect.stringContaining('Rebase paused'),
        },
      });

      // Verify subtask created
      expect(mockPrisma.subtask.create).toHaveBeenCalledWith({
        data: {
          storyId: 'story-123',
          title: expect.stringContaining('Resolve merge conflicts'),
          description: expect.stringContaining('file1.ts'),
          status: 'todo',
        },
      });
    });

    it('should auto-abort rebase if autoAbortOnConflict is true', async () => {
      (mockPrisma.story.findUnique as jest.Mock).mockResolvedValue(mockStory);
      (mockPrisma.story.update as jest.Mock).mockResolvedValue(mockStory);

      mockExistsSync.mockReturnValue(false);
      mockExecGit.mockReturnValueOnce(''); // clean worktree
      mockExecGit.mockReturnValueOnce(''); // fetch

      // Mock rebase with conflicts
      const rebaseError: any = new Error('Git command failed');
      rebaseError.status = 1;
      rebaseError.message = 'CONFLICT';
      mockExecGit.mockImplementationOnce(() => {
        throw rebaseError;
      });

      // Mock git status
      mockExecGit.mockReturnValueOnce('UU file.ts');

      // Mock git rebase --abort
      mockExecGit.mockReturnValueOnce('');

      const result = await handler(mockPrisma, {
        storyId: 'story-123',
        autoAbortOnConflict: true
      });

      expect(result.status).toBe('failed');
      expect(result.message).toContain('aborted due to conflicts');

      // Verify rebase --abort was called
      expect(mockExecGit).toHaveBeenCalledWith(
        'git rebase --abort',
        '/opt/stack/worktrees/st-48-test-story'
      );
    });
  });

  describe('error handling', () => {
    it('should throw NotFoundError if story not found', async () => {
      (mockPrisma.story.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(handler(mockPrisma, { storyId: 'invalid' })).rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError if worktree not found', async () => {
      const storyWithoutWorktree = { ...mockStory, worktrees: [] };
      (mockPrisma.story.findUnique as jest.Mock).mockResolvedValue(storyWithoutWorktree);

      await expect(handler(mockPrisma, { storyId: 'story-123' })).rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError for uncommitted changes', async () => {
      (mockPrisma.story.findUnique as jest.Mock).mockResolvedValue(mockStory);

      mockExistsSync.mockReturnValue(false);

      // Mock uncommitted changes (test calls handler twice, so need two mocks)
      mockExecGit.mockReturnValueOnce('M file.ts\n'); // git status --porcelain (first call)
      mockExecGit.mockReturnValueOnce('M file.ts\n'); // git status --porcelain (second call)

      await expect(handler(mockPrisma, { storyId: 'story-123' })).rejects.toThrow(ValidationError);
      await expect(handler(mockPrisma, { storyId: 'story-123' })).rejects.toThrow(/uncommitted changes/);
    });

    it('should throw ValidationError if rebase already in progress', async () => {
      (mockPrisma.story.findUnique as jest.Mock).mockResolvedValue(mockStory);

      // Mock rebase-apply directory exists and is recent
      mockExistsSync.mockReturnValue(true);
      mockStatSync.mockReturnValue({
        mtimeMs: Date.now() - 1000, // 1 second ago (recent)
      } as any);

      await expect(handler(mockPrisma, { storyId: 'story-123' })).rejects.toThrow(ValidationError);
      await expect(handler(mockPrisma, { storyId: 'story-123' })).rejects.toThrow(/Rebase already in progress/);
    });

    it('should auto-abort stale rebase (>1 hour old)', async () => {
      (mockPrisma.story.findUnique as jest.Mock).mockResolvedValue(mockStory);
      (mockPrisma.story.update as jest.Mock).mockResolvedValue(mockStory);

      // Mock stale rebase directory
      mockExistsSync.mockReturnValue(true);
      mockStatSync.mockReturnValue({
        mtimeMs: Date.now() - (2 * 60 * 60 * 1000), // 2 hours ago
      } as any);

      // Mock abort
      mockExecGit.mockReturnValueOnce(''); // git rebase --abort

      // Mock clean worktree check
      mockExecGit.mockReturnValueOnce('');

      // Mock fetch and successful rebase
      mockExecGit.mockReturnValueOnce('');
      mockExecGit.mockReturnValueOnce('');
      mockExecGit.mockReturnValueOnce('new-hash\n');
      mockExecGit.mockReturnValueOnce('commit1\n');

      const result = await handler(mockPrisma, { storyId: 'story-123' });

      expect(result.status).toBe('completed');
      // Verify stale rebase was aborted
      expect(mockExecGit).toHaveBeenCalledWith(
        'git rebase --abort',
        '/opt/stack/worktrees/st-48-test-story'
      );
    });

    it('should abort rebase on unexpected error', async () => {
      (mockPrisma.story.findUnique as jest.Mock).mockResolvedValue(mockStory);
      (mockPrisma.story.update as jest.Mock).mockResolvedValue(mockStory);

      mockExistsSync.mockReturnValue(false);
      mockExecGit.mockReturnValueOnce(''); // clean worktree
      mockExecGit.mockReturnValueOnce(''); // fetch

      // Mock unexpected rebase error
      const unexpectedError = new Error('Unexpected git error');
      mockExecGit.mockImplementationOnce(() => {
        throw unexpectedError;
      });

      // Mock abort (called in rollback)
      mockExecGit.mockReturnValueOnce(''); // git rebase --abort

      await expect(handler(mockPrisma, { storyId: 'story-123' })).rejects.toThrow('Unexpected git error');

      // Verify rebase --abort was called in rollback
      expect(mockExecGit).toHaveBeenCalledWith(
        'git rebase --abort',
        '/opt/stack/worktrees/st-48-test-story'
      );
    });

    it('should retry git fetch on network failure', async () => {
      (mockPrisma.story.findUnique as jest.Mock).mockResolvedValue(mockStory);
      (mockPrisma.story.update as jest.Mock).mockResolvedValue(mockStory);

      mockExistsSync.mockReturnValue(false);
      mockExecGit.mockReturnValueOnce(''); // clean worktree

      // Fail fetch twice, succeed on third
      let fetchAttempts = 0;
      mockExecGit.mockImplementation((command: string) => {
        if (command.includes('git fetch')) {
          fetchAttempts++;
          if (fetchAttempts < 3) {
            throw new Error('Network error');
          }
          return '';
        }
        if (command.includes('rebase')) {
          return '';
        }
        if (command.includes('rev-parse')) {
          return 'hash\n';
        }
        if (command.includes('log')) {
          return 'commit1\n';
        }
        return '';
      });

      const promise = handler(mockPrisma, { storyId: 'story-123' });
      await jest.runAllTimersAsync();
      const result = await promise;

      expect(result.status).toBe('completed');
      expect(fetchAttempts).toBe(3);
    });
  });

  describe('metadata updates', () => {
    it('should preserve existing metadata fields', async () => {
      const storyWithMetadata = {
        ...mockStory,
        metadata: { existingField: 'value' },
      };
      (mockPrisma.story.findUnique as jest.Mock).mockResolvedValue(storyWithMetadata);
      (mockPrisma.story.update as jest.Mock).mockResolvedValue(storyWithMetadata);

      mockExistsSync.mockReturnValue(false);
      mockExecGit.mockReturnValueOnce('');
      mockExecGit.mockReturnValueOnce('');
      mockExecGit.mockReturnValueOnce('');
      mockExecGit.mockReturnValueOnce('hash\n');
      mockExecGit.mockReturnValueOnce('commit1\n');

      await handler(mockPrisma, { storyId: 'story-123' });

      expect(mockPrisma.story.update).toHaveBeenCalledWith({
        where: { id: 'story-123' },
        data: {
          metadata: expect.objectContaining({
            existingField: 'value',
            rebaseStatus: expect.any(Object),
          }),
        },
      });
    });
  });
});
