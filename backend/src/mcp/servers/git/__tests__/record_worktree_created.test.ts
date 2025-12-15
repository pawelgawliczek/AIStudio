/**
 * Tests for record_worktree_created tool (ST-125)
 *
 * This tool records a worktree in the database after local creation.
 */

import * as os from 'os';
import { mockReset } from 'jest-mock-extended';
import { handler, tool, metadata } from '../record_worktree_created';
import { prismaMock } from './test-setup';

// Mock os module
jest.mock('os');
const mockOs = os as jest.Mocked<typeof os>;

describe('record_worktree_created', () => {
  const testStoryId = 'test-story-id-123';
  const testProjectId = 'test-project-id-456';

  beforeEach(() => {
    mockReset(prismaMock);
    jest.clearAllMocks();
    mockOs.hostname.mockReturnValue('test-hostname');
  });

  afterEach(() => {
    // No cleanup needed with mocks
  });

  // ========== TOOL DEFINITION TESTS ==========

  describe('Tool Definition', () => {
    it('should have correct tool name', () => {
      expect(tool.name).toBe('record_worktree_created');
    });

    it('should have correct description mentioning local creation', () => {
      expect(tool.description).toContain('locally-created');
      expect(tool.description).toContain('worktree');
    });

    it('should have required parameters', () => {
      expect(tool.inputSchema.required).toContain('storyId');
      expect(tool.inputSchema.required).toContain('branchName');
      expect(tool.inputSchema.required).toContain('worktreePath');
    });

    it('should have optional parameters', () => {
      expect(tool.inputSchema.properties).toHaveProperty('baseBranch');
      expect(tool.inputSchema.properties).toHaveProperty('hostName');
    });

    it('should have correct metadata', () => {
      expect(metadata.category).toBe('git');
      expect(metadata.tags).toContain('local');
      expect(metadata.since).toBe('ST-125');
    });
  });

  // ========== VALIDATION TESTS ==========

  describe('Validation', () => {
    it('ST-125-V1: should throw error when storyId is missing', async () => {
      await expect(
        handler(prismaMock as any, {
          branchName: 'test-branch',
          worktreePath: '/path/to/worktree',
        } as any)
      ).rejects.toThrow();
    });

    it('ST-125-V2: should throw error when branchName is missing', async () => {
      await expect(
        handler(prismaMock as any, {
          storyId: testStoryId,
          worktreePath: '/path/to/worktree',
        } as any)
      ).rejects.toThrow();
    });

    it('ST-125-V3: should throw error when worktreePath is missing', async () => {
      await expect(
        handler(prismaMock as any, {
          storyId: testStoryId,
          branchName: 'test-branch',
        } as any)
      ).rejects.toThrow();
    });

    it('ST-125-V4: should throw NotFoundError when story does not exist', async () => {
      prismaMock.story.findUnique.mockResolvedValue(null);

      await expect(
        handler(prismaMock as any, {
          storyId: testStoryId,
          branchName: 'test-branch',
          worktreePath: '/path/to/worktree',
        })
      ).rejects.toThrow('not found');
    });

    it('ST-125-V5: should throw ValidationError when worktree already exists', async () => {
      prismaMock.story.findUnique.mockResolvedValue({
        id: testStoryId,
        key: 'ST-1',
        title: 'Test Story',
      } as any);

      prismaMock.worktree.findFirst.mockResolvedValue({
        id: 'existing-worktree',
        storyId: testStoryId,
        worktreePath: '/existing/path',
        status: 'active',
      } as any);

      await expect(
        handler(prismaMock as any, {
          storyId: testStoryId,
          branchName: 'test-branch',
          worktreePath: '/path/to/worktree',
        })
      ).rejects.toThrow('already exists');
    });
  });

  // ========== SUCCESSFUL CREATION TESTS ==========

  describe('Successful Creation', () => {
    const story = {
      id: testStoryId,
      key: 'ST-42',
      title: 'Test Story',
      projectId: testProjectId,
    };

    beforeEach(() => {
      prismaMock.story.findUnique.mockResolvedValue(story as any);
      prismaMock.worktree.findFirst.mockResolvedValue(null);
      prismaMock.worktree.create.mockResolvedValue({
        id: 'new-worktree-id',
        storyId: testStoryId,
        branchName: 'st-42-test-branch',
        worktreePath: '/path/to/worktree',
        baseBranch: 'main',
        status: 'active',
        hostType: 'local',
        hostName: 'test-hostname',
      } as any);
      prismaMock.story.update.mockResolvedValue(story as any);
    });

    it('ST-125-C1: should create worktree with hostType=local', async () => {
      const result = await handler(prismaMock as any, {
        storyId: testStoryId,
        branchName: 'st-42-test-branch',
        worktreePath: '/path/to/worktree',
      });

      expect(prismaMock.worktree.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            hostType: 'local',
          }),
        })
      );

      expect(result.hostType).toBe('local');
    });

    it('ST-125-C2: should auto-detect hostname when not provided', async () => {
      mockOs.hostname.mockReturnValue('my-macbook');

      await handler(prismaMock as any, {
        storyId: testStoryId,
        branchName: 'st-42-test-branch',
        worktreePath: '/path/to/worktree',
      });

      expect(prismaMock.worktree.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            hostName: 'my-macbook',
          }),
        })
      );
    });

    it('ST-125-C3: should use provided hostname', async () => {
      await handler(prismaMock as any, {
        storyId: testStoryId,
        branchName: 'st-42-test-branch',
        worktreePath: '/path/to/worktree',
        hostName: 'custom-host',
      });

      expect(prismaMock.worktree.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            hostName: 'custom-host',
          }),
        })
      );
    });

    it('ST-125-C4: should use default baseBranch when not provided', async () => {
      await handler(prismaMock as any, {
        storyId: testStoryId,
        branchName: 'st-42-test-branch',
        worktreePath: '/path/to/worktree',
      });

      expect(prismaMock.worktree.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            baseBranch: 'main',
          }),
        })
      );
    });

    it('ST-125-C5: should use provided baseBranch', async () => {
      await handler(prismaMock as any, {
        storyId: testStoryId,
        branchName: 'st-42-test-branch',
        worktreePath: '/path/to/worktree',
        baseBranch: 'develop',
      });

      expect(prismaMock.worktree.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            baseBranch: 'develop',
          }),
        })
      );
    });

    it('ST-125-C6: should update story phase to implementation', async () => {
      await handler(prismaMock as any, {
        storyId: testStoryId,
        branchName: 'st-42-test-branch',
        worktreePath: '/path/to/worktree',
      });

      expect(prismaMock.story.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: testStoryId },
          data: { currentPhase: 'implementation' },
        })
      );
    });

    it('ST-125-C7: should return all required fields', async () => {
      const result = await handler(prismaMock as any, {
        storyId: testStoryId,
        branchName: 'st-42-test-branch',
        worktreePath: '/path/to/worktree',
      });

      expect(result).toHaveProperty('worktreeId');
      expect(result).toHaveProperty('storyId', testStoryId);
      expect(result).toHaveProperty('branchName', 'st-42-test-branch');
      expect(result).toHaveProperty('worktreePath', '/path/to/worktree');
      expect(result).toHaveProperty('baseBranch', 'main');
      expect(result).toHaveProperty('hostType', 'local');
      expect(result).toHaveProperty('hostName');
      expect(result).toHaveProperty('message');
    });

    it('ST-125-C8: should include story key in success message', async () => {
      const result = await handler(prismaMock as any, {
        storyId: testStoryId,
        branchName: 'st-42-test-branch',
        worktreePath: '/path/to/worktree',
      });

      expect(result.message).toContain('ST-42');
      expect(result.message).toContain('Successfully');
    });
  });

  // ========== WORKTREE STATUS TESTS ==========

  describe('Worktree Status Handling', () => {
    const story = {
      id: testStoryId,
      key: 'ST-42',
      title: 'Test Story',
    };

    beforeEach(() => {
      prismaMock.story.findUnique.mockResolvedValue(story as any);
      prismaMock.worktree.create.mockResolvedValue({
        id: 'new-worktree-id',
        storyId: testStoryId,
        branchName: 'st-42-test-branch',
        worktreePath: '/path/to/worktree',
        baseBranch: 'main',
        status: 'active',
        hostType: 'local',
        hostName: 'test-hostname',
      } as any);
      prismaMock.story.update.mockResolvedValue(story as any);
    });

    it('ST-125-S1: should allow creation when existing worktree has status=removed', async () => {
      prismaMock.worktree.findFirst.mockResolvedValue(null); // Only active/idle

      const result = await handler(prismaMock as any, {
        storyId: testStoryId,
        branchName: 'st-42-test-branch',
        worktreePath: '/path/to/worktree',
      });

      expect(result).toHaveProperty('worktreeId');
    });

    it('ST-125-S2: should block creation when worktree is active', async () => {
      prismaMock.worktree.findFirst.mockResolvedValue({
        id: 'existing',
        status: 'active',
        worktreePath: '/existing/path',
      } as any);

      await expect(
        handler(prismaMock as any, {
          storyId: testStoryId,
          branchName: 'st-42-test-branch',
          worktreePath: '/path/to/worktree',
        })
      ).rejects.toThrow('already exists');
    });

    it('ST-125-S3: should block creation when worktree is idle', async () => {
      prismaMock.worktree.findFirst.mockResolvedValue({
        id: 'existing',
        status: 'idle',
        worktreePath: '/existing/path',
      } as any);

      await expect(
        handler(prismaMock as any, {
          storyId: testStoryId,
          branchName: 'st-42-test-branch',
          worktreePath: '/path/to/worktree',
        })
      ).rejects.toThrow('already exists');
    });
  });
});
