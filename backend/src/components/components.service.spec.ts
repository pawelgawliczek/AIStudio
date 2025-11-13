import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ComponentsService } from './components.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateComponentDto, UpdateComponentDto } from './dto';

describe('ComponentsService', () => {
  let service: ComponentsService;
  let prismaService: PrismaService;

  const mockProject = {
    id: 'project-1',
    name: 'Test Project',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockComponent = {
    id: 'component-1',
    projectId: 'project-1',
    name: 'Code Review',
    description: 'Review code for quality issues',
    inputInstructions: 'Review PR files',
    operationInstructions: 'Check code style',
    outputInstructions: 'Generate review comments',
    config: {
      modelId: 'claude-sonnet-4',
      temperature: 0.3,
      maxInputTokens: 50000,
      maxOutputTokens: 10000,
      timeout: 300,
      maxRetries: 2,
      costLimit: 5.0,
    },
    tools: ['read_file', 'write_file'],
    subtaskConfig: null,
    onFailure: 'stop',
    tags: ['review', 'quality'],
    active: true,
    version: 'v1.0',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockComponentRun = {
    id: 'run-1',
    componentId: 'component-1',
    durationSeconds: 120,
    cost: 0.05,
    status: 'completed',
  };

  const mockPrismaService = {
    project: {
      findUnique: jest.fn(),
    },
    component: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    componentRun: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ComponentsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<ComponentsService>(ComponentsService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto: CreateComponentDto = {
      name: 'Code Review',
      description: 'Review code for quality issues',
      inputInstructions: 'Review PR files',
      operationInstructions: 'Check code style',
      outputInstructions: 'Generate review comments',
      config: {
        modelId: 'claude-sonnet-4',
        temperature: 0.3,
        maxInputTokens: 50000,
        maxOutputTokens: 10000,
        timeout: 300,
        maxRetries: 2,
        costLimit: 5.0,
      },
      tools: ['read_file', 'write_file'],
      onFailure: 'stop',
      tags: ['review', 'quality'],
    };

    it('should create component with valid data', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.component.create.mockResolvedValue(mockComponent);

      const result = await service.create('project-1', createDto);

      expect(result.id).toBe('component-1');
      expect(result.name).toBe('Code Review');
      expect(result.tags).toEqual(['review', 'quality']);
      expect(mockPrismaService.project.findUnique).toHaveBeenCalledWith({
        where: { id: 'project-1' },
      });
      expect(mockPrismaService.component.create).toHaveBeenCalled();
    });

    it('should throw NotFoundException if project not found', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(null);

      await expect(service.create('invalid-project', createDto)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrismaService.component.create).not.toHaveBeenCalled();
    });

    it('should create component with default values', async () => {
      const minimalDto: CreateComponentDto = {
        name: 'Minimal Component',
        inputInstructions: 'Input',
        operationInstructions: 'Operation',
        outputInstructions: 'Output',
        config: {
          modelId: 'claude-sonnet-4',
          temperature: 0.3,
          maxInputTokens: 50000,
          maxOutputTokens: 10000,
          timeout: 300,
          maxRetries: 2,
          costLimit: 5.0,
        },
        tools: [],
        onFailure: 'stop',
      };

      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.component.create.mockResolvedValue({
        ...mockComponent,
        ...minimalDto,
        active: true,
        version: 'v1.0',
        tags: [],
      });

      const result = await service.create('project-1', minimalDto);

      expect(result.active).toBe(true);
      expect(result.version).toBe('v1.0');
      expect(mockPrismaService.component.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          active: true,
          version: 'v1.0',
          tags: [],
        }),
      });
    });

    it('should handle component with no tags', async () => {
      const dtoNoTags = { ...createDto };
      delete dtoNoTags.tags;

      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.component.create.mockResolvedValue({
        ...mockComponent,
        tags: [],
      });

      const result = await service.create('project-1', dtoNoTags);

      expect(mockPrismaService.component.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tags: [],
        }),
      });
    });
  });

  describe('findAll', () => {
    it('should return all components for project', async () => {
      mockPrismaService.component.findMany.mockResolvedValue([mockComponent]);
      mockPrismaService.componentRun.findMany.mockResolvedValue([mockComponentRun]);

      const result = await service.findAll('project-1');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('component-1');
      expect(result[0].usageStats).toBeDefined();
      expect(mockPrismaService.component.findMany).toHaveBeenCalledWith({
        where: { projectId: 'project-1' },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should filter by active status', async () => {
      mockPrismaService.component.findMany.mockResolvedValue([mockComponent]);
      mockPrismaService.componentRun.findMany.mockResolvedValue([]);

      await service.findAll('project-1', { active: true });

      expect(mockPrismaService.component.findMany).toHaveBeenCalledWith({
        where: { projectId: 'project-1', active: true },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should filter by tags', async () => {
      mockPrismaService.component.findMany.mockResolvedValue([mockComponent]);
      mockPrismaService.componentRun.findMany.mockResolvedValue([]);

      await service.findAll('project-1', { tags: ['review'] });

      expect(mockPrismaService.component.findMany).toHaveBeenCalledWith({
        where: {
          projectId: 'project-1',
          tags: { hasSome: ['review'] },
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should search by name and description', async () => {
      mockPrismaService.component.findMany.mockResolvedValue([mockComponent]);
      mockPrismaService.componentRun.findMany.mockResolvedValue([]);

      await service.findAll('project-1', { search: 'review' });

      expect(mockPrismaService.component.findMany).toHaveBeenCalledWith({
        where: {
          projectId: 'project-1',
          OR: [
            { name: { contains: 'review', mode: 'insensitive' } },
            { description: { contains: 'review', mode: 'insensitive' } },
          ],
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return components with usage stats', async () => {
      mockPrismaService.component.findMany.mockResolvedValue([mockComponent]);
      mockPrismaService.componentRun.findMany.mockResolvedValue([
        { ...mockComponentRun, status: 'completed', durationSeconds: 120, cost: 0.05 },
        { ...mockComponentRun, status: 'completed', durationSeconds: 90, cost: 0.03 },
        { ...mockComponentRun, status: 'failed', durationSeconds: 60, cost: 0.02 },
      ]);

      const result = await service.findAll('project-1');

      expect(result[0].usageStats).toEqual({
        totalRuns: 3,
        avgRuntime: 90, // (120 + 90 + 60) / 3 = 90
        avgCost: 0.0333, // (0.05 + 0.03 + 0.02) / 3 ≈ 0.0333
        successRate: 66.67, // 2 / 3 * 100 = 66.67%
      });
    });

    it('should return empty array if no components', async () => {
      mockPrismaService.component.findMany.mockResolvedValue([]);

      const result = await service.findAll('project-1');

      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should return component by id', async () => {
      mockPrismaService.component.findUnique.mockResolvedValue(mockComponent);

      const result = await service.findOne('component-1');

      expect(result.id).toBe('component-1');
      expect(result.name).toBe('Code Review');
      expect(mockPrismaService.component.findUnique).toHaveBeenCalledWith({
        where: { id: 'component-1' },
      });
    });

    it('should return component with usage stats when requested', async () => {
      mockPrismaService.component.findUnique.mockResolvedValue(mockComponent);
      mockPrismaService.componentRun.findMany.mockResolvedValue([mockComponentRun]);

      const result = await service.findOne('component-1', true);

      expect(result.id).toBe('component-1');
      expect(result.usageStats).toBeDefined();
      expect(result.usageStats.totalRuns).toBe(1);
    });

    it('should throw NotFoundException if component not found', async () => {
      mockPrismaService.component.findUnique.mockResolvedValue(null);

      await expect(service.findOne('invalid-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const updateDto: UpdateComponentDto = {
      name: 'Updated Code Review',
      description: 'Updated description',
      tags: ['updated'],
    };

    it('should update component fields', async () => {
      mockPrismaService.component.findUnique.mockResolvedValue(mockComponent);
      mockPrismaService.component.update.mockResolvedValue({
        ...mockComponent,
        ...updateDto,
      });

      const result = await service.update('component-1', updateDto);

      expect(result.name).toBe('Updated Code Review');
      expect(result.description).toBe('Updated description');
      expect(result.tags).toEqual(['updated']);
      expect(mockPrismaService.component.update).toHaveBeenCalledWith({
        where: { id: 'component-1' },
        data: expect.objectContaining(updateDto),
      });
    });

    it('should throw NotFoundException if component not found', async () => {
      mockPrismaService.component.findUnique.mockResolvedValue(null);

      await expect(service.update('invalid-id', updateDto)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrismaService.component.update).not.toHaveBeenCalled();
    });

    it('should handle partial updates', async () => {
      const partialDto: UpdateComponentDto = { name: 'New Name Only' };

      mockPrismaService.component.findUnique.mockResolvedValue(mockComponent);
      mockPrismaService.component.update.mockResolvedValue({
        ...mockComponent,
        name: 'New Name Only',
      });

      const result = await service.update('component-1', partialDto);

      expect(result.name).toBe('New Name Only');
      expect(mockPrismaService.component.update).toHaveBeenCalled();
    });

    it('should update active status', async () => {
      const activeDto: UpdateComponentDto = { active: false };

      mockPrismaService.component.findUnique.mockResolvedValue(mockComponent);
      mockPrismaService.component.update.mockResolvedValue({
        ...mockComponent,
        active: false,
      });

      const result = await service.update('component-1', activeDto);

      expect(result.active).toBe(false);
    });
  });

  describe('remove', () => {
    it('should delete component if no execution history', async () => {
      mockPrismaService.component.findUnique.mockResolvedValue({
        ...mockComponent,
        componentRuns: [],
      });
      mockPrismaService.component.delete.mockResolvedValue(mockComponent);

      await service.remove('component-1');

      expect(mockPrismaService.component.delete).toHaveBeenCalledWith({
        where: { id: 'component-1' },
      });
    });

    it('should throw BadRequestException if component has execution history', async () => {
      mockPrismaService.component.findUnique.mockResolvedValue({
        ...mockComponent,
        componentRuns: [mockComponentRun],
      });

      await expect(service.remove('component-1')).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.component.delete).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if component not found', async () => {
      mockPrismaService.component.findUnique.mockResolvedValue(null);

      await expect(service.remove('invalid-id')).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.component.delete).not.toHaveBeenCalled();
    });
  });

  describe('activate', () => {
    it('should set active to true', async () => {
      mockPrismaService.component.findUnique.mockResolvedValue({
        ...mockComponent,
        active: false,
      });
      mockPrismaService.component.update.mockResolvedValue({
        ...mockComponent,
        active: true,
      });

      const result = await service.activate('component-1');

      expect(result.active).toBe(true);
      expect(mockPrismaService.component.update).toHaveBeenCalledWith({
        where: { id: 'component-1' },
        data: expect.objectContaining({ active: true }),
      });
    });
  });

  describe('deactivate', () => {
    it('should set active to false', async () => {
      mockPrismaService.component.findUnique.mockResolvedValue(mockComponent);
      mockPrismaService.component.update.mockResolvedValue({
        ...mockComponent,
        active: false,
      });

      const result = await service.deactivate('component-1');

      expect(result.active).toBe(false);
      expect(mockPrismaService.component.update).toHaveBeenCalledWith({
        where: { id: 'component-1' },
        data: expect.objectContaining({ active: false }),
      });
    });
  });

  describe('getComponentStats', () => {
    it('should return zero stats if no runs', async () => {
      mockPrismaService.component.findMany.mockResolvedValue([mockComponent]);
      mockPrismaService.componentRun.findMany.mockResolvedValue([]);

      const result = await service.findAll('project-1');

      expect(result[0].usageStats).toEqual({
        totalRuns: 0,
        avgRuntime: 0,
        avgCost: 0,
        successRate: 0,
      });
    });

    it('should calculate stats correctly with multiple runs', async () => {
      mockPrismaService.component.findMany.mockResolvedValue([mockComponent]);
      mockPrismaService.componentRun.findMany.mockResolvedValue([
        { durationSeconds: 100, cost: 0.10, status: 'completed' },
        { durationSeconds: 200, cost: 0.20, status: 'completed' },
        { durationSeconds: 300, cost: 0.30, status: 'failed' },
        { durationSeconds: 400, cost: 0.40, status: 'completed' },
      ]);

      const result = await service.findAll('project-1');

      expect(result[0].usageStats).toEqual({
        totalRuns: 4,
        avgRuntime: 250, // (100 + 200 + 300 + 400) / 4
        avgCost: 0.25, // (0.10 + 0.20 + 0.30 + 0.40) / 4
        successRate: 75.0, // 3 / 4 * 100
      });
    });

    it('should handle null durations and costs', async () => {
      mockPrismaService.component.findMany.mockResolvedValue([mockComponent]);
      mockPrismaService.componentRun.findMany.mockResolvedValue([
        { durationSeconds: null, cost: null, status: 'completed' },
        { durationSeconds: 100, cost: 0.05, status: 'completed' },
      ]);

      const result = await service.findAll('project-1');

      expect(result[0].usageStats.totalRuns).toBe(2);
      expect(result[0].usageStats.avgRuntime).toBe(50); // (0 + 100) / 2
      expect(result[0].usageStats.avgCost).toBe(0.025); // (0 + 0.05) / 2
    });
  });

  describe('testComponent', () => {
    it('should return simulated test response', async () => {
      mockPrismaService.component.findUnique.mockResolvedValue(mockComponent);

      const testInput = { file: 'test.ts', content: 'code' };
      const result = await service.testComponent('component-1', testInput);

      expect(result.componentId).toBe('component-1');
      expect(result.componentName).toBe('Code Review');
      expect(result.testInput).toEqual(testInput);
      expect(result.status).toBe('simulated');
    });

    it('should throw NotFoundException if component not found', async () => {
      mockPrismaService.component.findUnique.mockResolvedValue(null);

      await expect(service.testComponent('invalid-id', {})).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
