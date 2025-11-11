import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { LayersService } from './layers.service';
import { PrismaService } from '../prisma/prisma.service';
import { AppWebSocketGateway } from '../websocket/websocket.gateway';
import { CreateLayerDto, UpdateLayerDto } from './dto';

describe('LayersService', () => {
  let service: LayersService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    project: {
      findUnique: jest.fn(),
    },
    layer: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  const mockWebSocketGateway = {
    server: {
      emit: jest.fn(),
    },
  };

  const mockProject = {
    id: 'project-id',
    name: 'Test Project',
  };

  const mockLayer = {
    id: 'layer-id',
    projectId: 'project-id',
    name: 'Frontend',
    description: 'Frontend layer',
    icon: 'monitor',
    color: '#4A90E2',
    status: 'active' as any,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LayersService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AppWebSocketGateway, useValue: mockWebSocketGateway },
      ],
    }).compile();

    service = module.get<LayersService>(LayersService);
    prismaService = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto: CreateLayerDto = {
      projectId: 'project-id',
      name: 'Frontend',
      description: 'Frontend layer',
      icon: 'monitor',
      color: '#4A90E2',
    };

    it('should create a new layer', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.layer.findUnique.mockResolvedValue(null);
      mockPrismaService.layer.create.mockResolvedValue({
        ...mockLayer,
        project: mockProject,
        _count: { storyLayers: 0, componentLayers: 0, useCases: 0, testCases: 0 },
      });

      const result = await service.create(createDto);

      expect(result).toBeDefined();
      expect(result.name).toBe('Frontend');
      expect(mockPrismaService.layer.create).toHaveBeenCalled();
      expect(mockWebSocketGateway.server.emit).toHaveBeenCalledWith('layer:created', expect.any(Object));
    });

    it('should throw NotFoundException if project does not exist', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(null);

      await expect(service.create(createDto)).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if layer name already exists', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.layer.findUnique.mockResolvedValue(mockLayer);

      await expect(service.create(createDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should return all layers for a project', async () => {
      mockPrismaService.layer.findMany.mockResolvedValue([
        {
          ...mockLayer,
          project: mockProject,
          _count: { storyLayers: 0, componentLayers: 0, useCases: 0, testCases: 0 },
        },
      ]);

      const result = await service.findAll({ projectId: 'project-id' });

      expect(result).toHaveLength(1);
    });

    it('should filter by status', async () => {
      mockPrismaService.layer.findMany.mockResolvedValue([
        {
          ...mockLayer,
          project: mockProject,
          _count: { storyLayers: 0, componentLayers: 0, useCases: 0, testCases: 0 },
        },
      ]);

      await service.findAll({ projectId: 'project-id', status: 'active' as any });

      expect(mockPrismaService.layer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            projectId: 'project-id',
            status: 'active',
          }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a single layer', async () => {
      mockPrismaService.layer.findUnique.mockResolvedValue({
        ...mockLayer,
        project: mockProject,
        _count: { storyLayers: 0, componentLayers: 0, useCases: 0, testCases: 0 },
      });

      const result = await service.findOne('layer-id');

      expect(result).toBeDefined();
      expect(result.id).toBe('layer-id');
    });

    it('should throw NotFoundException if layer not found', async () => {
      mockPrismaService.layer.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const updateDto: UpdateLayerDto = {
      name: 'Updated Layer',
      description: 'Updated description',
    };

    it('should update a layer', async () => {
      mockPrismaService.layer.findUnique.mockResolvedValue(mockLayer);
      mockPrismaService.layer.update.mockResolvedValue({
        ...mockLayer,
        ...updateDto,
        project: mockProject,
        _count: { storyLayers: 0, componentLayers: 0, useCases: 0, testCases: 0 },
      });

      const result = await service.update('layer-id', updateDto);

      expect(result.name).toBe('Updated Layer');
    });

    it('should throw NotFoundException if layer not found', async () => {
      mockPrismaService.layer.findUnique.mockResolvedValue(null);

      await expect(service.update('nonexistent-id', updateDto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete a layer', async () => {
      mockPrismaService.layer.findUnique.mockResolvedValue(mockLayer);
      mockPrismaService.layer.delete.mockResolvedValue(mockLayer);

      await service.remove('layer-id');

      expect(mockPrismaService.layer.delete).toHaveBeenCalledWith({
        where: { id: 'layer-id' },
      });
    });

    it('should throw NotFoundException if layer not found', async () => {
      mockPrismaService.layer.findUnique.mockResolvedValue(null);

      await expect(service.remove('nonexistent-id')).rejects.toThrow(NotFoundException);
    });
  });
});
