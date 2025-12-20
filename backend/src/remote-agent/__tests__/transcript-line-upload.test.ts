/**
 * ST-329: Test transcript_line uploads are saved to transcript_lines table
 */
import { Test, TestingModule } from '@nestjs/testing';
import { Socket } from 'socket.io';
import { PrismaService } from '../../prisma/prisma.service';
import { TranscriptHandler } from '../handlers/transcript.handler';
import { TranscriptRegistrationService } from '../transcript-registration.service';

describe('ST-329: Transcript Line Upload', () => {
  let prismaService: jest.Mocked<PrismaService>;
  let transcriptHandler: TranscriptHandler;
  let mockSocket: Partial<Socket>;

  beforeEach(async () => {
    // Mock Prisma service
    const mockPrismaService = {
      transcriptLine: {
        createMany: jest.fn().mockResolvedValue({ count: 5 }),
      },
    };

    // Mock transcript registration service
    const mockTranscriptRegistrationService = {
      handleTranscriptDetected: jest.fn(),
    };

    mockSocket = {
      id: 'test-socket-id',
      emit: jest.fn(),
      data: { agentId: 'test-agent-id' },
      join: jest.fn(),
      leave: jest.fn(),
    } as unknown as Partial<Socket>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: TranscriptRegistrationService,
          useValue: mockTranscriptRegistrationService,
        },
        TranscriptHandler,
      ],
    }).compile();

    prismaService = module.get(PrismaService);
    transcriptHandler = module.get(TranscriptHandler);
  });

  describe('handleTranscriptLines', () => {
    it('should persist transcript lines to transcript_lines table', async () => {
      const payload = {
        queueId: 123,
        runId: 'workflow-run-uuid',
        sessionIndex: 0,
        lines: [
          { line: 'Test line 1', sequenceNumber: 1 },
          { line: 'Test line 2', sequenceNumber: 2 },
          { line: 'Test line 3', sequenceNumber: 3 },
        ],
        isHistorical: true,
        timestamp: new Date().toISOString(),
      };

      // Call handleTranscriptLines
      const result = await transcriptHandler.handleTranscriptLines(payload);

      // Verify success response
      expect(result).toEqual({
        success: true,
        queueId: 123,
        linesCount: 3,
      });

      // Verify transcript lines were persisted to DB
      expect(prismaService.transcriptLine.createMany).toHaveBeenCalledWith({
        data: [
          {
            workflowRunId: 'workflow-run-uuid',
            sessionIndex: 0,
            lineNumber: 1,
            content: 'Test line 1',
          },
          {
            workflowRunId: 'workflow-run-uuid',
            sessionIndex: 0,
            lineNumber: 2,
            content: 'Test line 2',
          },
          {
            workflowRunId: 'workflow-run-uuid',
            sessionIndex: 0,
            lineNumber: 3,
            content: 'Test line 3',
          },
        ],
        skipDuplicates: true,
      });
    });

    it('should handle empty lines array gracefully', async () => {
      const payload = {
        queueId: 456,
        runId: 'workflow-run-uuid',
        sessionIndex: 1,
        lines: [],
        isHistorical: false,
        timestamp: new Date().toISOString(),
      };

      // Call handleTranscriptLines
      const result = await transcriptHandler.handleTranscriptLines(payload);

      // Verify success response
      expect(result).toEqual({
        success: true,
        queueId: 456,
        linesCount: 0,
      });

      // Verify DB was not called for empty array
      expect(prismaService.transcriptLine.createMany).not.toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      // Mock database error
      const dbError = new Error('Database connection failed');
      (prismaService.transcriptLine.createMany as jest.Mock).mockRejectedValueOnce(dbError);

      const payload = {
        queueId: 789,
        runId: 'workflow-run-uuid',
        sessionIndex: 0,
        lines: [{ line: 'Test line', sequenceNumber: 1 }],
        isHistorical: true,
        timestamp: new Date().toISOString(),
      };

      // Call handleTranscriptLines
      const result = await transcriptHandler.handleTranscriptLines(payload);

      // Verify error response
      expect(result).toEqual({
        success: false,
        queueId: 789,
        error: 'Database connection failed',
      });
    });
  });
});
