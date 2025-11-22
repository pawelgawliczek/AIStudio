/**
 * Tests for cleanup_story_artifacts tool
 * ST-47: MCP Tool - Cleanup & Archival
 */

import { PrismaClient } from '@prisma/client';
import { createTestPrismaClient } from '@/test-utils/safe-prisma-client';
import { handler, tool } from '../cleanup_story_artifacts';
import * as gitUtils from '../../git/git_utils';

jest.mock('../../git/git_utils');

describe('cleanup_story_artifacts', () => {
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
      expect(tool.name).toBe('cleanup_story_artifacts');
    });

    it('should require storyId parameter', () => {
      expect(tool.inputSchema.required).toContain('storyId');
    });

    it('should have optional forceCleanup parameter', () => {
      expect(tool.inputSchema.properties).toHaveProperty('forceCleanup');
    });
  });

  describe('Handler Function', () => {
    const mockStoryWithMergedPR = {
      id: 'story-1',
      key: 'ST-47',
      title: 'Test Feature',
      status: 'review',
      currentPhase: 'review',
      pullRequests: [
        {
          id: 'pr-1',
          prNumber: 123,
          status: 'merged',
          createdAt: new Date('2025-11-19T10:00:00Z'),
        },
      ],
      worktrees: [
        {
          id: 'wt-1',
          branchName: 'st-47-test-feature',
          worktreePath: '/opt/stack/worktrees/st-47-test-feature',
          status: 'active',
          createdAt: new Date('2025-11-19T10:00:00Z'),
        },
      ],
    };

    const mockStoryWithOpenPR = {
      ...mockStoryWithMergedPR,
      pullRequests: [
        {
          id: 'pr-1',
          prNumber: 123,
          status: 'open',
          createdAt: new Date('2025-11-19T10:00:00Z'),
        },
      ],
    };

    const mockStoryCancelled = {
      id: 'story-2',
      key: 'ST-48',
      title: 'Cancelled Feature',
      status: 'planning',
      currentPhase: null,
      pullRequests: [],
      worktrees: [
        {
          id: 'wt-2',
          branchName: 'st-48-cancelled',
          worktreePath: '/opt/stack/worktrees/st-48-cancelled',
          status: 'active',
          createdAt: new Date('2025-11-19T10:00:00Z'),
        },
      ],
    };

    beforeEach(() => {
      const mockExecGit = gitUtils.execGit as jest.MockedFunction<typeof gitUtils.execGit>;
      mockExecGit.mockReturnValue('');

      const mockValidateWorktreePath = gitUtils.validateWorktreePath as jest.MockedFunction<
        typeof gitUtils.validateWorktreePath
      >;
      mockValidateWorktreePath.mockImplementation(() => {});

      const mockValidateBranchName = gitUtils.validateBranchName as jest.MockedFunction<
        typeof gitUtils.validateBranchName
      >;
      mockValidateBranchName.mockImplementation(() => {});
    });

    describe('Safety Checks', () => {
      it('should allow cleanup when PR is merged', async () => {
        prisma.story.findUnique = jest.fn().mockResolvedValue(mockStoryWithMergedPR);
        prisma.testQueue.findFirst = jest.fn().mockResolvedValue(null);
        prisma.worktree.update = jest.fn().mockResolvedValue({});
        prisma.story.update = jest.fn().mockResolvedValue({});

        const result = await handler(prisma, { storyId: 'story-1' });

        expect(result.safetyChecksPassed).toBe(true);
        expect(result.actions.worktreeRemoved).toBe(true);
        expect(result.actions.storyPhaseUpdated).toBe(true);
      });

      it('should allow cleanup when story is cancelled (no PR)', async () => {
        prisma.story.findUnique = jest.fn().mockResolvedValue(mockStoryCancelled);
        prisma.testQueue.findFirst = jest.fn().mockResolvedValue(null);
        prisma.worktree.update = jest.fn().mockResolvedValue({});
        prisma.story.update = jest.fn().mockResolvedValue({});

        const result = await handler(prisma, { storyId: 'story-2' });

        expect(result.safetyChecksPassed).toBe(true);
        expect(result.warnings).toContain('Story appears to be cancelled (no PR found)');
      });

      it('should reject cleanup when PR is not merged', async () => {
        prisma.story.findUnique = jest.fn().mockResolvedValue(mockStoryWithOpenPR);

        await expect(handler(prisma, { storyId: 'story-1' })).rejects.toThrow(
          'Safety check failed'
        );
      });

      it('should bypass safety checks with forceCleanup flag', async () => {
        prisma.story.findUnique = jest.fn().mockResolvedValue(mockStoryWithOpenPR);
        prisma.testQueue.findFirst = jest.fn().mockResolvedValue(null);
        prisma.worktree.update = jest.fn().mockResolvedValue({});
        prisma.story.update = jest.fn().mockResolvedValue({});

        const result = await handler(prisma, {
          storyId: 'story-1',
          forceCleanup: true,
        });

        expect(result.safetyChecksPassed).toBe(false);
        expect(result.warnings).toContain('Safety checks bypassed with forceCleanup flag');
      });
    });

    describe('Worktree Cleanup', () => {
      it('should remove worktree from filesystem', async () => {
        prisma.story.findUnique = jest.fn().mockResolvedValue(mockStoryWithMergedPR);
        prisma.testQueue.findFirst = jest.fn().mockResolvedValue(null);
        prisma.worktree.update = jest.fn().mockResolvedValue({});
        prisma.story.update = jest.fn().mockResolvedValue({});

        const result = await handler(prisma, { storyId: 'story-1' });

        expect(gitUtils.execGit).toHaveBeenCalledWith(
          expect.stringContaining('git worktree remove --force'),
          '/opt/stack/AIStudio'
        );
        expect(result.actions.worktreeRemoved).toBe(true);
      });

      it('should delete git branch', async () => {
        prisma.story.findUnique = jest.fn().mockResolvedValue(mockStoryWithMergedPR);
        prisma.testQueue.findFirst = jest.fn().mockResolvedValue(null);
        prisma.worktree.update = jest.fn().mockResolvedValue({});
        prisma.story.update = jest.fn().mockResolvedValue({});

        const result = await handler(prisma, { storyId: 'story-1' });

        expect(gitUtils.execGit).toHaveBeenCalledWith(
          expect.stringContaining('git branch -D st-47-test-feature'),
          '/opt/stack/AIStudio'
        );
        expect(result.actions.branchDeleted).toBe(true);
      });

      it('should update worktree status to removed', async () => {
        prisma.story.findUnique = jest.fn().mockResolvedValue(mockStoryWithMergedPR);
        prisma.testQueue.findFirst = jest.fn().mockResolvedValue(null);
        prisma.worktree.update = jest.fn().mockResolvedValue({});
        prisma.story.update = jest.fn().mockResolvedValue({});

        const result = await handler(prisma, { storyId: 'story-1' });

        expect(prisma.worktree.update).toHaveBeenCalledWith({
          where: { id: 'wt-1' },
          data: expect.objectContaining({
            status: 'removed',
          }),
        });
        expect(result.actions.worktreeStatusUpdated).toBe(true);
      });

      it('should handle missing worktree gracefully', async () => {
        const storyWithoutWorktree = {
          ...mockStoryWithMergedPR,
          worktrees: [],
        };
        prisma.story.findUnique = jest.fn().mockResolvedValue(storyWithoutWorktree);
        prisma.testQueue.findFirst = jest.fn().mockResolvedValue(null);
        prisma.story.update = jest.fn().mockResolvedValue({});

        const result = await handler(prisma, { storyId: 'story-1' });

        expect(result.warnings).toContain('No active worktree found for cleanup');
        expect(result.actions.worktreeRemoved).toBe(false);
      });
    });

    describe('Test Queue Cleanup', () => {
      it('should remove story from test queue if pending', async () => {
        const mockTestQueueEntry = {
          id: 'tq-1',
          storyId: 'story-1',
          status: 'pending',
        };

        prisma.story.findUnique = jest.fn().mockResolvedValue(mockStoryWithMergedPR);
        prisma.testQueue.findFirst = jest
          .fn()
          .mockResolvedValueOnce(mockTestQueueEntry) // First call for pending/running
          .mockResolvedValueOnce(null); // Second call for any status
        prisma.testQueue.update = jest.fn().mockResolvedValue({});
        prisma.worktree.update = jest.fn().mockResolvedValue({});
        prisma.story.update = jest.fn().mockResolvedValue({});

        const result = await handler(prisma, { storyId: 'story-1' });

        expect(prisma.testQueue.update).toHaveBeenCalledWith({
          where: { id: 'tq-1' },
          data: { status: 'cancelled' },
        });
        expect(result.actions.testQueueRemoved).toBe(true);
      });

      it('should handle story not in test queue', async () => {
        prisma.story.findUnique = jest.fn().mockResolvedValue(mockStoryWithMergedPR);
        prisma.testQueue.findFirst = jest.fn().mockResolvedValue(null);
        prisma.worktree.update = jest.fn().mockResolvedValue({});
        prisma.story.update = jest.fn().mockResolvedValue({});

        const result = await handler(prisma, { storyId: 'story-1' });

        expect(result.warnings).toContain('Story was never added to test queue');
        expect(result.actions.testQueueRemoved).toBe(false);
      });

      it('should warn if story already completed in test queue', async () => {
        const mockCompletedEntry = {
          id: 'tq-1',
          storyId: 'story-1',
          status: 'passed',
        };

        prisma.story.findUnique = jest.fn().mockResolvedValue(mockStoryWithMergedPR);
        prisma.testQueue.findFirst = jest
          .fn()
          .mockResolvedValueOnce(null) // No pending/running
          .mockResolvedValueOnce(mockCompletedEntry); // Has completed entry
        prisma.worktree.update = jest.fn().mockResolvedValue({});
        prisma.story.update = jest.fn().mockResolvedValue({});

        const result = await handler(prisma, { storyId: 'story-1' });

        expect(result.warnings).toContain('Story not in active test queue (status: passed)');
      });
    });

    describe('Story Phase Update', () => {
      it('should update story currentPhase to done', async () => {
        prisma.story.findUnique = jest.fn().mockResolvedValue(mockStoryWithMergedPR);
        prisma.testQueue.findFirst = jest.fn().mockResolvedValue(null);
        prisma.worktree.update = jest.fn().mockResolvedValue({});
        prisma.story.update = jest.fn().mockResolvedValue({});

        const result = await handler(prisma, { storyId: 'story-1' });

        expect(prisma.story.update).toHaveBeenCalledWith({
          where: { id: 'story-1' },
          data: expect.objectContaining({
            currentPhase: 'done',
          }),
        });
        expect(result.actions.storyPhaseUpdated).toBe(true);
      });
    });

    describe('Idempotency', () => {
      it('should handle worktree already removed from filesystem', async () => {
        prisma.story.findUnique = jest.fn().mockResolvedValue(mockStoryWithMergedPR);
        prisma.testQueue.findFirst = jest.fn().mockResolvedValue(null);
        prisma.worktree.update = jest.fn().mockResolvedValue({});
        prisma.story.update = jest.fn().mockResolvedValue({});

        const mockExecGit = gitUtils.execGit as jest.MockedFunction<typeof gitUtils.execGit>;
        mockExecGit.mockImplementation((cmd) => {
          if (cmd.includes('worktree remove')) {
            throw new Error('not found');
          }
          return '';
        });

        const result = await handler(prisma, { storyId: 'story-1' });

        expect(result.actions.worktreeRemoved).toBe(true);
        expect(result.warnings.some(w => w.includes('Worktree already removed from filesystem'))).toBe(true);
      });

      it('should handle branch already deleted', async () => {
        prisma.story.findUnique = jest.fn().mockResolvedValue(mockStoryWithMergedPR);
        prisma.testQueue.findFirst = jest.fn().mockResolvedValue(null);
        prisma.worktree.update = jest.fn().mockResolvedValue({});
        prisma.story.update = jest.fn().mockResolvedValue({});

        const mockExecGit = gitUtils.execGit as jest.MockedFunction<typeof gitUtils.execGit>;
        mockExecGit.mockImplementation((cmd) => {
          if (cmd.includes('branch -D')) {
            throw new Error('no such ref');
          }
          return '';
        });

        const result = await handler(prisma, { storyId: 'story-1' });

        expect(result.actions.branchDeleted).toBe(true);
        expect(result.warnings.some(w => w.includes('Branch already deleted'))).toBe(true);
      });
    });

    describe('Error Handling', () => {
      it('should handle worktree update failure gracefully', async () => {
        prisma.story.findUnique = jest.fn().mockResolvedValue(mockStoryWithMergedPR);
        prisma.testQueue.findFirst = jest.fn().mockResolvedValue(null);
        prisma.worktree.update = jest
          .fn()
          .mockRejectedValue(new Error('Database error'));
        prisma.story.update = jest.fn().mockResolvedValue({});

        const result = await handler(prisma, { storyId: 'story-1' });

        expect(result.warnings.some(w => w.includes('Failed to update worktree status'))).toBe(true);
        expect(result.actions.worktreeStatusUpdated).toBe(false);
      });

      it('should handle test queue removal failure gracefully', async () => {
        const mockTestQueueEntry = {
          id: 'tq-1',
          storyId: 'story-1',
          status: 'pending',
        };

        prisma.story.findUnique = jest.fn().mockResolvedValue(mockStoryWithMergedPR);
        prisma.testQueue.findFirst = jest.fn().mockResolvedValue(mockTestQueueEntry);
        prisma.testQueue.update = jest
          .fn()
          .mockRejectedValue(new Error('Database error'));
        prisma.worktree.update = jest.fn().mockResolvedValue({});
        prisma.story.update = jest.fn().mockResolvedValue({});

        const result = await handler(prisma, { storyId: 'story-1' });

        expect(result.warnings.some(w => w.includes('Failed to remove from test queue'))).toBe(true);
        expect(result.actions.testQueueRemoved).toBe(false);
      });

      it('should handle story phase update failure gracefully', async () => {
        prisma.story.findUnique = jest.fn().mockResolvedValue(mockStoryWithMergedPR);
        prisma.testQueue.findFirst = jest.fn().mockResolvedValue(null);
        prisma.worktree.update = jest.fn().mockResolvedValue({});
        prisma.story.update = jest.fn().mockRejectedValue(new Error('Database error'));

        const result = await handler(prisma, { storyId: 'story-1' });

        expect(result.warnings.some(w => w.includes('Failed to update story phase'))).toBe(true);
        expect(result.actions.storyPhaseUpdated).toBe(false);
      });
    });

    describe('Validation', () => {
      it('should require storyId parameter', async () => {
        await expect(handler(prisma, {} as any)).rejects.toThrow(
          'Missing required fields'
        );
      });

      it('should validate story exists', async () => {
        prisma.story.findUnique = jest.fn().mockResolvedValue(null);

        await expect(handler(prisma, { storyId: 'non-existent' })).rejects.toThrow(
          'not found'
        );
      });

      it('should validate worktree path', async () => {
        const storyWithInvalidPath = {
          ...mockStoryWithMergedPR,
          worktrees: [
            {
              id: 'wt-1',
              branchName: 'st-47-test',
              worktreePath: '/tmp/malicious',
              status: 'active',
              createdAt: new Date(),
            },
          ],
        };

        prisma.story.findUnique = jest.fn().mockResolvedValue(storyWithInvalidPath);

        const mockValidateWorktreePath = gitUtils.validateWorktreePath as jest.MockedFunction<
          typeof gitUtils.validateWorktreePath
        >;
        mockValidateWorktreePath.mockImplementation(() => {
          throw new Error('Invalid worktree path');
        });

        await expect(handler(prisma, { storyId: 'story-1' })).rejects.toThrow(
          'Invalid worktree path'
        );
      });
    });

    describe('Response Format', () => {
      it('should return comprehensive cleanup summary', async () => {
        prisma.story.findUnique = jest.fn().mockResolvedValue(mockStoryWithMergedPR);
        prisma.testQueue.findFirst = jest.fn().mockResolvedValue(null);
        prisma.worktree.update = jest.fn().mockResolvedValue({});
        prisma.story.update = jest.fn().mockResolvedValue({});

        const result = await handler(prisma, { storyId: 'story-1' });

        expect(result).toMatchObject({
          storyId: 'story-1',
          storyKey: 'ST-47',
          storyTitle: 'Test Feature',
          actions: expect.any(Object),
          warnings: expect.any(Array),
          safetyChecksPassed: true,
          message: expect.stringContaining('Successfully cleaned up artifacts'),
        });
      });
    });
  });
});
