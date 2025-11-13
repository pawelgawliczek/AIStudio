import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { CoordinatorsService } from './coordinators.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCoordinatorDto, UpdateCoordinatorDto } from './dto';

describe('CoordinatorsService', () => {
  let service: CoordinatorsService;
  let prismaService: PrismaService;

  const mockProject = {
    id: 'project-1',
    name: 'Test Project',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockComponent1 = {
    id: 'component-1',
    projectId: 'project-1',
    name: 'Requirements Analyzer',
  };

  const mockComponent2 = {
    id: 'component-2',
    projectId: 'project-1',
    name: 'Code Generator',
  };

  const mockCoordinator = {
    id: 'coordinator-1',
    projectId: 'project-1',
    name: 'Story Implementation Coordinator',
    description: 'Coordinates story implementation workflow',
    domain: 'story-implementation',
    coordinatorInstructions: 'Analyze requirements, then generate code',
    config: {
      modelId: 'claude-sonnet-4',
      temperature: 0.3,
      maxInputTokens: 50000,
      maxOutputTokens: 10000,
      timeout: 300,
      maxRetries: 2,
      costLimit: 10.0,
    },
    tools: ['get_story', 'update_story'],
    decisionStrategy: 'conditional',
    componentIds: ['component-1', 'component-2'],
    active: true,
    version: 'v1.0',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockWorkflowRun = {
    id: 'run-1',
    coordinatorId: 'coordinator-1',
    status: 'completed',
    durationSeconds: 300,
    estimatedCost: 0.15,
    componentRuns: [
      { id: 'cr-1', componentId: 'component-1' },
      { id: 'cr-2', componentId: 'component-2' },
    ],
  };

  const mockPrismaService = {
    project: {
      findUnique: jest.fn(),
    },
    component: {
      findMany: jest.fn(),
    },
    coordinatorAgent: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    workflowRun: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CoordinatorsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<CoordinatorsService>(CoordinatorsService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto: CreateCoordinatorDto = {
      name: 'Story Implementation Coordinator',
      description: 'Coordinates story implementation workflow',
      domain: 'story-implementation',
      coordinatorInstructions: 'Analyze requirements, then generate code',
      config: {
        modelId: 'claude-sonnet-4',
        temperature: 0.3,
        maxInputTokens: 50000,
        maxOutputTokens: 10000,
        timeout: 300,
        maxRetries: 2,
        costLimit: 10.0,
      },
      tools: ['get_story', 'update_story'],
      decisionStrategy: 'conditional',
      componentIds: ['component-1', 'component-2'],
    };

    it('should create coordinator with valid data', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.component.findMany.mockResolvedValue([mockComponent1, mockComponent2]);
      mockPrismaService.coordinatorAgent.create.mockResolvedValue(mockCoordinator);

      const result = await service.create('project-1', createDto);

      expect(result.id).toBe('coordinator-1');
      expect(result.name).toBe('Story Implementation Coordinator');
      expect(result.decisionStrategy).toBe('conditional');
      expect(result.componentIds).toEqual(['component-1', 'component-2']);
      expect(mockPrismaService.project.findUnique).toHaveBeenCalledWith({
        where: { id: 'project-1' },
      });
      expect(mockPrismaService.component.findMany).toHaveBeenCalledWith({
        where: {
          id: { in: ['component-1', 'component-2'] },
          projectId: 'project-1',
        },
      });
    });

    it('should throw NotFoundException if project not found', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(null);

      await expect(service.create('invalid-project', createDto)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrismaService.coordinatorAgent.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if component IDs are invalid', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.component.findMany.mockResolvedValue([mockComponent1]); // Only 1 instead of 2

      await expect(service.create('project-1', createDto)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockPrismaService.coordinatorAgent.create).not.toHaveBeenCalled();
    });

    it('should create coordinator with empty component list', async () => {
      const dtoNoComponents = { ...createDto, componentIds: [] };

      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.coordinatorAgent.create.mockResolvedValue({
        ...mockCoordinator,
        componentIds: [],
      });

      const result = await service.create('project-1', dtoNoComponents);

      expect(result.componentIds).toEqual([]);
      expect(mockPrismaService.component.findMany).not.toHaveBeenCalled();
    });

    it('should set default values for active and version', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.component.findMany.mockResolvedValue([mockComponent1, mockComponent2]);
      mockPrismaService.coordinatorAgent.create.mockResolvedValue(mockCoordinator);

      await service.create('project-1', createDto);

      expect(mockPrismaService.coordinatorAgent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          active: true,
          version: 'v1.0',
        }),
      });
    });

    it('should validate decision strategy (sequential)', async () => {
      const dtoSequential = { ...createDto, decisionStrategy: 'sequential' };

      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.component.findMany.mockResolvedValue([mockComponent1, mockComponent2]);
      mockPrismaService.coordinatorAgent.create.mockResolvedValue({
        ...mockCoordinator,
        decisionStrategy: 'sequential',
      });

      const result = await service.create('project-1', dtoSequential);

      expect(result.decisionStrategy).toBe('sequential');
    });

    it('should validate decision strategy (adaptive)', async () => {
      const dtoAdaptive = { ...createDto, decisionStrategy: 'adaptive' };

      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.component.findMany.mockResolvedValue([mockComponent1, mockComponent2]);
      mockPrismaService.coordinatorAgent.create.mockResolvedValue({
        ...mockCoordinator,
        decisionStrategy: 'adaptive',
      });

      const result = await service.create('project-1', dtoAdaptive);

      expect(result.decisionStrategy).toBe('adaptive');
    });

    it('should validate decision strategy (parallel)', async () => {
      const dtoParallel = { ...createDto, decisionStrategy: 'parallel' };

      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.component.findMany.mockResolvedValue([mockComponent1, mockComponent2]);
      mockPrismaService.coordinatorAgent.create.mockResolvedValue({
        ...mockCoordinator,
        decisionStrategy: 'parallel',
      });

      const result = await service.create('project-1', dtoParallel);

      expect(result.decisionStrategy).toBe('parallel');
    });
  });

  describe('findAll', () => {
    it('should return all coordinators for project', async () => {
      mockPrismaService.coordinatorAgent.findMany.mockResolvedValue([mockCoordinator]);

      const result = await service.findAll('project-1');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('coordinator-1');
      expect(mockPrismaService.coordinatorAgent.findMany).toHaveBeenCalledWith({
        where: { projectId: 'project-1' },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should filter by active status', async () => {
      mockPrismaService.coordinatorAgent.findMany.mockResolvedValue([mockCoordinator]);

      await service.findAll('project-1', { active: true });

      expect(mockPrismaService.coordinatorAgent.findMany).toHaveBeenCalledWith({
        where: { projectId: 'project-1', active: true },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should filter by domain', async () => {
      mockPrismaService.coordinatorAgent.findMany.mockResolvedValue([mockCoordinator]);

      await service.findAll('project-1', { domain: 'story-implementation' });

      expect(mockPrismaService.coordinatorAgent.findMany).toHaveBeenCalledWith({
        where: {
          projectId: 'project-1',
          domain: 'story-implementation',
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should search by name and description', async () => {
      mockPrismaService.coordinatorAgent.findMany.mockResolvedValue([mockCoordinator]);

      await service.findAll('project-1', { search: 'story' });

      expect(mockPrismaService.coordinatorAgent.findMany).toHaveBeenCalledWith({
        where: {
          projectId: 'project-1',
          OR: [
            { name: { contains: 'story', mode: 'insensitive' } },
            { description: { contains: 'story', mode: 'insensitive' } },
          ],
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return empty array if no coordinators', async () => {
      mockPrismaService.coordinatorAgent.findMany.mockResolvedValue([]);

      const result = await service.findAll('project-1');

      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should return coordinator by id', async () => {
      mockPrismaService.coordinatorAgent.findUnique.mockResolvedValue(mockCoordinator);

      const result = await service.findOne('coordinator-1');

      expect(result.id).toBe('coordinator-1');
      expect(result.name).toBe('Story Implementation Coordinator');
      expect(mockPrismaService.coordinatorAgent.findUnique).toHaveBeenCalledWith({
        where: { id: 'coordinator-1' },
      });
    });

    it('should return coordinator with usage stats when requested', async () => {
      mockPrismaService.coordinatorAgent.findUnique.mockResolvedValue(mockCoordinator);
      mockPrismaService.workflowRun.findMany.mockResolvedValue([mockWorkflowRun]);

      const result = await service.findOne('coordinator-1', true);

      expect(result.id).toBe('coordinator-1');
      expect(result.usageStats).toBeDefined();
      expect(result.usageStats.totalRuns).toBe(1);
      expect(result.usageStats.avgComponentsUsed).toBe(2); // 2 component runs
    });

    it('should throw NotFoundException if coordinator not found', async () => {
      mockPrismaService.coordinatorAgent.findUnique.mockResolvedValue(null);

      await expect(service.findOne('invalid-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const updateDto: UpdateCoordinatorDto = {
      name: 'Updated Coordinator',
      description: 'Updated description',
      componentIds: ['component-1'],
    };

    it('should update coordinator fields', async () => {
      mockPrismaService.coordinatorAgent.findUnique.mockResolvedValue(mockCoordinator);
      mockPrismaService.component.findMany.mockResolvedValue([mockComponent1]);
      mockPrismaService.coordinatorAgent.update.mockResolvedValue({
        ...mockCoordinator,
        ...updateDto,
      });

      const result = await service.update('coordinator-1', updateDto);

      expect(result.name).toBe('Updated Coordinator');
      expect(result.description).toBe('Updated description');
      expect(result.componentIds).toEqual(['component-1']);
      expect(mockPrismaService.coordinatorAgent.update).toHaveBeenCalledWith({
        where: { id: 'coordinator-1' },
        data: expect.objectContaining(updateDto),
      });
    });

    it('should throw NotFoundException if coordinator not found', async () => {
      mockPrismaService.coordinatorAgent.findUnique.mockResolvedValue(null);

      await expect(service.update('invalid-id', updateDto)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrismaService.coordinatorAgent.update).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if component IDs are invalid', async () => {
      mockPrismaService.coordinatorAgent.findUnique.mockResolvedValue(mockCoordinator);
      mockPrismaService.component.findMany.mockResolvedValue([]); // No components found

      await expect(service.update('coordinator-1', updateDto)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockPrismaService.coordinatorAgent.update).not.toHaveBeenCalled();
    });

    it('should update without validating components if not provided', async () => {
      const dtoNoComponents: UpdateCoordinatorDto = {
        name: 'Updated Coordinator',
      };

      mockPrismaService.coordinatorAgent.findUnique.mockResolvedValue(mockCoordinator);
      mockPrismaService.coordinatorAgent.update.mockResolvedValue({
        ...mockCoordinator,
        name: 'Updated Coordinator',
      });

      const result = await service.update('coordinator-1', dtoNoComponents);

      expect(result.name).toBe('Updated Coordinator');
      expect(mockPrismaService.component.findMany).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should delete coordinator if no execution history', async () => {
      mockPrismaService.coordinatorAgent.findUnique.mockResolvedValue({
        ...mockCoordinator,
        workflowRuns: [],
      });
      mockPrismaService.coordinatorAgent.delete.mockResolvedValue(mockCoordinator);

      await service.remove('coordinator-1');

      expect(mockPrismaService.coordinatorAgent.delete).toHaveBeenCalledWith({
        where: { id: 'coordinator-1' },
      });
    });

    it('should throw BadRequestException if coordinator has execution history', async () => {
      mockPrismaService.coordinatorAgent.findUnique.mockResolvedValue({
        ...mockCoordinator,
        workflowRuns: [mockWorkflowRun],
      });

      await expect(service.remove('coordinator-1')).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.coordinatorAgent.delete).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if coordinator not found', async () => {
      mockPrismaService.coordinatorAgent.findUnique.mockResolvedValue(null);

      await expect(service.remove('invalid-id')).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.coordinatorAgent.delete).not.toHaveBeenCalled();
    });
  });

  describe('activate', () => {
    it('should set active to true', async () => {
      mockPrismaService.coordinatorAgent.findUnique.mockResolvedValue({
        ...mockCoordinator,
        active: false,
      });
      mockPrismaService.coordinatorAgent.update.mockResolvedValue({
        ...mockCoordinator,
        active: true,
      });

      const result = await service.activate('coordinator-1');

      expect(result.active).toBe(true);
      expect(mockPrismaService.coordinatorAgent.update).toHaveBeenCalledWith({
        where: { id: 'coordinator-1' },
        data: { active: true },
      });
    });

    it('should throw NotFoundException if coordinator not found', async () => {
      mockPrismaService.coordinatorAgent.findUnique.mockResolvedValue(null);

      await expect(service.activate('invalid-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('deactivate', () => {
    it('should set active to false', async () => {
      mockPrismaService.coordinatorAgent.findUnique.mockResolvedValue(mockCoordinator);
      mockPrismaService.coordinatorAgent.update.mockResolvedValue({
        ...mockCoordinator,
        active: false,
      });

      const result = await service.deactivate('coordinator-1');

      expect(result.active).toBe(false);
      expect(mockPrismaService.coordinatorAgent.update).toHaveBeenCalledWith({
        where: { id: 'coordinator-1' },
        data: { active: false },
      });
    });

    it('should throw NotFoundException if coordinator not found', async () => {
      mockPrismaService.coordinatorAgent.findUnique.mockResolvedValue(null);

      await expect(service.deactivate('invalid-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getCoordinatorStats', () => {
    it('should return zero stats if no runs', async () => {
      mockPrismaService.coordinatorAgent.findUnique.mockResolvedValue(mockCoordinator);
      mockPrismaService.workflowRun.findMany.mockResolvedValue([]);

      const result = await service.findOne('coordinator-1', true);

      expect(result.usageStats).toEqual({
        totalRuns: 0,
        avgRuntime: 0,
        avgCost: 0,
        successRate: 0,
        avgComponentsUsed: 0,
      });
    });

    it('should calculate stats correctly with multiple runs', async () => {
      mockPrismaService.coordinatorAgent.findUnique.mockResolvedValue(mockCoordinator);
      mockPrismaService.workflowRun.findMany.mockResolvedValue([
        {
          ...mockWorkflowRun,
          status: 'completed',
          durationSeconds: 200,
          estimatedCost: 0.10,
          componentRuns: [{ id: 'cr-1' }, { id: 'cr-2' }],
        },
        {
          ...mockWorkflowRun,
          status: 'completed',
          durationSeconds: 400,
          estimatedCost: 0.20,
          componentRuns: [{ id: 'cr-3' }, { id: 'cr-4' }, { id: 'cr-5' }],
        },
        {
          ...mockWorkflowRun,
          status: 'failed',
          durationSeconds: 100,
          estimatedCost: 0.05,
          componentRuns: [{ id: 'cr-6' }],
        },
      ]);

      const result = await service.findOne('coordinator-1', true);

      expect(result.usageStats.totalRuns).toBe(3);
      expect(result.usageStats.avgRuntime).toBeCloseTo(233.33, 2); // (200 + 400 + 100) / 3
      expect(result.usageStats.avgCost).toBeCloseTo(0.117, 3); // (0.10 + 0.20 + 0.05) / 3
      expect(result.usageStats.successRate).toBeCloseTo(66.67, 2); // 2 / 3 * 100
      expect(result.usageStats.avgComponentsUsed).toBe(2); // (2 + 3 + 1) / 3
    });

    it('should handle null durations and costs', async () => {
      mockPrismaService.coordinatorAgent.findUnique.mockResolvedValue(mockCoordinator);
      mockPrismaService.workflowRun.findMany.mockResolvedValue([
        {
          ...mockWorkflowRun,
          status: 'completed',
          durationSeconds: null,
          estimatedCost: null,
          componentRuns: [],
        },
        {
          ...mockWorkflowRun,
          status: 'completed',
          durationSeconds: 200,
          estimatedCost: 0.10,
          componentRuns: [{ id: 'cr-1' }],
        },
      ]);

      const result = await service.findOne('coordinator-1', true);

      expect(result.usageStats.totalRuns).toBe(2);
      expect(result.usageStats.avgRuntime).toBe(100); // (0 + 200) / 2
      expect(result.usageStats.avgCost).toBe(0.05); // (0 + 0.10) / 2
      expect(result.usageStats.avgComponentsUsed).toBe(0.5); // (0 + 1) / 2
    });
  });
});
