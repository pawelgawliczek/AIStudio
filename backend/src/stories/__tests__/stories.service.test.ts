import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { RunnerService } from '../../runner/runner.service';
import { AppWebSocketGateway } from '../../websocket/websocket.gateway';
import { CreateStoryDto, UpdateStoryDto, UpdateStoryStatusDto, FilterStoryDto } from '../dto';
import { StoriesService } from '../stories.service';

describe('StoriesService', () => {
  let service: StoriesService;
  let prismaService: PrismaService;
  let wsGateway: AppWebSocketGateway;

  const mockPrismaService = {
    project: {
      findUnique: jest.fn(),
    },
    epic: {
      findUnique: jest.fn(),
    },
    agentFramework: {
      findUnique: jest.fn(),
    },
    story: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    commit: {
      findMany: jest.fn(),
    },
    subtask: {
      findMany: jest.fn(),
    },
  };

  const mockWebSocketGateway = {
    notifyStoryUpdate: jest.fn(),
    broadcastStoryCreated: jest.fn(),
    broadcastStoryUpdated: jest.fn(),
    broadcastStoryStatusChanged: jest.fn(),
  };

  const mockRunnerService = {
    // RunnerService methods - add mocks as needed
  };

  const mockProject = {
    id: 'project-id',
    name: 'Test Project',
    description: 'Test description',
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockEpic = {
    id: 'epic-id',
    projectId: 'project-id',
    key: 'EP-1',
    title: 'Test Epic',
    description: 'Test epic description',
    status: 'planning',
    priority: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockStory = {
    id: 'story-id',
    projectId: 'project-id',
    epicId: 'epic-id',
    key: 'ST-1',
    type: 'feature' as any,
    title: 'Test Story',
    description: 'Test story description',
    status: 'planning' as any,
    businessImpact: 5,
    businessComplexity: 3,
    technicalComplexity: 4,
    estimatedTokenCost: 1000,
    assignedFrameworkId: null,
    createdById: 'user-id',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUser = {
    id: 'user-id',
    name: 'Test User',
    email: 'test@example.com',
    role: 'dev' as any,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StoriesService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AppWebSocketGateway, useValue: mockWebSocketGateway },
        { provide: RunnerService, useValue: mockRunnerService },
      ],
    }).compile();

    service = module.get<StoriesService>(StoriesService);
    prismaService = module.get<PrismaService>(PrismaService);
    wsGateway = module.get<AppWebSocketGateway>(AppWebSocketGateway);

    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto: CreateStoryDto = {
      projectId: 'project-id',
      epicId: 'epic-id',
      title: 'Test Story',
      description: 'Test story description',
      type: 'feature' as any,
    };

    it('should create a new story', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.epic.findUnique.mockResolvedValue(mockEpic);
      mockPrismaService.story.findFirst.mockResolvedValue(null);
      mockPrismaService.story.create.mockResolvedValue({
        ...mockStory,
        epic: mockEpic,
        project: mockProject,
        createdBy: mockUser,
      });

      const result = await service.create(createDto, 'user-id');

      expect(result).toBeDefined();
      expect(result.key).toBe('ST-1');
      expect(mockPrismaService.project.findUnique).toHaveBeenCalledWith({
        where: { id: 'project-id' },
      });
      expect(mockPrismaService.epic.findUnique).toHaveBeenCalledWith({
        where: { id: 'epic-id' },
      });
      expect(mockPrismaService.story.create).toHaveBeenCalled();
    });

    it('should throw NotFoundException if project does not exist', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(null);

      await expect(service.create(createDto, 'user-id')).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.story.create).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if epic does not exist', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.epic.findUnique.mockResolvedValue(null);

      await expect(service.create(createDto, 'user-id')).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.story.create).not.toHaveBeenCalled();
    });

    it('should auto-generate key starting from ST-1', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.epic.findUnique.mockResolvedValue(mockEpic);
      mockPrismaService.story.findFirst.mockResolvedValue(null);
      mockPrismaService.story.create.mockResolvedValue({
        ...mockStory,
        key: 'ST-1',
        epic: mockEpic,
        project: mockProject,
        createdBy: mockUser,
      });

      const result = await service.create(createDto, 'user-id');

      expect(result.key).toBe('ST-1');
    });

    it('should auto-increment key from last story', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.epic.findUnique.mockResolvedValue(mockEpic);
      mockPrismaService.story.findFirst.mockResolvedValue({ key: 'ST-5' });
      mockPrismaService.story.create.mockResolvedValue({
        ...mockStory,
        key: 'ST-6',
        epic: mockEpic,
        project: mockProject,
        createdBy: mockUser,
      });

      const result = await service.create(createDto, 'user-id');

      expect(result.key).toBe('ST-6');
    });

    it('should create story without epicId', async () => {
      const dtoWithoutEpic = { ...createDto };
      delete dtoWithoutEpic.epicId;

      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.story.findFirst.mockResolvedValue(null);
      mockPrismaService.story.create.mockResolvedValue({
        ...mockStory,
        epicId: null,
        epic: null,
        project: mockProject,
        createdBy: mockUser,
      });

      const result = await service.create(dtoWithoutEpic, 'user-id');

      expect(result).toBeDefined();
      expect(mockPrismaService.epic.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    const filterDto: FilterStoryDto = {
      projectId: 'project-id',
    };

    it('should return all stories for a project', async () => {
      mockPrismaService.story.findMany.mockResolvedValue([mockStory]);
      mockPrismaService.story.count.mockResolvedValue(1);

      const result = await service.findAll(filterDto);

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(mockPrismaService.story.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ projectId: 'project-id' }),
        }),
      );
    });

    it('should filter by status', async () => {
      mockPrismaService.story.findMany.mockResolvedValue([mockStory]);

      await service.findAll({ ...filterDto, status: 'planning' as any });

      expect(mockPrismaService.story.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            projectId: 'project-id',
            status: 'planning',
          }),
        }),
      );
    });

    it('should filter by epicId', async () => {
      mockPrismaService.story.findMany.mockResolvedValue([mockStory]);

      await service.findAll({ ...filterDto, epicId: 'epic-id' });

      expect(mockPrismaService.story.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            projectId: 'project-id',
            epicId: 'epic-id',
          }),
        }),
      );
    });

    it('should filter by type', async () => {
      mockPrismaService.story.findMany.mockResolvedValue([mockStory]);

      await service.findAll({ ...filterDto, type: 'feature' as any });

      expect(mockPrismaService.story.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            projectId: 'project-id',
            type: 'feature',
          }),
        }),
      );
    });

    it('should search by title or description', async () => {
      mockPrismaService.story.findMany.mockResolvedValue([mockStory]);

      await service.findAll({ ...filterDto, search: 'test' });

      expect(mockPrismaService.story.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            projectId: 'project-id',
            OR: expect.any(Array),
          }),
        }),
      );
    });

    it('should filter by assignedFrameworkId', async () => {
      mockPrismaService.story.findMany.mockResolvedValue([mockStory]);

      await service.findAll({ ...filterDto, assignedFrameworkId: 'framework-id' });

      expect(mockPrismaService.story.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            projectId: 'project-id',
            assignedFrameworkId: 'framework-id',
          }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a single story', async () => {
      mockPrismaService.story.findUnique.mockResolvedValue({
        ...mockStory,
        epic: mockEpic,
        project: mockProject,
        createdBy: mockUser,
      });

      const result = await service.findOne('story-id');

      expect(result).toBeDefined();
      expect(result.id).toBe('story-id');
      expect(mockPrismaService.story.findUnique).toHaveBeenCalledWith({
        where: { id: 'story-id' },
        include: expect.any(Object),
      });
    });

    it('should throw NotFoundException if story not found', async () => {
      mockPrismaService.story.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent-id')).rejects.toThrow(NotFoundException);
    });

    it('should include details by default', async () => {
      mockPrismaService.story.findUnique.mockResolvedValue({
        ...mockStory,
        epic: mockEpic,
        project: mockProject,
        createdBy: mockUser,
        useCaseLinks: [],
        defects: [],
        subtasks: [],
        commits: [],
      });

      await service.findOne('story-id', true);

      expect(mockPrismaService.story.findUnique).toHaveBeenCalledWith({
        where: { id: 'story-id' },
        include: expect.any(Object),
      });
    });

    it('should not include details when requested', async () => {
      mockPrismaService.story.findUnique.mockResolvedValue(mockStory);

      await service.findOne('story-id', false);

      expect(mockPrismaService.story.findUnique).toHaveBeenCalledWith({
        where: { id: 'story-id' },
        include: undefined,
      });
    });

    it('should include workflow runs with complete traceability', async () => {
      const mockWorkflowRuns = [{
        id: 'run-1',
        status: 'completed',
        startedAt: new Date(),
        finishedAt: new Date(),
        durationSeconds: 300,
        totalTokens: 50000,
        estimatedCost: 0.25,
        workflow: { id: 'wf-1', name: 'Full Stack Dev' },
        componentRuns: [
          {
            id: 'comp-run-1',
            component: { id: 'comp-1', name: 'Context Explore' },
            status: 'completed',
            output: 'Context exploration output',
          },
        ],
      }];

      mockPrismaService.story.findUnique.mockResolvedValue({
        ...mockStory,
        workflowRuns: mockWorkflowRuns,
        useCaseLinks: [],
        testCases: [],
        commits: [],
        _count: { runs: 1 },
      });

      const result = await service.findOne('story-id');

      expect(result.workflowRuns).toBeDefined();
      expect(result.workflowRuns).toHaveLength(1);
      expect(result.workflowRuns[0].id).toBe('run-1');
      expect(result.workflowRuns[0].componentRuns).toHaveLength(1);
    });

    it('should include use cases with relationships', async () => {
      const mockUseCaseLinks = [{
        id: 'link-1',
        relation: 'implements',
        useCase: {
          id: 'uc-1',
          key: 'UC-EXEC-001',
          title: 'Execute Story with Workflow',
          area: 'Workflow Execution',
        },
      }];

      mockPrismaService.story.findUnique.mockResolvedValue({
        ...mockStory,
        workflowRuns: [],
        useCaseLinks: mockUseCaseLinks,
        testCases: [],
        commits: [],
        _count: { runs: 0 },
      });

      const result = await service.findOne('story-id');

      expect(result.useCaseLinks).toBeDefined();
      expect(result.useCaseLinks).toHaveLength(1);
      expect(result.useCaseLinks[0].relation).toBe('implements');
      expect(result.useCaseLinks[0].useCase.key).toBe('UC-EXEC-001');
    });

    it('should include test cases through use cases', async () => {
      const mockUseCaseLinks = [{
        id: 'link-1',
        relation: 'implements',
        useCase: {
          id: 'uc-1',
          key: 'UC-EXEC-001',
          title: 'Execute Story with Workflow',
          area: 'Workflow Execution',
          testCases: [{
            id: 'tc-1',
            key: 'TC-EXEC-001',
            title: 'Unit test for workflow execution',
            testLevel: 'unit',
            status: 'implemented',
            testFilePath: 'backend/src/workflows/execution.spec.ts',
          }],
        },
      }];

      mockPrismaService.story.findUnique.mockResolvedValue({
        ...mockStory,
        workflowRuns: [],
        useCaseLinks: mockUseCaseLinks,
        commits: [],
        _count: { runs: 0 },
      });

      const result = await service.findOne('story-id');

      expect(result.useCaseLinks).toBeDefined();
      expect(result.useCaseLinks[0].useCase.testCases).toBeDefined();
      expect(result.useCaseLinks[0].useCase.testCases).toHaveLength(1);
      expect(result.useCaseLinks[0].useCase.testCases[0].key).toBe('TC-EXEC-001');
      expect(result.useCaseLinks[0].useCase.testCases[0].status).toBe('implemented');
    });

    it('should include commits with file changes', async () => {
      const mockCommits = [{
        hash: 'abc123',
        author: 'Test User <test@example.com>',
        timestamp: new Date(),
        message: 'feat: Add workflow execution',
        files: [
          {
            filePath: 'backend/src/workflows/execution.ts',
            locAdded: 50,
            locDeleted: 10,
          },
        ],
      }];

      mockPrismaService.story.findUnique.mockResolvedValue({
        ...mockStory,
        workflowRuns: [],
        useCaseLinks: [],
        testCases: [],
        commits: mockCommits,
        _count: { runs: 0 },
      });

      const result = await service.findOne('story-id');

      expect(result.commits).toBeDefined();
      expect(result.commits).toHaveLength(1);
      expect(result.commits[0].hash).toBe('abc123');
      expect(result.commits[0].files).toHaveLength(1);
      expect(result.commits[0].files[0].locAdded).toBe(50);
    });

    it('should include complete traceability data in a single query', async () => {
      const completeStory = {
        ...mockStory,
        workflowRuns: [{
          id: 'run-1',
          status: 'completed',
          totalTokens: 50000,
          componentRuns: [],
        }],
        useCaseLinks: [{
          id: 'link-1',
          relation: 'implements',
          useCase: {
            id: 'uc-1',
            key: 'UC-001',
            title: 'Test UC',
            testCases: [{
              id: 'tc-1',
              key: 'TC-001',
              title: 'Test case',
              status: 'implemented',
            }],
          },
        }],
        commits: [{
          hash: 'abc123',
          message: 'feat: test',
          files: [],
        }],
        _count: { runs: 1 },
      };

      mockPrismaService.story.findUnique.mockResolvedValue(completeStory);

      const result = await service.findOne('story-id');

      expect(result.workflowRuns).toHaveLength(1);
      expect(result.useCaseLinks).toHaveLength(1);
      expect(result.useCaseLinks[0].useCase.testCases).toHaveLength(1);
      expect(result.commits).toHaveLength(1);
    });
  });

  describe('update', () => {
    const updateDto: UpdateStoryDto = {
      title: 'Updated title',
      description: 'Updated description',
      businessImpact: 4,
    };

    it('should update a story', async () => {
      mockPrismaService.story.findUnique.mockResolvedValue(mockStory);
      mockPrismaService.story.update.mockResolvedValue({
        ...mockStory,
        ...updateDto,
        epic: mockEpic,
        project: mockProject,
        createdBy: mockUser,
      });

      const result = await service.update('story-id', updateDto);

      expect(result).toBeDefined();
      expect(result.title).toBe('Updated title');
      expect(mockPrismaService.story.update).toHaveBeenCalledWith({
        where: { id: 'story-id' },
        data: updateDto,
        include: expect.any(Object),
      });
    });

    it('should throw NotFoundException if story not found', async () => {
      mockPrismaService.story.findUnique.mockResolvedValue(null);

      await expect(service.update('nonexistent-id', updateDto)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrismaService.story.update).not.toHaveBeenCalled();
    });

    it('should validate epic exists if epicId is updated', async () => {
      mockPrismaService.story.findUnique.mockResolvedValue(mockStory);
      mockPrismaService.epic.findUnique.mockResolvedValue(mockEpic);
      mockPrismaService.story.update.mockResolvedValue({
        ...mockStory,
        ...updateDto,
        epic: mockEpic,
        project: mockProject,
        createdBy: mockUser,
      });

      await service.update('story-id', { ...updateDto, epicId: 'epic-id' });

      expect(mockPrismaService.epic.findUnique).toHaveBeenCalledWith({
        where: { id: 'epic-id' },
      });
    });

    it('should throw NotFoundException if epic does not exist', async () => {
      mockPrismaService.story.findUnique.mockResolvedValue(mockStory);
      mockPrismaService.epic.findUnique.mockResolvedValue(null);

      await expect(
        service.update('story-id', { ...updateDto, epicId: 'nonexistent-epic' }),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.story.update).not.toHaveBeenCalled();
    });
  });

  describe('updateStatus', () => {
    const updateStatusDto: UpdateStoryStatusDto = {
      status: 'analysis' as any,
    };

    it('should update story status with valid transition', async () => {
      mockPrismaService.story.findUnique.mockResolvedValue({
        ...mockStory,
        status: 'planning',
      });
      mockPrismaService.story.update.mockResolvedValue({
        ...mockStory,
        status: 'analysis',
        epic: mockEpic,
        project: mockProject,
        createdBy: mockUser,
      });

      const result = await service.updateStatus('story-id', updateStatusDto);

      expect(result.status).toBe('analysis');
      expect(mockWebSocketGateway.broadcastStoryStatusChanged).toHaveBeenCalled();
    });

    it('should throw NotFoundException if story not found', async () => {
      mockPrismaService.story.findUnique.mockResolvedValue(null);

      await expect(service.updateStatus('nonexistent-id', updateStatusDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException for invalid transition', async () => {
      mockPrismaService.story.findUnique.mockResolvedValue({
        ...mockStory,
        status: 'planning',
      });

      await expect(
        service.updateStatus('story-id', { status: 'done' as any }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow admin to override workflow', async () => {
      mockPrismaService.story.findUnique.mockResolvedValue({
        ...mockStory,
        status: 'planning',
      });
      mockPrismaService.story.update.mockResolvedValue({
        ...mockStory,
        status: 'done',
        epic: mockEpic,
        project: mockProject,
        createdBy: mockUser,
      });

      const result = await service.updateStatus('story-id', {
        status: 'done' as any,
      }, true); // isAdmin = true

      expect(result.status).toBe('done');
    });

    it('should validate complexity when moving to implementation', async () => {
      mockPrismaService.story.findUnique.mockResolvedValue({
        ...mockStory,
        status: 'design',
        businessComplexity: null,
        technicalComplexity: null,
        businessImpact: null,
      });

      await expect(
        service.updateStatus('story-id', { status: 'implementation' as any }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow moving to implementation with complexity fields set', async () => {
      mockPrismaService.story.findUnique.mockResolvedValue({
        ...mockStory,
        status: 'design',
        businessComplexity: 3,
        technicalComplexity: 4,
        businessImpact: 5,
      });
      mockPrismaService.story.update.mockResolvedValue({
        ...mockStory,
        status: 'implementation',
        epic: mockEpic,
        project: mockProject,
        createdBy: mockUser,
      });

      const result = await service.updateStatus('story-id', {
        status: 'implementation' as any,
      });

      expect(result.status).toBe('implementation');
    });
  });

  describe('assignFramework', () => {
    it('should assign framework to story', async () => {
      mockPrismaService.story.findUnique.mockResolvedValue(mockStory);
      mockPrismaService.agentFramework.findUnique.mockResolvedValue({
        id: 'framework-id',
        name: 'Test Framework',
      });
      mockPrismaService.story.update.mockResolvedValue({
        ...mockStory,
        assignedFrameworkId: 'framework-id',
        epic: mockEpic,
        project: mockProject,
        createdBy: mockUser,
      });

      const result = await service.assignFramework('story-id', 'framework-id');

      expect(result.assignedFrameworkId).toBe('framework-id');
      expect(mockPrismaService.story.update).toHaveBeenCalledWith({
        where: { id: 'story-id' },
        data: { assignedFrameworkId: 'framework-id' },
        include: expect.any(Object),
      });
    });

    it('should throw NotFoundException if story not found', async () => {
      mockPrismaService.story.findUnique.mockResolvedValue(null);

      await expect(service.assignFramework('nonexistent-id', 'framework-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if framework not found', async () => {
      mockPrismaService.story.findUnique.mockResolvedValue(mockStory);
      mockPrismaService.agentFramework.findUnique.mockResolvedValue(null);

      await expect(service.assignFramework('story-id', 'nonexistent-framework')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('should delete a story', async () => {
      mockPrismaService.story.findUnique.mockResolvedValue(mockStory);
      mockPrismaService.story.delete.mockResolvedValue(mockStory);

      await service.remove('story-id');

      expect(mockPrismaService.story.delete).toHaveBeenCalledWith({
        where: { id: 'story-id' },
      });
    });

    it('should throw NotFoundException if story not found', async () => {
      mockPrismaService.story.findUnique.mockResolvedValue(null);

      await expect(service.remove('nonexistent-id')).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.story.delete).not.toHaveBeenCalled();
    });
  });
});
