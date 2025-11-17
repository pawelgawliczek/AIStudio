import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { PrismaModule } from '../../prisma/prisma.module';
import { PrismaService } from '../../prisma/prisma.service';
import { RunStatus } from '../dto';
import { WorkflowRunsModule } from '../workflow-runs.module';

describe('WorkflowRunsController (Integration)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;

  const mockProjectId = 'test-project-id';
  const mockWorkflowId = 'test-workflow-id';
  const mockStoryId = 'test-story-id';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [WorkflowRunsModule, PrismaModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prismaService = moduleFixture.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /projects/:projectId/workflow-runs/active/current', () => {
    it('TC-INTEGRATION-001: should return active workflow when one exists', async () => {
      // Mock data setup
      const mockWorkflowRun = {
        id: 'run-1',
        projectId: mockProjectId,
        workflowId: mockWorkflowId,
        storyId: mockStoryId,
        status: RunStatus.running,
        startedAt: new Date('2024-01-15T10:00:00Z'),
        workflow: {
          id: mockWorkflowId,
          name: 'Test Workflow',
          coordinator: {
            id: 'coordinator-1',
            name: 'Test Coordinator',
          },
        },
        story: {
          id: mockStoryId,
          key: 'ST-28',
          title: 'Test Story',
          type: 'feature',
        },
        componentRuns: [
          {
            id: 'comp-run-1',
            componentId: 'comp-1',
            status: RunStatus.completed,
            component: {
              id: 'comp-1',
              name: 'Context Explore',
            },
          },
          {
            id: 'comp-run-2',
            componentId: 'comp-2',
            status: RunStatus.running,
            component: {
              id: 'comp-2',
              name: 'Business Analyst',
            },
          },
        ],
      };

      jest.spyOn(prismaService.workflowRun, 'findFirst').mockResolvedValue(mockWorkflowRun as any);
      jest.spyOn(prismaService.componentRun, 'count').mockResolvedValue(6);

      const response = await request(app.getHttpServer())
        .get(`/projects/${mockProjectId}/workflow-runs/active/current`)
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.runId).toBe('run-1');
      expect(response.body.status).toBe(RunStatus.running);
      expect(response.body.storyKey).toBe('ST-28');
      expect(response.body.storyTitle).toBe('Test Story');
      expect(response.body.activeComponentName).toBe('Business Analyst');
      expect(response.body.progress).toBeDefined();
      expect(response.body.progress.completed).toBe(1);
      expect(response.body.progress.total).toBe(6);
      expect(response.body.progress.percentage).toBe(17);
    });

    it('TC-INTEGRATION-002: should return null when no active workflow exists', async () => {
      jest.spyOn(prismaService.workflowRun, 'findFirst').mockResolvedValue(null);

      const response = await request(app.getHttpServer())
        .get(`/projects/${mockProjectId}/workflow-runs/active/current`)
        .expect(200);

      expect(response.body).toBeNull();
    });

    it('TC-INTEGRATION-003: should handle epic-level workflows without stories', async () => {
      const mockWorkflowRun = {
        id: 'run-1',
        projectId: mockProjectId,
        workflowId: mockWorkflowId,
        storyId: null,
        epicId: 'epic-1',
        status: RunStatus.running,
        startedAt: new Date('2024-01-15T10:00:00Z'),
        workflow: {
          id: mockWorkflowId,
          name: 'Test Workflow',
          coordinator: {
            id: 'coordinator-1',
            name: 'Test Coordinator',
          },
        },
        story: null,
        epic: {
          id: 'epic-1',
          key: 'EP-5',
          title: 'Epic Title',
        },
        componentRuns: [
          {
            id: 'comp-run-1',
            componentId: 'comp-1',
            status: RunStatus.running,
            component: {
              id: 'comp-1',
              name: 'Epic Analyzer',
            },
          },
        ],
      };

      jest.spyOn(prismaService.workflowRun, 'findFirst').mockResolvedValue(mockWorkflowRun as any);
      jest.spyOn(prismaService.componentRun, 'count').mockResolvedValue(3);

      const response = await request(app.getHttpServer())
        .get(`/projects/${mockProjectId}/workflow-runs/active/current`)
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.storyKey).toBe('EP-5');
      expect(response.body.storyTitle).toBe('Epic Title');
      expect(response.body.activeComponentName).toBe('Epic Analyzer');
    });

    it('TC-INTEGRATION-004: should return zero progress when no components started', async () => {
      const mockWorkflowRun = {
        id: 'run-1',
        projectId: mockProjectId,
        workflowId: mockWorkflowId,
        storyId: mockStoryId,
        status: RunStatus.pending,
        startedAt: new Date('2024-01-15T10:00:00Z'),
        workflow: {
          id: mockWorkflowId,
          name: 'Test Workflow',
          coordinator: {
            id: 'coordinator-1',
            name: 'Test Coordinator',
          },
        },
        story: {
          id: mockStoryId,
          key: 'ST-28',
          title: 'Test Story',
          type: 'feature',
        },
        componentRuns: [],
      };

      jest.spyOn(prismaService.workflowRun, 'findFirst').mockResolvedValue(mockWorkflowRun as any);
      jest.spyOn(prismaService.componentRun, 'count').mockResolvedValue(5);

      const response = await request(app.getHttpServer())
        .get(`/projects/${mockProjectId}/workflow-runs/active/current`)
        .expect(200);

      expect(response.body.progress.completed).toBe(0);
      expect(response.body.progress.total).toBe(5);
      expect(response.body.progress.percentage).toBe(0);
      expect(response.body.activeComponentName).toBeNull();
    });
  });
});
