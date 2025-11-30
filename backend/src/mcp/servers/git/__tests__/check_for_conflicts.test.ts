/**
 * Unit Tests for check_for_conflicts tool
 * Updated for ST-153: Location-aware git execution
 */

import { PrismaClient } from '@prisma/client';
import { NotFoundError, ValidationError } from '../../../types';
import { handler } from '../check_for_conflicts';
import * as gitUtils from '../git_utils';

// Mock dependencies
jest.mock('../git_utils');
const mockExecGit = gitUtils.execGit as jest.MockedFunction<typeof gitUtils.execGit>;
const mockExecGitLocationAware = gitUtils.execGitLocationAware as jest.MockedFunction<typeof gitUtils.execGitLocationAware>;
const mockValidateWorktreePath = gitUtils.validateWorktreePath as jest.MockedFunction<typeof gitUtils.validateWorktreePath>;

// Mock Prisma
const mockPrisma = {
  story: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
} as unknown as PrismaClient;

describe('check_for_conflicts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers(); // Use fake timers for retry logic
    mockValidateWorktreePath.mockImplementation(() => {}); // Default no-op
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

  describe('successful conflict detection', () => {
    it('should detect no conflicts for clean merge', async () => {
      // Mock database responses
      (mockPrisma.story.findUnique as jest.Mock).mockResolvedValue(mockStory);
      (mockPrisma.story.update as jest.Mock).mockResolvedValue(mockStory);

      // Mock git version check (uses execGit directly)
      mockExecGit.mockReturnValueOnce('git version 2.39.0');

      // Mock location-aware git operations (ST-153)
      mockExecGitLocationAware
        .mockResolvedValueOnce({ success: true, output: '', executedOn: 'kvm' }) // fetch origin main
        .mockResolvedValueOnce({ success: true, output: 'abc123def456', executedOn: 'kvm' }) // base commit
        .mockResolvedValueOnce({ success: true, output: 'def456ghi789', executedOn: 'kvm' }); // head commit

      // Mock merge-tree with clean merge (exit code 0) - still uses execGit
      mockExecGit.mockReturnValueOnce('tree-hash-12345\n'); // clean merge output

      const result = await handler(mockPrisma, { storyId: 'story-123' });

      expect(result).toEqual({
        hasConflicts: false,
        conflictCount: 0,
        conflictingFiles: [],
        mergeableWithMain: true,
        baseCommit: 'abc123def456',
        headCommit: 'def456ghi789',
        detectedAt: expect.any(String),
        executedOn: 'kvm',
      });

      // Verify Story.metadata was updated
      expect(mockPrisma.story.update).toHaveBeenCalledWith({
        where: { id: 'story-123' },
        data: {
          metadata: expect.objectContaining({
            conflictDetails: expect.objectContaining({
              hasConflicts: false,
              resolution: 'resolved',
            }),
          }),
        },
      });
    });

    it('should detect conflicts and parse conflict files', async () => {
      (mockPrisma.story.findUnique as jest.Mock).mockResolvedValue(mockStory);
      (mockPrisma.story.update as jest.Mock).mockResolvedValue(mockStory);

      mockExecGit.mockReturnValueOnce('git version 2.39.0');

      // Mock location-aware git operations (ST-153)
      mockExecGitLocationAware
        .mockResolvedValueOnce({ success: true, output: '', executedOn: 'kvm' }) // fetch
        .mockResolvedValueOnce({ success: true, output: 'abc123', executedOn: 'kvm' }) // base commit
        .mockResolvedValueOnce({ success: true, output: 'def456', executedOn: 'kvm' }); // head commit

      // Mock merge-tree with conflicts (exit code 1, throw error with conflict output)
      const conflictOutput = `Auto-merging backend/src/api/handler.ts
CONFLICT (content): Merge conflict in backend/src/api/handler.ts

Conflicted file info:
100644 abc123... 1 backend/src/api/handler.ts
100644 def456... 2 backend/src/api/handler.ts
100644 ghi789... 3 backend/src/api/handler.ts`;

      const error: any = new Error('Git command failed');
      error.status = 1;
      error.stdout = conflictOutput;
      error.stderr = 'CONFLICT';
      mockExecGit.mockImplementationOnce(() => {
        throw error;
      });

      const result = await handler(mockPrisma, { storyId: 'story-123' });

      expect(result.hasConflicts).toBe(true);
      expect(result.conflictCount).toBe(1);
      expect(result.conflictingFiles).toHaveLength(1);
      expect(result.conflictingFiles[0]).toMatchObject({
        path: 'backend/src/api/handler.ts',
        conflictType: 'content',
        details: expect.stringContaining('Content conflict'),
      });
    });

    it('should detect multiple conflict types', async () => {
      (mockPrisma.story.findUnique as jest.Mock).mockResolvedValue(mockStory);
      (mockPrisma.story.update as jest.Mock).mockResolvedValue(mockStory);

      mockExecGit.mockReturnValueOnce('git version 2.39.0');

      // Mock location-aware git operations (ST-153)
      mockExecGitLocationAware
        .mockResolvedValueOnce({ success: true, output: '', executedOn: 'kvm' }) // fetch
        .mockResolvedValueOnce({ success: true, output: 'abc123', executedOn: 'kvm' }) // base commit
        .mockResolvedValueOnce({ success: true, output: 'def456', executedOn: 'kvm' }); // head commit

      const conflictOutput = `CONFLICT (content): Merge conflict in file1.ts
CONFLICT (modify/delete): file2.ts deleted in HEAD and modified in branch
CONFLICT (rename/delete): file3.ts renamed in HEAD and deleted in branch`;

      const error: any = new Error('Git command failed');
      error.status = 1;
      error.stdout = conflictOutput;
      error.stderr = 'CONFLICT';
      mockExecGit.mockImplementationOnce(() => {
        throw error;
      });

      const result = await handler(mockPrisma, { storyId: 'story-123' });

      expect(result.conflictCount).toBe(3);
      expect(result.conflictingFiles).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: 'file1.ts', conflictType: 'content' }),
          expect.objectContaining({ path: 'file2.ts', conflictType: 'delete' }),
          expect.objectContaining({ path: 'file3.ts', conflictType: 'rename' }),
        ])
      );
    });
  });

  describe('error handling', () => {
    it('should throw NotFoundError if story not found', async () => {
      (mockPrisma.story.findUnique as jest.Mock).mockResolvedValue(null);
      mockExecGit.mockReturnValueOnce('git version 2.39.0\n'); // Mock git --version

      await expect(handler(mockPrisma, { storyId: 'invalid-story' })).rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError if worktree not found', async () => {
      const storyWithoutWorktree = { ...mockStory, worktrees: [] };
      (mockPrisma.story.findUnique as jest.Mock).mockResolvedValue(storyWithoutWorktree);
      mockExecGit.mockReturnValueOnce('git version 2.39.0\n'); // Mock git --version

      await expect(handler(mockPrisma, { storyId: 'story-123' })).rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError for unsupported git version', async () => {
      (mockPrisma.story.findUnique as jest.Mock).mockResolvedValue(mockStory);

      // Mock git version 2.30 (too old)
      mockExecGit.mockReturnValueOnce('git version 2.30.0\n');

      await expect(handler(mockPrisma, { storyId: 'story-123' })).rejects.toThrow(ValidationError);

      // Reset mocks and test again with fresh mock
      jest.clearAllMocks();
      (mockPrisma.story.findUnique as jest.Mock).mockResolvedValue(mockStory);
      mockExecGit.mockReturnValueOnce('git version 2.37.0\n');

      await expect(handler(mockPrisma, { storyId: 'story-123' })).rejects.toThrow(/Git 2.38\+ required/);
    });

    it('should validate worktree path for security', async () => {
      const storyWithInvalidPath = {
        ...mockStory,
        worktrees: [
          {
            ...mockStory.worktrees[0],
            worktreePath: '/invalid/path/../../../etc/passwd',
          },
        ],
      };
      (mockPrisma.story.findUnique as jest.Mock).mockResolvedValue(storyWithInvalidPath);

      mockExecGit.mockReturnValueOnce('git version 2.39.0');

      mockValidateWorktreePath.mockImplementation(() => {
        throw new ValidationError('Invalid worktree path');
      });

      await expect(handler(mockPrisma, { storyId: 'story-123' })).rejects.toThrow(ValidationError);
    });

    it('should retry git fetch on network failure', async () => {
      (mockPrisma.story.findUnique as jest.Mock).mockResolvedValue(mockStory);
      (mockPrisma.story.update as jest.Mock).mockResolvedValue(mockStory);

      mockExecGit.mockReturnValueOnce('git version 2.39.0');

      // Mock location-aware fetch with retries (ST-153)
      let fetchAttempts = 0;
      mockExecGitLocationAware.mockImplementation(async () => {
        fetchAttempts++;
        if (fetchAttempts < 3) {
          throw new Error('Network error');
        }
        if (fetchAttempts === 3) {
          return { success: true, output: '', executedOn: 'kvm' as const };
        }
        // For rev-parse calls
        return { success: true, output: 'abc123', executedOn: 'kvm' as const };
      });

      // Mock merge-tree
      mockExecGit.mockReturnValueOnce('tree-hash\n');

      // Fast-forward timers for retry delays
      const promise = handler(mockPrisma, { storyId: 'story-123' });
      await jest.runAllTimersAsync();
      const result = await promise;

      expect(result.hasConflicts).toBe(false);
      expect(fetchAttempts).toBeGreaterThanOrEqual(3);
    });

    it('should throw timeout error after 30 seconds', async () => {
      (mockPrisma.story.findUnique as jest.Mock).mockResolvedValue(mockStory);

      mockExecGit.mockReturnValueOnce('git version 2.39.0');

      // Mock location-aware operations (ST-153)
      mockExecGitLocationAware
        .mockResolvedValueOnce({ success: true, output: '', executedOn: 'kvm' }) // fetch
        .mockResolvedValueOnce({ success: true, output: 'abc123', executedOn: 'kvm' }) // base commit
        .mockResolvedValueOnce({ success: true, output: 'def456', executedOn: 'kvm' }); // head commit

      // Mock timeout error
      const timeoutError: any = new Error('Git command failed');
      timeoutError.message = 'timeout';
      timeoutError.killed = true;
      mockExecGit.mockImplementationOnce(() => {
        throw timeoutError;
      });

      await expect(handler(mockPrisma, { storyId: 'story-123' })).rejects.toThrow(/timed out/);
    });
  });

  describe('metadata updates', () => {
    it('should update Story.metadata with conflict details', async () => {
      (mockPrisma.story.findUnique as jest.Mock).mockResolvedValue(mockStory);
      (mockPrisma.story.update as jest.Mock).mockResolvedValue(mockStory);

      mockExecGit.mockReturnValueOnce('git version 2.39.0');

      // Mock location-aware operations (ST-153)
      mockExecGitLocationAware
        .mockResolvedValueOnce({ success: true, output: '', executedOn: 'kvm' }) // fetch
        .mockResolvedValueOnce({ success: true, output: 'abc123', executedOn: 'kvm' }) // base commit
        .mockResolvedValueOnce({ success: true, output: 'def456', executedOn: 'kvm' }); // head commit

      const conflictOutput = `CONFLICT (content): Merge conflict in file.ts`;
      const error: any = new Error('Git command failed');
      error.status = 1;
      error.stdout = conflictOutput;
      error.stderr = 'CONFLICT';
      mockExecGit.mockImplementationOnce(() => {
        throw error;
      });

      await handler(mockPrisma, { storyId: 'story-123' });

      expect(mockPrisma.story.update).toHaveBeenCalledWith({
        where: { id: 'story-123' },
        data: {
          metadata: expect.objectContaining({
            conflictDetails: {
              detectedAt: expect.any(String),
              hasConflicts: true,
              conflictingFiles: expect.arrayContaining([
                expect.objectContaining({
                  path: 'file.ts',
                  conflictType: 'content',
                }),
              ]),
              baseCommit: 'abc123',
              headCommit: 'def456',
              resolution: 'pending',
            },
          }),
        },
      });
    });

    it('should preserve existing metadata fields', async () => {
      const storyWithMetadata = {
        ...mockStory,
        metadata: { existingField: 'value', rebaseStatus: { status: 'completed' } },
      };
      (mockPrisma.story.findUnique as jest.Mock).mockResolvedValue(storyWithMetadata);
      (mockPrisma.story.update as jest.Mock).mockResolvedValue(storyWithMetadata);

      mockExecGit.mockReturnValueOnce('git version 2.39.0');

      // Mock location-aware operations (ST-153)
      mockExecGitLocationAware
        .mockResolvedValueOnce({ success: true, output: '', executedOn: 'kvm' }) // fetch
        .mockResolvedValueOnce({ success: true, output: 'abc123', executedOn: 'kvm' }) // base commit
        .mockResolvedValueOnce({ success: true, output: 'def456', executedOn: 'kvm' }); // head commit

      // Mock clean merge
      mockExecGit.mockReturnValueOnce('tree-hash\n');

      await handler(mockPrisma, { storyId: 'story-123' });

      expect(mockPrisma.story.update).toHaveBeenCalledWith({
        where: { id: 'story-123' },
        data: {
          metadata: expect.objectContaining({
            existingField: 'value',
            rebaseStatus: { status: 'completed' },
            conflictDetails: expect.any(Object),
          }),
        },
      });
    });
  });
});
