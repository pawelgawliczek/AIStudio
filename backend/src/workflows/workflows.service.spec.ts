import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWorkflowDto, UpdateWorkflowDto } from './dto';
import { WorkflowsService } from './workflows.service';

describe('WorkflowsService', () => {
  let service: WorkflowsService;
  let prismaService: PrismaService;

  const mockProject = {
    id: 'project-1',
    name: 'Test Project',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockCoordinator = {
    id: 'coordinator-1',
    projectId: 'project-1',
    name: 'Test Coordinator',
    domain: 'software-development',
    componentIds: ['component-1', 'component-2'],
    flowDiagram: 'Start → Analysis → Code Generation → End',
  };

  const mockComponents = [
    { id: 'component-1', name: 'Requirements Analyzer' },
    { id: 'component-2', name: 'Code Generator' },
  ];

  const mockWorkflow = {
    id: 'workflow-1',
    projectId: 'project-1',
    coordinatorId: 'coordinator-1',
    name: 'Story Implementation Workflow',
    description: 'Automated story implementation',
    version: 'v1.0',
    triggerConfig: {
      type: 'manual',
      filters: {},
    },
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    coordinator: mockCoordinator,
  };

  const mockWorkflowRun = {
    id: 'run-1',
    workflowId: 'workflow-1',
    status: 'completed',
    durationSeconds: 300,
    estimatedCost: 0.25,
  };

  const mockActiveWorkflow = {
    id: 'active-1',
    workflowId: 'workflow-1',
    activatedAt: new Date(),
    activatedBy: 'user-1',
    filesGenerated: ['workflow-handler.ts', 'workflow-config.json'],
  };

  const mockPrismaService = {
    project: {
      findUnique: jest.fn(),
    },
    coordinatorAgent: {
      findUnique: jest.fn(),
    },
    component: {
      findMany: jest.fn(),
    },
    workflow: {
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
        WorkflowsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<WorkflowsService>(WorkflowsService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto: CreateWorkflowDto = {
      coordinatorId: 'coordinator-1',
      name: 'Story Implementation Workflow',
      description: 'Automated story implementation',
      version: 'v1.0',
      triggerConfig: {
        type: 'manual',
        filters: {},
      },
      active: true,
    };

    it('should create workflow with valid data', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.coordinatorAgent.findUnique.mockResolvedValue(mockCoordinator);
      mockPrismaService.workflow.create.mockResolvedValue(mockWorkflow);

      const result = await service.create('project-1', createDto);

      expect(result.id).toBe('workflow-1');
      expect(result.name).toBe('Story Implementation Workflow');
      expect(result.coordinatorId).toBe('coordinator-1');
      expect(mockPrismaService.project.findUnique).toHaveBeenCalledWith({
        where: { id: 'project-1' },
      });
      expect(mockPrismaService.coordinatorAgent.findUnique).toHaveBeenCalledWith({
        where: { id: 'coordinator-1' },
      });
    });

    it('should throw NotFoundException if project not found', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(null);

      await expect(service.create('invalid-project', createDto)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrismaService.workflow.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if coordinator not found', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.coordinatorAgent.findUnique.mockResolvedValue(null);

      await expect(service.create('project-1', createDto)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockPrismaService.workflow.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if coordinator belongs to different project', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.coordinatorAgent.findUnique.mockResolvedValue({
        ...mockCoordinator,
        projectId: 'different-project',
      });

      await expect(service.create('project-1', createDto)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockPrismaService.workflow.create).not.toHaveBeenCalled();
    });

    it('should set default values for version and active', async () => {
      const dtoWithoutDefaults = {
        ...createDto,
        version: undefined,
        active: undefined,
      };

      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.coordinatorAgent.findUnique.mockResolvedValue(mockCoordinator);
      mockPrismaService.workflow.create.mockResolvedValue(mockWorkflow);

      await service.create('project-1', dtoWithoutDefaults);

      expect(mockPrismaService.workflow.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          version: 'v1.0',
          active: true,
        }),
        include: { coordinator: true },
      });
    });
  });

  describe('findAll', () => {
    it('should return all workflows for project', async () => {
      mockPrismaService.workflow.findMany.mockResolvedValue([mockWorkflow]);
      mockPrismaService.component.findMany.mockResolvedValue(mockComponents);

      const result = await service.findAll('project-1');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('workflow-1');
      expect(mockPrismaService.workflow.findMany).toHaveBeenCalledWith({
        where: { projectId: 'project-1' },
        include: { coordinator: true },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should filter by active status', async () => {
      mockPrismaService.workflow.findMany.mockResolvedValue([mockWorkflow]);
      mockPrismaService.component.findMany.mockResolvedValue(mockComponents);

      await service.findAll('project-1', { active: true });

      expect(mockPrismaService.workflow.findMany).toHaveBeenCalledWith({
        where: { projectId: 'project-1', active: true },
        include: { coordinator: true },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should filter by coordinatorId', async () => {
      mockPrismaService.workflow.findMany.mockResolvedValue([mockWorkflow]);
      mockPrismaService.component.findMany.mockResolvedValue(mockComponents);

      await service.findAll('project-1', { coordinatorId: 'coordinator-1' });

      expect(mockPrismaService.workflow.findMany).toHaveBeenCalledWith({
        where: {
          projectId: 'project-1',
          coordinatorId: 'coordinator-1',
        },
        include: { coordinator: true },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should search by name and description', async () => {
      mockPrismaService.workflow.findMany.mockResolvedValue([mockWorkflow]);
      mockPrismaService.component.findMany.mockResolvedValue(mockComponents);

      await service.findAll('project-1', { search: 'story' });

      expect(mockPrismaService.workflow.findMany).toHaveBeenCalledWith({
        where: {
          projectId: 'project-1',
          OR: [
            { name: { contains: 'story', mode: 'insensitive' } },
            { description: { contains: 'story', mode: 'insensitive' } },
          ],
        },
        include: { coordinator: true },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should fetch and include component details', async () => {
      mockPrismaService.workflow.findMany.mockResolvedValue([mockWorkflow]);
      mockPrismaService.component.findMany.mockResolvedValue(mockComponents);

      const result = await service.findAll('project-1');

      expect(mockPrismaService.component.findMany).toHaveBeenCalledWith({
        where: {
          id: { in: ['component-1', 'component-2'] },
        },
        select: {
          id: true,
          name: true,
        },
      });
      expect(result[0].coordinator.components).toEqual(mockComponents);
    });

    it('should handle workflows without components', async () => {
      const workflowWithoutComponents = {
        ...mockWorkflow,
        coordinator: {
          ...mockCoordinator,
          componentIds: [],
        },
      };

      mockPrismaService.workflow.findMany.mockResolvedValue([workflowWithoutComponents]);

      const result = await service.findAll('project-1');

      expect(mockPrismaService.component.findMany).not.toHaveBeenCalled();
      expect(result[0].coordinator.componentIds).toEqual([]);
    });

    it('should return empty array if no workflows', async () => {
      mockPrismaService.workflow.findMany.mockResolvedValue([]);

      const result = await service.findAll('project-1');

      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should return workflow by id', async () => {
      mockPrismaService.workflow.findUnique.mockResolvedValue(mockWorkflow);

      const result = await service.findOne('workflow-1');

      expect(result.id).toBe('workflow-1');
      expect(result.name).toBe('Story Implementation Workflow');
      expect(mockPrismaService.workflow.findUnique).toHaveBeenCalledWith({
        where: { id: 'workflow-1' },
        include: {
          coordinator: true,
          activeWorkflows: true,
        },
      });
    });

    it('should return workflow with usage stats when requested', async () => {
      mockPrismaService.workflow.findUnique.mockResolvedValue(mockWorkflow);
      mockPrismaService.workflowRun.findMany.mockResolvedValue([
        mockWorkflowRun,
        { ...mockWorkflowRun, status: 'failed', durationSeconds: 150, estimatedCost: 0.10 },
      ]);

      const result = await service.findOne('workflow-1', true);

      expect(result.id).toBe('workflow-1');
      expect(result.usageStats).toBeDefined();
      expect(result.usageStats.totalRuns).toBe(2);
      expect(result.usageStats.successRate).toBe(50); // 1 out of 2
      expect(result.usageStats.avgRuntime).toBe(225); // (300 + 150) / 2
      expect(result.usageStats.avgCost).toBe(0.175); // (0.25 + 0.10) / 2
    });

    it('should include activation status when workflow is activated', async () => {
      mockPrismaService.workflow.findUnique.mockResolvedValue({
        ...mockWorkflow,
        activeWorkflows: [mockActiveWorkflow],
      });

      const result = await service.findOne('workflow-1');

      expect(result.activationStatus).toBeDefined();
      expect(result.activationStatus.isActivated).toBe(true);
      expect(result.activationStatus.activatedBy).toBe('user-1');
      expect(result.activationStatus.filesGenerated).toEqual([
        'workflow-handler.ts',
        'workflow-config.json',
      ]);
    });

    it('should throw NotFoundException if workflow not found', async () => {
      mockPrismaService.workflow.findUnique.mockResolvedValue(null);

      await expect(service.findOne('invalid-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const updateDto: UpdateWorkflowDto = {
      name: 'Updated Workflow',
      description: 'Updated description',
      active: false,
    };

    it('should update workflow fields', async () => {
      mockPrismaService.workflow.findUnique.mockResolvedValue(mockWorkflow);
      mockPrismaService.workflow.update.mockResolvedValue({
        ...mockWorkflow,
        ...updateDto,
      });

      const result = await service.update('workflow-1', updateDto);

      expect(result.name).toBe('Updated Workflow');
      expect(result.description).toBe('Updated description');
      expect(result.active).toBe(false);
      expect(mockPrismaService.workflow.update).toHaveBeenCalledWith({
        where: { id: 'workflow-1' },
        data: expect.objectContaining(updateDto),
        include: { coordinator: true },
      });
    });

    it('should throw NotFoundException if workflow not found', async () => {
      mockPrismaService.workflow.findUnique.mockResolvedValue(null);

      await expect(service.update('invalid-id', updateDto)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrismaService.workflow.update).not.toHaveBeenCalled();
    });

    it('should validate coordinator when changing coordinatorId', async () => {
      const updateWithCoordinator = { ...updateDto, coordinatorId: 'coordinator-2' };

      mockPrismaService.workflow.findUnique.mockResolvedValue(mockWorkflow);
      mockPrismaService.coordinatorAgent.findUnique.mockResolvedValue({
        ...mockCoordinator,
        id: 'coordinator-2',
      });
      mockPrismaService.workflow.update.mockResolvedValue(mockWorkflow);

      await service.update('workflow-1', updateWithCoordinator);

      expect(mockPrismaService.coordinatorAgent.findUnique).toHaveBeenCalledWith({
        where: { id: 'coordinator-2' },
      });
    });

    it('should throw BadRequestException if coordinator belongs to different project', async () => {
      const updateWithCoordinator = { ...updateDto, coordinatorId: 'coordinator-2' };

      mockPrismaService.workflow.findUnique.mockResolvedValue(mockWorkflow);
      mockPrismaService.coordinatorAgent.findUnique.mockResolvedValue({
        ...mockCoordinator,
        id: 'coordinator-2',
        projectId: 'different-project',
      });

      await expect(service.update('workflow-1', updateWithCoordinator)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockPrismaService.workflow.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should delete workflow if no execution history', async () => {
      mockPrismaService.workflow.findUnique.mockResolvedValue({
        ...mockWorkflow,
        workflowRuns: [],
        activeWorkflows: [],
      });
      mockPrismaService.workflow.delete.mockResolvedValue(mockWorkflow);

      await service.remove('workflow-1');

      expect(mockPrismaService.workflow.delete).toHaveBeenCalledWith({
        where: { id: 'workflow-1' },
      });
    });

    it('should throw BadRequestException if workflow is activated', async () => {
      mockPrismaService.workflow.findUnique.mockResolvedValue({
        ...mockWorkflow,
        workflowRuns: [],
        activeWorkflows: [mockActiveWorkflow],
      });

      await expect(service.remove('workflow-1')).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.workflow.delete).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if workflow has execution history', async () => {
      mockPrismaService.workflow.findUnique.mockResolvedValue({
        ...mockWorkflow,
        workflowRuns: [mockWorkflowRun],
        activeWorkflows: [],
      });

      await expect(service.remove('workflow-1')).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.workflow.delete).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if workflow not found', async () => {
      mockPrismaService.workflow.findUnique.mockResolvedValue(null);

      await expect(service.remove('invalid-id')).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.workflow.delete).not.toHaveBeenCalled();
    });
  });

  describe('deactivate', () => {
    it('should set active to false', async () => {
      mockPrismaService.workflow.findUnique.mockResolvedValue(mockWorkflow);
      mockPrismaService.workflow.update.mockResolvedValue({
        ...mockWorkflow,
        active: false,
      });

      const result = await service.deactivate('workflow-1');

      expect(result.active).toBe(false);
      expect(mockPrismaService.workflow.update).toHaveBeenCalledWith({
        where: { id: 'workflow-1' },
        data: { active: false },
        include: { coordinator: true },
      });
    });

    it('should throw NotFoundException if workflow not found', async () => {
      mockPrismaService.workflow.findUnique.mockResolvedValue(null);

      await expect(service.deactivate('invalid-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('activate', () => {
    it('should set active to true', async () => {
      mockPrismaService.workflow.findUnique.mockResolvedValue({
        ...mockWorkflow,
        active: false,
      });
      mockPrismaService.workflow.update.mockResolvedValue({
        ...mockWorkflow,
        active: true,
      });

      const result = await service.activate('workflow-1');

      expect(result.active).toBe(true);
      expect(mockPrismaService.workflow.update).toHaveBeenCalledWith({
        where: { id: 'workflow-1' },
        data: { active: true },
        include: { coordinator: true },
      });
    });

    it('should throw NotFoundException if workflow not found', async () => {
      mockPrismaService.workflow.findUnique.mockResolvedValue(null);

      await expect(service.activate('invalid-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getWorkflowStats', () => {
    it('should return zero stats if no runs', async () => {
      mockPrismaService.workflow.findUnique.mockResolvedValue(mockWorkflow);
      mockPrismaService.workflowRun.findMany.mockResolvedValue([]);

      const result = await service.findOne('workflow-1', true);

      expect(result.usageStats).toEqual({
        totalRuns: 0,
        avgRuntime: 0,
        avgCost: 0,
        successRate: 0,
      });
    });

    it('should calculate stats correctly with multiple runs', async () => {
      mockPrismaService.workflow.findUnique.mockResolvedValue(mockWorkflow);
      mockPrismaService.workflowRun.findMany.mockResolvedValue([
        {
          ...mockWorkflowRun,
          status: 'completed',
          durationSeconds: 200,
          estimatedCost: 0.10,
        },
        {
          ...mockWorkflowRun,
          status: 'completed',
          durationSeconds: 400,
          estimatedCost: 0.20,
        },
        {
          ...mockWorkflowRun,
          status: 'failed',
          durationSeconds: 100,
          estimatedCost: 0.05,
        },
      ]);

      const result = await service.findOne('workflow-1', true);

      expect(result.usageStats.totalRuns).toBe(3);
      expect(result.usageStats.avgRuntime).toBeCloseTo(233.33, 2); // (200 + 400 + 100) / 3
      expect(result.usageStats.avgCost).toBeCloseTo(0.117, 3); // (0.10 + 0.20 + 0.05) / 3
      expect(result.usageStats.successRate).toBeCloseTo(66.67, 2); // 2 / 3 * 100
    });

    it('should handle null durations and costs', async () => {
      mockPrismaService.workflow.findUnique.mockResolvedValue(mockWorkflow);
      mockPrismaService.workflowRun.findMany.mockResolvedValue([
        {
          ...mockWorkflowRun,
          status: 'completed',
          durationSeconds: null,
          estimatedCost: null,
        },
        {
          ...mockWorkflowRun,
          status: 'completed',
          durationSeconds: 200,
          estimatedCost: 0.10,
        },
      ]);

      const result = await service.findOne('workflow-1', true);

      expect(result.usageStats.totalRuns).toBe(2);
      expect(result.usageStats.avgRuntime).toBe(100); // (0 + 200) / 2
      expect(result.usageStats.avgCost).toBe(0.05); // (0 + 0.10) / 2
    });
  });

  describe('mapToResponseDto', () => {
    it('should map workflow to response DTO with coordinator details', async () => {
      mockPrismaService.workflow.findUnique.mockResolvedValue(mockWorkflow);

      const result = await service.findOne('workflow-1');

      expect(result.coordinator).toBeDefined();
      expect(result.coordinator.id).toBe('coordinator-1');
      expect(result.coordinator.name).toBe('Test Coordinator');
      expect(result.coordinator.domain).toBe('software-development');
      expect(result.coordinator.flowDiagram).toBe('Start → Analysis → Code Generation → End');
      expect(result.coordinator.componentIds).toEqual(['component-1', 'component-2']);
    });

    it('should handle workflow without coordinator', async () => {
      mockPrismaService.workflow.findUnique.mockResolvedValue({
        ...mockWorkflow,
        coordinator: null,
      });

      const result = await service.findOne('workflow-1');

      expect(result.coordinator).toBeUndefined();
    });
  });
});
