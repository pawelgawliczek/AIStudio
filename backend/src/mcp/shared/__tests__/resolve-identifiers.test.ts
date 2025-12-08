/**
 * Tests for resolve-identifiers shared utilities
 * ST-187: MCP Tool Optimization & Step Commands
 */

import { PrismaClient } from '@prisma/client';
import {
  isStoryKey,
  isUUID,
  resolveStory,
  resolveRunId,
  resolveProject,
} from '../resolve-identifiers';

describe('resolve-identifiers utilities', () => {
  let mockPrisma: jest.Mocked<PrismaClient>;

  beforeEach(() => {
    mockPrisma = {
      story: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
      },
      workflowRun: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
      },
      project: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
      },
    } as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('isStoryKey', () => {
    it('should recognize valid story keys', () => {
      expect(isStoryKey('ST-1')).toBe(true);
      expect(isStoryKey('ST-123')).toBe(true);
      expect(isStoryKey('ST-9999')).toBe(true);
      expect(isStoryKey('EP-1')).toBe(true);
      expect(isStoryKey('STORY-1')).toBe(true);
    });

    it('should reject invalid story keys', () => {
      expect(isStoryKey('st-123')).toBe(false); // lowercase
      expect(isStoryKey('ST123')).toBe(false); // no hyphen
      expect(isStoryKey('123')).toBe(false); // number only
      expect(isStoryKey('ST-')).toBe(false); // no number
      expect(isStoryKey('-123')).toBe(false); // no prefix
      expect(isStoryKey('')).toBe(false);
    });
  });

  describe('isUUID', () => {
    it('should recognize valid UUIDs (v4 format)', () => {
      // v4 UUIDs: 4 in 3rd group, 8/9/a/b in 4th group
      expect(isUUID('123e4567-e89b-4d3a-a456-426614174000')).toBe(true);
      expect(isUUID('00000000-0000-4000-8000-000000000000')).toBe(true);
      expect(isUUID('a1b2c3d4-e5f6-4890-abcd-ef1234567890')).toBe(true);
    });

    it('should reject invalid UUIDs', () => {
      expect(isUUID('not-a-uuid')).toBe(false);
      expect(isUUID('123e4567-e89b-12d3-a456')).toBe(false); // too short
      expect(isUUID('')).toBe(false);
      expect(isUUID('ST-123')).toBe(false);
      // Not v4 format (wrong version number)
      expect(isUUID('123e4567-e89b-12d3-a456-426614174000')).toBe(false);
    });
  });

  describe('resolveStory', () => {
    it('should resolve story by key', async () => {
      const mockStory = {
        id: 'story-uuid',
        key: 'ST-123',
        title: 'Test Story',
        status: 'planning',
        projectId: 'project-uuid',
      };
      (mockPrisma.story.findFirst as jest.Mock).mockResolvedValue(mockStory);

      const result = await resolveStory(mockPrisma, 'ST-123');

      expect(result).toEqual(mockStory);
      expect(mockPrisma.story.findFirst).toHaveBeenCalled();
    });

    it('should resolve story by UUID', async () => {
      const uuid = '123e4567-e89b-4d3a-a456-426614174000'; // Valid v4 UUID
      const mockStory = {
        id: uuid,
        key: 'ST-123',
        title: 'Test Story',
        status: 'planning',
        projectId: 'project-uuid',
      };
      (mockPrisma.story.findUnique as jest.Mock).mockResolvedValue(mockStory);

      const result = await resolveStory(mockPrisma, uuid);

      expect(result).toEqual(mockStory);
      expect(mockPrisma.story.findUnique).toHaveBeenCalled();
    });

    it('should return null for story not found', async () => {
      (mockPrisma.story.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await resolveStory(mockPrisma, 'ST-999');

      expect(result).toBeNull();
    });

    it('should throw error for invalid identifier format', async () => {
      await expect(resolveStory(mockPrisma, 'invalid-format')).rejects.toThrow(
        'Invalid story identifier'
      );
    });
  });

  describe('resolveRunId', () => {
    it('should return runId directly if provided', async () => {
      const mockRun = {
        id: 'run-uuid',
        workflowId: 'workflow-uuid',
        status: 'running',
        storyId: 'story-uuid',
        story: null,
      };
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);

      const result = await resolveRunId(mockPrisma, { runId: 'run-uuid' });

      expect(result.id).toBe('run-uuid');
      expect(mockPrisma.workflowRun.findUnique).toHaveBeenCalled();
    });

    it('should resolve story key to active run', async () => {
      const mockStory = {
        id: 'story-uuid',
        key: 'ST-123',
        title: 'Test Story',
        status: 'planning',
        projectId: 'project-uuid',
      };
      const mockRun = {
        id: 'run-uuid',
        workflowId: 'workflow-uuid',
        status: 'running',
        storyId: 'story-uuid',
      };
      (mockPrisma.story.findFirst as jest.Mock).mockResolvedValue(mockStory);
      (mockPrisma.workflowRun.findFirst as jest.Mock).mockResolvedValue(mockRun);

      const result = await resolveRunId(mockPrisma, { story: 'ST-123' });

      expect(result.id).toBe('run-uuid');
      expect(result.story?.key).toBe('ST-123');
    });

    it('should throw error when no story or runId provided', async () => {
      await expect(resolveRunId(mockPrisma, {})).rejects.toThrow(
        'Either story or runId is required'
      );
    });

    it('should throw error when no active run for story', async () => {
      const mockStory = {
        id: 'story-uuid',
        key: 'ST-123',
        title: 'Test Story',
        status: 'planning',
        projectId: 'project-uuid',
      };
      (mockPrisma.story.findFirst as jest.Mock).mockResolvedValue(mockStory);
      (mockPrisma.workflowRun.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(resolveRunId(mockPrisma, { story: 'ST-123' })).rejects.toThrow(
        'No active workflow run found for story ST-123'
      );
    });

    it('should throw error when runId not found', async () => {
      (mockPrisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(resolveRunId(mockPrisma, { runId: 'unknown' })).rejects.toThrow(
        'WorkflowRun not found'
      );
    });
  });

  describe('resolveProject', () => {
    it('should resolve project by name', async () => {
      const mockProject = {
        id: 'project-uuid',
        name: 'My Project',
      };
      (mockPrisma.project.findFirst as jest.Mock).mockResolvedValue(mockProject);

      const result = await resolveProject(mockPrisma, 'My Project');

      expect(result).toEqual(mockProject);
      expect(mockPrisma.project.findFirst).toHaveBeenCalled();
    });

    it('should resolve project by UUID', async () => {
      const uuid = '123e4567-e89b-4d3a-a456-426614174000'; // Valid v4 UUID
      const mockProject = {
        id: uuid,
        name: 'My Project',
      };
      (mockPrisma.project.findUnique as jest.Mock).mockResolvedValue(mockProject);

      const result = await resolveProject(mockPrisma, uuid);

      expect(result).toEqual(mockProject);
      expect(mockPrisma.project.findUnique).toHaveBeenCalled();
    });

    it('should return null for project not found', async () => {
      (mockPrisma.project.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await resolveProject(mockPrisma, 'Unknown');

      expect(result).toBeNull();
    });
  });
});
