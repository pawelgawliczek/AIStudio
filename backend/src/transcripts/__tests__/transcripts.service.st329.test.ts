/**
 * Unit Tests for TranscriptsService - ST-329 Lines Retrieval
 *
 * TDD Implementation - These tests WILL FAIL until service is implemented
 *
 * Service layer business logic for transcript line retrieval:
 * - Authorization validation
 * - Pagination logic
 * - Session filtering
 * - Response formatting
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TranscriptsService } from '../transcripts.service';

describe('TranscriptsService - ST-329 Lines Retrieval (TDD)', () => {
  let service: TranscriptsService;
  let prismaService: jest.Mocked<PrismaService>;

  const USER_ID = 'user-123';
  const RUN_ID = 'run-789';
  const PROJECT_ID = 'proj-456';

  const mockPrismaService = {
    transcriptLine: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    workflowRun: {
      findUnique: jest.fn(),
    },
    project: {
      findFirst: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TranscriptsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<TranscriptsService>(TranscriptsService);
    prismaService = module.get(PrismaService) as any;
  });

  describe('getTranscriptLines - Authorization', () => {
    it('should throw NotFoundException when workflow run not found', async () => {
      mockPrismaService.workflowRun.findUnique.mockResolvedValue(null);

      await expect(
        service.getTranscriptLines('non-existent-run', USER_ID),
      ).rejects.toThrow(NotFoundException);

      await expect(
        service.getTranscriptLines('non-existent-run', USER_ID),
      ).rejects.toThrow('Workflow run not found');
    });

    it('should throw ForbiddenException when user lacks project access', async () => {
      mockPrismaService.workflowRun.findUnique.mockResolvedValue({
        id: RUN_ID,
        projectId: PROJECT_ID,
      } as any);

      // User does not have access
      mockPrismaService.project.findFirst.mockResolvedValue(null);

      await expect(
        service.getTranscriptLines(RUN_ID, USER_ID),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        service.getTranscriptLines(RUN_ID, USER_ID),
      ).rejects.toThrow('Access denied to this workflow run');
    });

    it('should allow access when user has project access', async () => {
      mockPrismaService.workflowRun.findUnique.mockResolvedValue({
        id: RUN_ID,
        projectId: PROJECT_ID,
      } as any);

      mockPrismaService.project.findFirst.mockResolvedValue({
        id: PROJECT_ID,
        users: [{ id: USER_ID }],
      } as any);

      mockPrismaService.transcriptLine.findMany.mockResolvedValue([]);
      mockPrismaService.transcriptLine.count.mockResolvedValue(0);

      await expect(
        service.getTranscriptLines(RUN_ID, USER_ID),
      ).resolves.not.toThrow();
    });

    it('should verify project access with correct query', async () => {
      mockPrismaService.workflowRun.findUnique.mockResolvedValue({
        id: RUN_ID,
        projectId: PROJECT_ID,
      } as any);

      mockPrismaService.project.findFirst.mockResolvedValue({
        id: PROJECT_ID,
      } as any);

      mockPrismaService.transcriptLine.findMany.mockResolvedValue([]);
      mockPrismaService.transcriptLine.count.mockResolvedValue(0);

      await service.getTranscriptLines(RUN_ID, USER_ID);

      expect(mockPrismaService.project.findFirst).toHaveBeenCalledWith({
        where: {
          id: PROJECT_ID,
          users: {
            some: {
              id: USER_ID,
            },
          },
        },
      });
    });
  });

  describe('getTranscriptLines - Basic Retrieval', () => {
    beforeEach(() => {
      // Setup default authorization mocks
      mockPrismaService.workflowRun.findUnique.mockResolvedValue({
        id: RUN_ID,
        projectId: PROJECT_ID,
      } as any);

      mockPrismaService.project.findFirst.mockResolvedValue({
        id: PROJECT_ID,
      } as any);
    });

    it('should return transcript lines with metadata', async () => {
      const mockLines = [
        {
          id: 'line-1',
          workflowRunId: RUN_ID,
          sessionIndex: 0,
          lineNumber: 1,
          content: 'Line 1',
          createdAt: new Date(),
        },
        {
          id: 'line-2',
          workflowRunId: RUN_ID,
          sessionIndex: 0,
          lineNumber: 2,
          content: 'Line 2',
          createdAt: new Date(),
        },
      ];

      mockPrismaService.transcriptLine.findMany.mockResolvedValue(mockLines as any);
      mockPrismaService.transcriptLine.count.mockResolvedValue(2);

      const result = await service.getTranscriptLines(RUN_ID, USER_ID);

      expect(result).toEqual({
        lines: [
          {
            lineNumber: 1,
            sessionIndex: 0,
            content: 'Line 1',
            createdAt: expect.any(Date),
          },
          {
            lineNumber: 2,
            sessionIndex: 0,
            content: 'Line 2',
            createdAt: expect.any(Date),
          },
        ],
        total: 2,
        offset: 0,
        limit: 100,
      });
    });

    it('should exclude internal fields from response', async () => {
      const mockLines = [
        {
          id: 'internal-uuid',
          workflowRunId: RUN_ID,
          sessionIndex: 0,
          lineNumber: 1,
          content: 'test',
          createdAt: new Date(),
        },
      ];

      mockPrismaService.transcriptLine.findMany.mockResolvedValue(mockLines as any);
      mockPrismaService.transcriptLine.count.mockResolvedValue(1);

      const result = await service.getTranscriptLines(RUN_ID, USER_ID);

      expect(result.lines[0]).not.toHaveProperty('id');
      expect(result.lines[0]).not.toHaveProperty('workflowRunId');
      expect(result.lines[0]).toHaveProperty('lineNumber');
      expect(result.lines[0]).toHaveProperty('sessionIndex');
      expect(result.lines[0]).toHaveProperty('content');
      expect(result.lines[0]).toHaveProperty('createdAt');
    });

    it('should query with correct ordering', async () => {
      mockPrismaService.transcriptLine.findMany.mockResolvedValue([]);
      mockPrismaService.transcriptLine.count.mockResolvedValue(0);

      await service.getTranscriptLines(RUN_ID, USER_ID);

      expect(mockPrismaService.transcriptLine.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ sessionIndex: 'asc' }, { lineNumber: 'asc' }],
        }),
      );
    });

    it('should return empty array when no lines exist', async () => {
      mockPrismaService.transcriptLine.findMany.mockResolvedValue([]);
      mockPrismaService.transcriptLine.count.mockResolvedValue(0);

      const result = await service.getTranscriptLines(RUN_ID, USER_ID);

      expect(result).toEqual({
        lines: [],
        total: 0,
        offset: 0,
        limit: 100,
      });
    });
  });

  describe('getTranscriptLines - Pagination', () => {
    beforeEach(() => {
      mockPrismaService.workflowRun.findUnique.mockResolvedValue({
        id: RUN_ID,
        projectId: PROJECT_ID,
      } as any);

      mockPrismaService.project.findFirst.mockResolvedValue({
        id: PROJECT_ID,
      } as any);
    });

    it('should use default pagination when not specified', async () => {
      mockPrismaService.transcriptLine.findMany.mockResolvedValue([]);
      mockPrismaService.transcriptLine.count.mockResolvedValue(0);

      const result = await service.getTranscriptLines(RUN_ID, USER_ID);

      expect(result.offset).toBe(0);
      expect(result.limit).toBe(100);

      expect(mockPrismaService.transcriptLine.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 100,
        }),
      );
    });

    it('should apply custom offset', async () => {
      mockPrismaService.transcriptLine.findMany.mockResolvedValue([]);
      mockPrismaService.transcriptLine.count.mockResolvedValue(500);

      const result = await service.getTranscriptLines(RUN_ID, USER_ID, {
        offset: 200,
      });

      expect(result.offset).toBe(200);

      expect(mockPrismaService.transcriptLine.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 200,
        }),
      );
    });

    it('should apply custom limit', async () => {
      mockPrismaService.transcriptLine.findMany.mockResolvedValue([]);
      mockPrismaService.transcriptLine.count.mockResolvedValue(500);

      const result = await service.getTranscriptLines(RUN_ID, USER_ID, {
        limit: 50,
      });

      expect(result.limit).toBe(50);

      expect(mockPrismaService.transcriptLine.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 50,
        }),
      );
    });

    it('should cap limit at maximum of 1000', async () => {
      mockPrismaService.transcriptLine.findMany.mockResolvedValue([]);
      mockPrismaService.transcriptLine.count.mockResolvedValue(5000);

      const result = await service.getTranscriptLines(RUN_ID, USER_ID, {
        limit: 5000,
      });

      expect(result.limit).toBe(1000);

      expect(mockPrismaService.transcriptLine.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 1000,
        }),
      );
    });

    it('should throw BadRequestException for negative offset', async () => {
      await expect(
        service.getTranscriptLines(RUN_ID, USER_ID, { offset: -10 }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.getTranscriptLines(RUN_ID, USER_ID, { offset: -10 }),
      ).rejects.toThrow('Offset must be non-negative');
    });

    it('should throw BadRequestException for negative limit', async () => {
      await expect(
        service.getTranscriptLines(RUN_ID, USER_ID, { limit: -5 }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.getTranscriptLines(RUN_ID, USER_ID, { limit: -5 }),
      ).rejects.toThrow('Limit must be positive');
    });

    it('should throw BadRequestException for zero limit', async () => {
      await expect(
        service.getTranscriptLines(RUN_ID, USER_ID, { limit: 0 }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.getTranscriptLines(RUN_ID, USER_ID, { limit: 0 }),
      ).rejects.toThrow('Limit must be positive');
    });
  });

  describe('getTranscriptLines - Session Filtering', () => {
    beforeEach(() => {
      mockPrismaService.workflowRun.findUnique.mockResolvedValue({
        id: RUN_ID,
        projectId: PROJECT_ID,
      } as any);

      mockPrismaService.project.findFirst.mockResolvedValue({
        id: PROJECT_ID,
      } as any);
    });

    it('should filter by sessionIndex when provided', async () => {
      mockPrismaService.transcriptLine.findMany.mockResolvedValue([]);
      mockPrismaService.transcriptLine.count.mockResolvedValue(0);

      await service.getTranscriptLines(RUN_ID, USER_ID, {
        sessionIndex: 1,
      });

      expect(mockPrismaService.transcriptLine.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            workflowRunId: RUN_ID,
            sessionIndex: 1,
          },
        }),
      );

      expect(mockPrismaService.transcriptLine.count).toHaveBeenCalledWith({
        where: {
          workflowRunId: RUN_ID,
          sessionIndex: 1,
        },
      });
    });

    it('should not filter by sessionIndex when not provided', async () => {
      mockPrismaService.transcriptLine.findMany.mockResolvedValue([]);
      mockPrismaService.transcriptLine.count.mockResolvedValue(0);

      await service.getTranscriptLines(RUN_ID, USER_ID);

      expect(mockPrismaService.transcriptLine.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            workflowRunId: RUN_ID,
          },
        }),
      );
    });

    it('should handle sessionIndex=0 correctly', async () => {
      mockPrismaService.transcriptLine.findMany.mockResolvedValue([]);
      mockPrismaService.transcriptLine.count.mockResolvedValue(0);

      await service.getTranscriptLines(RUN_ID, USER_ID, {
        sessionIndex: 0,
      });

      expect(mockPrismaService.transcriptLine.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            workflowRunId: RUN_ID,
            sessionIndex: 0,
          },
        }),
      );
    });

    it('should throw BadRequestException for negative sessionIndex', async () => {
      await expect(
        service.getTranscriptLines(RUN_ID, USER_ID, { sessionIndex: -1 }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.getTranscriptLines(RUN_ID, USER_ID, { sessionIndex: -1 }),
      ).rejects.toThrow('Session index must be non-negative');
    });

    it('should apply both sessionIndex and pagination', async () => {
      mockPrismaService.transcriptLine.findMany.mockResolvedValue([]);
      mockPrismaService.transcriptLine.count.mockResolvedValue(0);

      await service.getTranscriptLines(RUN_ID, USER_ID, {
        sessionIndex: 1,
        offset: 50,
        limit: 25,
      });

      expect(mockPrismaService.transcriptLine.findMany).toHaveBeenCalledWith({
        where: {
          workflowRunId: RUN_ID,
          sessionIndex: 1,
        },
        orderBy: [{ sessionIndex: 'asc' }, { lineNumber: 'asc' }],
        skip: 50,
        take: 25,
      });
    });
  });

  describe('getTranscriptLines - Content Preservation', () => {
    beforeEach(() => {
      mockPrismaService.workflowRun.findUnique.mockResolvedValue({
        id: RUN_ID,
        projectId: PROJECT_ID,
      } as any);

      mockPrismaService.project.findFirst.mockResolvedValue({
        id: PROJECT_ID,
      } as any);
    });

    it('should preserve special characters in content', async () => {
      const complexContent = '{"type":"text","content":"Line with \\"quotes\\" and \\nescapes"}';

      const mockLines = [
        {
          id: 'line-1',
          workflowRunId: RUN_ID,
          sessionIndex: 0,
          lineNumber: 1,
          content: complexContent,
          createdAt: new Date(),
        },
      ];

      mockPrismaService.transcriptLine.findMany.mockResolvedValue(mockLines as any);
      mockPrismaService.transcriptLine.count.mockResolvedValue(1);

      const result = await service.getTranscriptLines(RUN_ID, USER_ID);

      expect(result.lines[0].content).toBe(complexContent);
    });

    it('should preserve unicode characters', async () => {
      const unicodeContent = 'Test with emoji: 🎉 and unicode: 你好';

      const mockLines = [
        {
          id: 'line-1',
          workflowRunId: RUN_ID,
          sessionIndex: 0,
          lineNumber: 1,
          content: unicodeContent,
          createdAt: new Date(),
        },
      ];

      mockPrismaService.transcriptLine.findMany.mockResolvedValue(mockLines as any);
      mockPrismaService.transcriptLine.count.mockResolvedValue(1);

      const result = await service.getTranscriptLines(RUN_ID, USER_ID);

      expect(result.lines[0].content).toBe(unicodeContent);
    });

    it('should preserve multi-line content', async () => {
      const multiLineContent = `Line 1
Line 2
Line 3`;

      const mockLines = [
        {
          id: 'line-1',
          workflowRunId: RUN_ID,
          sessionIndex: 0,
          lineNumber: 1,
          content: multiLineContent,
          createdAt: new Date(),
        },
      ];

      mockPrismaService.transcriptLine.findMany.mockResolvedValue(mockLines as any);
      mockPrismaService.transcriptLine.count.mockResolvedValue(1);

      const result = await service.getTranscriptLines(RUN_ID, USER_ID);

      expect(result.lines[0].content).toBe(multiLineContent);
    });
  });

  describe('getTranscriptLines - Performance Optimization', () => {
    beforeEach(() => {
      mockPrismaService.workflowRun.findUnique.mockResolvedValue({
        id: RUN_ID,
        projectId: PROJECT_ID,
      } as any);

      mockPrismaService.project.findFirst.mockResolvedValue({
        id: PROJECT_ID,
      } as any);
    });

    it('should execute count and findMany queries efficiently', async () => {
      mockPrismaService.transcriptLine.findMany.mockResolvedValue([]);
      mockPrismaService.transcriptLine.count.mockResolvedValue(0);

      await service.getTranscriptLines(RUN_ID, USER_ID);

      // Both queries should use the same where clause for consistency
      const expectedWhere = { workflowRunId: RUN_ID };

      expect(mockPrismaService.transcriptLine.count).toHaveBeenCalledWith({
        where: expectedWhere,
      });

      expect(mockPrismaService.transcriptLine.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expectedWhere,
        }),
      );
    });

    it('should use indexed fields for filtering', async () => {
      mockPrismaService.transcriptLine.findMany.mockResolvedValue([]);
      mockPrismaService.transcriptLine.count.mockResolvedValue(0);

      await service.getTranscriptLines(RUN_ID, USER_ID, {
        sessionIndex: 0,
      });

      // Query uses indexed fields: workflowRunId, sessionIndex
      expect(mockPrismaService.transcriptLine.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            workflowRunId: RUN_ID,
            sessionIndex: 0,
          },
          // Order by indexed fields for efficient sorting
          orderBy: [{ sessionIndex: 'asc' }, { lineNumber: 'asc' }],
        }),
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      mockPrismaService.workflowRun.findUnique.mockRejectedValue(
        new Error('Database connection failed'),
      );

      await expect(
        service.getTranscriptLines(RUN_ID, USER_ID),
      ).rejects.toThrow('Database connection failed');
    });

    it('should handle null count gracefully', async () => {
      mockPrismaService.workflowRun.findUnique.mockResolvedValue({
        id: RUN_ID,
        projectId: PROJECT_ID,
      } as any);

      mockPrismaService.project.findFirst.mockResolvedValue({
        id: PROJECT_ID,
      } as any);

      mockPrismaService.transcriptLine.findMany.mockResolvedValue([]);
      mockPrismaService.transcriptLine.count.mockResolvedValue(null as any);

      const result = await service.getTranscriptLines(RUN_ID, USER_ID);

      // Should handle null count as 0
      expect(result.total).toBe(0);
    });
  });
});
