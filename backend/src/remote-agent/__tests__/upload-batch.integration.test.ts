import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../../prisma/prisma.service';
import { TelemetryService } from '../../telemetry/telemetry.service';
import { AppWebSocketGateway } from '../../websocket/websocket.gateway';
import { ClaudeCodeHandler } from '../handlers/claude-code.handler';
import { GitJobHandler } from '../handlers/git-job.handler';
import { TranscriptHandler } from '../handlers/transcript.handler';
import { RemoteAgentGateway } from '../remote-agent.gateway';
import { StreamEventService } from '../stream-event.service';
import { TranscriptRegistrationService } from '../transcript-registration.service';
import { UploadBatchPayload } from '../types';

describe('RemoteAgentGateway - upload:batch integration', () => {
  let gateway: RemoteAgentGateway;
  let transcriptHandler: TranscriptHandler;
  let mockClient: Partial<Socket>;
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

  const mockJwtService = {
    signAsync: jest.fn(),
    verify: jest.fn(),
  };

  const mockStreamEventService = {
    recordEvent: jest.fn(),
  };

  const mockTranscriptRegistrationService = {
    handleTranscriptDetected: jest.fn(),
  };

  const mockTelemetryService = {
    withSpan: jest.fn((name, fn) => fn({ setAttribute: jest.fn(), recordException: jest.fn() })),
  };

  const mockAppWebSocketGateway = {
    server: {} as Server,
  };

  const mockClaudeCodeHandler = {
    emitClaudeCodeJob: jest.fn(),
  };

  const mockGitJobHandler = {
    emitGitJob: jest.fn(),
  };

  beforeEach(async () => {
    mockClient = {
      id: 'socket-123',
      emit: jest.fn(),
      data: { agentId: 'agent-abc' },
      join: jest.fn(),
      leave: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RemoteAgentGateway,
        TranscriptHandler,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: StreamEventService, useValue: mockStreamEventService },
        { provide: TranscriptRegistrationService, useValue: mockTranscriptRegistrationService },
        { provide: TelemetryService, useValue: mockTelemetryService },
        { provide: AppWebSocketGateway, useValue: mockAppWebSocketGateway },
        { provide: ClaudeCodeHandler, useValue: mockClaudeCodeHandler },
        { provide: GitJobHandler, useValue: mockGitJobHandler },
      ],
    }).compile();

    gateway = module.get<RemoteAgentGateway>(RemoteAgentGateway);
    transcriptHandler = module.get<TranscriptHandler>(TranscriptHandler);
    prismaService = module.get<PrismaService>(PrismaService);

    // Suppress logger output during tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handleUploadBatch', () => {
    it('should process batch upload and send individual and batch ACKs', async () => {
      const payload: UploadBatchPayload = {
        agentId: 'agent-abc',
        items: [
          {
            queueId: 1,
            workflowRunId: 'run-1',
            componentRunId: 'comp-1',
            transcriptPath: '/path/1.jsonl',
            content: '{"line":1}',
            sequenceNumber: 1,
          },
          {
            queueId: 2,
            workflowRunId: 'run-1',
            componentRunId: 'comp-1',
            transcriptPath: '/path/2.jsonl',
            content: '{"line":2}',
            sequenceNumber: 2,
          },
        ],
      };

      const mockWorkflowRun = {
        id: 'run-1',
        workflowId: 'workflow-1',
        storyId: 'story-1',
      };

      const mockComponentRun = {
        id: 'comp-1',
        componentId: 'component-xyz',
        metadata: {},
        component: { id: 'component-xyz' },
      };

      const mockArtifactDef = {
        id: 'def-1',
        key: 'TRANSCRIPT',
      };

      mockPrismaService.workflowRun.findUnique.mockResolvedValue(mockWorkflowRun);
      mockPrismaService.componentRun.findUnique.mockResolvedValue(mockComponentRun);
      mockPrismaService.artifactDefinition.findFirst.mockResolvedValue(mockArtifactDef);
      mockPrismaService.artifact.findFirst.mockResolvedValue(null);
      mockPrismaService.artifact.create
        .mockResolvedValueOnce({ id: 'artifact-1', size: 10 })
        .mockResolvedValueOnce({ id: 'artifact-2', size: 10 });
      mockPrismaService.componentRun.update.mockResolvedValue({});

      await gateway.handleUploadBatch(mockClient as Socket, payload);

      // Verify individual ACKs were sent
      expect(mockClient.emit).toHaveBeenCalledWith('upload:ack:item', {
        success: true,
        id: 1,
      });
      expect(mockClient.emit).toHaveBeenCalledWith('upload:ack:item', {
        success: true,
        id: 2,
      });

      // Verify batch ACK was sent
      expect(mockClient.emit).toHaveBeenCalledWith('upload:ack', {
        ids: [1, 2],
      });
    });

    it('should handle mixed success/failure in batch', async () => {
      const payload: UploadBatchPayload = {
        agentId: 'agent-abc',
        items: [
          {
            queueId: 10,
            workflowRunId: 'run-1',
            componentRunId: 'comp-1',
            transcriptPath: '/path/success.jsonl',
            content: '{"success":true}',
            sequenceNumber: 1,
          },
          {
            queueId: 11,
            workflowRunId: 'non-existent',
            componentRunId: 'comp-1',
            transcriptPath: '/path/fail.jsonl',
            content: '{"fail":true}',
            sequenceNumber: 2,
          },
        ],
      };

      mockPrismaService.workflowRun.findUnique
        .mockResolvedValueOnce({
          id: 'run-1',
          workflowId: 'workflow-1',
          storyId: 'story-1',
        })
        .mockResolvedValueOnce(null); // Second item fails

      mockPrismaService.componentRun.findUnique.mockResolvedValue({
        id: 'comp-1',
        componentId: 'component-xyz',
        metadata: {},
        component: { id: 'component-xyz' },
      });

      mockPrismaService.artifactDefinition.findFirst.mockResolvedValue({
        id: 'def-1',
        key: 'TRANSCRIPT',
      });
      mockPrismaService.artifact.findFirst.mockResolvedValue(null);
      mockPrismaService.artifact.create.mockResolvedValue({ id: 'artifact-1', size: 18 });
      mockPrismaService.componentRun.update.mockResolvedValue({});

      await gateway.handleUploadBatch(mockClient as Socket, payload);

      // Verify success ACK for item 10
      expect(mockClient.emit).toHaveBeenCalledWith('upload:ack:item', {
        success: true,
        id: 10,
      });

      // Verify failure ACK for item 11
      expect(mockClient.emit).toHaveBeenCalledWith('upload:ack:item', {
        success: false,
        id: 11,
        error: 'WorkflowRun not found',
      });

      // Verify batch ACK only contains successful ID
      expect(mockClient.emit).toHaveBeenCalledWith('upload:ack', {
        ids: [10],
      });
    });

    it('should handle duplicates correctly in batch ACK', async () => {
      const payload: UploadBatchPayload = {
        agentId: 'agent-abc',
        items: [
          {
            queueId: 20,
            workflowRunId: 'run-1',
            componentRunId: 'comp-1',
            transcriptPath: '/path/new.jsonl',
            content: '{"new":true}',
            sequenceNumber: 1,
          },
          {
            queueId: 21,
            workflowRunId: 'run-1',
            componentRunId: 'comp-1',
            transcriptPath: '/path/duplicate.jsonl',
            content: '{"duplicate":true}',
            sequenceNumber: 2,
          },
        ],
      };

      mockPrismaService.workflowRun.findUnique.mockResolvedValue({
        id: 'run-1',
        workflowId: 'workflow-1',
        storyId: 'story-1',
      });

      mockPrismaService.componentRun.findUnique.mockResolvedValue({
        id: 'comp-1',
        componentId: 'component-xyz',
        metadata: {},
        component: { id: 'component-xyz' },
      });

      mockPrismaService.artifactDefinition.findFirst.mockResolvedValue({
        id: 'def-1',
        key: 'TRANSCRIPT',
      });

      // First item is new, second is duplicate
      mockPrismaService.artifact.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'existing-artifact' });

      mockPrismaService.artifact.create.mockResolvedValue({ id: 'artifact-20', size: 13 });
      mockPrismaService.componentRun.update.mockResolvedValue({});

      await gateway.handleUploadBatch(mockClient as Socket, payload);

      // Verify new item ACK
      expect(mockClient.emit).toHaveBeenCalledWith('upload:ack:item', {
        success: true,
        id: 20,
      });

      // Verify duplicate item ACK
      expect(mockClient.emit).toHaveBeenCalledWith('upload:ack:item', {
        success: true,
        id: 21,
        isDuplicate: true,
      });

      // Verify batch ACK only contains non-duplicate ID
      expect(mockClient.emit).toHaveBeenCalledWith('upload:ack', {
        ids: [20],
      });
    });

    it('should reject batch when agent ID mismatch', async () => {
      const payload: UploadBatchPayload = {
        agentId: 'different-agent',
        items: [
          {
            queueId: 30,
            workflowRunId: 'run-1',
            componentRunId: 'comp-1',
            transcriptPath: '/path/test.jsonl',
            content: '{"test":true}',
            sequenceNumber: 1,
          },
        ],
      };

      await gateway.handleUploadBatch(mockClient as Socket, payload);

      // Should not process items or send ACKs
      expect(mockClient.emit).not.toHaveBeenCalled();
      expect(mockPrismaService.workflowRun.findUnique).not.toHaveBeenCalled();
    });

    it('should handle empty batch gracefully', async () => {
      const payload: UploadBatchPayload = {
        agentId: 'agent-abc',
        items: [],
      };

      await gateway.handleUploadBatch(mockClient as Socket, payload);

      // Should send empty batch ACK
      expect(mockClient.emit).toHaveBeenCalledWith('upload:ack', {
        ids: [],
      });
    });
  });
});
