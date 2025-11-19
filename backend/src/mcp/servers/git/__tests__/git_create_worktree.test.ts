/**
 * Tests for git_create_worktree tool
 */

import { PrismaClient } from '@prisma/client';
import { handler, tool } from '../git_create_worktree';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// Mock child_process
jest.mock('child_process');

const mockExecSync = execSync as jest.MockedFunction<typeof execSync>;

describe('git_create_worktree', () => {
  let prisma: PrismaClient;
  const testStoryId = 'test-story-id-123';
  const testProjectId = 'test-project-id-456';

  beforeEach(() => {
    prisma = new PrismaClient();
    jest.clearAllMocks();

    // Default mock implementations
    mockExecSync.mockReturnValue('');
    jest.spyOn(fs, 'existsSync').mockReturnValue(false);
    jest.spyOn(fs, 'mkdirSync').mockImplementation(() => undefined);
    jest.spyOn(fs, 'symlinkSync').mockImplementation(() => undefined);
    jest.spyOn(fs, 'rmSync').mockImplementation(() => undefined);
  });

  afterEach(async () => {
    await prisma.$disconnect();
  });

  describe('Tool Definition', () => {
    it('should have correct tool name', () => {
      expect(tool.name).toBe('git_create_worktree');
    });

    it('should have required storyId parameter', () => {
      expect(tool.inputSchema.required).toContain('storyId');
    });

    it('should have optional branchName and baseBranch parameters', () => {
      expect(tool.inputSchema.properties).toHaveProperty('branchName');
      expect(tool.inputSchema.properties).toHaveProperty('baseBranch');
      expect(tool.inputSchema.required).toHaveLength(1);
    });
  });

  describe('Handler Function', () => {
    describe('Validation', () => {
      it('should throw NotFoundError when story does not exist', async () => {
        // Mock Prisma to return null for story
        prisma.story.findUnique = jest.fn().mockResolvedValue(null);

        await expect(
          handler(prisma, { storyId: testStoryId })
        ).rejects.toThrow('Story not found');
      });

      it('should throw ValidationError when worktree already exists for story', async () => {
        // Mock story exists
        prisma.story.findUnique = jest.fn().mockResolvedValue({
          id: testStoryId,
          key: 'ST-1',
          title: 'Test Story',
          projectId: testProjectId,
          project: { id: testProjectId },
        });

        // Mock existing worktree
        prisma.worktree.findFirst = jest.fn().mockResolvedValue({
          id: 'worktree-id',
          storyId: testStoryId,
          status: 'active',
          worktreePath: '/opt/stack/worktrees/st-1-test-story',
        });

        await expect(
          handler(prisma, { storyId: testStoryId })
        ).rejects.toThrow('Worktree already exists');
      });

      it('should throw ValidationError when branch already exists', async () => {
        // Mock story exists
        prisma.story.findUnique = jest.fn().mockResolvedValue({
          id: testStoryId,
          key: 'ST-1',
          title: 'Test Story',
          projectId: testProjectId,
          project: { id: testProjectId },
        });

        // Mock no existing worktree
        prisma.worktree.findFirst = jest.fn().mockResolvedValue(null);

        // Mock branch exists (git rev-parse succeeds)
        mockExecSync.mockImplementation((cmd) => {
          if (cmd.toString().includes('rev-parse')) {
            return 'commit-hash';
          }
          return '';
        });

        await expect(
          handler(prisma, { storyId: testStoryId })
        ).rejects.toThrow('Branch');
      });

      it('should throw ValidationError when insufficient disk space', async () => {
        // Mock story exists
        prisma.story.findUnique = jest.fn().mockResolvedValue({
          id: testStoryId,
          key: 'ST-1',
          title: 'Test Story',
          projectId: testProjectId,
          project: { id: testProjectId },
        });

        prisma.worktree.findFirst = jest.fn().mockResolvedValue(null);

        // Mock git commands
        mockExecSync.mockImplementation((cmd) => {
          if (cmd.toString().includes('rev-parse')) {
            throw new Error('fatal: not found');
          }
          if (cmd.toString().includes('df -BG')) {
            return '3G\n'; // Less than 5GB
          }
          return '';
        });

        await expect(
          handler(prisma, { storyId: testStoryId })
        ).rejects.toThrow('Insufficient disk space');
      });
    });

    describe('Branch Name Generation', () => {
      it('should auto-generate branch name from story key and title', async () => {
        const story = {
          id: testStoryId,
          key: 'ST-42',
          title: 'Implement User Authentication',
          projectId: testProjectId,
          project: { id: testProjectId },
        };

        prisma.story.findUnique = jest.fn().mockResolvedValue(story);
        prisma.worktree.findFirst = jest.fn().mockResolvedValue(null);
        prisma.worktree.create = jest.fn().mockResolvedValue({
          id: 'worktree-id',
          storyId: testStoryId,
          branchName: 'st-42-implement-user-authentication',
          worktreePath: '/opt/stack/worktrees/st-42-implement-user-authentication',
          baseBranch: 'main',
          status: 'active',
        });
        prisma.story.update = jest.fn().mockResolvedValue(story);

        mockExecSync.mockImplementation((cmd) => {
          if (cmd.toString().includes('rev-parse')) {
            throw new Error('fatal: not found');
          }
          if (cmd.toString().includes('df -BG')) {
            return '10G\n';
          }
          return '';
        });

        const result = await handler(prisma, { storyId: testStoryId });

        expect(result.branchName).toBe('st-42-implement-user-authentication');
      });

      it('should use provided branch name', async () => {
        const customBranchName = 'feature/custom-branch';
        const story = {
          id: testStoryId,
          key: 'ST-42',
          title: 'Test Story',
          projectId: testProjectId,
          project: { id: testProjectId },
        };

        prisma.story.findUnique = jest.fn().mockResolvedValue(story);
        prisma.worktree.findFirst = jest.fn().mockResolvedValue(null);
        prisma.worktree.create = jest.fn().mockResolvedValue({
          id: 'worktree-id',
          storyId: testStoryId,
          branchName: customBranchName,
          worktreePath: `/opt/stack/worktrees/${customBranchName}`,
          baseBranch: 'main',
          status: 'active',
        });
        prisma.story.update = jest.fn().mockResolvedValue(story);

        mockExecSync.mockImplementation((cmd) => {
          if (cmd.toString().includes('rev-parse')) {
            throw new Error('fatal: not found');
          }
          if (cmd.toString().includes('df -BG')) {
            return '10G\n';
          }
          return '';
        });

        const result = await handler(prisma, {
          storyId: testStoryId,
          branchName: customBranchName,
        });

        expect(result.branchName).toBe(customBranchName);
      });

      it('should sanitize special characters in generated branch name', async () => {
        const story = {
          id: testStoryId,
          key: 'ST-99',
          title: 'Fix Bug: User@Email.com & Password!',
          projectId: testProjectId,
          project: { id: testProjectId },
        };

        prisma.story.findUnique = jest.fn().mockResolvedValue(story);
        prisma.worktree.findFirst = jest.fn().mockResolvedValue(null);
        prisma.worktree.create = jest.fn().mockResolvedValue({
          id: 'worktree-id',
          storyId: testStoryId,
          branchName: 'st-99-fix-bug-useremailcom-password',
          worktreePath: '/opt/stack/worktrees/st-99-fix-bug-useremailcom-password',
          baseBranch: 'main',
          status: 'active',
        });
        prisma.story.update = jest.fn().mockResolvedValue(story);

        mockExecSync.mockImplementation((cmd) => {
          if (cmd.toString().includes('rev-parse')) {
            throw new Error('fatal: not found');
          }
          if (cmd.toString().includes('df -BG')) {
            return '10G\n';
          }
          return '';
        });

        const result = await handler(prisma, { storyId: testStoryId });

        // Should not contain special characters
        expect(result.branchName).not.toMatch(/[@!:]/);
      });
    });

    describe('Successful Worktree Creation', () => {
      beforeEach(() => {
        const story = {
          id: testStoryId,
          key: 'ST-1',
          title: 'Test Story',
          projectId: testProjectId,
          project: { id: testProjectId },
        };

        prisma.story.findUnique = jest.fn().mockResolvedValue(story);
        prisma.worktree.findFirst = jest.fn().mockResolvedValue(null);
        prisma.worktree.create = jest.fn().mockResolvedValue({
          id: 'worktree-id',
          storyId: testStoryId,
          branchName: 'st-1-test-story',
          worktreePath: '/opt/stack/worktrees/st-1-test-story',
          baseBranch: 'main',
          status: 'active',
        });
        prisma.story.update = jest.fn().mockResolvedValue(story);

        mockExecSync.mockImplementation((cmd) => {
          if (cmd.toString().includes('rev-parse')) {
            throw new Error('fatal: not found');
          }
          if (cmd.toString().includes('df -BG')) {
            return '10G\n';
          }
          return '';
        });

        jest.spyOn(fs, 'existsSync').mockImplementation((path) => {
          // Simulate node_modules exists in main repo
          if (path.toString().includes('/opt/stack/AIStudio/node_modules')) {
            return true;
          }
          return false;
        });
      });

      it('should create worktree with all required steps', async () => {
        const result = await handler(prisma, { storyId: testStoryId });

        // Verify git commands were called
        expect(mockExecSync).toHaveBeenCalledWith(
          expect.stringContaining('git fetch'),
          expect.any(Object)
        );
        expect(mockExecSync).toHaveBeenCalledWith(
          expect.stringContaining('git branch'),
          expect.any(Object)
        );
        expect(mockExecSync).toHaveBeenCalledWith(
          expect.stringContaining('git worktree add'),
          expect.any(Object)
        );

        // Verify database records were created
        expect(prisma.worktree.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              storyId: testStoryId,
              status: 'active',
            }),
          })
        );

        // Verify story phase was updated
        expect(prisma.story.update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: testStoryId },
            data: { currentPhase: 'implementation' },
          })
        );

        // Verify response
        expect(result).toMatchObject({
          storyId: testStoryId,
          baseBranch: 'main',
          message: expect.stringContaining('Successfully created worktree'),
        });
      });

      it('should use custom base branch when provided', async () => {
        await handler(prisma, {
          storyId: testStoryId,
          baseBranch: 'develop',
        });

        expect(mockExecSync).toHaveBeenCalledWith(
          expect.stringContaining('git fetch origin develop'),
          expect.any(Object)
        );
        expect(mockExecSync).toHaveBeenCalledWith(
          expect.stringContaining('origin/develop'),
          expect.any(Object)
        );
      });

      it('should create symlinks for node_modules', async () => {
        await handler(prisma, { storyId: testStoryId });

        // Verify symlink was created
        expect(fs.symlinkSync).toHaveBeenCalledWith(
          expect.stringContaining('/opt/stack/AIStudio/node_modules'),
          expect.stringContaining('/opt/stack/worktrees'),
          'dir'
        );
      });

      it('should return worktree information', async () => {
        const result = await handler(prisma, { storyId: testStoryId });

        expect(result).toHaveProperty('worktreeId');
        expect(result).toHaveProperty('storyId', testStoryId);
        expect(result).toHaveProperty('branchName');
        expect(result).toHaveProperty('worktreePath');
        expect(result).toHaveProperty('baseBranch');
        expect(result).toHaveProperty('message');
      });
    });

    describe('Error Handling', () => {
      it('should clean up branch if worktree creation fails', async () => {
        const story = {
          id: testStoryId,
          key: 'ST-1',
          title: 'Test Story',
          projectId: testProjectId,
          project: { id: testProjectId },
        };

        prisma.story.findUnique = jest.fn().mockResolvedValue(story);
        prisma.worktree.findFirst = jest.fn().mockResolvedValue(null);

        mockExecSync.mockImplementation((cmd) => {
          if (cmd.toString().includes('rev-parse')) {
            throw new Error('fatal: not found');
          }
          if (cmd.toString().includes('df -BG')) {
            return '10G\n';
          }
          return '';
        });

        // Simulate worktree path already exists
        jest.spyOn(fs, 'existsSync').mockReturnValue(true);

        await expect(
          handler(prisma, { storyId: testStoryId })
        ).rejects.toThrow('Worktree path already exists');

        // Verify branch cleanup was attempted
        expect(mockExecSync).toHaveBeenCalledWith(
          expect.stringContaining('git branch -D'),
          expect.any(Object)
        );
      });

      it('should handle git command failures gracefully', async () => {
        const story = {
          id: testStoryId,
          key: 'ST-1',
          title: 'Test Story',
          projectId: testProjectId,
          project: { id: testProjectId },
        };

        prisma.story.findUnique = jest.fn().mockResolvedValue(story);
        prisma.worktree.findFirst = jest.fn().mockResolvedValue(null);

        mockExecSync.mockImplementation((cmd) => {
          if (cmd.toString().includes('git fetch')) {
            throw new Error('fatal: unable to access repository');
          }
          if (cmd.toString().includes('rev-parse')) {
            throw new Error('fatal: not found');
          }
          if (cmd.toString().includes('df -BG')) {
            return '10G\n';
          }
          return '';
        });

        await expect(
          handler(prisma, { storyId: testStoryId })
        ).rejects.toThrow('Git command failed');
      });
    });
  });
});
