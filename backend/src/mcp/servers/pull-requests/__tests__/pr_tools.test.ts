/**
 * Integration tests for all PR tools
 */

import { execSync } from 'child_process';
import { PrismaClient } from '@prisma/client';
import { handler as closeHandler, tool as closeTool } from '../close_pull_request';
import { handler as createPrHandler, tool as createPrTool } from '../create_pull_request';
import { handler as getStatusHandler, tool as getStatusTool } from '../get_pr_status';
import { handler as mergeHandler, tool as mergeTool } from '../merge_pull_request';

// Mock child_process
jest.mock('child_process');

const mockExecSync = execSync as jest.MockedFunction<typeof execSync>;

describe('Pull Request Tools', () => {
  let prisma: PrismaClient;

  beforeEach(() => {
    prisma = new PrismaClient();
    jest.clearAllMocks();
    process.env.GITHUB_TOKEN = 'test-token';
    process.env.GITHUB_REPOSITORY = 'org/repo';
  });

  afterEach(async () => {
    await prisma.$disconnect();
  });

  describe('Tool Definitions', () => {
    it('should have correct tool names', () => {
      expect(createPrTool.name).toBe('create_pull_request');
      expect(getStatusTool.name).toBe('get_pr_status');
      expect(mergeTool.name).toBe('merge_pull_request');
      expect(closeTool.name).toBe('close_pull_request');
    });

    it('should have correct categories', () => {
      expect(createPrTool.inputSchema.type).toBe('object');
      expect(getStatusTool.inputSchema.type).toBe('object');
      expect(mergeTool.inputSchema.type).toBe('object');
      expect(closeTool.inputSchema.type).toBe('object');
    });
  });

  describe('get_pr_status', () => {
    it('should get PR status by story ID', async () => {
      const testStoryId = 'test-story-123';
      const testPrNumber = 456;

      prisma.pullRequest.findFirst = jest.fn().mockResolvedValue({
        id: 'pr-id',
        prNumber: testPrNumber,
        prUrl: 'https://github.com/org/repo/pull/456',
      });

      mockExecSync.mockImplementation((cmd) => {
        if (cmd.toString().includes('gh --version')) {
          return 'gh version 2.0.0\n';
        }
        if (cmd.toString().includes('gh pr view')) {
          return JSON.stringify({
            number: testPrNumber,
            title: 'Test PR',
            state: 'OPEN',
            mergeable: 'MERGEABLE',
            statusCheckRollup: [
              { name: 'CI', status: 'SUCCESS', conclusion: 'PASSED' },
            ],
            reviews: [
              {
                author: { login: 'reviewer1' },
                state: 'APPROVED',
                submittedAt: '2025-11-19T10:00:00Z',
              },
            ],
          });
        }
        return '';
      });

      const result = await getStatusHandler(prisma, { storyId: testStoryId });

      expect(result.success).toBe(true);
      expect(result.prNumber).toBe(testPrNumber);
      expect(result.checksStatus).toBe('PASSING');
      expect(result.approvals).toHaveLength(1);
      expect(result.mergeable).toBe(true);
    });

    it('should detect failing checks', async () => {
      prisma.pullRequest.findFirst = jest.fn().mockResolvedValue({
        id: 'pr-id',
        prNumber: 456,
        prUrl: 'https://github.com/org/repo/pull/456',
      });

      mockExecSync.mockImplementation((cmd) => {
        if (cmd.toString().includes('gh --version')) {
          return 'gh version 2.0.0\n';
        }
        if (cmd.toString().includes('gh pr view')) {
          return JSON.stringify({
            number: 456,
            title: 'Test PR',
            state: 'OPEN',
            mergeable: 'MERGEABLE',
            statusCheckRollup: [
              { name: 'CI', status: 'FAILED', conclusion: 'FAILURE' },
            ],
            reviews: [],
          });
        }
        return '';
      });

      const result = await getStatusHandler(prisma, { storyId: 'test-story' });

      expect(result.checksStatus).toBe('FAILING');
      expect(result.ciChecks[0].status).toBe('FAILED');
    });
  });

  describe('merge_pull_request', () => {
    it('should merge PR with valid approvals and checks', async () => {
      const testStoryId = 'test-story-123';
      const testPrNumber = 456;

      prisma.pullRequest.findFirst = jest.fn().mockResolvedValue({
        id: 'pr-id',
        prNumber: testPrNumber,
        prUrl: 'https://github.com/org/repo/pull/456',
        status: 'approved',
      });

      prisma.pullRequest.update = jest.fn().mockResolvedValue({
        id: 'pr-id',
        status: 'merged',
      });

      mockExecSync.mockImplementation((cmd) => {
        if (cmd.toString().includes('gh --version')) {
          return 'gh version 2.0.0\n';
        }
        if (cmd.toString().includes('gh pr view')) {
          return JSON.stringify({
            reviews: [{ state: 'APPROVED' }],
            statusCheckRollup: [{ conclusion: 'SUCCESS' }],
            mergeable: 'MERGEABLE',
          });
        }
        if (cmd.toString().includes('gh pr merge')) {
          return 'Merged pull request #456 (abc1234567890)\n';
        }
        return '';
      });

      const result = await mergeHandler(prisma, {
        storyId: testStoryId,
        mergeMethod: 'squash',
      });

      expect(result.success).toBe(true);
      expect(result.prNumber).toBe(testPrNumber);
      expect(result.branchDeleted).toBe(true);
    });

    it('should fail merge when approval required but missing', async () => {
      prisma.pullRequest.findFirst = jest.fn().mockResolvedValue({
        id: 'pr-id',
        prNumber: 456,
        status: 'open',
      });

      mockExecSync.mockImplementation((cmd) => {
        if (cmd.toString().includes('gh --version')) {
          return 'gh version 2.0.0\n';
        }
        if (cmd.toString().includes('gh pr view')) {
          return JSON.stringify({
            reviews: [],
            statusCheckRollup: [{ conclusion: 'SUCCESS' }],
            mergeable: 'MERGEABLE',
          });
        }
        return '';
      });

      await expect(
        mergeHandler(prisma, { storyId: 'test-story', requireApproval: true })
      ).rejects.toThrow('not approved');
    });

    it('should fail merge when checks failing', async () => {
      prisma.pullRequest.findFirst = jest.fn().mockResolvedValue({
        id: 'pr-id',
        prNumber: 456,
        status: 'open',
      });

      mockExecSync.mockImplementation((cmd) => {
        if (cmd.toString().includes('gh --version')) {
          return 'gh version 2.0.0\n';
        }
        if (cmd.toString().includes('gh pr view')) {
          return JSON.stringify({
            reviews: [{ state: 'APPROVED' }],
            statusCheckRollup: [
              { name: 'CI', conclusion: 'FAILURE', status: 'FAILED' },
            ],
            mergeable: 'MERGEABLE',
          });
        }
        return '';
      });

      await expect(
        mergeHandler(prisma, { storyId: 'test-story', requireChecks: true })
      ).rejects.toThrow('checks failing');
    });

    it('should fail merge when conflicts detected', async () => {
      prisma.pullRequest.findFirst = jest.fn().mockResolvedValue({
        id: 'pr-id',
        prNumber: 456,
        status: 'open',
      });

      mockExecSync.mockImplementation((cmd) => {
        if (cmd.toString().includes('gh --version')) {
          return 'gh version 2.0.0\n';
        }
        if (cmd.toString().includes('gh pr view')) {
          return JSON.stringify({
            reviews: [{ state: 'APPROVED' }],
            statusCheckRollup: [{ conclusion: 'SUCCESS' }],
            mergeable: 'CONFLICTING',
          });
        }
        return '';
      });

      await expect(
        mergeHandler(prisma, { storyId: 'test-story' })
      ).rejects.toThrow('conflicts');
    });
  });

  describe('close_pull_request', () => {
    it('should close PR successfully', async () => {
      const testStoryId = 'test-story-123';
      const testPrNumber = 456;

      prisma.pullRequest.findFirst = jest.fn().mockResolvedValue({
        id: 'pr-id',
        prNumber: testPrNumber,
        prUrl: 'https://github.com/org/repo/pull/456',
        status: 'open',
        description: 'Original description',
      });

      prisma.pullRequest.update = jest.fn().mockResolvedValue({
        id: 'pr-id',
        status: 'closed',
      });

      mockExecSync.mockImplementation((cmd) => {
        if (cmd.toString().includes('gh --version')) {
          return 'gh version 2.0.0\n';
        }
        if (cmd.toString().includes('gh pr close')) {
          return 'Closed pull request #456\n';
        }
        return '';
      });

      const result = await closeHandler(prisma, {
        storyId: testStoryId,
        reason: 'Story cancelled',
      });

      expect(result.success).toBe(true);
      expect(result.prNumber).toBe(testPrNumber);
      expect(result.reason).toBe('Story cancelled');
    });

    it('should add comment before closing if provided', async () => {
      prisma.pullRequest.findFirst = jest.fn().mockResolvedValue({
        id: 'pr-id',
        prNumber: 456,
        prUrl: 'https://github.com/org/repo/pull/456',
        status: 'open',
      });

      prisma.pullRequest.update = jest.fn().mockResolvedValue({
        id: 'pr-id',
        status: 'closed',
      });

      let commentAdded = false;
      mockExecSync.mockImplementation((cmd) => {
        if (cmd.toString().includes('gh --version')) {
          return 'gh version 2.0.0\n';
        }
        if (cmd.toString().includes('gh pr comment')) {
          commentAdded = true;
          return 'Comment added\n';
        }
        if (cmd.toString().includes('gh pr close')) {
          return 'Closed pull request #456\n';
        }
        return '';
      });

      await closeHandler(prisma, {
        storyId: 'test-story',
        comment: 'Closing due to requirements change',
      });

      expect(commentAdded).toBe(true);
    });

    it('should fail when trying to close already merged PR', async () => {
      prisma.pullRequest.findFirst = jest.fn().mockResolvedValue({
        id: 'pr-id',
        prNumber: 456,
        status: 'merged',
      });

      mockExecSync.mockImplementation((cmd) => {
        if (cmd.toString().includes('gh --version')) {
          return 'gh version 2.0.0\n';
        }
        return '';
      });

      await expect(
        closeHandler(prisma, { storyId: 'test-story' })
      ).rejects.toThrow('already merged');
    });
  });

  describe('Error Handling', () => {
    it('should throw ValidationError when GitHub CLI not available', async () => {
      delete process.env.GITHUB_TOKEN;

      await expect(
        getStatusHandler(prisma, { storyId: 'test-story' })
      ).rejects.toThrow('GITHUB_TOKEN');
    });

    it('should throw NotFoundError when PR not found for story', async () => {
      prisma.pullRequest.findFirst = jest.fn().mockResolvedValue(null);

      mockExecSync.mockImplementation((cmd) => {
        if (cmd.toString().includes('gh --version')) {
          return 'gh version 2.0.0\n';
        }
        return '';
      });

      process.env.GITHUB_TOKEN = 'test-token';

      await expect(
        getStatusHandler(prisma, { storyId: 'test-story' })
      ).rejects.toThrow('PullRequest');
    });
  });
});
