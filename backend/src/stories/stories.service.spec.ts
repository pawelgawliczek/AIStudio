import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { StoryStatus, StoryType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AppWebSocketGateway } from '../websocket/websocket.gateway';
import { StoriesService } from './stories.service';

describe('StoriesService', () => {
  let service: StoriesService;
  let prismaService: PrismaService;
  let wsGateway: AppWebSocketGateway;

  const mockPrismaService = {
    story: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    project: {
      findUnique: jest.fn(),
    },
    epic: {
      findUnique: jest.fn(),
    },
    agentFramework: {
      findUnique: jest.fn(),
    },
    workflowRun: {
      findMany: jest.fn(),
    },
    componentRun: {
      findMany: jest.fn(),
    },
  };

  const mockWsGateway = {
    broadcastStoryCreated: jest.fn(),
    broadcastStoryUpdated: jest.fn(),
    broadcastStoryStatusChanged: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StoriesService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AppWebSocketGateway, useValue: mockWsGateway },
      ],
    }).compile();

    service = module.get<StoriesService>(StoriesService);
    prismaService = module.get<PrismaService>(PrismaService);
    wsGateway = module.get<AppWebSocketGateway>(AppWebSocketGateway);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findOneByIdOrKey', () => {
    const mockStory = {
      id: '52334d99-31a0-4707-a307-9c63c3b8ac3d',
      key: 'ST-26',
      title: 'Test Story',
      description: 'Test Description',
      status: StoryStatus.planning,
      type: StoryType.feature,
      projectId: 'project-1',
      epicId: 'epic-1',
      project: { id: 'project-1', name: 'Test Project' },
      epic: { id: 'epic-1', key: 'EP-1', title: 'Test Epic' },
      workflowRuns: [],
      subtasks: [],
      useCaseLinks: [],
      commits: [],
      _count: { subtasks: 0, commits: 0, runs: 0, workflowRuns: 0 },
    };

    it('should find story by UUID', async () => {
      mockPrismaService.story.findUnique.mockResolvedValue(mockStory);

      const result = await service.findOneByIdOrKey('52334d99-31a0-4707-a307-9c63c3b8ac3d');

      expect(result).toEqual(mockStory);
      expect(mockPrismaService.story.findUnique).toHaveBeenCalledWith({
        where: { id: '52334d99-31a0-4707-a307-9c63c3b8ac3d' },
        include: expect.any(Object),
      });
    });

    it('should find story by storyKey (e.g., ST-26)', async () => {
      mockPrismaService.story.findUnique
        .mockResolvedValueOnce(null) // First try by ID fails
        .mockResolvedValueOnce(mockStory); // Then try by key succeeds

      const result = await service.findOneByIdOrKey('ST-26');

      expect(result).toEqual(mockStory);
      expect(mockPrismaService.story.findUnique).toHaveBeenCalledTimes(2);
      expect(mockPrismaService.story.findUnique).toHaveBeenNthCalledWith(2, {
        where: { key: 'ST-26' },
        include: expect.any(Object),
      });
    });

    it('should throw NotFoundException if story not found by ID or key', async () => {
      mockPrismaService.story.findUnique.mockResolvedValue(null);

      await expect(service.findOneByIdOrKey('invalid-id')).rejects.toThrow(NotFoundException);
      await expect(service.findOneByIdOrKey('invalid-id')).rejects.toThrow(
        'Story with ID or key invalid-id not found'
      );
    });

    it('should include all traceability data', async () => {
      mockPrismaService.story.findUnique.mockResolvedValue(mockStory);

      await service.findOneByIdOrKey('ST-26');

      expect(mockPrismaService.story.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            project: true,
            epic: true,
            assignedFramework: true,
            subtasks: expect.any(Object),
            useCaseLinks: expect.any(Object),
            commits: expect.any(Object),
            workflowRuns: expect.any(Object),
            _count: expect.any(Object),
          }),
        })
      );
    });
  });

  describe('getTokenMetrics', () => {
    const mockWorkflowRuns = [
      {
        id: 'run-1',
        status: 'completed',
        startedAt: new Date('2025-11-14T10:00:00Z'),
        finishedAt: new Date('2025-11-14T10:30:00Z'),
        totalTokens: 50000,
        estimatedCost: 0.75,
        workflow: { id: 'wf-1', name: 'Standard Workflow' },
        componentRuns: [
          {
            id: 'comp-run-1',
            status: 'completed',
            tokensInput: 10000,
            tokensOutput: 15000,
            component: { id: 'comp-1', name: 'Context Explorer' },
            metrics: { userPrompts: 2, systemIterations: 5 },
          },
          {
            id: 'comp-run-2',
            status: 'completed',
            tokensInput: 12000,
            tokensOutput: 13000,
            component: { id: 'comp-2', name: 'BA Analyst' },
            metrics: { userPrompts: 1, systemIterations: 3 },
          },
        ],
      },
      {
        id: 'run-2',
        status: 'running',
        startedAt: new Date('2025-11-15T09:00:00Z'),
        finishedAt: null,
        totalTokens: 25000,
        estimatedCost: 0.38,
        workflow: { id: 'wf-1', name: 'Standard Workflow' },
        componentRuns: [
          {
            id: 'comp-run-3',
            status: 'completed',
            tokensInput: 12000,
            tokensOutput: 13000,
            component: { id: 'comp-1', name: 'Context Explorer' },
            metrics: { userPrompts: 0, systemIterations: 4 },
          },
        ],
      },
    ];

    const mockStory = {
      id: '52334d99-31a0-4707-a307-9c63c3b8ac3d',
      key: 'ST-26',
      title: 'Test Story',
    };

    it('should aggregate token metrics from all workflow runs', async () => {
      mockPrismaService.story.findUnique.mockResolvedValue(mockStory);
      mockPrismaService.workflowRun.findMany.mockResolvedValue(mockWorkflowRuns);

      const result = await service.getTokenMetrics('52334d99-31a0-4707-a307-9c63c3b8ac3d');

      expect(result).toEqual({
        storyId: '52334d99-31a0-4707-a307-9c63c3b8ac3d',
        storyKey: 'ST-26',
        totalTokens: 75000, // 50000 + 25000
        totalCost: 1.13, // 0.75 + 0.38
        breakdown: expect.arrayContaining([
          expect.objectContaining({
            workflowRunId: 'run-1',
            workflowName: 'Standard Workflow',
            status: 'completed',
            tokens: 50000,
            cost: 0.75,
            components: expect.arrayContaining([
              expect.objectContaining({
                componentName: 'Context Explorer',
                tokens: 25000, // 10000 + 15000
                userPrompts: 2,
                iterations: 5,
              }),
              expect.objectContaining({
                componentName: 'BA Analyst',
                tokens: 25000, // 12000 + 13000
                userPrompts: 1,
                iterations: 3,
              }),
            ]),
          }),
          expect.objectContaining({
            workflowRunId: 'run-2',
            workflowName: 'Standard Workflow',
            status: 'running',
            tokens: 25000,
            cost: 0.38,
          }),
        ]),
      });
    });

    it('should return zero metrics if no workflow runs exist', async () => {
      mockPrismaService.story.findUnique.mockResolvedValue(mockStory);
      mockPrismaService.workflowRun.findMany.mockResolvedValue([]);

      const result = await service.getTokenMetrics('52334d99-31a0-4707-a307-9c63c3b8ac3d');

      expect(result).toEqual({
        storyId: '52334d99-31a0-4707-a307-9c63c3b8ac3d',
        storyKey: 'ST-26',
        totalTokens: 0,
        totalCost: 0,
        breakdown: [],
      });
    });

    it('should throw NotFoundException if story not found', async () => {
      mockPrismaService.story.findUnique.mockResolvedValue(null);

      await expect(service.getTokenMetrics('invalid-id')).rejects.toThrow(NotFoundException);
    });

    it('should handle null cost and token values gracefully', async () => {
      mockPrismaService.story.findUnique.mockResolvedValue(mockStory);
      mockPrismaService.workflowRun.findMany.mockResolvedValue([
        {
          id: 'run-3',
          status: 'failed',
          startedAt: new Date(),
          finishedAt: null,
          totalTokens: null,
          estimatedCost: null,
          workflow: { id: 'wf-1', name: 'Test Workflow' },
          componentRuns: [],
        },
      ]);

      const result = await service.getTokenMetrics('52334d99-31a0-4707-a307-9c63c3b8ac3d');

      expect(result.totalTokens).toBe(0);
      expect(result.totalCost).toBe(0);
      expect(result.breakdown[0].tokens).toBe(0);
      expect(result.breakdown[0].cost).toBe(0);
    });
  });

  describe('findOne - existing method should still work', () => {
    it('should return story by ID with full traceability', async () => {
      const mockStory = {
        id: '52334d99-31a0-4707-a307-9c63c3b8ac3d',
        key: 'ST-26',
        title: 'Test Story',
        project: { id: 'project-1', name: 'Test Project' },
        epic: { id: 'epic-1', key: 'EP-1', title: 'Test Epic' },
        workflowRuns: [],
        subtasks: [],
        useCaseLinks: [],
        commits: [],
        _count: { subtasks: 0, commits: 0, runs: 0, workflowRuns: 0 },
      };

      mockPrismaService.story.findUnique.mockResolvedValue(mockStory);

      const result = await service.findOne('52334d99-31a0-4707-a307-9c63c3b8ac3d');

      expect(result).toEqual(mockStory);
    });
  });
});
