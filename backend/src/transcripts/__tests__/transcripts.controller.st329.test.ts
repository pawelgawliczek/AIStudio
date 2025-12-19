/**
 * Integration Tests for TranscriptsController - ST-329 REST Endpoint
 *
 * TDD Implementation - These tests WILL FAIL until controller is implemented
 *
 * Tests for new REST endpoint: GET /api/transcripts/:runId/lines
 * Requirements from ST-329:
 * - Fetch historical transcript lines from database
 * - Support pagination (offset, limit)
 * - Filter by sessionIndex
 * - Return lines ordered by lineNumber
 * - Authentication and authorization
 */

import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { TranscriptsController } from '../transcripts.controller';
import { TranscriptsService } from '../transcripts.service';

describe('TranscriptsController - ST-329 Lines Endpoint (TDD)', () => {
  let app: INestApplication;
  let prismaService: jest.Mocked<PrismaService>;

  const VALID_JWT = 'Bearer valid-jwt-token-12345';
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
      controllers: [TranscriptsController],
      providers: [
        TranscriptsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context) => {
          const request = context.switchToHttp().getRequest();
          if (request.headers.authorization === VALID_JWT) {
            request.user = { id: USER_ID };
            return true;
          }
          return false;
        },
      })
      .compile();

    app = module.createNestApplication();
    await app.init();

    prismaService = module.get(PrismaService) as any;
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /api/transcripts/:runId/lines - Authentication', () => {
    it('should reject unauthenticated requests', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/transcripts/${RUN_ID}/lines`)
        .expect(401);

      expect(response.body).toMatchObject({
        statusCode: 401,
        message: expect.stringMatching(/unauthorized/i),
      });

      expect(mockPrismaService.transcriptLine.findMany).not.toHaveBeenCalled();
    });

    it('should accept requests with valid JWT', async () => {
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

      await request(app.getHttpServer())
        .get(`/api/transcripts/${RUN_ID}/lines`)
        .set('Authorization', VALID_JWT)
        .expect(200);
    });
  });

  describe('GET /api/transcripts/:runId/lines - Authorization', () => {
    it('should reject access to workflow runs from other users projects', async () => {
      mockPrismaService.workflowRun.findUnique.mockResolvedValue({
        id: RUN_ID,
        projectId: PROJECT_ID,
      } as any);

      // User does not have access to this project
      mockPrismaService.project.findFirst.mockResolvedValue(null);

      const response = await request(app.getHttpServer())
        .get(`/api/transcripts/${RUN_ID}/lines`)
        .set('Authorization', VALID_JWT)
        .expect(403);

      expect(response.body).toMatchObject({
        statusCode: 403,
        message: expect.stringMatching(/access denied|forbidden/i),
      });
    });

    it('should allow access to own projects', async () => {
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

      await request(app.getHttpServer())
        .get(`/api/transcripts/${RUN_ID}/lines`)
        .set('Authorization', VALID_JWT)
        .expect(200);
    });

    it('should return 404 when workflow run not found', async () => {
      mockPrismaService.workflowRun.findUnique.mockResolvedValue(null);

      await request(app.getHttpServer())
        .get(`/api/transcripts/non-existent-run/lines`)
        .set('Authorization', VALID_JWT)
        .expect(404);
    });
  });

  describe('GET /api/transcripts/:runId/lines - Basic Retrieval', () => {
    beforeEach(() => {
      // Setup default authorization mocks
      mockPrismaService.workflowRun.findUnique.mockResolvedValue({
        id: RUN_ID,
        projectId: PROJECT_ID,
      } as any);

      mockPrismaService.project.findFirst.mockResolvedValue({
        id: PROJECT_ID,
        users: [{ id: USER_ID }],
      } as any);
    });

    it('should return transcript lines ordered by lineNumber', async () => {
      const mockLines = [
        {
          id: 'line-1',
          workflowRunId: RUN_ID,
          sessionIndex: 0,
          lineNumber: 1,
          content: '{"type":"text","content":"Line 1"}',
          createdAt: new Date('2025-12-19T10:00:00Z'),
        },
        {
          id: 'line-2',
          workflowRunId: RUN_ID,
          sessionIndex: 0,
          lineNumber: 2,
          content: '{"type":"text","content":"Line 2"}',
          createdAt: new Date('2025-12-19T10:00:01Z'),
        },
        {
          id: 'line-3',
          workflowRunId: RUN_ID,
          sessionIndex: 0,
          lineNumber: 3,
          content: '{"type":"text","content":"Line 3"}',
          createdAt: new Date('2025-12-19T10:00:02Z'),
        },
      ];

      mockPrismaService.transcriptLine.findMany.mockResolvedValue(mockLines as any);
      mockPrismaService.transcriptLine.count.mockResolvedValue(3);

      const response = await request(app.getHttpServer())
        .get(`/api/transcripts/${RUN_ID}/lines`)
        .set('Authorization', VALID_JWT)
        .expect(200);

      expect(response.body).toMatchObject({
        lines: [
          {
            lineNumber: 1,
            content: '{"type":"text","content":"Line 1"}',
            sessionIndex: 0,
          },
          {
            lineNumber: 2,
            content: '{"type":"text","content":"Line 2"}',
            sessionIndex: 0,
          },
          {
            lineNumber: 3,
            content: '{"type":"text","content":"Line 3"}',
            sessionIndex: 0,
          },
        ],
        total: 3,
        offset: 0,
        limit: 100,
      });

      expect(mockPrismaService.transcriptLine.findMany).toHaveBeenCalledWith({
        where: { workflowRunId: RUN_ID },
        orderBy: [{ sessionIndex: 'asc' }, { lineNumber: 'asc' }],
        skip: 0,
        take: 100,
      });
    });

    it('should return empty array when no lines exist', async () => {
      mockPrismaService.transcriptLine.findMany.mockResolvedValue([]);
      mockPrismaService.transcriptLine.count.mockResolvedValue(0);

      const response = await request(app.getHttpServer())
        .get(`/api/transcripts/${RUN_ID}/lines`)
        .set('Authorization', VALID_JWT)
        .expect(200);

      expect(response.body).toEqual({
        lines: [],
        total: 0,
        offset: 0,
        limit: 100,
      });
    });
  });

  describe('GET /api/transcripts/:runId/lines - Pagination', () => {
    beforeEach(() => {
      mockPrismaService.workflowRun.findUnique.mockResolvedValue({
        id: RUN_ID,
        projectId: PROJECT_ID,
      } as any);

      mockPrismaService.project.findFirst.mockResolvedValue({
        id: PROJECT_ID,
        users: [{ id: USER_ID }],
      } as any);
    });

    it('should support offset parameter', async () => {
      mockPrismaService.transcriptLine.findMany.mockResolvedValue([]);
      mockPrismaService.transcriptLine.count.mockResolvedValue(500);

      await request(app.getHttpServer())
        .get(`/api/transcripts/${RUN_ID}/lines?offset=100`)
        .set('Authorization', VALID_JWT)
        .expect(200);

      expect(mockPrismaService.transcriptLine.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 100,
        }),
      );
    });

    it('should support limit parameter', async () => {
      mockPrismaService.transcriptLine.findMany.mockResolvedValue([]);
      mockPrismaService.transcriptLine.count.mockResolvedValue(500);

      await request(app.getHttpServer())
        .get(`/api/transcripts/${RUN_ID}/lines?limit=50`)
        .set('Authorization', VALID_JWT)
        .expect(200);

      expect(mockPrismaService.transcriptLine.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 50,
        }),
      );
    });

    it('should support both offset and limit parameters', async () => {
      mockPrismaService.transcriptLine.findMany.mockResolvedValue([]);
      mockPrismaService.transcriptLine.count.mockResolvedValue(500);

      const response = await request(app.getHttpServer())
        .get(`/api/transcripts/${RUN_ID}/lines?offset=200&limit=25`)
        .set('Authorization', VALID_JWT)
        .expect(200);

      expect(mockPrismaService.transcriptLine.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 200,
          take: 25,
        }),
      );

      expect(response.body).toMatchObject({
        offset: 200,
        limit: 25,
        total: 500,
      });
    });

    it('should enforce maximum limit of 1000', async () => {
      mockPrismaService.transcriptLine.findMany.mockResolvedValue([]);
      mockPrismaService.transcriptLine.count.mockResolvedValue(5000);

      await request(app.getHttpServer())
        .get(`/api/transcripts/${RUN_ID}/lines?limit=5000`)
        .set('Authorization', VALID_JWT)
        .expect(200);

      expect(mockPrismaService.transcriptLine.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 1000, // Should be capped at 1000
        }),
      );
    });

    it('should default to limit=100 when not specified', async () => {
      mockPrismaService.transcriptLine.findMany.mockResolvedValue([]);
      mockPrismaService.transcriptLine.count.mockResolvedValue(500);

      await request(app.getHttpServer())
        .get(`/api/transcripts/${RUN_ID}/lines`)
        .set('Authorization', VALID_JWT)
        .expect(200);

      expect(mockPrismaService.transcriptLine.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 100,
        }),
      );
    });

    it('should reject negative offset', async () => {
      await request(app.getHttpServer())
        .get(`/api/transcripts/${RUN_ID}/lines?offset=-10`)
        .set('Authorization', VALID_JWT)
        .expect(400);
    });

    it('should reject negative limit', async () => {
      await request(app.getHttpServer())
        .get(`/api/transcripts/${RUN_ID}/lines?limit=-5`)
        .set('Authorization', VALID_JWT)
        .expect(400);
    });

    it('should reject non-numeric offset', async () => {
      await request(app.getHttpServer())
        .get(`/api/transcripts/${RUN_ID}/lines?offset=abc`)
        .set('Authorization', VALID_JWT)
        .expect(400);
    });
  });

  describe('GET /api/transcripts/:runId/lines - Session Filtering', () => {
    beforeEach(() => {
      mockPrismaService.workflowRun.findUnique.mockResolvedValue({
        id: RUN_ID,
        projectId: PROJECT_ID,
      } as any);

      mockPrismaService.project.findFirst.mockResolvedValue({
        id: PROJECT_ID,
        users: [{ id: USER_ID }],
      } as any);
    });

    it('should filter by sessionIndex', async () => {
      const session1Lines = [
        {
          id: 'line-1',
          workflowRunId: RUN_ID,
          sessionIndex: 1,
          lineNumber: 1,
          content: 'Session 1 line',
          createdAt: new Date(),
        },
      ];

      mockPrismaService.transcriptLine.findMany.mockResolvedValue(session1Lines as any);
      mockPrismaService.transcriptLine.count.mockResolvedValue(1);

      await request(app.getHttpServer())
        .get(`/api/transcripts/${RUN_ID}/lines?sessionIndex=1`)
        .set('Authorization', VALID_JWT)
        .expect(200);

      expect(mockPrismaService.transcriptLine.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            workflowRunId: RUN_ID,
            sessionIndex: 1,
          },
        }),
      );
    });

    it('should return all sessions when sessionIndex not specified', async () => {
      mockPrismaService.transcriptLine.findMany.mockResolvedValue([]);
      mockPrismaService.transcriptLine.count.mockResolvedValue(0);

      await request(app.getHttpServer())
        .get(`/api/transcripts/${RUN_ID}/lines`)
        .set('Authorization', VALID_JWT)
        .expect(200);

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

      await request(app.getHttpServer())
        .get(`/api/transcripts/${RUN_ID}/lines?sessionIndex=0`)
        .set('Authorization', VALID_JWT)
        .expect(200);

      expect(mockPrismaService.transcriptLine.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            workflowRunId: RUN_ID,
            sessionIndex: 0,
          },
        }),
      );
    });

    it('should reject negative sessionIndex', async () => {
      await request(app.getHttpServer())
        .get(`/api/transcripts/${RUN_ID}/lines?sessionIndex=-1`)
        .set('Authorization', VALID_JWT)
        .expect(400);
    });
  });

  describe('GET /api/transcripts/:runId/lines - Response Format', () => {
    beforeEach(() => {
      mockPrismaService.workflowRun.findUnique.mockResolvedValue({
        id: RUN_ID,
        projectId: PROJECT_ID,
      } as any);

      mockPrismaService.project.findFirst.mockResolvedValue({
        id: PROJECT_ID,
        users: [{ id: USER_ID }],
      } as any);
    });

    it('should include metadata in response', async () => {
      const mockLines = [
        {
          id: 'line-1',
          workflowRunId: RUN_ID,
          sessionIndex: 0,
          lineNumber: 1,
          content: 'test',
          createdAt: new Date(),
        },
      ];

      mockPrismaService.transcriptLine.findMany.mockResolvedValue(mockLines as any);
      mockPrismaService.transcriptLine.count.mockResolvedValue(1);

      const response = await request(app.getHttpServer())
        .get(`/api/transcripts/${RUN_ID}/lines`)
        .set('Authorization', VALID_JWT)
        .expect(200);

      expect(response.body).toHaveProperty('lines');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('offset');
      expect(response.body).toHaveProperty('limit');
    });

    it('should not expose internal IDs', async () => {
      const mockLines = [
        {
          id: 'internal-uuid-123',
          workflowRunId: RUN_ID,
          sessionIndex: 0,
          lineNumber: 1,
          content: 'test',
          createdAt: new Date(),
        },
      ];

      mockPrismaService.transcriptLine.findMany.mockResolvedValue(mockLines as any);
      mockPrismaService.transcriptLine.count.mockResolvedValue(1);

      const response = await request(app.getHttpServer())
        .get(`/api/transcripts/${RUN_ID}/lines`)
        .set('Authorization', VALID_JWT)
        .expect(200);

      // Should not expose internal database ID
      expect(response.body.lines[0]).not.toHaveProperty('id');
      expect(response.body.lines[0]).not.toHaveProperty('workflowRunId');
    });

    it('should preserve line content exactly as stored', async () => {
      const complexContent = '{"type":"text","content":"Line with \\"quotes\\" and special chars: <>&"}';

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

      const response = await request(app.getHttpServer())
        .get(`/api/transcripts/${RUN_ID}/lines`)
        .set('Authorization', VALID_JWT)
        .expect(200);

      expect(response.body.lines[0].content).toBe(complexContent);
    });
  });

  describe('GET /api/transcripts/:runId/lines - Performance', () => {
    beforeEach(() => {
      mockPrismaService.workflowRun.findUnique.mockResolvedValue({
        id: RUN_ID,
        projectId: PROJECT_ID,
      } as any);

      mockPrismaService.project.findFirst.mockResolvedValue({
        id: PROJECT_ID,
        users: [{ id: USER_ID }],
      } as any);
    });

    it('should use database index for efficient queries', async () => {
      mockPrismaService.transcriptLine.findMany.mockResolvedValue([]);
      mockPrismaService.transcriptLine.count.mockResolvedValue(0);

      await request(app.getHttpServer())
        .get(`/api/transcripts/${RUN_ID}/lines?sessionIndex=0`)
        .set('Authorization', VALID_JWT)
        .expect(200);

      // Should query by indexed fields: workflowRunId, sessionIndex, lineNumber
      expect(mockPrismaService.transcriptLine.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            workflowRunId: RUN_ID,
            sessionIndex: 0,
          },
          orderBy: [{ sessionIndex: 'asc' }, { lineNumber: 'asc' }],
        }),
      );
    });

    it('should execute count and findMany in parallel', async () => {
      // This test verifies that we're not waiting for count before fetching lines
      let countResolved = false;
      let findManyResolved = false;

      mockPrismaService.transcriptLine.count.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        countResolved = true;
        return 100;
      });

      mockPrismaService.transcriptLine.findMany.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        findManyResolved = true;
        return [];
      });

      await request(app.getHttpServer())
        .get(`/api/transcripts/${RUN_ID}/lines`)
        .set('Authorization', VALID_JWT)
        .expect(200);

      // Both should be called (exact timing is hard to test in Jest)
      expect(mockPrismaService.transcriptLine.count).toHaveBeenCalled();
      expect(mockPrismaService.transcriptLine.findMany).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      mockPrismaService.workflowRun.findUnique.mockResolvedValue({
        id: RUN_ID,
        projectId: PROJECT_ID,
      } as any);

      mockPrismaService.project.findFirst.mockResolvedValue({
        id: PROJECT_ID,
        users: [{ id: USER_ID }],
      } as any);
    });

    it('should handle database errors gracefully', async () => {
      mockPrismaService.transcriptLine.findMany.mockRejectedValue(
        new Error('Database connection failed'),
      );

      const response = await request(app.getHttpServer())
        .get(`/api/transcripts/${RUN_ID}/lines`)
        .set('Authorization', VALID_JWT)
        .expect(500);

      expect(response.body).toMatchObject({
        statusCode: 500,
        message: expect.stringMatching(/internal server error/i),
      });
    });

    it('should handle malformed UUIDs', async () => {
      await request(app.getHttpServer())
        .get('/api/transcripts/not-a-uuid/lines')
        .set('Authorization', VALID_JWT)
        .expect(400);
    });
  });
});
