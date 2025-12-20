import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../prisma/prisma.service';
import { ArtifactUploadItem } from '../../types';
import { ArtifactHandler } from '../artifact.handler';

describe('ArtifactHandler - handleArtifactUpload', () => {
  let handler: ArtifactHandler;

  const mockPrismaService = {
    story: {
      findFirst: jest.fn(),
    },
    artifactDefinition: {
      findFirst: jest.fn(),
    },
    artifact: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockFrontendServer = {
    emit: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArtifactHandler,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    handler = module.get<ArtifactHandler>(ArtifactHandler);

    // Set the frontend server
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    handler.setFrontendServer(mockFrontendServer as any);

    // Suppress logger output during tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('successful upload', () => {
    it('should create new artifact and send success ACK', async () => {
      const item: ArtifactUploadItem = {
        queueId: 1,
        storyKey: 'ST-123',
        artifactKey: 'THE_PLAN',
        filePath: 'docs/ST-123/THE_PLAN.md',
        content: '# Test Content',
        contentType: 'text/markdown',
        timestamp: Date.now(),
      };

      const mockStory = {
        id: 'story-uuid',
        key: 'ST-123',
        projectId: 'project-uuid',
        project: { id: 'project-uuid' },
      };

      const mockDefinition = {
        id: 'definition-uuid',
        key: 'THE_PLAN',
        workflowId: 'workflow-uuid',
      };

      const mockArtifact = {
        id: 'artifact-uuid',
        size: 15,
        currentVersion: 1,
        updatedAt: new Date(),
      };

      mockPrismaService.story.findFirst.mockResolvedValue(mockStory);
      mockPrismaService.artifactDefinition.findFirst.mockResolvedValue(mockDefinition);
      mockPrismaService.artifact.findFirst.mockResolvedValueOnce(null); // No duplicate by hash
      mockPrismaService.artifact.findFirst.mockResolvedValueOnce(null); // No existing by definition
      mockPrismaService.artifact.create.mockResolvedValue(mockArtifact);

      const callback = jest.fn();
      await handler.handleArtifactUpload(item, callback);

      expect(mockPrismaService.story.findFirst).toHaveBeenCalledWith({
        where: { key: 'ST-123' },
        select: { id: true, projectId: true },
      });
      expect(mockPrismaService.artifactDefinition.findFirst).toHaveBeenCalledWith({
        where: {
          key: 'THE_PLAN',
          workflow: { projectId: 'project-uuid' },
        },
      });
      expect(mockPrismaService.artifact.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          definitionId: 'definition-uuid',
          storyId: 'story-uuid',
          content: '# Test Content',
          contentType: 'text/markdown',
          contentPreview: '# Test Content',
          size: 14,
          currentVersion: 1,
        }),
      });
      expect(callback).toHaveBeenCalledWith({
        success: true,
        id: 1,
      });
    });

    it('should broadcast artifact:updated event on successful upload', async () => {
      const item: ArtifactUploadItem = {
        queueId: 2,
        storyKey: 'ST-456',
        artifactKey: 'ANALYSIS',
        filePath: 'docs/ST-456/ANALYSIS.md',
        content: '# Analysis Content',
        contentType: 'text/markdown',
        timestamp: Date.now(),
      };

      const mockStory = {
        id: 'story-uuid-2',
        key: 'ST-456',
        projectId: 'project-uuid',
        project: { id: 'project-uuid' },
      };

      const mockDefinition = {
        id: 'definition-uuid-2',
        key: 'ANALYSIS',
      };

      const mockArtifact = {
        id: 'artifact-uuid-2',
        currentVersion: 1,
        updatedAt: new Date(),
      };

      mockPrismaService.story.findFirst.mockResolvedValue(mockStory);
      mockPrismaService.artifactDefinition.findFirst.mockResolvedValue(mockDefinition);
      mockPrismaService.artifact.findFirst.mockResolvedValueOnce(null);
      mockPrismaService.artifact.findFirst.mockResolvedValueOnce(null);
      mockPrismaService.artifact.create.mockResolvedValue(mockArtifact);

      const callback = jest.fn();
      await handler.handleArtifactUpload(item, callback);

      expect(mockFrontendServer.emit).toHaveBeenCalledWith('artifact:updated', {
        artifactId: 'artifact-uuid-2',
        storyId: 'story-uuid-2',
        epicId: null,
        storyKey: 'ST-456',
        epicKey: undefined,
        artifactKey: 'ANALYSIS',
        version: 1,
        timestamp: mockArtifact.updatedAt,
      });
    });

    it('should update existing artifact when content changes', async () => {
      const item: ArtifactUploadItem = {
        queueId: 3,
        storyKey: 'ST-789',
        artifactKey: 'THE_PLAN',
        filePath: 'docs/ST-789/THE_PLAN.md',
        content: '# Updated Plan',
        contentType: 'text/markdown',
        timestamp: Date.now(),
      };

      const mockStory = {
        id: 'story-uuid-3',
        key: 'ST-789',
        projectId: 'project-uuid',
        project: { id: 'project-uuid' },
      };

      const mockDefinition = {
        id: 'definition-uuid-3',
        key: 'THE_PLAN',
      };

      const existingArtifact = {
        id: 'existing-artifact-uuid',
        currentVersion: 2,
      };

      const updatedArtifact = {
        id: 'existing-artifact-uuid',
        currentVersion: 3,
        updatedAt: new Date(),
      };

      mockPrismaService.story.findFirst.mockResolvedValue(mockStory);
      mockPrismaService.artifactDefinition.findFirst.mockResolvedValue(mockDefinition);
      mockPrismaService.artifact.findFirst.mockResolvedValueOnce(null); // No duplicate by hash
      mockPrismaService.artifact.findFirst.mockResolvedValueOnce(existingArtifact); // Existing by definition
      mockPrismaService.artifact.update.mockResolvedValue(updatedArtifact);

      const callback = jest.fn();
      await handler.handleArtifactUpload(item, callback);

      expect(mockPrismaService.artifact.update).toHaveBeenCalledWith({
        where: { id: 'existing-artifact-uuid' },
        data: expect.objectContaining({
          content: '# Updated Plan',
          contentType: 'text/markdown',
          contentPreview: '# Updated Plan',
          size: 14,
          currentVersion: 3,
        }),
      });
      expect(callback).toHaveBeenCalledWith({
        success: true,
        id: 3,
      });
    });
  });

  describe('duplicate detection', () => {
    it('should detect duplicate content by SHA256 hash', async () => {
      const item: ArtifactUploadItem = {
        queueId: 4,
        storyKey: 'ST-999',
        artifactKey: 'THE_PLAN',
        filePath: 'docs/ST-999/THE_PLAN.md',
        content: '# Duplicate Content',
        contentType: 'text/markdown',
        timestamp: Date.now(),
      };

      const mockStory = {
        id: 'story-uuid-4',
        key: 'ST-999',
        projectId: 'project-uuid',
        project: { id: 'project-uuid' },
      };

      const mockDefinition = {
        id: 'definition-uuid-4',
        key: 'THE_PLAN',
      };

      const existingArtifact = {
        id: 'existing-duplicate-uuid',
        currentVersion: 1,
      };

      mockPrismaService.story.findFirst.mockResolvedValue(mockStory);
      mockPrismaService.artifactDefinition.findFirst.mockResolvedValue(mockDefinition);
      mockPrismaService.artifact.findFirst.mockResolvedValueOnce(existingArtifact); // Found duplicate by hash

      const callback = jest.fn();
      await handler.handleArtifactUpload(item, callback);

      expect(mockPrismaService.artifact.create).not.toHaveBeenCalled();
      expect(mockPrismaService.artifact.update).not.toHaveBeenCalled();
      expect(callback).toHaveBeenCalledWith({
        success: true,
        id: 4,
        isDuplicate: true,
      });
    });

    it('should not broadcast event for duplicate content', async () => {
      const item: ArtifactUploadItem = {
        queueId: 5,
        storyKey: 'ST-111',
        artifactKey: 'ANALYSIS',
        filePath: 'docs/ST-111/ANALYSIS.md',
        content: '# Same Content',
        contentType: 'text/markdown',
        timestamp: Date.now(),
      };

      const mockStory = {
        id: 'story-uuid-5',
        key: 'ST-111',
        projectId: 'project-uuid',
        project: { id: 'project-uuid' },
      };

      const mockDefinition = {
        id: 'definition-uuid-5',
        key: 'ANALYSIS',
      };

      mockPrismaService.story.findFirst.mockResolvedValue(mockStory);
      mockPrismaService.artifactDefinition.findFirst.mockResolvedValue(mockDefinition);
      mockPrismaService.artifact.findFirst.mockResolvedValueOnce({ id: 'dup-uuid' });

      const callback = jest.fn();
      await handler.handleArtifactUpload(item, callback);

      expect(mockFrontendServer.emit).not.toHaveBeenCalled();
    });
  });

  describe('error handling - story not found', () => {
    it('should send error ACK when story key does not exist', async () => {
      const item: ArtifactUploadItem = {
        queueId: 6,
        storyKey: 'ST-NONEXISTENT',
        artifactKey: 'THE_PLAN',
        filePath: 'docs/ST-NONEXISTENT/THE_PLAN.md',
        content: '# Content',
        contentType: 'text/markdown',
        timestamp: Date.now(),
      };

      mockPrismaService.story.findFirst.mockResolvedValue(null);

      const callback = jest.fn();
      await handler.handleArtifactUpload(item, callback);

      // ST-347: Error now includes the key for debugging
      expect(callback).toHaveBeenCalledWith({
        success: false,
        id: 6,
        error: 'Story not found: ST-NONEXISTENT',
      });
    });
  });

  describe('error handling - definition not found', () => {
    it('should send error ACK when artifact definition key does not exist', async () => {
      const item: ArtifactUploadItem = {
        queueId: 7,
        storyKey: 'ST-222',
        artifactKey: 'UNKNOWN_ARTIFACT',
        filePath: 'docs/ST-222/UNKNOWN.md',
        content: '# Content',
        contentType: 'text/markdown',
        timestamp: Date.now(),
      };

      const mockStory = {
        id: 'story-uuid-6',
        key: 'ST-222',
        projectId: 'project-uuid',
        project: { id: 'project-uuid' },
      };

      mockPrismaService.story.findFirst.mockResolvedValue(mockStory);
      mockPrismaService.artifactDefinition.findFirst.mockResolvedValue(null);

      const callback = jest.fn();
      await handler.handleArtifactUpload(item, callback);

      // ST-347: Error now includes the key for debugging
      expect(callback).toHaveBeenCalledWith({
        success: false,
        id: 7,
        error: 'Artifact definition not found: UNKNOWN_ARTIFACT',
      });
    });

    it('should convert artifact key to uppercase when searching for definition', async () => {
      const item: ArtifactUploadItem = {
        queueId: 8,
        storyKey: 'ST-333',
        artifactKey: 'the_plan',
        filePath: 'docs/ST-333/THE_PLAN.md',
        content: '# Content',
        contentType: 'text/markdown',
        timestamp: Date.now(),
      };

      const mockStory = {
        id: 'story-uuid-7',
        key: 'ST-333',
        projectId: 'project-uuid',
        project: { id: 'project-uuid' },
      };

      mockPrismaService.story.findFirst.mockResolvedValue(mockStory);
      mockPrismaService.artifactDefinition.findFirst.mockResolvedValue(null);

      const callback = jest.fn();
      await handler.handleArtifactUpload(item, callback);

      expect(mockPrismaService.artifactDefinition.findFirst).toHaveBeenCalledWith({
        where: {
          key: 'THE_PLAN',
          workflow: { projectId: 'project-uuid' },
        },
      });
    });
  });

  describe('error handling - database errors', () => {
    it('should catch and report Prisma errors during artifact creation', async () => {
      const item: ArtifactUploadItem = {
        queueId: 9,
        storyKey: 'ST-444',
        artifactKey: 'THE_PLAN',
        filePath: 'docs/ST-444/THE_PLAN.md',
        content: '# Content',
        contentType: 'text/markdown',
        timestamp: Date.now(),
      };

      const mockStory = {
        id: 'story-uuid-8',
        key: 'ST-444',
        projectId: 'project-uuid',
        project: { id: 'project-uuid' },
      };

      const mockDefinition = {
        id: 'definition-uuid-6',
        key: 'THE_PLAN',
      };

      mockPrismaService.story.findFirst.mockResolvedValue(mockStory);
      mockPrismaService.artifactDefinition.findFirst.mockResolvedValue(mockDefinition);
      mockPrismaService.artifact.findFirst.mockResolvedValueOnce(null);
      mockPrismaService.artifact.findFirst.mockResolvedValueOnce(null);
      mockPrismaService.artifact.create.mockRejectedValue(new Error('Prisma constraint violation'));

      const callback = jest.fn();
      await handler.handleArtifactUpload(item, callback);

      expect(callback).toHaveBeenCalledWith({
        success: false,
        id: 9,
        error: 'Prisma constraint violation',
      });
    });

    it('should catch and report errors during artifact update', async () => {
      const item: ArtifactUploadItem = {
        queueId: 10,
        storyKey: 'ST-555',
        artifactKey: 'THE_PLAN',
        filePath: 'docs/ST-555/THE_PLAN.md',
        content: '# Updated Content',
        contentType: 'text/markdown',
        timestamp: Date.now(),
      };

      const mockStory = {
        id: 'story-uuid-9',
        key: 'ST-555',
        projectId: 'project-uuid',
        project: { id: 'project-uuid' },
      };

      const mockDefinition = {
        id: 'definition-uuid-7',
        key: 'THE_PLAN',
      };

      const existingArtifact = {
        id: 'existing-uuid',
        currentVersion: 1,
      };

      mockPrismaService.story.findFirst.mockResolvedValue(mockStory);
      mockPrismaService.artifactDefinition.findFirst.mockResolvedValue(mockDefinition);
      mockPrismaService.artifact.findFirst.mockResolvedValueOnce(null);
      mockPrismaService.artifact.findFirst.mockResolvedValueOnce(existingArtifact);
      mockPrismaService.artifact.update.mockRejectedValue(new Error('Database connection lost'));

      const callback = jest.fn();
      await handler.handleArtifactUpload(item, callback);

      expect(callback).toHaveBeenCalledWith({
        success: false,
        id: 10,
        error: 'Database connection lost',
      });
    });
  });

  describe('version incrementing', () => {
    it('should increment currentVersion when updating existing artifact with new content', async () => {
      const item: ArtifactUploadItem = {
        queueId: 11,
        storyKey: 'ST-666',
        artifactKey: 'THE_PLAN',
        filePath: 'docs/ST-666/THE_PLAN.md',
        content: '# Version 5 Content',
        contentType: 'text/markdown',
        timestamp: Date.now(),
      };

      const mockStory = {
        id: 'story-uuid-10',
        key: 'ST-666',
        projectId: 'project-uuid',
        project: { id: 'project-uuid' },
      };

      const mockDefinition = {
        id: 'definition-uuid-8',
        key: 'THE_PLAN',
      };

      const existingArtifact = {
        id: 'artifact-with-version',
        currentVersion: 4,
      };

      const updatedArtifact = {
        id: 'artifact-with-version',
        currentVersion: 5,
        updatedAt: new Date(),
      };

      mockPrismaService.story.findFirst.mockResolvedValue(mockStory);
      mockPrismaService.artifactDefinition.findFirst.mockResolvedValue(mockDefinition);
      mockPrismaService.artifact.findFirst.mockResolvedValueOnce(null);
      mockPrismaService.artifact.findFirst.mockResolvedValueOnce(existingArtifact);
      mockPrismaService.artifact.update.mockResolvedValue(updatedArtifact);

      const callback = jest.fn();
      await handler.handleArtifactUpload(item, callback);

      expect(mockPrismaService.artifact.update).toHaveBeenCalledWith({
        where: { id: 'artifact-with-version' },
        data: expect.objectContaining({
          currentVersion: 5,
        }),
      });
      expect(callback).toHaveBeenCalledWith({
        success: true,
        id: 11,
      });
    });
  });

  describe('content preview', () => {
    it('should truncate long content to 500 characters for preview', async () => {
      const longContent = 'a'.repeat(1000);
      const item: ArtifactUploadItem = {
        queueId: 12,
        storyKey: 'ST-777',
        artifactKey: 'THE_PLAN',
        filePath: 'docs/ST-777/THE_PLAN.md',
        content: longContent,
        contentType: 'text/markdown',
        timestamp: Date.now(),
      };

      const mockStory = {
        id: 'story-uuid-11',
        key: 'ST-777',
        projectId: 'project-uuid',
        project: { id: 'project-uuid' },
      };

      const mockDefinition = {
        id: 'definition-uuid-9',
        key: 'THE_PLAN',
      };

      const mockArtifact = {
        id: 'artifact-uuid-9',
        currentVersion: 1,
        updatedAt: new Date(),
      };

      mockPrismaService.story.findFirst.mockResolvedValue(mockStory);
      mockPrismaService.artifactDefinition.findFirst.mockResolvedValue(mockDefinition);
      mockPrismaService.artifact.findFirst.mockResolvedValueOnce(null);
      mockPrismaService.artifact.findFirst.mockResolvedValueOnce(null);
      mockPrismaService.artifact.create.mockResolvedValue(mockArtifact);

      const callback = jest.fn();
      await handler.handleArtifactUpload(item, callback);

      expect(mockPrismaService.artifact.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          content: longContent,
          contentPreview: 'a'.repeat(500),
          size: 1000,
        }),
      });
    });
  });
});
