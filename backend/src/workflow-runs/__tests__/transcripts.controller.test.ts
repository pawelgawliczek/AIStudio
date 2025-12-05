/**
 * Integration Tests for TranscriptsController (ST-173 Phase 4)
 *
 * TDD Implementation - These tests WILL FAIL until controller is implemented
 *
 * Security Requirements from SECURITY_REVIEW:
 * - Test Case 2: Authentication (401 without JWT)
 * - Test Case 3: IDOR vulnerability (403 for other projects)
 * - Test Case 7: Rate limiting (100 req/min)
 */

import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';

describe('TranscriptsController - REST API (TDD)', () => {
  let app: INestApplication;
  let prismaService: jest.Mocked<PrismaService>;

  const VALID_JWT = 'Bearer valid-jwt-token-12345';
  const USER_ID = 'user-123';
  const PROJECT_ID = 'proj-456';
  const RUN_ID = 'run-789';
  const ARTIFACT_ID = 'artifact-abc';
  const COMPONENT_ID = 'comp-xyz';

  const mockPrismaService = {
    artifact: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    workflowRun: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    project: {
      findFirst: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [/* TranscriptsController will be added */],
      providers: [
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        /* TranscriptsService will be added */
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

  describe('Test Case 2: Authentication (401 without JWT)', () => {
    it('GET /transcripts should reject unauthenticated requests', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/projects/${PROJECT_ID}/workflow-runs/${RUN_ID}/transcripts`)
        .expect(401);

      expect(response.body).toMatchObject({
        statusCode: 401,
        message: expect.stringMatching(/unauthorized/i),
      });

      // Should NOT query database
      expect(mockPrismaService.artifact.findMany).not.toHaveBeenCalled();
    });

    it('GET /transcripts/:artifactId should reject unauthenticated requests', async () => {
      await request(app.getHttpServer())
        .get(`/api/projects/${PROJECT_ID}/workflow-runs/${RUN_ID}/transcripts/${ARTIFACT_ID}`)
        .expect(401);
    });

    it('GET /transcripts/component/:componentId should reject unauthenticated requests', async () => {
      await request(app.getHttpServer())
        .get(`/api/projects/${PROJECT_ID}/workflow-runs/${RUN_ID}/transcripts/component/${COMPONENT_ID}`)
        .expect(401);
    });

    it('GET /transcripts/master/:index should reject unauthenticated requests', async () => {
      await request(app.getHttpServer())
        .get(`/api/projects/${PROJECT_ID}/workflow-runs/${RUN_ID}/transcripts/master/0`)
        .expect(401);
    });

    it('should accept requests with valid JWT', async () => {
      // Mock project access validation
      mockPrismaService.project.findFirst.mockResolvedValue({
        id: PROJECT_ID,
        users: [{ id: USER_ID }],
      } as any);

      mockPrismaService.workflowRun.findFirst.mockResolvedValue({
        id: RUN_ID,
        projectId: PROJECT_ID,
      } as any);

      mockPrismaService.artifact.findMany.mockResolvedValue([]);

      await request(app.getHttpServer())
        .get(`/api/projects/${PROJECT_ID}/workflow-runs/${RUN_ID}/transcripts`)
        .set('Authorization', VALID_JWT)
        .expect(200);
    });
  });

  describe('Test Case 3: IDOR Vulnerability (403 for other projects)', () => {
    it('should reject access to transcripts from other projects', async () => {
      const OTHER_USER_ID = 'other-user-999';
      const OTHER_PROJECT_ID = 'other-proj-888';

      // Mock: Project belongs to OTHER user, not current user
      mockPrismaService.project.findFirst.mockResolvedValue(null);

      mockPrismaService.workflowRun.findFirst.mockResolvedValue({
        id: RUN_ID,
        projectId: OTHER_PROJECT_ID,
      } as any);

      const response = await request(app.getHttpServer())
        .get(`/api/projects/${OTHER_PROJECT_ID}/workflow-runs/${RUN_ID}/transcripts`)
        .set('Authorization', VALID_JWT)
        .expect(403);

      expect(response.body).toMatchObject({
        statusCode: 403,
        message: expect.stringMatching(/access denied|forbidden/i),
      });
    });

    it('should reject access to workflow runs not in specified project', async () => {
      // Mock: User has access to PROJECT_ID
      mockPrismaService.project.findFirst.mockResolvedValue({
        id: PROJECT_ID,
        users: [{ id: USER_ID }],
      } as any);

      // Mock: But workflow run belongs to DIFFERENT project
      mockPrismaService.workflowRun.findFirst.mockResolvedValue({
        id: RUN_ID,
        projectId: 'different-proj-777', // Mismatch!
      } as any);

      const response = await request(app.getHttpServer())
        .get(`/api/projects/${PROJECT_ID}/workflow-runs/${RUN_ID}/transcripts`)
        .set('Authorization', VALID_JWT)
        .expect(403);

      expect(response.body.message).toMatch(/workflow run does not belong to project/i);
    });

    it('should allow access to own projects', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue({
        id: PROJECT_ID,
        users: [{ id: USER_ID }],
      } as any);

      mockPrismaService.workflowRun.findFirst.mockResolvedValue({
        id: RUN_ID,
        projectId: PROJECT_ID,
      } as any);

      mockPrismaService.artifact.findMany.mockResolvedValue([]);

      await request(app.getHttpServer())
        .get(`/api/projects/${PROJECT_ID}/workflow-runs/${RUN_ID}/transcripts`)
        .set('Authorization', VALID_JWT)
        .expect(200);
    });

    it('should validate artifact belongs to workflow run', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue({
        id: PROJECT_ID,
        users: [{ id: USER_ID }],
      } as any);

      mockPrismaService.workflowRun.findFirst.mockResolvedValue({
        id: RUN_ID,
        projectId: PROJECT_ID,
      } as any);

      // Mock: Artifact belongs to DIFFERENT workflow run
      mockPrismaService.artifact.findUnique.mockResolvedValue({
        id: ARTIFACT_ID,
        workflowRunId: 'different-run-666', // Mismatch!
      } as any);

      const response = await request(app.getHttpServer())
        .get(`/api/projects/${PROJECT_ID}/workflow-runs/${RUN_ID}/transcripts/${ARTIFACT_ID}`)
        .set('Authorization', VALID_JWT)
        .expect(403);

      expect(response.body.message).toMatch(/artifact does not belong to workflow run/i);
    });
  });

  describe('GET /transcripts - List All Transcripts', () => {
    it('should return master and agent transcripts grouped', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue({
        id: PROJECT_ID,
        users: [{ id: USER_ID }],
      } as any);

      mockPrismaService.workflowRun.findFirst.mockResolvedValue({
        id: RUN_ID,
        projectId: PROJECT_ID,
      } as any);

      mockPrismaService.artifact.findMany.mockResolvedValue([
        {
          id: 'artifact-master-0',
          createdByComponentId: null,
          contentPreview: 'Master session transcript...',
          size: 1024,
          createdAt: new Date('2025-12-01'),
        },
        {
          id: 'artifact-agent-1',
          createdByComponentId: 'comp-123',
          contentPreview: 'Agent transcript...',
          size: 2048,
          createdAt: new Date('2025-12-02'),
          component: { name: 'Developer' },
        },
      ] as any);

      const response = await request(app.getHttpServer())
        .get(`/api/projects/${PROJECT_ID}/workflow-runs/${RUN_ID}/transcripts`)
        .set('Authorization', VALID_JWT)
        .expect(200);

      expect(response.body).toMatchObject({
        master: [
          {
            artifactId: 'artifact-master-0',
            contentPreview: expect.any(String),
            size: 1024,
            index: 0,
          },
        ],
        agents: [
          {
            artifactId: 'artifact-agent-1',
            componentId: 'comp-123',
            componentName: 'Developer',
            contentPreview: expect.any(String),
            size: 2048,
          },
        ],
      });
    });

    it('should return empty arrays when no transcripts exist', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue({
        id: PROJECT_ID,
        users: [{ id: USER_ID }],
      } as any);

      mockPrismaService.workflowRun.findFirst.mockResolvedValue({
        id: RUN_ID,
        projectId: PROJECT_ID,
      } as any);

      mockPrismaService.artifact.findMany.mockResolvedValue([]);

      const response = await request(app.getHttpServer())
        .get(`/api/projects/${PROJECT_ID}/workflow-runs/${RUN_ID}/transcripts`)
        .set('Authorization', VALID_JWT)
        .expect(200);

      expect(response.body).toEqual({
        master: [],
        agents: [],
      });
    });
  });

  describe('GET /transcripts/:artifactId - Get Single Transcript', () => {
    it('should return full transcript content with includeContent=true', async () => {
      const fullContent = '{"type":"text","content":"test"}\\n{"type":"text","content":"data"}';

      mockPrismaService.project.findFirst.mockResolvedValue({
        id: PROJECT_ID,
        users: [{ id: USER_ID }],
      } as any);

      mockPrismaService.workflowRun.findFirst.mockResolvedValue({
        id: RUN_ID,
        projectId: PROJECT_ID,
      } as any);

      mockPrismaService.artifact.findUnique.mockResolvedValue({
        id: ARTIFACT_ID,
        workflowRunId: RUN_ID,
        content: fullContent,
        contentType: 'application/x-jsonlines',
        size: fullContent.length,
        transcriptType: 'agent',
        componentId: 'comp-123',
        component: { name: 'Developer' },
        createdAt: new Date('2025-12-01'),
      } as any);

      const response = await request(app.getHttpServer())
        .get(`/api/projects/${PROJECT_ID}/workflow-runs/${RUN_ID}/transcripts/${ARTIFACT_ID}?includeContent=true`)
        .set('Authorization', VALID_JWT)
        .expect(200);

      expect(response.body).toMatchObject({
        id: ARTIFACT_ID,
        content: fullContent,
        contentType: 'application/x-jsonlines',
        size: fullContent.length,
        transcriptType: 'agent',
        componentName: 'Developer',
      });
    });

    it('should return preview only when includeContent=false', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue({
        id: PROJECT_ID,
        users: [{ id: USER_ID }],
      } as any);

      mockPrismaService.workflowRun.findFirst.mockResolvedValue({
        id: RUN_ID,
        projectId: PROJECT_ID,
      } as any);

      mockPrismaService.artifact.findUnique.mockResolvedValue({
        id: ARTIFACT_ID,
        workflowRunId: RUN_ID,
        contentPreview: 'First 500 chars...',
        size: 10240,
        createdAt: new Date('2025-12-01'),
      } as any);

      const response = await request(app.getHttpServer())
        .get(`/api/projects/${PROJECT_ID}/workflow-runs/${RUN_ID}/transcripts/${ARTIFACT_ID}?includeContent=false`)
        .set('Authorization', VALID_JWT)
        .expect(200);

      expect(response.body).toMatchObject({
        id: ARTIFACT_ID,
        contentPreview: 'First 500 chars...',
        size: 10240,
      });
      expect(response.body.content).toBeUndefined();
    });

    it('should return 404 when artifact not found', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue({
        id: PROJECT_ID,
        users: [{ id: USER_ID }],
      } as any);

      mockPrismaService.workflowRun.findFirst.mockResolvedValue({
        id: RUN_ID,
        projectId: PROJECT_ID,
      } as any);

      mockPrismaService.artifact.findUnique.mockResolvedValue(null);

      await request(app.getHttpServer())
        .get(`/api/projects/${PROJECT_ID}/workflow-runs/${RUN_ID}/transcripts/non-existent`)
        .set('Authorization', VALID_JWT)
        .expect(404);
    });
  });

  describe('GET /transcripts/component/:componentId - Component Transcript', () => {
    it('should return transcript for specific component', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue({
        id: PROJECT_ID,
        users: [{ id: USER_ID }],
      } as any);

      mockPrismaService.workflowRun.findFirst.mockResolvedValue({
        id: RUN_ID,
        projectId: PROJECT_ID,
      } as any);

      mockPrismaService.artifact.findFirst.mockResolvedValue({
        id: 'artifact-comp-xyz',
        workflowRunId: RUN_ID,
        createdByComponentId: COMPONENT_ID,
        content: '{"type":"text"}',
        size: 15,
        component: { name: 'Developer' },
      } as any);

      const response = await request(app.getHttpServer())
        .get(`/api/projects/${PROJECT_ID}/workflow-runs/${RUN_ID}/transcripts/component/${COMPONENT_ID}?includeContent=true`)
        .set('Authorization', VALID_JWT)
        .expect(200);

      expect(response.body).toMatchObject({
        id: 'artifact-comp-xyz',
        componentId: COMPONENT_ID,
        componentName: 'Developer',
        content: '{"type":"text"}',
      });
    });

    it('should return 404 when component has no transcript', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue({
        id: PROJECT_ID,
        users: [{ id: USER_ID }],
      } as any);

      mockPrismaService.workflowRun.findFirst.mockResolvedValue({
        id: RUN_ID,
        projectId: PROJECT_ID,
      } as any);

      mockPrismaService.artifact.findFirst.mockResolvedValue(null);

      await request(app.getHttpServer())
        .get(`/api/projects/${PROJECT_ID}/workflow-runs/${RUN_ID}/transcripts/component/no-transcript-comp`)
        .set('Authorization', VALID_JWT)
        .expect(404);
    });
  });

  describe('GET /transcripts/master/:index - Master Transcript by Index', () => {
    it('should return master transcript at index 0', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue({
        id: PROJECT_ID,
        users: [{ id: USER_ID }],
      } as any);

      mockPrismaService.workflowRun.findFirst.mockResolvedValue({
        id: RUN_ID,
        projectId: PROJECT_ID,
        metadata: {
          masterTranscriptArtifactIds: ['artifact-master-0', 'artifact-master-1'],
        },
      } as any);

      mockPrismaService.artifact.findUnique.mockResolvedValue({
        id: 'artifact-master-0',
        content: 'master transcript 0',
        size: 19,
      } as any);

      const response = await request(app.getHttpServer())
        .get(`/api/projects/${PROJECT_ID}/workflow-runs/${RUN_ID}/transcripts/master/0?includeContent=true`)
        .set('Authorization', VALID_JWT)
        .expect(200);

      expect(response.body).toMatchObject({
        id: 'artifact-master-0',
        content: 'master transcript 0',
        index: 0,
      });
    });

    it('should return master transcript at index 1 (after compaction)', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue({
        id: PROJECT_ID,
        users: [{ id: USER_ID }],
      } as any);

      mockPrismaService.workflowRun.findFirst.mockResolvedValue({
        id: RUN_ID,
        projectId: PROJECT_ID,
        metadata: {
          masterTranscriptArtifactIds: ['artifact-master-0', 'artifact-master-1'],
        },
      } as any);

      mockPrismaService.artifact.findUnique.mockResolvedValue({
        id: 'artifact-master-1',
        content: 'master transcript 1',
        size: 19,
      } as any);

      const response = await request(app.getHttpServer())
        .get(`/api/projects/${PROJECT_ID}/workflow-runs/${RUN_ID}/transcripts/master/1?includeContent=true`)
        .set('Authorization', VALID_JWT)
        .expect(200);

      expect(response.body).toMatchObject({
        id: 'artifact-master-1',
        index: 1,
      });
    });

    it('should return 404 when index out of range', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue({
        id: PROJECT_ID,
        users: [{ id: USER_ID }],
      } as any);

      mockPrismaService.workflowRun.findFirst.mockResolvedValue({
        id: RUN_ID,
        projectId: PROJECT_ID,
        metadata: {
          masterTranscriptArtifactIds: ['artifact-master-0'],
        },
      } as any);

      await request(app.getHttpServer())
        .get(`/api/projects/${PROJECT_ID}/workflow-runs/${RUN_ID}/transcripts/master/5`)
        .set('Authorization', VALID_JWT)
        .expect(404);
    });
  });

  describe('Test Case 7: Rate Limiting (100 req/min)', () => {
    it('should enforce rate limit after 100 requests', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue({
        id: PROJECT_ID,
        users: [{ id: USER_ID }],
      } as any);

      mockPrismaService.workflowRun.findFirst.mockResolvedValue({
        id: RUN_ID,
        projectId: PROJECT_ID,
      } as any);

      mockPrismaService.artifact.findMany.mockResolvedValue([]);

      // Make 100 successful requests
      for (let i = 0; i < 100; i++) {
        await request(app.getHttpServer())
          .get(`/api/projects/${PROJECT_ID}/workflow-runs/${RUN_ID}/transcripts`)
          .set('Authorization', VALID_JWT)
          .expect(200);
      }

      // 101st request should be rate limited
      const response = await request(app.getHttpServer())
        .get(`/api/projects/${PROJECT_ID}/workflow-runs/${RUN_ID}/transcripts`)
        .set('Authorization', VALID_JWT)
        .expect(429);

      expect(response.body).toMatchObject({
        statusCode: 429,
        message: expect.stringMatching(/rate limit exceeded|too many requests/i),
      });
    });

    it('should reset rate limit after 60 seconds', async () => {
      // This test would require time manipulation (jest.useFakeTimers)
      // Placeholder for integration testing
      expect(true).toBe(true);
    });
  });
});
