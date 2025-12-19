/**
 * Unit Tests for TranscriptHandler - ST-329 Transcript Line Persistence
 *
 * TDD Implementation - These tests WILL FAIL until implementation is complete
 *
 * Tests the new functionality for ST-329:
 * - Persist transcript lines to TranscriptLine table
 * - Track line numbers per session
 * - Broadcast to frontend subscribers
 * - Continue broadcasting even if persistence fails
 */

import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../../../prisma/prisma.service';
import { TranscriptHandler } from '../transcript.handler';
import { TranscriptRegistrationService } from '../../transcript-registration.service';

describe('TranscriptHandler - ST-329 Transcript Line Persistence (TDD)', () => {
  let handler: TranscriptHandler;
  let prismaService: jest.Mocked<PrismaService>;
  let mockFrontendServer: jest.Mocked<Server>;
  let mockSocket: jest.Mocked<Socket>;

  const RUN_ID = 'run-123';
  const SESSION_INDEX = 0;

  const mockPrismaService = {
    transcriptLine: {
      createMany: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    remoteAgent: {
      findMany: jest.fn(),
    },
    workflowRun: {
      findUnique: jest.fn(),
    },
  };

  const mockTranscriptRegistrationService = {
    handleTranscriptDetected: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TranscriptHandler,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: TranscriptRegistrationService,
          useValue: mockTranscriptRegistrationService,
        },
      ],
    }).compile();

    handler = module.get<TranscriptHandler>(TranscriptHandler);
    prismaService = module.get(PrismaService) as any;

    // Mock frontend server
    mockFrontendServer = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    } as any;

    // Set frontend server reference
    handler.setFrontendServer(mockFrontendServer);

    // Mock socket
    mockSocket = {
      id: 'socket-123',
      join: jest.fn(),
      leave: jest.fn(),
      emit: jest.fn(),
    } as any;

    // Suppress logger output during tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  describe('persistTranscriptLines - Database Persistence', () => {
    it('should persist transcript lines to database', async () => {
      const lines = [
        { line: '{"type":"text","content":"line 1"}', sequenceNumber: 1 },
        { line: '{"type":"text","content":"line 2"}', sequenceNumber: 2 },
        { line: '{"type":"text","content":"line 3"}', sequenceNumber: 3 },
      ];

      mockPrismaService.transcriptLine.createMany.mockResolvedValue({ count: 3 });

      await handler.handleTranscriptLines({
        runId: RUN_ID,
        sessionIndex: SESSION_INDEX,
        lines,
        isHistorical: false,
        timestamp: new Date().toISOString(),
      });

      expect(mockPrismaService.transcriptLine.createMany).toHaveBeenCalledWith({
        data: [
          {
            workflowRunId: RUN_ID,
            sessionIndex: SESSION_INDEX,
            lineNumber: 1,
            content: '{"type":"text","content":"line 1"}',
          },
          {
            workflowRunId: RUN_ID,
            sessionIndex: SESSION_INDEX,
            lineNumber: 2,
            content: '{"type":"text","content":"line 2"}',
          },
          {
            workflowRunId: RUN_ID,
            sessionIndex: SESSION_INDEX,
            lineNumber: 3,
            content: '{"type":"text","content":"line 3"}',
          },
        ],
        skipDuplicates: true,
      });
    });

    it('should use skipDuplicates to avoid errors on duplicate lines', async () => {
      const lines = [
        { line: '{"type":"text","content":"duplicate"}', sequenceNumber: 1 },
      ];

      mockPrismaService.transcriptLine.createMany.mockResolvedValue({ count: 0 });

      await handler.handleTranscriptLines({
        runId: RUN_ID,
        sessionIndex: SESSION_INDEX,
        lines,
        isHistorical: false,
        timestamp: new Date().toISOString(),
      });

      expect(mockPrismaService.transcriptLine.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skipDuplicates: true,
        }),
      );
    });

    it('should handle empty lines array gracefully', async () => {
      await handler.handleTranscriptLines({
        runId: RUN_ID,
        sessionIndex: SESSION_INDEX,
        lines: [],
        isHistorical: false,
        timestamp: new Date().toISOString(),
      });

      // Should not attempt to insert empty data
      expect(mockPrismaService.transcriptLine.createMany).not.toHaveBeenCalled();
    });

    it('should track correct line numbers for sequential batches', async () => {
      mockPrismaService.transcriptLine.createMany.mockResolvedValue({ count: 2 });

      // First batch
      await handler.handleTranscriptLines({
        runId: RUN_ID,
        sessionIndex: SESSION_INDEX,
        lines: [
          { line: 'line 1', sequenceNumber: 1 },
          { line: 'line 2', sequenceNumber: 2 },
        ],
        isHistorical: false,
        timestamp: new Date().toISOString(),
      });

      // Second batch
      await handler.handleTranscriptLines({
        runId: RUN_ID,
        sessionIndex: SESSION_INDEX,
        lines: [
          { line: 'line 3', sequenceNumber: 3 },
          { line: 'line 4', sequenceNumber: 4 },
        ],
        isHistorical: false,
        timestamp: new Date().toISOString(),
      });

      expect(mockPrismaService.transcriptLine.createMany).toHaveBeenCalledTimes(2);

      // Check first batch
      expect(mockPrismaService.transcriptLine.createMany).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({ lineNumber: 1 }),
            expect.objectContaining({ lineNumber: 2 }),
          ]),
        }),
      );

      // Check second batch
      expect(mockPrismaService.transcriptLine.createMany).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({ lineNumber: 3 }),
            expect.objectContaining({ lineNumber: 4 }),
          ]),
        }),
      );
    });

    it('should handle different session indices correctly', async () => {
      mockPrismaService.transcriptLine.createMany.mockResolvedValue({ count: 1 });

      // Session 0
      await handler.handleTranscriptLines({
        runId: RUN_ID,
        sessionIndex: 0,
        lines: [{ line: 'session 0 line', sequenceNumber: 1 }],
        isHistorical: false,
        timestamp: new Date().toISOString(),
      });

      // Session 1 (after compaction)
      await handler.handleTranscriptLines({
        runId: RUN_ID,
        sessionIndex: 1,
        lines: [{ line: 'session 1 line', sequenceNumber: 1 }],
        isHistorical: false,
        timestamp: new Date().toISOString(),
      });

      expect(mockPrismaService.transcriptLine.createMany).toHaveBeenCalledTimes(2);

      // Check session 0
      expect(mockPrismaService.transcriptLine.createMany).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          data: [
            expect.objectContaining({
              sessionIndex: 0,
              lineNumber: 1,
            }),
          ],
        }),
      );

      // Check session 1
      expect(mockPrismaService.transcriptLine.createMany).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          data: [
            expect.objectContaining({
              sessionIndex: 1,
              lineNumber: 1,
            }),
          ],
        }),
      );
    });
  });

  describe('handleTranscriptBatch - Batch Processing', () => {
    it('should persist batch to database', async () => {
      const lines = [
        { line: 'batch line 1', sequenceNumber: 1 },
        { line: 'batch line 2', sequenceNumber: 2 },
      ];

      mockPrismaService.transcriptLine.createMany.mockResolvedValue({ count: 2 });

      await handler.handleTranscriptBatch({
        runId: RUN_ID,
        sessionIndex: SESSION_INDEX,
        lines,
        isHistorical: true,
        timestamp: new Date().toISOString(),
      });

      expect(mockPrismaService.transcriptLine.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({
              workflowRunId: RUN_ID,
              sessionIndex: SESSION_INDEX,
              lineNumber: 1,
              content: 'batch line 1',
            }),
            expect.objectContaining({
              lineNumber: 2,
              content: 'batch line 2',
            }),
          ]),
        }),
      );
    });

    it('should broadcast to frontend after persisting batch', async () => {
      const lines = [{ line: 'batch line', sequenceNumber: 1 }];

      mockPrismaService.transcriptLine.createMany.mockResolvedValue({ count: 1 });

      await handler.handleTranscriptBatch({
        runId: RUN_ID,
        sessionIndex: SESSION_INDEX,
        lines,
        isHistorical: true,
        timestamp: new Date().toISOString(),
      });

      expect(mockFrontendServer.to).toHaveBeenCalledWith(`master-transcript:${RUN_ID}`);
      expect(mockFrontendServer.emit).toHaveBeenCalledWith(
        'master-transcript:batch',
        expect.objectContaining({
          runId: RUN_ID,
          sessionIndex: SESSION_INDEX,
          lines,
          isHistorical: true,
        }),
      );
    });
  });

  describe('Error Handling - Continue Broadcasting on Persistence Failure', () => {
    it('should continue broadcasting even if persistence fails', async () => {
      const lines = [{ line: 'test line', sequenceNumber: 1 }];

      // Simulate database error
      mockPrismaService.transcriptLine.createMany.mockRejectedValue(
        new Error('Database connection failed'),
      );

      await handler.handleTranscriptLines({
        runId: RUN_ID,
        sessionIndex: SESSION_INDEX,
        lines,
        isHistorical: false,
        timestamp: new Date().toISOString(),
      });

      // Should still broadcast to frontend
      expect(mockFrontendServer.to).toHaveBeenCalledWith(`master-transcript:${RUN_ID}`);
      expect(mockFrontendServer.emit).toHaveBeenCalledWith(
        'master-transcript:lines',
        expect.objectContaining({
          runId: RUN_ID,
          lines,
        }),
      );

      // Should log error
      expect(Logger.prototype.error).toHaveBeenCalledWith(
        expect.stringContaining('[ST-329] Failed to persist transcript lines'),
        expect.anything(),
      );
    });

    it('should handle batch persistence errors gracefully', async () => {
      const lines = [{ line: 'batch line', sequenceNumber: 1 }];

      mockPrismaService.transcriptLine.createMany.mockRejectedValue(
        new Error('Unique constraint violation'),
      );

      await handler.handleTranscriptBatch({
        runId: RUN_ID,
        sessionIndex: SESSION_INDEX,
        lines,
        isHistorical: true,
        timestamp: new Date().toISOString(),
      });

      // Should still broadcast
      expect(mockFrontendServer.emit).toHaveBeenCalledWith('master-transcript:batch', expect.anything());

      // Should log error
      expect(Logger.prototype.error).toHaveBeenCalledWith(
        expect.stringContaining('[ST-329] Failed to persist transcript batch'),
        expect.anything(),
      );
    });

    it('should not throw errors on persistence failure', async () => {
      const lines = [{ line: 'test', sequenceNumber: 1 }];

      mockPrismaService.transcriptLine.createMany.mockRejectedValue(
        new Error('Network timeout'),
      );

      // Should not throw
      await expect(
        handler.handleTranscriptLines({
          runId: RUN_ID,
          sessionIndex: SESSION_INDEX,
          lines,
          isHistorical: false,
          timestamp: new Date().toISOString(),
        }),
      ).resolves.not.toThrow();
    });
  });

  describe('Large Batch Handling', () => {
    it('should handle large batches efficiently', async () => {
      const largeBatch = Array.from({ length: 1000 }, (_, i) => ({
        line: `Line ${i + 1}`,
        sequenceNumber: i + 1,
      }));

      mockPrismaService.transcriptLine.createMany.mockResolvedValue({ count: 1000 });

      await handler.handleTranscriptLines({
        runId: RUN_ID,
        sessionIndex: SESSION_INDEX,
        lines: largeBatch,
        isHistorical: false,
        timestamp: new Date().toISOString(),
      });

      expect(mockPrismaService.transcriptLine.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ lineNumber: 1 }),
          expect.objectContaining({ lineNumber: 1000 }),
        ]),
        skipDuplicates: true,
      });

      // Should create exactly 1000 records
      const createCall = mockPrismaService.transcriptLine.createMany.mock.calls[0][0];
      expect(createCall.data).toHaveLength(1000);
    });
  });

  describe('Integration with Existing Broadcast Logic', () => {
    it('should persist before broadcasting for handleTranscriptLines', async () => {
      const lines = [{ line: 'test', sequenceNumber: 1 }];
      const callOrder: string[] = [];

      mockPrismaService.transcriptLine.createMany.mockImplementation(async () => {
        callOrder.push('persist');
        return { count: 1 };
      });

      const originalTo = mockFrontendServer.to;
      mockFrontendServer.to = jest.fn().mockImplementation((...args) => {
        callOrder.push('broadcast');
        return originalTo.apply(mockFrontendServer, args);
      });

      await handler.handleTranscriptLines({
        runId: RUN_ID,
        sessionIndex: SESSION_INDEX,
        lines,
        isHistorical: false,
        timestamp: new Date().toISOString(),
      });

      // Persistence should happen before broadcast
      expect(callOrder).toEqual(['persist', 'broadcast']);
    });

    it('should maintain existing broadcast format', async () => {
      const timestamp = new Date().toISOString();
      const lines = [{ line: 'test line', sequenceNumber: 1 }];

      mockPrismaService.transcriptLine.createMany.mockResolvedValue({ count: 1 });

      await handler.handleTranscriptLines({
        runId: RUN_ID,
        sessionIndex: SESSION_INDEX,
        lines,
        isHistorical: false,
        timestamp,
      });

      expect(mockFrontendServer.emit).toHaveBeenCalledWith('master-transcript:lines', {
        runId: RUN_ID,
        sessionIndex: SESSION_INDEX,
        lines,
        isHistorical: false,
        timestamp,
      });
    });
  });

  describe('Content Validation', () => {
    it('should preserve exact line content including special characters', async () => {
      const lines = [
        {
          line: '{"type":"text","content":"Line with \\"quotes\\" and \\nescapes"}',
          sequenceNumber: 1,
        },
      ];

      mockPrismaService.transcriptLine.createMany.mockResolvedValue({ count: 1 });

      await handler.handleTranscriptLines({
        runId: RUN_ID,
        sessionIndex: SESSION_INDEX,
        lines,
        isHistorical: false,
        timestamp: new Date().toISOString(),
      });

      const createCall = mockPrismaService.transcriptLine.createMany.mock.calls[0][0];
      expect(createCall.data[0].content).toBe(
        '{"type":"text","content":"Line with \\"quotes\\" and \\nescapes"}',
      );
    });

    it('should handle multi-line JSON content', async () => {
      const multiLineContent = `{
  "type": "text",
  "content": "Multi-line content"
}`;

      const lines = [{ line: multiLineContent, sequenceNumber: 1 }];

      mockPrismaService.transcriptLine.createMany.mockResolvedValue({ count: 1 });

      await handler.handleTranscriptLines({
        runId: RUN_ID,
        sessionIndex: SESSION_INDEX,
        lines,
        isHistorical: false,
        timestamp: new Date().toISOString(),
      });

      const createCall = mockPrismaService.transcriptLine.createMany.mock.calls[0][0];
      expect(createCall.data[0].content).toBe(multiLineContent);
    });
  });
});
