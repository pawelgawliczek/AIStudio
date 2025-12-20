/**
 * EP-14: Unit tests for transcript:lines and transcript:batch ACK emission
 *
 * These tests verify that the gateway correctly emits ACKs back to the client
 * after processing transcript lines and batches. This is the critical fix for
 * the guaranteed delivery protocol.
 *
 * Bug: Handlers returned ACK objects but did not emit them to the client.
 * Fix: Gateway now explicitly calls client.emit('upload:ack:item', ack)
 */

import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../../prisma/prisma.service';
import { TelemetryService } from '../../telemetry/telemetry.service';
import { AppWebSocketGateway } from '../../websocket/websocket.gateway';
import { ArtifactHandler } from '../handlers/artifact.handler';
import { ClaudeCodeHandler } from '../handlers/claude-code.handler';
import { GitJobHandler } from '../handlers/git-job.handler';
import { TranscriptHandler } from '../handlers/transcript.handler';
import { RemoteAgentGateway } from '../remote-agent.gateway';
import { StreamEventService } from '../stream-event.service';
import { TranscriptRegistrationService } from '../transcript-registration.service';

describe('RemoteAgentGateway - transcript ACK emission (EP-14)', () => {
  let gateway: RemoteAgentGateway;
  let mockClient: Partial<Socket>;
  let mockTranscriptHandler: {
    handleTranscriptLines: jest.Mock;
    handleTranscriptBatch: jest.Mock;
    setFrontendServer: jest.Mock;
    handleTranscriptDetected: jest.Mock;
    handleMasterTranscriptSubscribe: jest.Mock;
    handleMasterTranscriptUnsubscribe: jest.Mock;
    handleTranscriptStreamingStarted: jest.Mock;
    handleTranscriptError: jest.Mock;
    handleTranscriptStreamingStopped: jest.Mock;
    forwardTailRequestToAgent: jest.Mock;
    forwardStopTailToAgent: jest.Mock;
    handleTranscriptUpload: jest.Mock;
  };

  const mockPrismaService = {
    remoteAgent: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      upsert: jest.fn(),
    },
    transcriptLine: {
      createMany: jest.fn(),
    },
  };

  const mockJwtService = {
    signAsync: jest.fn(),
    verify: jest.fn(),
  };

  const mockStreamEventService = {
    recordEvent: jest.fn(),
    storeEvent: jest.fn(),
  };

  const mockTranscriptRegistrationService = {
    handleTranscriptDetected: jest.fn(),
  };

  const mockTelemetryService = {
    withSpan: jest.fn((name, fn) => fn({ setAttribute: jest.fn(), recordException: jest.fn() })),
  };

  const mockAppWebSocketGateway = {
    server: {
      to: jest.fn().mockReturnValue({
        emit: jest.fn(),
      }),
    } as unknown as Server,
  };

  const mockClaudeCodeHandler = {
    emitClaudeCodeJob: jest.fn(),
    handleClaudeCodeProgress: jest.fn(),
    handleClaudeCodeComplete: jest.fn(),
    handleClaudeCodePaused: jest.fn(),
    handleResumeAvailable: jest.fn(),
    emitAnswerToAgent: jest.fn(),
  };

  const mockGitJobHandler = {
    emitGitJob: jest.fn(),
    handleGitResult: jest.fn(),
  };

  const mockArtifactHandler = {
    setFrontendServer: jest.fn(),
    handleArtifactUpload: jest.fn(),
  };

  beforeEach(async () => {
    // Create mock socket
    mockClient = {
      id: 'socket-123',
      emit: jest.fn(),
      data: { agentId: 'agent-abc' },
      join: jest.fn(),
      leave: jest.fn(),
    };

    // Create mock transcript handler with typed methods
    mockTranscriptHandler = {
      handleTranscriptLines: jest.fn(),
      handleTranscriptBatch: jest.fn(),
      setFrontendServer: jest.fn(),
      handleTranscriptDetected: jest.fn(),
      handleMasterTranscriptSubscribe: jest.fn(),
      handleMasterTranscriptUnsubscribe: jest.fn(),
      handleTranscriptStreamingStarted: jest.fn(),
      handleTranscriptError: jest.fn(),
      handleTranscriptStreamingStopped: jest.fn(),
      forwardTailRequestToAgent: jest.fn(),
      forwardStopTailToAgent: jest.fn(),
      handleTranscriptUpload: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RemoteAgentGateway,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: StreamEventService, useValue: mockStreamEventService },
        { provide: TranscriptRegistrationService, useValue: mockTranscriptRegistrationService },
        { provide: TelemetryService, useValue: mockTelemetryService },
        { provide: AppWebSocketGateway, useValue: mockAppWebSocketGateway },
        { provide: ClaudeCodeHandler, useValue: mockClaudeCodeHandler },
        { provide: GitJobHandler, useValue: mockGitJobHandler },
        { provide: ArtifactHandler, useValue: mockArtifactHandler },
        { provide: TranscriptHandler, useValue: mockTranscriptHandler },
      ],
    }).compile();

    gateway = module.get<RemoteAgentGateway>(RemoteAgentGateway);

    // Suppress logger output during tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handleTranscriptLines', () => {
    const transcriptLinesData = {
      queueId: 123,
      runId: 'run-abc',
      sessionIndex: 0,
      lines: [
        { line: '{"type":"text","content":"line 1"}', sequenceNumber: 1 },
        { line: '{"type":"text","content":"line 2"}', sequenceNumber: 2 },
      ],
      isHistorical: false,
      timestamp: new Date().toISOString(),
    };

    it('should emit success ACK to client after processing transcript lines', async () => {
      // Setup: Handler returns success ACK
      mockTranscriptHandler.handleTranscriptLines.mockResolvedValue({
        success: true,
        queueId: 123,
        linesCount: 2,
      });

      // Execute
      await gateway.handleTranscriptLines(mockClient as Socket, transcriptLinesData);

      // Verify: Client.emit was called with ACK
      expect(mockClient.emit).toHaveBeenCalledWith('upload:ack:item', {
        success: true,
        id: 123,
      });

      // Verify: Handler was called
      expect(mockTranscriptHandler.handleTranscriptLines).toHaveBeenCalledWith(transcriptLinesData);
    });

    it('should emit error ACK to client when handler fails', async () => {
      // Setup: Handler returns error ACK
      mockTranscriptHandler.handleTranscriptLines.mockResolvedValue({
        success: false,
        queueId: 123,
        error: 'Database connection failed',
      });

      // Execute
      await gateway.handleTranscriptLines(mockClient as Socket, transcriptLinesData);

      // Verify: Client.emit was called with error ACK
      expect(mockClient.emit).toHaveBeenCalledWith('upload:ack:item', {
        success: false,
        id: 123,
        error: 'Database connection failed',
      });
    });

    it('should use queueId from data as the ACK id', async () => {
      const dataWithDifferentQueueId = {
        ...transcriptLinesData,
        queueId: 999,
      };

      mockTranscriptHandler.handleTranscriptLines.mockResolvedValue({
        success: true,
        queueId: 999,
        linesCount: 2,
      });

      await gateway.handleTranscriptLines(mockClient as Socket, dataWithDifferentQueueId);

      expect(mockClient.emit).toHaveBeenCalledWith('upload:ack:item', {
        success: true,
        id: 999,
      });
    });

    it('should not include error field in ACK when success is true', async () => {
      mockTranscriptHandler.handleTranscriptLines.mockResolvedValue({
        success: true,
        queueId: 123,
        linesCount: 2,
      });

      await gateway.handleTranscriptLines(mockClient as Socket, transcriptLinesData);

      const emitCall = (mockClient.emit as jest.Mock).mock.calls[0];
      expect(emitCall[0]).toBe('upload:ack:item');
      expect(emitCall[1]).not.toHaveProperty('error');
    });
  });

  describe('handleTranscriptBatch', () => {
    const transcriptBatchData = {
      queueId: 456,
      runId: 'run-xyz',
      sessionIndex: 1,
      lines: [
        { line: '{"type":"batch","content":"batch line 1"}', sequenceNumber: 100 },
        { line: '{"type":"batch","content":"batch line 2"}', sequenceNumber: 101 },
        { line: '{"type":"batch","content":"batch line 3"}', sequenceNumber: 102 },
      ],
      isHistorical: true,
      timestamp: new Date().toISOString(),
    };

    it('should emit success ACK to client after processing transcript batch', async () => {
      // Setup: Handler returns success ACK
      mockTranscriptHandler.handleTranscriptBatch.mockResolvedValue({
        success: true,
        queueId: 456,
        linesCount: 3,
      });

      // Execute
      await gateway.handleTranscriptBatch(mockClient as Socket, transcriptBatchData);

      // Verify: Client.emit was called with ACK
      expect(mockClient.emit).toHaveBeenCalledWith('upload:ack:item', {
        success: true,
        id: 456,
      });

      // Verify: Handler was called
      expect(mockTranscriptHandler.handleTranscriptBatch).toHaveBeenCalledWith(transcriptBatchData);
    });

    it('should emit error ACK to client when batch processing fails', async () => {
      // Setup: Handler returns error ACK
      mockTranscriptHandler.handleTranscriptBatch.mockResolvedValue({
        success: false,
        queueId: 456,
        error: 'Unique constraint violation',
      });

      // Execute
      await gateway.handleTranscriptBatch(mockClient as Socket, transcriptBatchData);

      // Verify: Client.emit was called with error ACK
      expect(mockClient.emit).toHaveBeenCalledWith('upload:ack:item', {
        success: false,
        id: 456,
        error: 'Unique constraint violation',
      });
    });

    it('should use queueId from data as the ACK id', async () => {
      const dataWithDifferentQueueId = {
        ...transcriptBatchData,
        queueId: 888,
      };

      mockTranscriptHandler.handleTranscriptBatch.mockResolvedValue({
        success: true,
        queueId: 888,
        linesCount: 3,
      });

      await gateway.handleTranscriptBatch(mockClient as Socket, dataWithDifferentQueueId);

      expect(mockClient.emit).toHaveBeenCalledWith('upload:ack:item', {
        success: true,
        id: 888,
      });
    });

    it('should not include error field in ACK when success is true', async () => {
      mockTranscriptHandler.handleTranscriptBatch.mockResolvedValue({
        success: true,
        queueId: 456,
        linesCount: 3,
      });

      await gateway.handleTranscriptBatch(mockClient as Socket, transcriptBatchData);

      const emitCall = (mockClient.emit as jest.Mock).mock.calls[0];
      expect(emitCall[0]).toBe('upload:ack:item');
      expect(emitCall[1]).not.toHaveProperty('error');
    });
  });

  describe('ACK format consistency with upload:batch', () => {
    it('should emit ACK in the same format as upload:batch handler', async () => {
      // This test verifies that transcript:lines ACK format matches upload:batch ACK format
      mockTranscriptHandler.handleTranscriptLines.mockResolvedValue({
        success: true,
        queueId: 100,
        linesCount: 5,
      });

      await gateway.handleTranscriptLines(mockClient as Socket, {
        queueId: 100,
        runId: 'run-1',
        sessionIndex: 0,
        lines: [{ line: 'test', sequenceNumber: 1 }],
        isHistorical: false,
        timestamp: new Date().toISOString(),
      });

      // ACK format should match: { success: boolean, id: number, error?: string }
      expect(mockClient.emit).toHaveBeenCalledWith('upload:ack:item', {
        success: true,
        id: 100,
      });

      // Verify the exact structure of the ACK
      const ackData = (mockClient.emit as jest.Mock).mock.calls[0][1];
      expect(typeof ackData.success).toBe('boolean');
      expect(typeof ackData.id).toBe('number');
    });

    it('should emit error ACK in the same format as upload:batch handler', async () => {
      mockTranscriptHandler.handleTranscriptLines.mockResolvedValue({
        success: false,
        queueId: 200,
        error: 'Test error message',
      });

      await gateway.handleTranscriptLines(mockClient as Socket, {
        queueId: 200,
        runId: 'run-1',
        sessionIndex: 0,
        lines: [{ line: 'test', sequenceNumber: 1 }],
        isHistorical: false,
        timestamp: new Date().toISOString(),
      });

      expect(mockClient.emit).toHaveBeenCalledWith('upload:ack:item', {
        success: false,
        id: 200,
        error: 'Test error message',
      });

      // Verify the exact structure of the error ACK
      const ackData = (mockClient.emit as jest.Mock).mock.calls[0][1];
      expect(typeof ackData.success).toBe('boolean');
      expect(typeof ackData.id).toBe('number');
      expect(typeof ackData.error).toBe('string');
    });
  });

  describe('return value behavior', () => {
    it('should return the ACK object from handleTranscriptLines', async () => {
      const expectedAck = {
        success: true,
        queueId: 123,
        linesCount: 2,
      };
      mockTranscriptHandler.handleTranscriptLines.mockResolvedValue(expectedAck);

      const result = await gateway.handleTranscriptLines(mockClient as Socket, {
        queueId: 123,
        runId: 'run-1',
        sessionIndex: 0,
        lines: [{ line: 'test', sequenceNumber: 1 }],
        isHistorical: false,
        timestamp: new Date().toISOString(),
      });

      // Return value should be the original ACK object
      expect(result).toEqual(expectedAck);
    });

    it('should return the ACK object from handleTranscriptBatch', async () => {
      const expectedAck = {
        success: true,
        queueId: 456,
        linesCount: 3,
      };
      mockTranscriptHandler.handleTranscriptBatch.mockResolvedValue(expectedAck);

      const result = await gateway.handleTranscriptBatch(mockClient as Socket, {
        queueId: 456,
        runId: 'run-1',
        sessionIndex: 0,
        lines: [{ line: 'test', sequenceNumber: 1 }],
        isHistorical: true,
        timestamp: new Date().toISOString(),
      });

      // Return value should be the original ACK object
      expect(result).toEqual(expectedAck);
    });
  });
});
