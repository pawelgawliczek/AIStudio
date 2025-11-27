/**
 * Tests for git_create_worktree tool
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { mockReset } from 'jest-mock-extended';
import { handler, tool } from '../git_create_worktree';
import { prismaMock } from './test-setup';

// Mock modules
jest.mock('child_process');
jest.mock('fs');

const mockExecSync = execSync as jest.MockedFunction<typeof execSync>;
const mockFs = fs as jest.Mocked<typeof fs>;

describe('git_create_worktree', () => {
  const testStoryId = 'test-story-id-123';
  const testProjectId = 'test-project-id-456';
  const originalEnv = process.env;

  beforeEach(() => {
    mockReset(prismaMock);
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.SSH_CONNECTION;
    delete process.env.VIBESTUDIO_REMOTE;
    delete process.env.DOCKER_CONTAINER;

    // Default mock implementations
    mockExecSync.mockReturnValue('');
    mockFs.existsSync.mockReturnValue(false);
    mockFs.mkdirSync.mockImplementation(() => undefined);
    mockFs.symlinkSync.mockImplementation(() => undefined);
    mockFs.rmSync.mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.env = originalEnv;
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
        prismaMock.story.findUnique.mockResolvedValue(null as any);

        await expect(
          handler(prismaMock as any, { storyId: testStoryId })
        ).rejects.toThrow('not found');
      });

      it('should throw ValidationError when worktree already exists for story', async () => {
        // Mock story exists
        prismaMock.story.findUnique.mockResolvedValue({
          id: testStoryId,
          key: 'ST-1',
          title: 'Test Story',
          projectId: testProjectId,
          project: { id: testProjectId },
        } as any);

        // Mock existing worktree
        prismaMock.worktree.findFirst.mockResolvedValue({
          id: 'worktree-id',
          storyId: testStoryId,
          status: 'active',
          worktreePath: '/opt/stack/worktrees/st-1-test-story',
        } as any);

        await expect(
          handler(prismaMock as any, { storyId: testStoryId })
        ).rejects.toThrow('Worktree already exists');
      });

      it('should throw ValidationError when branch already exists', async () => {
        // Mock story exists
        prismaMock.story.findUnique.mockResolvedValue({
          id: testStoryId,
          key: 'ST-1',
          title: 'Test Story',
          projectId: testProjectId,
          project: { id: testProjectId },
        } as any);

        // Mock no existing worktree
        prismaMock.worktree.findFirst.mockResolvedValue(null as any);

        // Mock branch exists (git rev-parse succeeds)
        mockExecSync.mockImplementation((cmd) => {
          if (cmd.toString().includes('rev-parse')) {
            return 'commit-hash';
          }
          return '';
        });

        await expect(
          handler(prismaMock as any, { storyId: testStoryId })
        ).rejects.toThrow('Branch');
      });

      it('should throw ValidationError when insufficient disk space', async () => {
        // Mock story exists
        prismaMock.story.findUnique.mockResolvedValue({
          id: testStoryId,
          key: 'ST-1',
          title: 'Test Story',
          projectId: testProjectId,
          project: { id: testProjectId },
        } as any);

        prismaMock.worktree.findFirst.mockResolvedValue(null as any);

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
          handler(prismaMock as any, { storyId: testStoryId })
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

        prismaMock.story.findUnique.mockResolvedValue(story as any);
        prismaMock.worktree.findFirst.mockResolvedValue(null as any);
        prismaMock.worktree.create.mockResolvedValue({
          id: 'worktree-id',
          storyId: testStoryId,
          branchName: 'st-42-implement-user-authentication',
          worktreePath: '/opt/stack/worktrees/st-42-implement-user-authentication',
          baseBranch: 'main',
          status: 'active',
        } as any);
        prismaMock.story.update.mockResolvedValue(story as any);

        mockExecSync.mockImplementation((cmd) => {
          if (cmd.toString().includes('rev-parse')) {
            throw new Error('fatal: not found');
          }
          if (cmd.toString().includes('df -BG')) {
            return '10G\n';
          }
          return '';
        });

        const result = await handler(prismaMock as any, { storyId: testStoryId });

        expect('branchName' in result && result.branchName).toBe('st-42-implement-user-authentication');
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

        prismaMock.story.findUnique.mockResolvedValue(story as any);
        prismaMock.worktree.findFirst.mockResolvedValue(null as any);
        prismaMock.worktree.create.mockResolvedValue({
          id: 'worktree-id',
          storyId: testStoryId,
          branchName: customBranchName,
          worktreePath: `/opt/stack/worktrees/${customBranchName}`,
          baseBranch: 'main',
          status: 'active',
        } as any);
        prismaMock.story.update.mockResolvedValue(story as any);

        mockExecSync.mockImplementation((cmd) => {
          if (cmd.toString().includes('rev-parse')) {
            throw new Error('fatal: not found');
          }
          if (cmd.toString().includes('df -BG')) {
            return '10G\n';
          }
          return '';
        });

        const result = await handler(prismaMock as any, {
          storyId: testStoryId,
          branchName: customBranchName,
        });

        expect('branchName' in result && result.branchName).toBe(customBranchName);
      });

      it('should sanitize special characters in generated branch name', async () => {
        const story = {
          id: testStoryId,
          key: 'ST-99',
          title: 'Fix Bug: User@Email.com & Password!',
          projectId: testProjectId,
          project: { id: testProjectId },
        };

        prismaMock.story.findUnique.mockResolvedValue(story as any);
        prismaMock.worktree.findFirst.mockResolvedValue(null as any);
        prismaMock.worktree.create.mockResolvedValue({
          id: 'worktree-id',
          storyId: testStoryId,
          branchName: 'st-99-fix-bug-useremailcom-password',
          worktreePath: '/opt/stack/worktrees/st-99-fix-bug-useremailcom-password',
          baseBranch: 'main',
          status: 'active',
        } as any);
        prismaMock.story.update.mockResolvedValue(story as any);

        mockExecSync.mockImplementation((cmd) => {
          if (cmd.toString().includes('rev-parse')) {
            throw new Error('fatal: not found');
          }
          if (cmd.toString().includes('df -BG')) {
            return '10G\n';
          }
          return '';
        });

        const result = await handler(prismaMock as any, { storyId: testStoryId });

        // Should not contain special characters
        expect('branchName' in result && result.branchName).toBeTruthy();
        if ('branchName' in result) {
          expect(result.branchName).not.toMatch(/[@!:]/);
        }
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

        prismaMock.story.findUnique.mockResolvedValue(story as any);
        prismaMock.worktree.findFirst.mockResolvedValue(null as any);
        prismaMock.worktree.create.mockResolvedValue({
          id: 'worktree-id',
          storyId: testStoryId,
          branchName: 'st-1-test-story',
          worktreePath: '/opt/stack/worktrees/st-1-test-story',
          baseBranch: 'main',
          status: 'active',
        } as any);
        prismaMock.story.update.mockResolvedValue(story as any);

        mockExecSync.mockImplementation((cmd) => {
          if (cmd.toString().includes('rev-parse')) {
            throw new Error('fatal: not found');
          }
          if (cmd.toString().includes('df -BG')) {
            return '10G\n';
          }
          return '';
        });

        mockFs.existsSync.mockImplementation((path) => {
          // Simulate node_modules exists in main repo
          if (String(path).includes('/opt/stack/AIStudio/node_modules')) {
            return true;
          }
          return false;
        });
      });

      it('should create worktree with all required steps', async () => {
        const result = await handler(prismaMock as any, { storyId: testStoryId });

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
        expect(prismaMock.worktree.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              storyId: testStoryId,
              status: 'active',
            }),
          })
        );

        // Verify story phase was updated
        expect(prismaMock.story.update).toHaveBeenCalledWith(
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
        await handler(prismaMock as any, {
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
        await handler(prismaMock as any, { storyId: testStoryId });

        // Verify symlink was created
        expect(mockFs.symlinkSync).toHaveBeenCalledWith(
          expect.stringContaining('/opt/stack/AIStudio/node_modules'),
          expect.stringContaining('/opt/stack/worktrees'),
          'dir'
        );
      });

      it('should return worktree information', async () => {
        const result = await handler(prismaMock as any, { storyId: testStoryId });

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

        prismaMock.story.findUnique.mockResolvedValue(story as any);
        prismaMock.worktree.findFirst.mockResolvedValue(null as any);

        mockExecSync.mockImplementation((cmd) => {
          if (cmd.toString().includes('rev-parse')) {
            throw new Error('fatal: not found');
          }
          if (cmd.toString().includes('df -BG')) {
            return '10G\n';
          }
          return '';
        });

        // Simulate worktree path already exists (but NOT /.dockerenv)
        mockFs.existsSync.mockImplementation((p) => {
          if (p === '/.dockerenv') return false;
          return true; // All other paths exist (worktree path)
        });

        await expect(
          handler(prismaMock as any, { storyId: testStoryId })
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

        prismaMock.story.findUnique.mockResolvedValue(story as any);
        prismaMock.worktree.findFirst.mockResolvedValue(null as any);

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
          handler(prismaMock as any, { storyId: testStoryId })
        ).rejects.toThrow('Git command failed');
      });
    });
  });

  // ========== REMOTE DETECTION TESTS (ST-125) ==========

  describe('Remote Detection (ST-125)', () => {
    const story = {
      id: testStoryId,
      key: 'ST-42',
      title: 'Test Story for Remote',
      projectId: testProjectId,
      project: { id: testProjectId },
    };

    beforeEach(() => {
      prismaMock.story.findUnique.mockResolvedValue(story as any);
    });

    it('ST-125-R1: should return runLocally=true when SSH_CONNECTION is set', async () => {
      // ========== ARRANGE ==========
      process.env.SSH_CONNECTION = '192.168.1.1 12345 192.168.1.2 22';

      // ========== ACT ==========
      const result = await handler(prismaMock as any, { storyId: testStoryId });

      // ========== ASSERT ==========
      expect(result).toHaveProperty('runLocally', true);
      expect(result).toHaveProperty('slashCommand', '/git_create_worktree');
      expect(result).toHaveProperty('story');
      expect((result as any).story.key).toBe('ST-42');
    });

    it('ST-125-R2: should return runLocally=true when VIBESTUDIO_REMOTE is set', async () => {
      // ========== ARRANGE ==========
      process.env.VIBESTUDIO_REMOTE = 'true';

      // ========== ACT ==========
      const result = await handler(prismaMock as any, { storyId: testStoryId });

      // ========== ASSERT ==========
      expect(result).toHaveProperty('runLocally', true);
      expect(result).toHaveProperty('slashCommand', '/git_create_worktree');
    });

    it('ST-125-R3: should return runLocally=true when DOCKER_CONTAINER is set', async () => {
      // ========== ARRANGE ==========
      process.env.DOCKER_CONTAINER = 'true';

      // ========== ACT ==========
      const result = await handler(prismaMock as any, { storyId: testStoryId });

      // ========== ASSERT ==========
      expect(result).toHaveProperty('runLocally', true);
    });

    it('ST-125-R4: should return runLocally=true when /.dockerenv exists', async () => {
      // ========== ARRANGE ==========
      mockFs.existsSync.mockImplementation((path) => {
        if (path === '/.dockerenv') {
          return true;
        }
        return false;
      });

      // ========== ACT ==========
      const result = await handler(prismaMock as any, { storyId: testStoryId });

      // ========== ASSERT ==========
      expect(result).toHaveProperty('runLocally', true);
    });

    it('ST-125-R5: should include params in response for local execution', async () => {
      // ========== ARRANGE ==========
      process.env.SSH_CONNECTION = '192.168.1.1 12345 192.168.1.2 22';

      // ========== ACT ==========
      const result = await handler(prismaMock as any, {
        storyId: testStoryId,
        branchName: 'custom-branch',
        baseBranch: 'develop',
      });

      // ========== ASSERT ==========
      expect(result).toHaveProperty('params');
      expect((result as any).params.storyId).toBe(testStoryId);
      expect((result as any).params.branchName).toBe('custom-branch');
      expect((result as any).params.baseBranch).toBe('develop');
    });

    it('ST-125-R6: should include instructions for local execution', async () => {
      // ========== ARRANGE ==========
      process.env.SSH_CONNECTION = '192.168.1.1 12345 192.168.1.2 22';

      // ========== ACT ==========
      const result = await handler(prismaMock as any, { storyId: testStoryId });

      // ========== ASSERT ==========
      expect(result).toHaveProperty('instructions');
      expect((result as any).instructions).toContain('/git_create_worktree');
      expect((result as any).instructions).toContain('record_worktree_created');
    });

    it('ST-125-R7: should throw NotFoundError for invalid story even in remote mode', async () => {
      // ========== ARRANGE ==========
      process.env.SSH_CONNECTION = '192.168.1.1 12345 192.168.1.2 22';
      prismaMock.story.findUnique.mockResolvedValue(null as any);

      // ========== ACT & ASSERT ==========
      await expect(
        handler(prismaMock as any, { storyId: 'nonexistent-story' })
      ).rejects.toThrow('not found');
    });

    it('ST-125-R8: should NOT return runLocally when no remote indicators', async () => {
      // ========== ARRANGE ==========
      // No SSH_CONNECTION, VIBESTUDIO_REMOTE, DOCKER_CONTAINER, or /.dockerenv
      mockFs.existsSync.mockReturnValue(false);
      prismaMock.worktree.findFirst.mockResolvedValue(null as any);
      prismaMock.worktree.create.mockResolvedValue({
        id: 'worktree-id',
        storyId: testStoryId,
        branchName: 'st-42-test-story',
        worktreePath: '/opt/stack/worktrees/st-42-test-story',
        baseBranch: 'main',
        status: 'active',
      } as any);
      prismaMock.story.update.mockResolvedValue(story as any);
      mockExecSync.mockImplementation((cmd) => {
        if (cmd.toString().includes('rev-parse')) throw new Error('not found');
        if (cmd.toString().includes('df -BG')) return '10G\n';
        return '';
      });

      // ========== ACT ==========
      const result = await handler(prismaMock as any, { storyId: testStoryId });

      // ========== ASSERT ==========
      expect(result).not.toHaveProperty('runLocally');
      expect(result).toHaveProperty('worktreeId');
    });
  });
});
