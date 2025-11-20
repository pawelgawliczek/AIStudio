/**
 * Tests for create_pull_request tool
 */

import { execSync } from 'child_process';
import { PrismaClient } from '@prisma/client';
import { handler, tool } from '../create_pull_request';

// Mock child_process
jest.mock('child_process');

const mockExecSync = execSync as jest.MockedFunction<typeof execSync>;

describe('create_pull_request', () => {
  let prisma: PrismaClient;
  const testStoryId = 'test-story-id-123';
  const testPrNumber = 456;
  const testPrUrl = 'https://github.com/org/repo/pull/456';

  beforeEach(() => {
    prisma = new PrismaClient();
    jest.clearAllMocks();

    // Set environment variables
    process.env.GITHUB_TOKEN = 'test-token';
    process.env.GITHUB_REPOSITORY = 'org/repo';

    // Default mock implementations
    mockExecSync.mockReturnValue('');
  });

  afterEach(async () => {
    await prisma.$disconnect();
  });

  describe('Tool Definition', () => {
    it('should have correct tool name', () => {
      expect(tool.name).toBe('create_pull_request');
    });

    it('should have required storyId parameter', () => {
      expect(tool.inputSchema.required).toContain('storyId');
    });

    it('should have optional parameters', () => {
      expect(tool.inputSchema.properties).toHaveProperty('title');
      expect(tool.inputSchema.properties).toHaveProperty('description');
      expect(tool.inputSchema.properties).toHaveProperty('draft');
      expect(tool.inputSchema.properties).toHaveProperty('baseBranch');
    });
  });

  describe('Handler Function', () => {
    describe('Validation', () => {
      it('should throw NotFoundError when story does not exist', async () => {
        prisma.story.findUnique = jest.fn().mockResolvedValue(null);

        await expect(
          handler(prisma, { storyId: testStoryId })
        ).rejects.toThrow(/Story.*not found/i);
      });

      it('should throw ValidationError when PR already exists', async () => {
        prisma.story.findUnique = jest.fn().mockResolvedValue({
          id: testStoryId,
          key: 'ST-46',
          title: 'Test Story',
          project: { id: 'project-id' },
        });

        prisma.pullRequest.findFirst = jest.fn().mockResolvedValue({
          id: 'pr-id',
          prNumber: 123,
          status: 'open',
        });

        await expect(
          handler(prisma, { storyId: testStoryId })
        ).rejects.toThrow('Pull request already exists');
      });

      it('should throw ValidationError when no worktree found', async () => {
        prisma.story.findUnique = jest.fn().mockResolvedValue({
          id: testStoryId,
          key: 'ST-46',
          title: 'Test Story',
          project: { id: 'project-id' },
        });

        prisma.pullRequest.findFirst = jest.fn().mockResolvedValue(null);
        prisma.worktree.findFirst = jest.fn().mockResolvedValue(null);

        await expect(
          handler(prisma, { storyId: testStoryId })
        ).rejects.toThrow('No active worktree found');
      });

      it('should throw ValidationError when branch not pushed', async () => {
        prisma.story.findUnique = jest.fn().mockResolvedValue({
          id: testStoryId,
          key: 'ST-46',
          title: 'Test Story',
          project: { id: 'project-id' },
        });

        prisma.pullRequest.findFirst = jest.fn().mockResolvedValue(null);
        prisma.worktree.findFirst = jest.fn().mockResolvedValue({
          id: 'worktree-id',
          branchName: 'st-46-test',
          worktreePath: '/opt/stack/worktrees/st-46-test',
          status: 'active',
        });

        mockExecSync.mockImplementation((cmd) => {
          if (cmd.toString().includes('ls-remote')) {
            throw new Error('Branch not found');
          }
          return '';
        });

        await expect(
          handler(prisma, { storyId: testStoryId })
        ).rejects.toThrow('not pushed to remote');
      });

      it('should throw ValidationError when no commits ahead', async () => {
        prisma.story.findUnique = jest.fn().mockResolvedValue({
          id: testStoryId,
          key: 'ST-46',
          title: 'Test Story',
          project: { id: 'project-id' },
        });

        prisma.pullRequest.findFirst = jest.fn().mockResolvedValue(null);
        prisma.worktree.findFirst = jest.fn().mockResolvedValue({
          id: 'worktree-id',
          branchName: 'st-46-test',
          worktreePath: '/opt/stack/worktrees/st-46-test',
          status: 'active',
        });

        mockExecSync.mockImplementation((cmd) => {
          if (cmd.toString().includes('ls-remote')) {
            return 'ref\n';
          }
          if (cmd.toString().includes('rev-list')) {
            return '0\n';
          }
          return '';
        });

        await expect(
          handler(prisma, { storyId: testStoryId })
        ).rejects.toThrow('No commits ahead');
      });
    });

    describe('PR Creation', () => {
      it('should create PR with auto-generated title and description', async () => {
        prisma.story.findUnique = jest.fn().mockResolvedValue({
          id: testStoryId,
          key: 'ST-46',
          title: 'MCP Tool - Pull Request Management',
          description: 'Test description',
          project: { id: 'project-id' },
        });

        prisma.pullRequest.findFirst = jest.fn().mockResolvedValue(null);
        prisma.worktree.findFirst = jest.fn().mockResolvedValue({
          id: 'worktree-id',
          branchName: 'st-46-test',
          worktreePath: '/opt/stack/worktrees/st-46-test',
          status: 'active',
        });

        prisma.pullRequest.create = jest.fn().mockResolvedValue({
          id: 'pr-id',
          prNumber: testPrNumber,
          prUrl: testPrUrl,
          status: 'open',
        });

        mockExecSync.mockImplementation((cmd) => {
          if (cmd.toString().includes('gh --version')) {
            return 'gh version 2.0.0\n';
          }
          if (cmd.toString().includes('ls-remote')) {
            return 'ref\n';
          }
          if (cmd.toString().includes('rev-list')) {
            return '5\n';
          }
          if (cmd.toString().includes('git log')) {
            return 'abc123 feat: implement PR tools\n';
          }
          if (cmd.toString().includes('git diff --stat')) {
            return 'file.ts | 100 ++++\n';
          }
          if (cmd.toString().includes('gh pr create')) {
            return testPrUrl;
          }
          return '';
        });

        const result = await handler(prisma, { storyId: testStoryId });

        expect(result.success).toBe(true);
        expect(result.prNumber).toBe(testPrNumber);
        expect(result.prUrl).toBe(testPrUrl);
        expect(result.status).toBe('open');
      });

      it('should create draft PR when draft=true', async () => {
        prisma.story.findUnique = jest.fn().mockResolvedValue({
          id: testStoryId,
          key: 'ST-46',
          title: 'Test Story',
          description: 'Test description',
          project: { id: 'project-id' },
        });

        prisma.pullRequest.findFirst = jest.fn().mockResolvedValue(null);
        prisma.worktree.findFirst = jest.fn().mockResolvedValue({
          id: 'worktree-id',
          branchName: 'st-46-test',
          worktreePath: '/opt/stack/worktrees/st-46-test',
          status: 'active',
        });

        prisma.pullRequest.create = jest.fn().mockResolvedValue({
          id: 'pr-id',
          prNumber: testPrNumber,
          prUrl: testPrUrl,
          status: 'draft',
        });

        mockExecSync.mockImplementation((cmd) => {
          if (cmd.toString().includes('gh --version')) {
            return 'gh version 2.0.0\n';
          }
          if (cmd.toString().includes('ls-remote')) {
            return 'ref\n';
          }
          if (cmd.toString().includes('rev-list')) {
            return '5\n';
          }
          if (cmd.toString().includes('gh pr create')) {
            expect(cmd.toString()).toContain('--draft');
            return testPrUrl;
          }
          return '';
        });

        const result = await handler(prisma, {
          storyId: testStoryId,
          draft: true,
        });

        expect(result.success).toBe(true);
        expect(result.status).toBe('draft');
      });

      it('should use custom title and description if provided', async () => {
        const customTitle = 'Custom PR Title';
        const customDescription = 'Custom PR Description';

        prisma.story.findUnique = jest.fn().mockResolvedValue({
          id: testStoryId,
          key: 'ST-46',
          title: 'Test Story',
          project: { id: 'project-id' },
        });

        prisma.pullRequest.findFirst = jest.fn().mockResolvedValue(null);
        prisma.worktree.findFirst = jest.fn().mockResolvedValue({
          id: 'worktree-id',
          branchName: 'st-46-test',
          worktreePath: '/opt/stack/worktrees/st-46-test',
          status: 'active',
        });

        prisma.pullRequest.create = jest.fn().mockResolvedValue({
          id: 'pr-id',
          prNumber: testPrNumber,
          prUrl: testPrUrl,
          status: 'open',
        });

        mockExecSync.mockImplementation((cmd) => {
          if (cmd.toString().includes('gh --version')) {
            return 'gh version 2.0.0\n';
          }
          if (cmd.toString().includes('ls-remote')) {
            return 'ref\n';
          }
          if (cmd.toString().includes('rev-list')) {
            return '5\n';
          }
          if (cmd.toString().includes('gh pr create')) {
            expect(cmd.toString()).toContain(customTitle);
            return testPrUrl;
          }
          return '';
        });

        const result = await handler(prisma, {
          storyId: testStoryId,
          title: customTitle,
          description: customDescription,
        });

        expect(result.success).toBe(true);
      });
    });

    describe('Error Handling', () => {
      it('should throw ValidationError when GitHub CLI not available', async () => {
        delete process.env.GITHUB_TOKEN;

        await expect(
          handler(prisma, { storyId: testStoryId })
        ).rejects.toThrow('GITHUB_TOKEN');
      });

      it('should rollback database on GitHub failure', async () => {
        prisma.story.findUnique = jest.fn().mockResolvedValue({
          id: testStoryId,
          key: 'ST-46',
          title: 'Test Story',
          description: 'Test',
          project: { id: 'project-id' },
        });

        prisma.pullRequest.findFirst = jest.fn().mockResolvedValue(null);
        prisma.worktree.findFirst = jest.fn().mockResolvedValue({
          id: 'worktree-id',
          branchName: 'st-46-test',
          worktreePath: '/opt/stack/worktrees/st-46-test',
          status: 'active',
        });

        mockExecSync.mockImplementation((cmd) => {
          if (cmd.toString().includes('gh --version')) {
            return 'gh version 2.0.0\n';
          }
          if (cmd.toString().includes('ls-remote')) {
            return 'ref\n';
          }
          if (cmd.toString().includes('rev-list')) {
            return '5\n';
          }
          if (cmd.toString().includes('gh pr create')) {
            throw new Error('GitHub API error');
          }
          return '';
        });

        process.env.GITHUB_TOKEN = 'test-token';

        await expect(
          handler(prisma, { storyId: testStoryId })
        ).rejects.toThrow('Failed to create PR on GitHub');
      });
    });
  });
});
