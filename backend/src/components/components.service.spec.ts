import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { ComponentsService } from './components.service';
import { PrismaService } from '../prisma/prisma.service';
import { AppWebSocketGateway } from '../websocket/websocket.gateway';
import { CreateComponentDto, UpdateComponentDto } from './dto';

describe('ComponentsService', () => {
  let service: ComponentsService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    project: {
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    layer: {
      findMany: jest.fn(),
    },
    component: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  const mockWebSocketGateway = {};

  const mockProject = {
    id: 'project-id',
    name: 'Test Project',
  };

  const mockUser = {
    id: 'user-id',
    name: 'Test User',
    email: 'test@example.com',
  };

  const mockComponent = {
    id: 'component-id',
    projectId: 'project-id',
    name: 'Auth Component',
    description: 'Authentication component',
    status: 'active' as any,
    ownerId: 'user-id',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ComponentsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AppWebSocketGateway, useValue: mockWebSocketGateway },
      ],
    }).compile();

    service = module.get<ComponentsService>(ComponentsService);
    prismaService = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto: CreateComponentDto = {
      projectId: 'project-id',
      name: 'Auth Component',
      description: 'Authentication component',
      ownerId: 'user-id',
    };

    it('should create a new component', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.component.findUnique.mockResolvedValue(null);
      mockPrismaService.component.create.mockResolvedValue({
        ...mockComponent,
        project: mockProject,
        owner: mockUser,
        layers: [],
        _count: { storyComponents: 0 },
      });

      const result = await service.create(createDto);

      expect(result).toBeDefined();
      expect(result.name).toBe('Auth Component');
      expect(mockPrismaService.component.create).toHaveBeenCalled();
    });

    it('should throw NotFoundException if project does not exist', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(null);

      await expect(service.create(createDto)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if owner does not exist', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.create(createDto)).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if component name already exists', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.component.findUnique.mockResolvedValue(mockComponent);

      await expect(service.create(createDto)).rejects.toThrow(ConflictException);
    });

    it('should validate layer IDs if provided', async () => {
      const dtoWithLayers = { ...createDto, layerIds: ['layer-1', 'layer-2'] };

      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.layer.findMany.mockResolvedValue([
        { id: 'layer-1' },
        { id: 'layer-2' },
      ]);
      mockPrismaService.component.findUnique.mockResolvedValue(null);
      mockPrismaService.component.create.mockResolvedValue({
        ...mockComponent,
        project: mockProject,
        owner: mockUser,
        layers: [],
        _count: { storyComponents: 0 },
      });

      await service.create(dtoWithLayers);

      expect(mockPrismaService.layer.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['layer-1', 'layer-2'] } },
      });
    });

    it('should throw NotFoundException if layer IDs are invalid', async () => {
      const dtoWithLayers = { ...createDto, layerIds: ['layer-1', 'layer-2'] };

      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.layer.findMany.mockResolvedValue([{ id: 'layer-1' }]); // Only 1 layer found

      await expect(service.create(dtoWithLayers)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('should return all components for a project', async () => {
      mockPrismaService.component.findMany.mockResolvedValue([
        {
          ...mockComponent,
          project: mockProject,
          owner: mockUser,
          layers: [],
          _count: { storyComponents: 0 },
        },
      ]);

      const result = await service.findAll({ projectId: 'project-id' });

      expect(result).toHaveLength(1);
    });

    it('should filter by status', async () => {
      mockPrismaService.component.findMany.mockResolvedValue([
        {
          ...mockComponent,
          project: mockProject,
          owner: mockUser,
          layers: [],
          _count: { storyComponents: 0 },
        },
      ]);

      await service.findAll({ projectId: 'project-id', status: 'active' as any });

      expect(mockPrismaService.component.findMany).toHaveBeenCalledWith(
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
    it('should return a single component', async () => {
      mockPrismaService.component.findUnique.mockResolvedValue({
        ...mockComponent,
        project: mockProject,
        owner: mockUser,
        layers: [],
        _count: { storyComponents: 0 },
      });

      const result = await service.findOne('component-id');

      expect(result).toBeDefined();
      expect(result.id).toBe('component-id');
    });

    it('should throw NotFoundException if component not found', async () => {
      mockPrismaService.component.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const updateDto: UpdateComponentDto = {
      name: 'Updated Component',
      description: 'Updated description',
    };

    it('should update a component', async () => {
      mockPrismaService.component.findUnique.mockResolvedValue(mockComponent);
      mockPrismaService.component.update.mockResolvedValue({
        ...mockComponent,
        ...updateDto,
        project: mockProject,
        owner: mockUser,
        layers: [],
        _count: { storyComponents: 0 },
      });

      const result = await service.update('component-id', updateDto);

      expect(result.name).toBe('Updated Component');
    });

    it('should throw NotFoundException if component not found', async () => {
      mockPrismaService.component.findUnique.mockResolvedValue(null);

      await expect(service.update('nonexistent-id', updateDto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('should delete a component', async () => {
      mockPrismaService.component.findUnique.mockResolvedValue(mockComponent);
      mockPrismaService.component.delete.mockResolvedValue(mockComponent);

      await service.remove('component-id');

      expect(mockPrismaService.component.delete).toHaveBeenCalledWith({
        where: { id: 'component-id' },
      });
    });

    it('should throw NotFoundException if component not found', async () => {
      mockPrismaService.component.findUnique.mockResolvedValue(null);

      await expect(service.remove('nonexistent-id')).rejects.toThrow(NotFoundException);
    });
  });
});
