import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { WorkflowStateService } from '../../execution/workflow-state.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RunStatus } from '../dto';
import { WorkflowRunsService } from '../workflow-runs.service';

describe('WorkflowRunsService', () => {
  let service: WorkflowRunsService;
  let prismaService: PrismaService;
  let workflowStateService: WorkflowStateService;

  const mockProject = {
    id: 'project-1',
    name: 'Test Project',
  };

  const mockWorkflow = {
    id: 'workflow-1',
    name: 'Test Workflow',
    coordinator: {
      id: 'coordinator-1',
      name: 'Test Coordinator',
    },
  };

  const mockStory = {
    id: 'story-1',
    key: 'ST-28',
    title: 'Add global live workflow tracking bar',
  };

  const mockWorkflowRun = {
    id: 'run-1',
    projectId: 'project-1',
    workflowId: 'workflow-1',
    storyId: 'story-1',
    status: RunStatus.running,
    startedAt: new Date('2024-01-15T10:00:00Z'),
    finishedAt: null,
    totalTokens: 50000,
    estimatedCost: 0.75,
    totalUserPrompts: 2,
    totalIterations: 5,
    totalInterventions: 1,
    totalLocGenerated: 150,
    totalTestsAdded: 8,
    workflow: mockWorkflow,
    story: mockStory,
    componentRuns: [],
  };

  const mockPrismaService = {
    project: {
      findUnique: jest.fn(),
    },
    workflow: {
      findUnique: jest.fn(),
    },
    workflowRun: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    componentRun: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };

  const mockWorkflowStateService = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkflowRunsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: WorkflowStateService, useValue: mockWorkflowStateService },
      ],
    }).compile();

    service = module.get<WorkflowRunsService>(WorkflowRunsService);
    prismaService = module.get<PrismaService>(PrismaService);
    workflowStateService = module.get<WorkflowStateService>(WorkflowStateService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('TC-WORKFLOW-TRACKING-001: getActiveWorkflowForProject', () => {
    it('should return active workflow run when one exists', async () => {
      const activeRun = {
        ...mockWorkflowRun,
        componentRuns: [
          {
            id: 'comp-run-1',
            componentId: 'comp-1',
            status: RunStatus.completed,
            startedAt: new Date('2024-01-15T10:00:00Z'),
            finishedAt: new Date('2024-01-15T10:05:00Z'),
            component: {
              id: 'comp-1',
              name: 'Context Explore',
            },
          },
          {
            id: 'comp-run-2',
            componentId: 'comp-2',
            status: RunStatus.running,
            startedAt: new Date('2024-01-15T10:05:00Z'),
            finishedAt: null,
            component: {
              id: 'comp-2',
              name: 'Business Analyst',
            },
          },
        ],
      };

      mockPrismaService.workflowRun.findFirst.mockResolvedValue(activeRun);
      mockPrismaService.componentRun.count.mockResolvedValue(6);

      const result = await service.getActiveWorkflowForProject('project-1');

      expect(result).toBeDefined();
      expect(result.status).toBe(RunStatus.running);
      expect(result.storyKey).toBe('ST-28');
      expect(result.storyTitle).toBe('Add global live workflow tracking bar');
      expect(result.activeComponentName).toBe('Business Analyst');
      expect(result.progress.completed).toBe(1);
      expect(result.progress.total).toBe(6);
      expect(result.progress.percentage).toBe(17); // Math.round(1/6 * 100)
      expect(mockPrismaService.workflowRun.findFirst).toHaveBeenCalledWith({
        where: {
          projectId: 'project-1',
          status: {
            in: [RunStatus.running, RunStatus.pending],
          },
        },
        include: {
          workflow: {
            include: {
              coordinator: true,
            },
          },
          story: {
            select: {
              id: true,
              key: true,
              title: true,
              type: true,
            },
          },
          epic: {
            select: {
              id: true,
              key: true,
              title: true,
            },
          },
          componentRuns: {
            include: {
              component: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
            orderBy: {
              executionOrder: 'asc',
            },
          },
        },
        orderBy: {
          startedAt: 'desc',
        },
      });
    });

    it('should return null when no active workflow exists', async () => {
      mockPrismaService.workflowRun.findFirst.mockResolvedValue(null);

      const result = await service.getActiveWorkflowForProject('project-1');

      expect(result).toBeNull();
    });

    it('should calculate correct progress when multiple components completed', async () => {
      const activeRun = {
        ...mockWorkflowRun,
        componentRuns: [
          {
            id: 'comp-run-1',
            status: RunStatus.completed,
            component: { name: 'Context Explore' },
          },
          {
            id: 'comp-run-2',
            status: RunStatus.completed,
            component: { name: 'Business Analyst' },
          },
          {
            id: 'comp-run-3',
            status: RunStatus.completed,
            component: { name: 'Designer' },
          },
          {
            id: 'comp-run-4',
            status: RunStatus.running,
            component: { name: 'Architect' },
          },
        ],
      };

      mockPrismaService.workflowRun.findFirst.mockResolvedValue(activeRun);
      mockPrismaService.componentRun.count.mockResolvedValue(6);

      const result = await service.getActiveWorkflowForProject('project-1');

      expect(result.progress.completed).toBe(3);
      expect(result.progress.total).toBe(6);
      expect(result.progress.percentage).toBe(50); // Math.round(3/6 * 100)
      expect(result.activeComponentName).toBe('Architect');
    });

    it('should handle workflow with no story (epic-level workflow)', async () => {
      const activeRun = {
        ...mockWorkflowRun,
        storyId: null,
        story: null,
        epicId: 'epic-1',
        epic: {
          id: 'epic-1',
          key: 'EP-5',
          title: 'Workflow Tracking Features',
        },
        componentRuns: [
          {
            id: 'comp-run-1',
            status: RunStatus.running,
            component: { name: 'Epic Analyzer' },
          },
        ],
      };

      mockPrismaService.workflowRun.findFirst.mockResolvedValue(activeRun);
      mockPrismaService.componentRun.count.mockResolvedValue(3);

      const result = await service.getActiveWorkflowForProject('project-1');

      expect(result).toBeDefined();
      expect(result.storyKey).toBe('EP-5');
      expect(result.storyTitle).toBe('Workflow Tracking Features');
    });

    it('should handle workflow with all components pending', async () => {
      const activeRun = {
        ...mockWorkflowRun,
        status: RunStatus.pending,
        componentRuns: [],
      };

      mockPrismaService.workflowRun.findFirst.mockResolvedValue(activeRun);
      mockPrismaService.componentRun.count.mockResolvedValue(5);

      const result = await service.getActiveWorkflowForProject('project-1');

      expect(result.progress.completed).toBe(0);
      expect(result.progress.total).toBe(5);
      expect(result.progress.percentage).toBe(0);
      expect(result.activeComponentName).toBeNull();
    });

  });
});
