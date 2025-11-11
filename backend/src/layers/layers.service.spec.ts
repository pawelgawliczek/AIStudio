import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { LayersService } from './layers.service';
import { PrismaService } from '../prisma/prisma.service';
import { AppWebSocketGateway } from '../websocket/websocket.gateway';
import { LayerStatus } from '@prisma/client';

describe('LayersService', () => {
  let service: LayersService;
  let prismaService: PrismaService;
  let wsGateway: AppWebSocketGateway;

  const mockProject = {
    id: 'project-1',
    name: 'Test Project',
    description: 'Test Description',
    status: 'active' as const,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockLayer = {
    id: 'layer-1',
    projectId: 'project-1',
    name: 'Frontend',
    description: 'Frontend layer',
    techStack: ['React', 'TypeScript'],
    orderIndex: 1,
    color: '#3B82F6',
    icon: '🌐',
    status: LayerStatus.active,
    createdAt: new Date(),
    updatedAt: new Date(),
    _count: {
      storyLayers: 0,
      componentLayers: 0,
      useCases: 0,
      testCases: 0,
    },
    project: {
      id: 'project-1',
      name: 'Test Project',
    },
  };

  const mockWsGateway = {
    server: {
      emit: jest.fn(),
    },
  };

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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LayersService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AppWebSocketGateway, useValue: mockWsGateway },
      ],
    }).compile();

    service = module.get<LayersService>(LayersService);
    prismaService = module.get<PrismaService>(PrismaService);
    wsGateway = module.get<AppWebSocketGateway>(AppWebSocketGateway);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createLayerDto = {
      projectId: 'project-1',
      name: 'Frontend',
      description: 'Frontend layer',
      techStack: ['React', 'TypeScript'],
      orderIndex: 1,
      color: '#3B82F6',
      icon: '🌐',
      status: LayerStatus.active,
    };

    it('should create a new layer successfully', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.layer.findUnique.mockResolvedValue(null);
      mockPrismaService.layer.create.mockResolvedValue(mockLayer);

      const result = await service.create(createLayerDto);

      expect(result).toEqual(mockLayer);
      expect(mockPrismaService.project.findUnique).toHaveBeenCalledWith({
        where: { id: createLayerDto.projectId },
      });
      expect(mockPrismaService.layer.create).toHaveBeenCalledWith({
        data: createLayerDto,
        include: expect.any(Object),
      });
      expect(mockWsGateway.server.emit).toHaveBeenCalledWith('layer:created', {
        projectId: mockLayer.projectId,
        layer: mockLayer,
      });
    });

    it('should throw NotFoundException if project does not exist', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(null);

      await expect(service.create(createLayerDto)).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.project.findUnique).toHaveBeenCalled();
      expect(mockPrismaService.layer.create).not.toHaveBeenCalled();
    });

    it('should throw ConflictException if layer name already exists in project', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.layer.findUnique.mockResolvedValue(mockLayer);

      await expect(service.create(createLayerDto)).rejects.toThrow(ConflictException);
      expect(mockPrismaService.layer.findUnique).toHaveBeenCalledWith({
        where: {
          projectId_name: {
            projectId: createLayerDto.projectId,
            name: createLayerDto.name,
          },
        },
      });
      expect(mockPrismaService.layer.create).not.toHaveBeenCalled();
    });

    it('should set status to active by default if not provided', async () => {
      const dtoWithoutStatus = { ...createLayerDto };
      delete dtoWithoutStatus.status;

      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.layer.findUnique.mockResolvedValue(null);
      mockPrismaService.layer.create.mockResolvedValue(mockLayer);

      await service.create(dtoWithoutStatus);

      expect(mockPrismaService.layer.create).toHaveBeenCalledWith({
        data: { ...dtoWithoutStatus, status: LayerStatus.active },
        include: expect.any(Object),
      });
    });
  });

  describe('findAll', () => {
    const mockLayers = [
      mockLayer,
      {
        ...mockLayer,
        id: 'layer-2',
        name: 'Backend',
        orderIndex: 2,
      },
    ];

    it('should return all layers without filters', async () => {
      mockPrismaService.layer.findMany.mockResolvedValue(mockLayers);

      const result = await service.findAll({});

      expect(result).toEqual(mockLayers);
      expect(mockPrismaService.layer.findMany).toHaveBeenCalledWith({
        where: {},
        include: expect.any(Object),
        orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
      });
    });

    it('should filter by projectId', async () => {
      mockPrismaService.layer.findMany.mockResolvedValue(mockLayers);

      await service.findAll({ projectId: 'project-1' });

      expect(mockPrismaService.layer.findMany).toHaveBeenCalledWith({
        where: { projectId: 'project-1' },
        include: expect.any(Object),
        orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
      });
    });

    it('should filter by status', async () => {
      mockPrismaService.layer.findMany.mockResolvedValue(mockLayers);

      await service.findAll({ status: LayerStatus.active });

      expect(mockPrismaService.layer.findMany).toHaveBeenCalledWith({
        where: { status: LayerStatus.active },
        include: expect.any(Object),
        orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
      });
    });

    it('should filter by both projectId and status', async () => {
      mockPrismaService.layer.findMany.mockResolvedValue(mockLayers);

      await service.findAll({ projectId: 'project-1', status: LayerStatus.active });

      expect(mockPrismaService.layer.findMany).toHaveBeenCalledWith({
        where: { projectId: 'project-1', status: LayerStatus.active },
        include: expect.any(Object),
        orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
      });
    });
  });

  describe('findOne', () => {
    const layerWithComponents = {
      ...mockLayer,
      componentLayers: [
        {
          component: {
            id: 'comp-1',
            name: 'Authentication',
            icon: '🔐',
            color: '#10B981',
          },
        },
      ],
    };

    it('should return a single layer with related data', async () => {
      mockPrismaService.layer.findUnique.mockResolvedValue(layerWithComponents);

      const result = await service.findOne('layer-1');

      expect(result).toEqual(layerWithComponents);
      expect(mockPrismaService.layer.findUnique).toHaveBeenCalledWith({
        where: { id: 'layer-1' },
        include: expect.any(Object),
      });
    });

    it('should throw NotFoundException if layer not found', async () => {
      mockPrismaService.layer.findUnique.mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const updateLayerDto = {
      name: 'Updated Frontend',
      description: 'Updated description',
      techStack: ['React', 'TypeScript', 'Vite'],
    };

    it('should update layer successfully', async () => {
      const updatedLayer = { ...mockLayer, ...updateLayerDto };
      mockPrismaService.layer.findUnique
        .mockResolvedValueOnce(mockLayer) // First call - get existing layer
        .mockResolvedValueOnce(null); // Second call - check for duplicate name
      mockPrismaService.layer.update.mockResolvedValue(updatedLayer);

      const result = await service.update('layer-1', updateLayerDto);

      expect(result).toEqual(updatedLayer);
      expect(mockPrismaService.layer.update).toHaveBeenCalledWith({
        where: { id: 'layer-1' },
        data: updateLayerDto,
        include: expect.any(Object),
      });
      expect(mockWsGateway.server.emit).toHaveBeenCalledWith('layer:updated', {
        layerId: 'layer-1',
        projectId: updatedLayer.projectId,
        layer: updatedLayer,
      });
    });

    it('should throw NotFoundException if layer does not exist', async () => {
      mockPrismaService.layer.findUnique.mockResolvedValue(null);

      await expect(service.update('non-existent', updateLayerDto)).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.layer.update).not.toHaveBeenCalled();
    });

    it('should throw ConflictException if new name already exists', async () => {
      const duplicateLayer = { ...mockLayer, id: 'layer-2' };
      mockPrismaService.layer.findUnique
        .mockResolvedValueOnce(mockLayer) // First call for existing check
        .mockResolvedValueOnce(duplicateLayer); // Second call for duplicate check

      await expect(service.update('layer-1', { name: 'Backend' })).rejects.toThrow(ConflictException);
      expect(mockPrismaService.layer.update).not.toHaveBeenCalled();
    });

    it('should allow updating other fields without changing name', async () => {
      const updatedLayer = { ...mockLayer, description: 'New description' };
      mockPrismaService.layer.findUnique.mockResolvedValue(mockLayer);
      mockPrismaService.layer.update.mockResolvedValue(updatedLayer);

      await service.update('layer-1', { description: 'New description' });

      expect(mockPrismaService.layer.update).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should delete layer successfully when not in use', async () => {
      mockPrismaService.layer.findUnique.mockResolvedValue(mockLayer);
      mockPrismaService.layer.delete.mockResolvedValue(mockLayer);

      const result = await service.remove('layer-1');

      expect(result).toEqual({ message: 'Layer deleted successfully' });
      expect(mockPrismaService.layer.delete).toHaveBeenCalledWith({ where: { id: 'layer-1' } });
    });

    it('should throw NotFoundException if layer does not exist', async () => {
      mockPrismaService.layer.findUnique.mockResolvedValue(null);

      await expect(service.remove('non-existent')).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.layer.delete).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if layer is used by stories', async () => {
      const usedLayer = {
        ...mockLayer,
        _count: {
          storyLayers: 5,
          componentLayers: 0,
          useCases: 0,
          testCases: 0,
        },
      };
      mockPrismaService.layer.findUnique.mockResolvedValue(usedLayer);

      await expect(service.remove('layer-1')).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.layer.delete).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if layer is used by components', async () => {
      const usedLayer = {
        ...mockLayer,
        _count: {
          storyLayers: 0,
          componentLayers: 3,
          useCases: 0,
          testCases: 0,
        },
      };
      mockPrismaService.layer.findUnique.mockResolvedValue(usedLayer);

      await expect(service.remove('layer-1')).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.layer.delete).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if layer is used by use cases', async () => {
      const usedLayer = {
        ...mockLayer,
        _count: {
          storyLayers: 0,
          componentLayers: 0,
          useCases: 2,
          testCases: 0,
        },
      };
      mockPrismaService.layer.findUnique.mockResolvedValue(usedLayer);

      await expect(service.remove('layer-1')).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.layer.delete).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if layer is used by test cases', async () => {
      const usedLayer = {
        ...mockLayer,
        _count: {
          storyLayers: 0,
          componentLayers: 0,
          useCases: 0,
          testCases: 10,
        },
      };
      mockPrismaService.layer.findUnique.mockResolvedValue(usedLayer);

      await expect(service.remove('layer-1')).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.layer.delete).not.toHaveBeenCalled();
    });

    it('should include usage details in error message', async () => {
      const usedLayer = {
        ...mockLayer,
        _count: {
          storyLayers: 5,
          componentLayers: 3,
          useCases: 2,
          testCases: 10,
        },
      };
      mockPrismaService.layer.findUnique.mockResolvedValue(usedLayer);

      try {
        await service.remove('layer-1');
      } catch (error) {
        expect(error.message).toContain('5 stories');
        expect(error.message).toContain('3 components');
        expect(error.message).toContain('2 use cases');
        expect(error.message).toContain('10 test cases');
        expect(error.message).toContain('Consider deprecating instead');
      }
    });
  });
});
