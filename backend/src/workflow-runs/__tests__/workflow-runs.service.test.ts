/**
 * ST-237: Tests for WorkflowRunsService.updateArtifactContent
 */

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { WorkflowRunsService } from '../workflow-runs.service';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkflowStateService } from '../../execution/workflow-state.service';
import { AppWebSocketGateway } from '../../websocket/websocket.gateway';

describe('WorkflowRunsService', () => {
  let service: WorkflowRunsService;

  const mockArtifact = {
    id: 'artifact-1',
    definitionId: 'def-1',
    storyId: 'story-1',
    workflowRunId: 'run-1',
    content: 'Original content',
    contentHash: 'abc123',
    contentType: 'text/markdown',
    size: 16,
    currentVersion: 1,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    definition: {
      id: 'def-1',
      key: 'TEST_DOC',
      name: 'Test Document',
      type: 'markdown',
    },
  };

  const mockPrismaService = {
    artifact: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    artifactVersion: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockWorkflowStateService = {
    getWorkflowRunStatus: jest.fn(),
    getWorkflowArtifacts: jest.fn(),
    getArtifactAccess: jest.fn(),
    getWorkflowContext: jest.fn(),
  };

  const mockWebSocketGateway = {
    broadcastWorkflowStarted: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkflowRunsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: WorkflowStateService, useValue: mockWorkflowStateService },
        { provide: AppWebSocketGateway, useValue: mockWebSocketGateway },
      ],
    }).compile();

    service = module.get<WorkflowRunsService>(WorkflowRunsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('updateArtifactContent', () => {
    it('should throw NotFoundException when artifact does not exist', async () => {
      mockPrismaService.artifact.findUnique.mockResolvedValue(null);

      await expect(
        service.updateArtifactContent('non-existent', 'new content'),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrismaService.artifact.findUnique).toHaveBeenCalledWith({
        where: { id: 'non-existent' },
        include: { definition: true },
      });
    });

    it('should skip update when content hash matches (no changes)', async () => {
      // Calculate hash for "Same content"
      const crypto = await import('crypto');
      const content = 'Same content';
      const hash = crypto.createHash('sha256').update(content, 'utf8').digest('hex');

      const artifactWithSameContent = {
        ...mockArtifact,
        content,
        contentHash: hash,
      };

      mockPrismaService.artifact.findUnique.mockResolvedValue(artifactWithSameContent);

      const result = await service.updateArtifactContent('artifact-1', content);

      expect(result.skipped).toBe(true);
      expect(result.message).toBe('Content unchanged, no new version created');
      expect(result.version).toBe(1);
      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
    });

    it('should update artifact and create version when content changes', async () => {
      const newContent = 'Updated content';

      mockPrismaService.artifact.findUnique.mockResolvedValue(mockArtifact);

      const updatedArtifact = {
        ...mockArtifact,
        content: newContent,
        currentVersion: 2,
        updatedAt: new Date(),
      };

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          artifact: {
            update: jest.fn().mockResolvedValue(updatedArtifact),
          },
          artifactVersion: {
            create: jest.fn().mockResolvedValue({}),
          },
        };
        return callback(mockTx);
      });

      const result = await service.updateArtifactContent('artifact-1', newContent, 'run-1');

      expect(result.version).toBe(2);
      expect(result.content).toBe(newContent);
      expect(result.definitionKey).toBe('TEST_DOC');
      expect(mockPrismaService.$transaction).toHaveBeenCalled();
    });

    it('should pass workflowRunId to version history', async () => {
      const newContent = 'New version content';

      mockPrismaService.artifact.findUnique.mockResolvedValue(mockArtifact);

      let capturedVersionCreate: any = null;
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          artifact: {
            update: jest.fn().mockResolvedValue({
              ...mockArtifact,
              content: newContent,
              currentVersion: 2,
            }),
          },
          artifactVersion: {
            create: jest.fn().mockImplementation((args) => {
              capturedVersionCreate = args;
              return {};
            }),
          },
        };
        return callback(mockTx);
      });

      await service.updateArtifactContent('artifact-1', newContent, 'run-123');

      expect(capturedVersionCreate.data.workflowRunId).toBe('run-123');
      expect(capturedVersionCreate.data.version).toBe(2);
    });

    it('should calculate correct size for content', async () => {
      const newContent = 'Hello World!'; // 12 bytes

      mockPrismaService.artifact.findUnique.mockResolvedValue(mockArtifact);

      let capturedUpdate: any = null;
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          artifact: {
            update: jest.fn().mockImplementation((args) => {
              capturedUpdate = args;
              return {
                ...mockArtifact,
                content: newContent,
                currentVersion: 2,
                size: 12,
              };
            }),
          },
          artifactVersion: {
            create: jest.fn().mockResolvedValue({}),
          },
        };
        return callback(mockTx);
      });

      const result = await service.updateArtifactContent('artifact-1', newContent);

      expect(capturedUpdate.data.size).toBe(12);
      expect(result.size).toBe(12);
    });
  });
});
