import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../prisma/prisma.service';
import { TranscriptRegistrationService } from '../../transcript-registration.service';
import { UploadBatchItem, ItemAckPayload } from '../../types';
import { TranscriptHandler } from '../transcript.handler';

describe('TranscriptHandler - handleTranscriptUpload', () => {
  let handler: TranscriptHandler;
  let prismaService: PrismaService;

  const mockPrismaService = {
    workflowRun: {
      findUnique: jest.fn(),
    },
    componentRun: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    artifactDefinition: {
      findFirst: jest.fn(),
    },
    artifact: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  };

  const mockTranscriptRegistrationService = {
    handleTranscriptDetected: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TranscriptHandler,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: TranscriptRegistrationService, useValue: mockTranscriptRegistrationService },
      ],
    }).compile();

    handler = module.get<TranscriptHandler>(TranscriptHandler);
    prismaService = module.get<PrismaService>(PrismaService);

    // Suppress logger output during tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('successful upload', () => {
    it('should upload transcript and send success ACK', async () => {
      const item: UploadBatchItem = {
        queueId: 1,
        workflowRunId: 'workflow-run-123',
        componentRunId: 'component-run-456',
        transcriptPath: '/path/to/transcript.jsonl',
        content: '{"type":"test","data":"content"}',
        sequenceNumber: 1,
        metadata: { test: 'data' },
      };

      const mockWorkflowRun = {
        id: 'workflow-run-123',
        workflowId: 'workflow-789',
        storyId: 'story-abc',
      };

      const mockComponentRun = {
        id: 'component-run-456',
        componentId: 'component-xyz',
        metadata: {},
        component: { id: 'component-xyz', name: 'Test Component' },
      };

      const mockArtifactDef = {
        id: 'artifact-def-123',
        key: 'TRANSCRIPT',
        workflowId: 'workflow-789',
      };

      const mockArtifact = {
        id: 'artifact-999',
        size: 32,
      };

      mockPrismaService.workflowRun.findUnique.mockResolvedValue(mockWorkflowRun);
      mockPrismaService.componentRun.findUnique.mockResolvedValue(mockComponentRun);
      mockPrismaService.artifactDefinition.findFirst.mockResolvedValue(mockArtifactDef);
      mockPrismaService.artifact.findFirst.mockResolvedValue(null); // No duplicate
      mockPrismaService.artifact.create.mockResolvedValue(mockArtifact);
      mockPrismaService.componentRun.update.mockResolvedValue({});

      const callback = jest.fn();
      await handler.handleTranscriptUpload(item, callback);

      expect(mockPrismaService.workflowRun.findUnique).toHaveBeenCalledWith({
        where: { id: 'workflow-run-123' },
      });
      expect(mockPrismaService.artifact.create).toHaveBeenCalledWith({
        data: {
          definitionId: 'artifact-def-123',
          storyId: 'story-abc',
          workflowRunId: 'workflow-run-123',
          lastUpdatedRunId: 'workflow-run-123',
          content: '{"type":"test","data":"content"}',
          contentType: 'application/x-jsonlines',
          contentPreview: '{"type":"test","data":"content"}',
          size: 32,
          currentVersion: 1,
          createdByComponentId: 'component-xyz',
        },
      });
      expect(callback).toHaveBeenCalledWith({
        success: true,
        id: 1,
      });
    });
  });

  describe('duplicate detection', () => {
    it('should detect duplicate content and send ACK with isDuplicate flag', async () => {
      const item: UploadBatchItem = {
        queueId: 2,
        workflowRunId: 'workflow-run-123',
        componentRunId: 'component-run-456',
        transcriptPath: '/path/to/transcript.jsonl',
        content: '{"type":"test","data":"duplicate"}',
        sequenceNumber: 1,
      };

      const mockWorkflowRun = {
        id: 'workflow-run-123',
        workflowId: 'workflow-789',
        storyId: 'story-abc',
      };

      const mockComponentRun = {
        id: 'component-run-456',
        componentId: 'component-xyz',
        component: { id: 'component-xyz' },
      };

      const mockArtifactDef = {
        id: 'artifact-def-123',
        key: 'TRANSCRIPT',
      };

      const mockExistingArtifact = {
        id: 'existing-artifact-888',
      };

      mockPrismaService.workflowRun.findUnique.mockResolvedValue(mockWorkflowRun);
      mockPrismaService.componentRun.findUnique.mockResolvedValue(mockComponentRun);
      mockPrismaService.artifactDefinition.findFirst.mockResolvedValue(mockArtifactDef);
      mockPrismaService.artifact.findFirst.mockResolvedValue(mockExistingArtifact);

      const callback = jest.fn();
      await handler.handleTranscriptUpload(item, callback);

      expect(mockPrismaService.artifact.create).not.toHaveBeenCalled();
      expect(callback).toHaveBeenCalledWith({
        success: true,
        id: 2,
        isDuplicate: true,
      });
    });
  });

  describe('error handling', () => {
    it('should send error ACK when workflow run not found', async () => {
      const item: UploadBatchItem = {
        queueId: 3,
        workflowRunId: 'non-existent',
        componentRunId: 'component-run-456',
        transcriptPath: '/path/to/transcript.jsonl',
        content: '{"test":"data"}',
        sequenceNumber: 1,
      };

      mockPrismaService.workflowRun.findUnique.mockResolvedValue(null);

      const callback = jest.fn();
      await handler.handleTranscriptUpload(item, callback);

      expect(callback).toHaveBeenCalledWith({
        success: false,
        id: 3,
        error: 'WorkflowRun not found',
      });
    });

    it('should send error ACK when workflow run has no storyId', async () => {
      const item: UploadBatchItem = {
        queueId: 4,
        workflowRunId: 'workflow-run-123',
        componentRunId: 'component-run-456',
        transcriptPath: '/path/to/transcript.jsonl',
        content: '{"test":"data"}',
        sequenceNumber: 1,
      };

      mockPrismaService.workflowRun.findUnique.mockResolvedValue({
        id: 'workflow-run-123',
        storyId: null,
      });

      const callback = jest.fn();
      await handler.handleTranscriptUpload(item, callback);

      expect(callback).toHaveBeenCalledWith({
        success: false,
        id: 4,
        error: 'WorkflowRun has no storyId',
      });
    });

    it('should send error ACK when component run not found', async () => {
      const item: UploadBatchItem = {
        queueId: 5,
        workflowRunId: 'workflow-run-123',
        componentRunId: 'non-existent',
        transcriptPath: '/path/to/transcript.jsonl',
        content: '{"test":"data"}',
        sequenceNumber: 1,
      };

      mockPrismaService.workflowRun.findUnique.mockResolvedValue({
        id: 'workflow-run-123',
        storyId: 'story-abc',
      });
      mockPrismaService.componentRun.findUnique.mockResolvedValue(null);

      const callback = jest.fn();
      await handler.handleTranscriptUpload(item, callback);

      expect(callback).toHaveBeenCalledWith({
        success: false,
        id: 5,
        error: 'ComponentRun not found',
      });
    });

    it('should send error ACK when artifact definition not found', async () => {
      const item: UploadBatchItem = {
        queueId: 6,
        workflowRunId: 'workflow-run-123',
        componentRunId: 'component-run-456',
        transcriptPath: '/path/to/transcript.jsonl',
        content: '{"test":"data"}',
        sequenceNumber: 1,
      };

      mockPrismaService.workflowRun.findUnique.mockResolvedValue({
        id: 'workflow-run-123',
        workflowId: 'workflow-789',
        storyId: 'story-abc',
      });
      mockPrismaService.componentRun.findUnique.mockResolvedValue({
        id: 'component-run-456',
        componentId: 'component-xyz',
        component: { id: 'component-xyz' },
      });
      mockPrismaService.artifactDefinition.findFirst.mockResolvedValue(null);

      const callback = jest.fn();
      await handler.handleTranscriptUpload(item, callback);

      expect(callback).toHaveBeenCalledWith({
        success: false,
        id: 6,
        error: 'No TRANSCRIPT artifact definition',
      });
    });

    it('should send error ACK when database operation fails', async () => {
      const item: UploadBatchItem = {
        queueId: 7,
        workflowRunId: 'workflow-run-123',
        componentRunId: 'component-run-456',
        transcriptPath: '/path/to/transcript.jsonl',
        content: '{"test":"data"}',
        sequenceNumber: 1,
      };

      mockPrismaService.workflowRun.findUnique.mockResolvedValue({
        id: 'workflow-run-123',
        workflowId: 'workflow-789',
        storyId: 'story-abc',
      });
      mockPrismaService.componentRun.findUnique.mockResolvedValue({
        id: 'component-run-456',
        componentId: 'component-xyz',
        component: { id: 'component-xyz' },
      });
      mockPrismaService.artifactDefinition.findFirst.mockResolvedValue({
        id: 'artifact-def-123',
      });
      mockPrismaService.artifact.findFirst.mockResolvedValue(null);
      mockPrismaService.artifact.create.mockRejectedValue(new Error('Database error'));

      const callback = jest.fn();
      await handler.handleTranscriptUpload(item, callback);

      expect(callback).toHaveBeenCalledWith({
        success: false,
        id: 7,
        error: 'Database error',
      });
    });
  });

  describe('metadata handling', () => {
    it('should update component run metadata with upload details', async () => {
      const item: UploadBatchItem = {
        queueId: 8,
        workflowRunId: 'workflow-run-123',
        componentRunId: 'component-run-456',
        transcriptPath: '/path/to/transcript.jsonl',
        content: '{"test":"data"}',
        sequenceNumber: 42,
        metadata: { custom: 'metadata', version: '1.0' },
      };

      const mockWorkflowRun = {
        id: 'workflow-run-123',
        workflowId: 'workflow-789',
        storyId: 'story-abc',
      };

      const mockComponentRun = {
        id: 'component-run-456',
        componentId: 'component-xyz',
        metadata: { existing: 'data' },
        component: { id: 'component-xyz' },
      };

      mockPrismaService.workflowRun.findUnique.mockResolvedValue(mockWorkflowRun);
      mockPrismaService.componentRun.findUnique.mockResolvedValue(mockComponentRun);
      mockPrismaService.artifactDefinition.findFirst.mockResolvedValue({ id: 'def-123' });
      mockPrismaService.artifact.findFirst.mockResolvedValue(null);
      mockPrismaService.artifact.create.mockResolvedValue({ id: 'artifact-999', size: 15 });
      mockPrismaService.componentRun.update.mockResolvedValue({});

      const callback = jest.fn();
      await handler.handleTranscriptUpload(item, callback);

      expect(mockPrismaService.componentRun.update).toHaveBeenCalledWith({
        where: { id: 'component-run-456' },
        data: {
          metadata: {
            existing: 'data',
            transcriptArtifactId: 'artifact-999',
            transcriptPath: '/path/to/transcript.jsonl',
            sequenceNumber: 42,
            uploadMetadata: { custom: 'metadata', version: '1.0' },
          },
        },
      });
      expect(callback).toHaveBeenCalledWith({
        success: true,
        id: 8,
      });
    });
  });
});
