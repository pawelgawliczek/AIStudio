/**
 * Integration Tests for Conflict Detection
 *
 * These tests verify the integration between check_for_conflicts and deployment workflow.
 * They use mocked git commands but test the full integration flow.
 */

import * as fs from 'fs';
import { PrismaClient } from '@prisma/client';
import { handler as checkForConflicts } from '../check_for_conflicts';
import * as gitUtils from '../git_utils';
import { handler as rebaseOnMain } from '../rebase_on_main';

// Mock dependencies
jest.mock('../git_utils');
jest.mock('fs');

const mockExecGit = gitUtils.execGit as jest.MockedFunction<typeof gitUtils.execGit>;
const mockValidateWorktreePath = gitUtils.validateWorktreePath as jest.MockedFunction<typeof gitUtils.validateWorktreePath>;
const mockExistsSync = fs.existsSync as jest.MockedFunction<typeof fs.existsSync>;

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

describe('Conflict Detection Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockValidateWorktreePath.mockImplementation(() => {});
    mockExistsSync.mockReturnValue(false);
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

  describe('end-to-end conflict resolution workflow', () => {
    it('should detect conflicts, rebase successfully, and clear conflicts', async () => {
      // STEP 1: Check for conflicts - detect conflicts
      (mockPrisma.story.findUnique as jest.Mock).mockResolvedValue(mockStory);
      (mockPrisma.story.update as jest.Mock).mockResolvedValue(mockStory);

      mockExecGit.mockReturnValueOnce('git version 2.39.0');
      mockExecGit.mockReturnValueOnce(''); // fetch
      mockExecGit.mockReturnValueOnce('abc123\n'); // base commit
      mockExecGit.mockReturnValueOnce('def456\n'); // head commit

      // Simulate conflicts detected
      const conflictOutput = 'CONFLICT (content): Merge conflict in file.ts';
      const error: any = new Error('Git command failed');
      error.status = 1;
      error.stdout = conflictOutput;
      error.stderr = 'CONFLICT';
      mockExecGit.mockImplementationOnce(() => {
        throw error;
      });

      const conflictResult = await checkForConflicts(mockPrisma, { storyId: 'story-123' });

      expect(conflictResult.hasConflicts).toBe(true);
      expect(conflictResult.conflictingFiles).toHaveLength(1);

      // Verify metadata updated with conflicts
      expect(mockPrisma.story.update).toHaveBeenCalledWith({
        where: { id: 'story-123' },
        data: {
          metadata: expect.objectContaining({
            conflictDetails: expect.objectContaining({
              hasConflicts: true,
            }),
          }),
        },
      });

      // STEP 2: Attempt rebase - succeeds and resolves conflicts
      jest.clearAllMocks();
      (mockPrisma.story.findUnique as jest.Mock).mockResolvedValue(mockStory);
      (mockPrisma.story.update as jest.Mock).mockResolvedValue(mockStory);

      mockExecGit.mockReturnValueOnce(''); // clean worktree check
      mockExecGit.mockReturnValueOnce(''); // fetch
      mockExecGit.mockReturnValueOnce(''); // rebase succeeds
      mockExecGit.mockReturnValueOnce('new-hash\n'); // new HEAD
      mockExecGit.mockReturnValueOnce('commit1\ncommit2\n'); // log

      const rebaseResult = await rebaseOnMain(mockPrisma, { storyId: 'story-123' });

      expect(rebaseResult.success).toBe(true);
      expect(rebaseResult.status).toBe('completed');

      // Verify metadata updated with successful rebase
      expect(mockPrisma.story.update).toHaveBeenCalledWith({
        where: { id: 'story-123' },
        data: {
          metadata: expect.objectContaining({
            rebaseStatus: expect.objectContaining({
              status: 'completed',
            }),
          }),
        },
      });

      // STEP 3: Check for conflicts again - should be clean
      jest.clearAllMocks();
      (mockPrisma.story.findUnique as jest.Mock).mockResolvedValue(mockStory);
      (mockPrisma.story.update as jest.Mock).mockResolvedValue(mockStory);

      mockExecGit.mockReturnValueOnce('git version 2.39.0');
      mockExecGit.mockReturnValueOnce('');
      mockExecGit.mockReturnValueOnce('abc123\n');
      mockExecGit.mockReturnValueOnce('new-hash\n'); // new HEAD after rebase
      mockExecGit.mockReturnValueOnce('tree-hash\n'); // clean merge

      const cleanResult = await checkForConflicts(mockPrisma, { storyId: 'story-123' });

      expect(cleanResult.hasConflicts).toBe(false);
      expect(cleanResult.mergeableWithMain).toBe(true);
    });

    it('should detect conflicts, attempt rebase, fail with conflicts, create subtask', async () => {
      // STEP 1: Check for conflicts
      (mockPrisma.story.findUnique as jest.Mock).mockResolvedValue(mockStory);
      (mockPrisma.story.update as jest.Mock).mockResolvedValue(mockStory);

      mockExecGit.mockReturnValueOnce('git version 2.39.0');
      mockExecGit.mockReturnValueOnce('');
      mockExecGit.mockReturnValueOnce('abc123\n');
      mockExecGit.mockReturnValueOnce('def456\n');

      const conflictError: any = new Error('Git command failed');
      conflictError.status = 1;
      conflictError.stdout = 'CONFLICT (content): Merge conflict in file.ts';
      conflictError.stderr = 'CONFLICT';
      mockExecGit.mockImplementationOnce(() => {
        throw conflictError;
      });

      const conflictResult = await checkForConflicts(mockPrisma, { storyId: 'story-123' });
      expect(conflictResult.hasConflicts).toBe(true);

      // STEP 2: Attempt rebase - fails with conflicts
      jest.clearAllMocks();
      (mockPrisma.story.findUnique as jest.Mock).mockResolvedValue(mockStory);
      (mockPrisma.story.update as jest.Mock).mockResolvedValue(mockStory);
      (mockPrisma.worktree.update as jest.Mock).mockResolvedValue(mockStory.worktrees[0]);
      (mockPrisma.subtask.create as jest.Mock).mockResolvedValue({ id: 'subtask-123' });

      mockExecGit.mockReturnValueOnce(''); // clean worktree
      mockExecGit.mockReturnValueOnce(''); // fetch

      const rebaseError: any = new Error('Git command failed');
      rebaseError.status = 1;
      rebaseError.message = 'CONFLICT';
      mockExecGit.mockImplementationOnce(() => {
        throw rebaseError;
      });

      mockExecGit.mockReturnValueOnce('UU file.ts\n'); // git status

      const rebaseResult = await rebaseOnMain(mockPrisma, { storyId: 'story-123' });

      expect(rebaseResult.success).toBe(false);
      expect(rebaseResult.status).toBe('paused');
      expect(rebaseResult.conflictFiles).toContain('file.ts');

      // Verify subtask created for manual resolution
      expect(mockPrisma.subtask.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          storyId: 'story-123',
          title: expect.stringContaining('Resolve merge conflicts'),
          status: 'todo',
        }),
      });

      // Verify worktree marked as idle
      expect(mockPrisma.worktree.update).toHaveBeenCalledWith({
        where: { id: 'worktree-123' },
        data: expect.objectContaining({
          status: 'idle',
        }),
      });
    });
  });

  describe('deployment workflow integration', () => {
    it('should simulate deployment blocking on conflicts', async () => {
      // Simulate deployment calling check_for_conflicts
      (mockPrisma.story.findUnique as jest.Mock).mockResolvedValue(mockStory);
      (mockPrisma.story.update as jest.Mock).mockResolvedValue(mockStory);

      mockExecGit.mockReturnValueOnce('git version 2.39.0');
      mockExecGit.mockReturnValueOnce('');
      mockExecGit.mockReturnValueOnce('abc123\n');
      mockExecGit.mockReturnValueOnce('def456\n');

      const conflictError: any = new Error('Git command failed');
      conflictError.status = 1;
      conflictError.stdout = 'CONFLICT (content): Merge conflict in backend/src/api.ts\nCONFLICT (content): Merge conflict in frontend/src/App.tsx';
      conflictError.stderr = 'CONFLICT';
      mockExecGit.mockImplementationOnce(() => {
        throw conflictError;
      });

      const result = await checkForConflicts(mockPrisma, { storyId: 'story-123' });

      // Simulate deployment logic checking for conflicts
      if (result.hasConflicts) {
        // Deployment should fail with informative error
        expect(result.conflictCount).toBe(2);
        expect(result.conflictingFiles.map(f => f.path)).toContain('backend/src/api.ts');
        expect(result.conflictingFiles.map(f => f.path)).toContain('frontend/src/App.tsx');

        // Deployment would throw error here
        const deploymentError = `Deployment blocked: ${result.conflictCount} merge conflicts detected`;
        expect(deploymentError).toContain('2 merge conflicts');
      }
    });

    it('should allow deployment when no conflicts detected', async () => {
      (mockPrisma.story.findUnique as jest.Mock).mockResolvedValue(mockStory);
      (mockPrisma.story.update as jest.Mock).mockResolvedValue(mockStory);

      mockExecGit.mockReturnValueOnce('git version 2.39.0');
      mockExecGit.mockReturnValueOnce('');
      mockExecGit.mockReturnValueOnce('abc123\n');
      mockExecGit.mockReturnValueOnce('def456\n');
      mockExecGit.mockReturnValueOnce('tree-hash\n'); // clean merge

      const result = await checkForConflicts(mockPrisma, { storyId: 'story-123' });

      // Simulate deployment logic
      if (!result.hasConflicts) {
        expect(result.mergeableWithMain).toBe(true);
        // Deployment would proceed
      } else {
        fail('Should not have conflicts');
      }
    });
  });

  describe('error recovery scenarios', () => {
    it('should handle network failures with retry and eventual success', async () => {
      (mockPrisma.story.findUnique as jest.Mock).mockResolvedValue(mockStory);
      (mockPrisma.story.update as jest.Mock).mockResolvedValue(mockStory);

      mockExecGit.mockReturnValueOnce('git version 2.39.0');

      // Simulate network failures with retry
      let fetchAttempts = 0;
      mockExecGit.mockImplementation((command: string) => {
        if (command.includes('git fetch')) {
          fetchAttempts++;
          if (fetchAttempts < 3) {
            throw new Error('Network timeout');
          }
          return '';
        }
        if (command.includes('rev-parse')) {
          return 'hash\n';
        }
        if (command.includes('merge-tree')) {
          return 'tree-hash\n';
        }
        return '';
      });

      const promise = checkForConflicts(mockPrisma, { storyId: 'story-123' });
      await jest.runAllTimersAsync();
      const result = await promise;

      expect(result.hasConflicts).toBe(false);
      expect(fetchAttempts).toBe(3); // Retried 3 times
    });
  });
});
