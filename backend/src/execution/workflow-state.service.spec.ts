import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { WorkflowStateService } from './workflow-state.service';

describe('WorkflowStateService', () => {
  let service: WorkflowStateService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    workflowRun: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    componentRun: {
      findMany: jest.fn(),
    },
    component: {
      findMany: jest.fn(),
    },
  };

  const mockWorkflowRun = {
    id: 'run-id',
    workflowId: 'workflow-id',
    projectId: 'project-id',
    coordinatorId: 'coordinator-id',
    status: 'running',
    startedAt: new Date('2025-01-01T00:00:00Z'),
    finishedAt: null,
    errorMessage: null,
    totalTokens: 15000,
    estimatedCost: 0.15,
    durationSeconds: 1800,
    totalUserPrompts: 10,
    totalIterations: 50,
    totalInterventions: 2,
    workflow: {
      id: 'workflow-id',
      name: 'Test Workflow',
      version: '1.0.0',
    },
    coordinator: {
      id: 'coordinator-id',
      name: 'Sequential Coordinator',
      decisionStrategy: 'sequential',
      componentIds: ['comp-1', 'comp-2', 'comp-3'],
    },
    componentRuns: [
      {
        id: 'comp-run-1',
        componentId: 'comp-1',
        status: 'completed',
        startedAt: new Date('2025-01-01T00:00:00Z'),
        finishedAt: new Date('2025-01-01T00:10:00Z'),
        durationSeconds: 600,
        totalTokens: 5000,
        userPrompts: 5,
        artifacts: [],
        component: {
          name: 'Component 1',
          description: 'First component',
        },
      },
      {
        id: 'comp-run-2',
        componentId: 'comp-2',
        status: 'running',
        startedAt: new Date('2025-01-01T00:10:00Z'),
        finishedAt: null,
        durationSeconds: null,
        totalTokens: null,
        userPrompts: 3,
        artifacts: [],
        component: {
          name: 'Component 2',
          description: 'Second component',
        },
      },
    ],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkflowStateService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<WorkflowStateService>(WorkflowStateService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getWorkflowRunStatus', () => {
    it('should return workflow run status with metrics', async () => {
      mockPrismaService.workflowRun.findUnique.mockResolvedValue(mockWorkflowRun);

      const result = await service.getWorkflowRunStatus('run-id');

      expect(result).toBeDefined();
      expect(result.runId).toBe('run-id');
      expect(result.workflowName).toBe('Test Workflow');
      expect(result.coordinatorName).toBe('Sequential Coordinator');
      expect(result.status).toBe('running');
      expect(result.metrics).toBeDefined();
      expect(result.metrics.totalTokens).toBe(15000);
      expect(result.metrics.componentsCompleted).toBe(1);
      expect(result.metrics.componentsTotal).toBe(3);
      expect(result.metrics.percentComplete).toBe(33); // 1/3 = 33%
      expect(result.componentRuns).toHaveLength(2);
    });

    it('should calculate 100% completion when all components are done', async () => {
      const completedRun = {
        ...mockWorkflowRun,
        status: 'completed',
        componentRuns: [
          { ...mockWorkflowRun.componentRuns[0], status: 'completed' },
          { ...mockWorkflowRun.componentRuns[1], status: 'completed' },
          {
            id: 'comp-run-3',
            componentId: 'comp-3',
            status: 'completed',
            startedAt: new Date(),
            finishedAt: new Date(),
            durationSeconds: 600,
            totalTokens: 5000,
            userPrompts: 4,
            artifacts: [],
            component: { name: 'Component 3' },
          },
        ],
      };
      mockPrismaService.workflowRun.findUnique.mockResolvedValue(completedRun);

      const result = await service.getWorkflowRunStatus('run-id');

      expect(result.metrics.componentsCompleted).toBe(3);
      expect(result.metrics.percentComplete).toBe(100);
    });

    it('should throw error if workflow run not found', async () => {
      mockPrismaService.workflowRun.findUnique.mockResolvedValue(null);

      await expect(service.getWorkflowRunStatus('nonexistent-id')).rejects.toThrow(
        'Workflow run with ID nonexistent-id not found',
      );
    });
  });

  describe('getWorkflowArtifacts', () => {
    it('should return artifacts from component runs', async () => {
      const componentRunsWithArtifacts = [
        {
          id: 'comp-run-1',
          workflowRunId: 'run-id',
          componentId: 'comp-1',
          component: { name: 'Component 1' },
          output: {
            artifacts: [
              {
                s3Key: 'artifact-1',
                artifactType: 'code',
                filename: 'main.ts',
                format: 'typescript',
                size: 1024,
                uploadedAt: '2025-01-01T00:10:00Z',
                data: { content: 'test' },
              },
            ],
          },
        },
        {
          id: 'comp-run-2',
          workflowRunId: 'run-id',
          componentId: 'comp-2',
          component: { name: 'Component 2' },
          output: {
            artifacts: [
              {
                s3Key: 'artifact-2',
                artifactType: 'documentation',
                filename: 'README.md',
                format: 'markdown',
                size: 512,
                uploadedAt: '2025-01-01T00:20:00Z',
              },
            ],
          },
        },
      ];

      mockPrismaService.componentRun.findMany.mockResolvedValue(
        componentRunsWithArtifacts,
      );

      const result = await service.getWorkflowArtifacts('run-id');

      expect(result).toHaveLength(2);
      expect(result[0].s3Key).toBe('artifact-1');
      expect(result[0].artifactType).toBe('code');
      expect(result[1].s3Key).toBe('artifact-2');
      expect(result[1].artifactType).toBe('documentation');
      expect(prismaService.componentRun.findMany).toHaveBeenCalledWith({
        where: { workflowRunId: 'run-id' },
        include: { component: true },
      });
    });

    it('should handle component runs without artifacts', async () => {
      mockPrismaService.componentRun.findMany.mockResolvedValue([
        {
          id: 'comp-run-1',
          workflowRunId: 'run-id',
          componentId: 'comp-1',
          component: { name: 'Component 1' },
          output: null,
        },
        {
          id: 'comp-run-2',
          workflowRunId: 'run-id',
          componentId: 'comp-2',
          component: { name: 'Component 2' },
          output: { result: 'success' },
        },
      ]);

      const result = await service.getWorkflowArtifacts('run-id');

      expect(result).toHaveLength(0);
    });
  });

  describe('getArtifact', () => {
    it('should return specific artifact by s3Key', async () => {
      const artifacts = [
        {
          s3Key: 'artifact-1',
          artifactType: 'code',
          filename: 'main.ts',
          format: 'typescript',
          size: 1024,
          uploadedAt: '2025-01-01T00:10:00Z',
        },
        {
          s3Key: 'artifact-2',
          artifactType: 'documentation',
          filename: 'README.md',
          format: 'markdown',
          size: 512,
          uploadedAt: '2025-01-01T00:20:00Z',
        },
      ];

      mockPrismaService.componentRun.findMany.mockResolvedValue([
        {
          output: { artifacts },
        },
      ]);

      const result = await service.getArtifact('run-id', 'artifact-2');

      expect(result).toBeDefined();
      expect(result.s3Key).toBe('artifact-2');
      expect(result.artifactType).toBe('documentation');
    });

    it('should return null if artifact not found', async () => {
      mockPrismaService.componentRun.findMany.mockResolvedValue([]);

      const result = await service.getArtifact('run-id', 'nonexistent-key');

      expect(result).toBeNull();
    });
  });

  describe('getWorkflowContext', () => {
    it('should return workflow context with completed and remaining components', async () => {
      mockPrismaService.workflowRun.findUnique.mockResolvedValue(mockWorkflowRun);
      mockPrismaService.component.findMany.mockResolvedValue([
        {
          id: 'comp-3',
          name: 'Component 3',
          description: 'Third component',
        },
      ]);

      const result = await service.getWorkflowContext('run-id');

      expect(result).toBeDefined();
      expect(result.runId).toBe('run-id');
      expect(result.workflowName).toBe('Test Workflow');
      expect(result.coordinatorStrategy).toBe('sequential');
      expect(result.completedComponents).toHaveLength(2);
      expect(result.remainingComponents).toHaveLength(1);
      expect(result.remainingComponents[0].componentId).toBe('comp-3');
      expect(result.aggregatedMetrics).toBeDefined();
      expect(result.aggregatedMetrics.componentsCompleted).toBe(2);
      expect(result.aggregatedMetrics.componentsTotal).toBe(3);
    });

    it('should throw error if workflow run not found', async () => {
      mockPrismaService.workflowRun.findUnique.mockResolvedValue(null);

      await expect(service.getWorkflowContext('nonexistent-id')).rejects.toThrow(
        'Workflow run with ID nonexistent-id not found',
      );
    });
  });

  describe('listWorkflowRuns', () => {
    it('should list workflow runs for a project', async () => {
      const runs = [
        {
          ...mockWorkflowRun,
          _count: { componentRuns: 2 },
        },
      ];

      mockPrismaService.workflowRun.findMany.mockResolvedValue(runs);
      mockPrismaService.workflowRun.count.mockResolvedValue(1);

      const result = await service.listWorkflowRuns('project-id');

      expect(result).toBeDefined();
      expect(result.runs).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.limit).toBe(50);
      expect(result.offset).toBe(0);
      expect(result.runs[0].runId).toBe('run-id');
      expect(result.runs[0].componentRunsCount).toBe(2);
    });

    it('should filter by status', async () => {
      mockPrismaService.workflowRun.findMany.mockResolvedValue([]);
      mockPrismaService.workflowRun.count.mockResolvedValue(0);

      await service.listWorkflowRuns('project-id', { status: 'completed' });

      expect(prismaService.workflowRun.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { projectId: 'project-id', status: 'completed' },
        }),
      );
    });

    it('should respect limit and offset', async () => {
      mockPrismaService.workflowRun.findMany.mockResolvedValue([]);
      mockPrismaService.workflowRun.count.mockResolvedValue(100);

      const result = await service.listWorkflowRuns('project-id', {
        limit: 10,
        offset: 20,
      });

      expect(result.limit).toBe(10);
      expect(result.offset).toBe(20);
      expect(prismaService.workflowRun.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          skip: 20,
        }),
      );
    });
  });
});
