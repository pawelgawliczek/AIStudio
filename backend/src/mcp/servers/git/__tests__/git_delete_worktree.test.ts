/**
 * Tests for git_delete_worktree tool
 */

import { PrismaClient } from '@prisma/client';
import { createTestPrismaClient } from '@/test-utils/safe-prisma-client';
import { handler, tool } from '../git_delete_worktree';
import * as gitUtils from '../git_utils';

jest.mock('../git_utils');

describe('git_delete_worktree', () => {
  let prisma: PrismaClient;
  const mockTransaction = jest.fn();

  beforeEach(() => {
    prisma = createTestPrismaClient();
    prisma.$transaction = mockTransaction as any;
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await prisma.$disconnect();
  });

  describe('Tool Definition', () => {
    it('should have correct tool name', () => {
      expect(tool.name).toBe('git_delete_worktree');
    });

    it('should require storyId and confirm parameters', () => {
      expect(tool.inputSchema.required).toContain('storyId');
      expect(tool.inputSchema.required).toContain('confirm');
    });

    it('should have optional parameters', () => {
      expect(tool.inputSchema.properties).toHaveProperty('worktreeId');
      expect(tool.inputSchema.properties).toHaveProperty('deleteBranch');
      expect(tool.inputSchema.properties).toHaveProperty('forceDelete');
      expect(tool.inputSchema.properties).toHaveProperty('preserveDatabase');
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
      },
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

    describe('Successful deletion', () => {
      it('should delete worktree with all cleanup steps', async () => {
        prisma.worktree.findFirst = jest.fn().mockResolvedValue(mockWorktree);

        // Mock transaction
        mockTransaction.mockImplementation(async (callback) => {
          const txMock = {
            worktree: {
              update: jest.fn().mockResolvedValue(mockWorktree),
            },
            story: {
              update: jest.fn().mockResolvedValue({}),
            },
          };
          return callback(txMock);
        });

        const result = await handler(prisma, {
          storyId: 'story-1',
          confirm: true,
        });

        expect(result.actions.filesystemRemoved).toBe(true);
        expect(result.actions.branchDeleted).toBe(true);
        expect(result.actions.databaseUpdated).toBe(true);
        expect(gitUtils.execGit).toHaveBeenCalledWith(
          expect.stringContaining('git worktree remove'),
          '/opt/stack/AIStudio'
        );
        expect(gitUtils.execGit).toHaveBeenCalledWith(
          expect.stringContaining('git branch -D st-1-feature'),
          '/opt/stack/AIStudio'
        );
      });

      it('should use force flag when forceDelete is true', async () => {
        prisma.worktree.findFirst = jest.fn().mockResolvedValue(mockWorktree);

        mockTransaction.mockImplementation(async (callback) => {
          const txMock = {
            worktree: {
              update: jest.fn().mockResolvedValue(mockWorktree),
            },
            story: {
              update: jest.fn().mockResolvedValue({}),
            },
          };
          return callback(txMock);
        });

        await handler(prisma, {
          storyId: 'story-1',
          confirm: true,
          forceDelete: true,
        });

        expect(gitUtils.execGit).toHaveBeenCalledWith(
          expect.stringContaining('git worktree remove --force'),
          '/opt/stack/AIStudio'
        );
      });

      it('should skip branch deletion when deleteBranch is false', async () => {
        prisma.worktree.findFirst = jest.fn().mockResolvedValue(mockWorktree);

        mockTransaction.mockImplementation(async (callback) => {
          const txMock = {
            worktree: {
              update: jest.fn().mockResolvedValue(mockWorktree),
            },
            story: {
              update: jest.fn().mockResolvedValue({}),
            },
          };
          return callback(txMock);
        });

        const result = await handler(prisma, {
          storyId: 'story-1',
          confirm: true,
          deleteBranch: false,
        });

        expect(result.actions.branchDeleted).toBe(false);
        expect(gitUtils.execGit).not.toHaveBeenCalledWith(
          expect.stringContaining('git branch -D'),
          expect.anything()
        );
      });

      it('should hard delete when preserveDatabase is false', async () => {
        prisma.worktree.findFirst = jest.fn().mockResolvedValue(mockWorktree);

        mockTransaction.mockImplementation(async (callback) => {
          const txMock = {
            worktree: {
              delete: jest.fn().mockResolvedValue(mockWorktree),
            },
            story: {
              update: jest.fn().mockResolvedValue({}),
            },
          };
          return callback(txMock);
        });

        const result = await handler(prisma, {
          storyId: 'story-1',
          confirm: true,
          preserveDatabase: false,
        });

        expect(result.actions.databaseDeleted).toBe(true);
        expect(result.actions.databaseUpdated).toBe(false);
      });

      it('should clear story currentPhase for active worktree', async () => {
        prisma.worktree.findFirst = jest.fn().mockResolvedValue(mockWorktree);

        let storyUpdateCalled = false;
        mockTransaction.mockImplementation(async (callback) => {
          const txMock = {
            worktree: {
              update: jest.fn().mockResolvedValue(mockWorktree),
            },
            story: {
              update: jest.fn().mockImplementation((params) => {
                storyUpdateCalled = true;
                expect(params.data.currentPhase).toBe(null);
                return {};
              }),
            },
          };
          return callback(txMock);
        });

        await handler(prisma, {
          storyId: 'story-1',
          confirm: true,
        });

        expect(storyUpdateCalled).toBe(true);
      });
    });

    describe('Idempotency', () => {
      it('should handle worktree already removed from filesystem', async () => {
        prisma.worktree.findFirst = jest.fn().mockResolvedValue(mockWorktree);

        const mockExecGit = gitUtils.execGit as jest.MockedFunction<typeof gitUtils.execGit>;
        mockExecGit.mockImplementation((cmd) => {
          if (cmd.includes('worktree remove')) {
            throw new Error('not found');
          }
          return '';
        });

        mockTransaction.mockImplementation(async (callback) => {
          const txMock = {
            worktree: {
              update: jest.fn().mockResolvedValue(mockWorktree),
            },
            story: {
              update: jest.fn().mockResolvedValue({}),
            },
          };
          return callback(txMock);
        });

        const result = await handler(prisma, {
          storyId: 'story-1',
          confirm: true,
        });

        expect(result.actions.filesystemRemoved).toBe(true);
        expect(result.warnings?.[0]).toContain('already removed from filesystem');
      });

      it('should handle branch already deleted', async () => {
        prisma.worktree.findFirst = jest.fn().mockResolvedValue(mockWorktree);

        const mockExecGit = gitUtils.execGit as jest.MockedFunction<typeof gitUtils.execGit>;
        mockExecGit.mockImplementation((cmd) => {
          if (cmd.includes('branch -D')) {
            throw new Error('not found');
          }
          return '';
        });

        mockTransaction.mockImplementation(async (callback) => {
          const txMock = {
            worktree: {
              update: jest.fn().mockResolvedValue(mockWorktree),
            },
            story: {
              update: jest.fn().mockResolvedValue({}),
            },
          };
          return callback(txMock);
        });

        const result = await handler(prisma, {
          storyId: 'story-1',
          confirm: true,
        });

        expect(result.actions.branchDeleted).toBe(true);
        expect(result.warnings?.[0]).toContain('already deleted');
      });
    });

    describe('Validation', () => {
      it('should require confirm parameter', async () => {
        await expect(
          handler(prisma, { storyId: 'story-1' } as any)
        ).rejects.toThrow('Missing required fields');
      });

      it('should require confirm to be true', async () => {
        await expect(
          handler(prisma, { storyId: 'story-1', confirm: false } as any)
        ).rejects.toThrow('Deletion requires explicit confirmation');
      });

      it('should validate worktree exists', async () => {
        prisma.worktree.findFirst = jest.fn().mockResolvedValue(null);

        await expect(
          handler(prisma, { storyId: 'story-1', confirm: true })
        ).rejects.toThrow('not found');
      });

      it('should validate worktree path', async () => {
        prisma.worktree.findFirst = jest.fn().mockResolvedValue({
          ...mockWorktree,
          worktreePath: '/tmp/malicious-path',
        });

        const mockValidateWorktreePath = gitUtils.validateWorktreePath as jest.MockedFunction<
          typeof gitUtils.validateWorktreePath
        >;
        mockValidateWorktreePath.mockImplementation(() => {
          throw new Error('Invalid worktree path');
        });

        await expect(
          handler(prisma, { storyId: 'story-1', confirm: true })
        ).rejects.toThrow('Invalid worktree path');
      });

      it('should throw error on uncommitted changes without force', async () => {
        prisma.worktree.findFirst = jest.fn().mockResolvedValue(mockWorktree);

        const mockExecGit = gitUtils.execGit as jest.MockedFunction<typeof gitUtils.execGit>;
        mockExecGit.mockImplementation((cmd) => {
          if (cmd.includes('worktree remove')) {
            throw new Error('uncommitted changes');
          }
          return '';
        });

        await expect(
          handler(prisma, { storyId: 'story-1', confirm: true })
        ).rejects.toThrow('Cannot delete worktree with uncommitted changes');
      });
    });

    describe('Specific worktree ID', () => {
      it('should filter by worktree ID when provided', async () => {
        prisma.worktree.findFirst = jest.fn().mockResolvedValue(mockWorktree);

        mockTransaction.mockImplementation(async (callback) => {
          const txMock = {
            worktree: {
              update: jest.fn().mockResolvedValue(mockWorktree),
            },
            story: {
              update: jest.fn().mockResolvedValue({}),
            },
          };
          return callback(txMock);
        });

        await handler(prisma, {
          storyId: 'story-1',
          worktreeId: 'wt-1',
          confirm: true,
        });

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
  });
});
