import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { ComponentsService } from './components.service';
import { PrismaService } from '../prisma/prisma.service';
import { AppWebSocketGateway } from '../websocket/websocket.gateway';
import { ComponentStatus } from '@prisma/client';

describe('ComponentsService', () => {
  let service: ComponentsService;
  let prismaService: PrismaService;
  let wsGateway: AppWebSocketGateway;

  const mockProject = {
    id: 'project-1',
    name: 'Test Project',
  };

  const mockUser = {
    id: 'user-1',
    name: 'John Doe',
    email: 'john@example.com',
  };

  const mockLayer = {
    id: 'layer-1',
    projectId: 'project-1',
    name: 'Frontend',
    icon: '🌐',
    color: '#3B82F6',
    orderIndex: 1,
  };

  const mockComponent = {
    id: 'component-1',
    projectId: 'project-1',
    name: 'Authentication',
    description: 'User authentication component',
    ownerId: 'user-1',
    status: ComponentStatus.active,
    color: '#10B981',
    icon: '🔐',
    filePatterns: ['**/auth/**/*', '**/*auth*.ts'],
    createdAt: new Date(),
    updatedAt: new Date(),
    _count: {
      storyComponents: 0,
      useCases: 0,
      testCases: 0,
    },
    project: mockProject,
    owner: mockUser,
    layers: [
      {
        layer: mockLayer,
      },
    ],
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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ComponentsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AppWebSocketGateway, useValue: mockWsGateway },
      ],
    }).compile();

    service = module.get<ComponentsService>(ComponentsService);
    prismaService = module.get<PrismaService>(PrismaService);
    wsGateway = module.get<AppWebSocketGateway>(AppWebSocketGateway);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createComponentDto = {
      projectId: 'project-1',
      name: 'Authentication',
      description: 'User authentication component',
      ownerId: 'user-1',
      layerIds: ['layer-1'],
      status: ComponentStatus.active,
      color: '#10B981',
      icon: '🔐',
      filePatterns: ['**/auth/**/*'],
    };

    it('should create a new component successfully', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.layer.findMany.mockResolvedValue([mockLayer]);
      mockPrismaService.component.findUnique.mockResolvedValue(null);
      mockPrismaService.component.create.mockResolvedValue(mockComponent);

      const result = await service.create(createComponentDto);

      expect(result).toEqual(mockComponent);
      expect(mockPrismaService.project.findUnique).toHaveBeenCalledWith({
        where: { id: createComponentDto.projectId },
      });
      expect(mockPrismaService.component.create).toHaveBeenCalled();
      expect(mockWsGateway.server.emit).toHaveBeenCalledWith('component:created', {
        projectId: mockComponent.projectId,
        component: mockComponent,
      });
    });

    it('should throw NotFoundException if project does not exist', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(null);

      await expect(service.create(createComponentDto)).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.component.create).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if owner does not exist', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.create(createComponentDto)).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.component.create).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if any layer ID is invalid', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.layer.findMany.mockResolvedValue([]); // No layers found

      await expect(service.create(createComponentDto)).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.component.create).not.toHaveBeenCalled();
    });

    it('should throw ConflictException if component name already exists', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.layer.findMany.mockResolvedValue([mockLayer]);
      mockPrismaService.component.findUnique.mockResolvedValue(mockComponent);

      await expect(service.create(createComponentDto)).rejects.toThrow(ConflictException);
      expect(mockPrismaService.component.create).not.toHaveBeenCalled();
    });

    it('should create component without owner', async () => {
      const dtoWithoutOwner = { ...createComponentDto };
      delete dtoWithoutOwner.ownerId;

      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.layer.findMany.mockResolvedValue([mockLayer]);
      mockPrismaService.component.findUnique.mockResolvedValue(null);
      mockPrismaService.component.create.mockResolvedValue({
        ...mockComponent,
        ownerId: null,
        owner: null,
      });

      await service.create(dtoWithoutOwner);

      expect(mockPrismaService.user.findUnique).not.toHaveBeenCalled();
      expect(mockPrismaService.component.create).toHaveBeenCalled();
    });

    it('should create component without layers', async () => {
      const dtoWithoutLayers = { ...createComponentDto };
      delete dtoWithoutLayers.layerIds;

      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.component.findUnique.mockResolvedValue(null);
      mockPrismaService.component.create.mockResolvedValue({
        ...mockComponent,
        layers: [],
      });

      await service.create(dtoWithoutLayers);

      expect(mockPrismaService.layer.findMany).not.toHaveBeenCalled();
      expect(mockPrismaService.component.create).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    const mockComponents = [
      mockComponent,
      {
        ...mockComponent,
        id: 'component-2',
        name: 'Billing',
      },
    ];

    it('should return all components without filters', async () => {
      mockPrismaService.component.findMany.mockResolvedValue(mockComponents);

      const result = await service.findAll({});

      expect(result).toEqual(mockComponents);
      expect(mockPrismaService.component.findMany).toHaveBeenCalledWith({
        where: {},
        include: expect.any(Object),
        orderBy: [{ name: 'asc' }],
      });
    });

    it('should filter by projectId', async () => {
      mockPrismaService.component.findMany.mockResolvedValue(mockComponents);

      await service.findAll({ projectId: 'project-1' });

      expect(mockPrismaService.component.findMany).toHaveBeenCalledWith({
        where: { projectId: 'project-1' },
        include: expect.any(Object),
        orderBy: [{ name: 'asc' }],
      });
    });

    it('should filter by status', async () => {
      mockPrismaService.component.findMany.mockResolvedValue(mockComponents);

      await service.findAll({ status: ComponentStatus.active });

      expect(mockPrismaService.component.findMany).toHaveBeenCalledWith({
        where: { status: ComponentStatus.active },
        include: expect.any(Object),
        orderBy: [{ name: 'asc' }],
      });
    });

    it('should filter by layerId', async () => {
      mockPrismaService.component.findMany.mockResolvedValue(mockComponents);

      await service.findAll({ layerId: 'layer-1' });

      expect(mockPrismaService.component.findMany).toHaveBeenCalledWith({
        where: {
          layers: {
            some: { layerId: 'layer-1' },
          },
        },
        include: expect.any(Object),
        orderBy: [{ name: 'asc' }],
      });
    });
  });

  describe('findOne', () => {
    it('should return a single component with related data', async () => {
      mockPrismaService.component.findUnique.mockResolvedValue(mockComponent);

      const result = await service.findOne('component-1');

      expect(result).toEqual(mockComponent);
      expect(mockPrismaService.component.findUnique).toHaveBeenCalledWith({
        where: { id: 'component-1' },
        include: expect.any(Object),
      });
    });

    it('should throw NotFoundException if component not found', async () => {
      mockPrismaService.component.findUnique.mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findWithUseCases', () => {
    const componentWithUseCases = {
      ...mockComponent,
      useCases: [
        {
          id: 'uc-1',
          key: 'UC-AUTH-001',
          title: 'User Login',
          testCases: [],
        },
      ],
    };

    it('should return component with use cases', async () => {
      mockPrismaService.component.findUnique.mockResolvedValue(componentWithUseCases);

      const result = await service.findWithUseCases('component-1');

      expect(result).toEqual(componentWithUseCases);
      expect(mockPrismaService.component.findUnique).toHaveBeenCalledWith({
        where: { id: 'component-1' },
        include: expect.objectContaining({
          useCases: expect.any(Object),
        }),
      });
    });

    it('should throw NotFoundException if component not found', async () => {
      mockPrismaService.component.findUnique.mockResolvedValue(null);

      await expect(service.findWithUseCases('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findWithStories', () => {
    const componentWithStories = {
      ...mockComponent,
      storyComponents: [
        {
          story: {
            id: 'story-1',
            key: 'ST-1',
            title: 'Implement login',
            epic: {
              id: 'epic-1',
              title: 'Authentication Epic',
            },
            assignedFramework: {
              id: 'framework-1',
              name: 'Single Agent',
            },
          },
        },
      ],
    };

    it('should return component with stories', async () => {
      mockPrismaService.component.findUnique.mockResolvedValue(componentWithStories);

      const result = await service.findWithStories('component-1');

      expect(result).toEqual(componentWithStories);
      expect(mockPrismaService.component.findUnique).toHaveBeenCalledWith({
        where: { id: 'component-1' },
        include: expect.objectContaining({
          storyComponents: expect.any(Object),
        }),
      });
    });

    it('should throw NotFoundException if component not found', async () => {
      mockPrismaService.component.findUnique.mockResolvedValue(null);

      await expect(service.findWithStories('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const updateComponentDto = {
      name: 'Updated Authentication',
      description: 'Updated description',
      layerIds: ['layer-1', 'layer-2'],
    };

    it('should update component successfully', async () => {
      const updatedComponent = { ...mockComponent, ...updateComponentDto };
      mockPrismaService.component.findUnique
        .mockResolvedValueOnce(mockComponent) // First call - get existing component
        .mockResolvedValueOnce(null); // Second call - check for duplicate name
      mockPrismaService.layer.findMany.mockResolvedValue([
        mockLayer,
        { id: 'layer-2', projectId: 'project-1' },
      ]);
      mockPrismaService.component.update.mockResolvedValue(updatedComponent);

      const result = await service.update('component-1', updateComponentDto);

      expect(result).toEqual(updatedComponent);
      expect(mockPrismaService.component.update).toHaveBeenCalledWith({
        where: { id: 'component-1' },
        data: expect.objectContaining({
          name: updateComponentDto.name,
          description: updateComponentDto.description,
          layers: {
            deleteMany: {},
            create: expect.any(Array),
          },
        }),
        include: expect.any(Object),
      });
      expect(mockWsGateway.server.emit).toHaveBeenCalledWith('component:updated', {
        componentId: 'component-1',
        projectId: updatedComponent.projectId,
        component: updatedComponent,
      });
    });

    it('should throw NotFoundException if component does not exist', async () => {
      mockPrismaService.component.findUnique.mockResolvedValue(null);

      await expect(service.update('non-existent', updateComponentDto)).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.component.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if owner does not exist', async () => {
      mockPrismaService.component.findUnique.mockResolvedValue(mockComponent);
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.update('component-1', { ownerId: 'invalid-user' })).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.component.update).not.toHaveBeenCalled();
    });

    it('should throw ConflictException if new name already exists', async () => {
      const duplicateComponent = { ...mockComponent, id: 'component-2' };
      mockPrismaService.component.findUnique
        .mockResolvedValueOnce(mockComponent) // First call for existing check
        .mockResolvedValueOnce(duplicateComponent); // Second call for duplicate check

      await expect(service.update('component-1', { name: 'Billing' })).rejects.toThrow(ConflictException);
      expect(mockPrismaService.component.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if any layer ID is invalid', async () => {
      mockPrismaService.component.findUnique.mockResolvedValue(mockComponent);
      mockPrismaService.layer.findMany.mockResolvedValue([mockLayer]); // Only 1 layer found, but 2 requested

      await expect(service.update('component-1', { layerIds: ['layer-1', 'invalid-layer'] }))
        .rejects.toThrow(NotFoundException);
      expect(mockPrismaService.component.update).not.toHaveBeenCalled();
    });

    it('should update component without changing layers', async () => {
      const updatedComponent = { ...mockComponent, description: 'New description' };
      mockPrismaService.component.findUnique.mockResolvedValue(mockComponent);
      mockPrismaService.component.update.mockResolvedValue(updatedComponent);

      await service.update('component-1', { description: 'New description' });

      expect(mockPrismaService.component.update).toHaveBeenCalledWith({
        where: { id: 'component-1' },
        data: {
          description: 'New description',
          layers: undefined,
        },
        include: expect.any(Object),
      });
    });
  });

  describe('remove', () => {
    it('should delete component successfully when not in use', async () => {
      mockPrismaService.component.findUnique.mockResolvedValue(mockComponent);
      mockPrismaService.component.delete.mockResolvedValue(mockComponent);

      const result = await service.remove('component-1');

      expect(result).toEqual({ message: 'Component deleted successfully' });
      expect(mockPrismaService.component.delete).toHaveBeenCalledWith({ where: { id: 'component-1' } });
    });

    it('should throw NotFoundException if component does not exist', async () => {
      mockPrismaService.component.findUnique.mockResolvedValue(null);

      await expect(service.remove('non-existent')).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.component.delete).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if component is used by stories', async () => {
      const usedComponent = {
        ...mockComponent,
        _count: {
          storyComponents: 5,
          useCases: 0,
          testCases: 0,
        },
      };
      mockPrismaService.component.findUnique.mockResolvedValue(usedComponent);

      await expect(service.remove('component-1')).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.component.delete).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if component is used by use cases', async () => {
      const usedComponent = {
        ...mockComponent,
        _count: {
          storyComponents: 0,
          useCases: 3,
          testCases: 0,
        },
      };
      mockPrismaService.component.findUnique.mockResolvedValue(usedComponent);

      await expect(service.remove('component-1')).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.component.delete).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if component is used by test cases', async () => {
      const usedComponent = {
        ...mockComponent,
        _count: {
          storyComponents: 0,
          useCases: 0,
          testCases: 10,
        },
      };
      mockPrismaService.component.findUnique.mockResolvedValue(usedComponent);

      await expect(service.remove('component-1')).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.component.delete).not.toHaveBeenCalled();
    });

    it('should include usage details in error message', async () => {
      const usedComponent = {
        ...mockComponent,
        _count: {
          storyComponents: 5,
          useCases: 3,
          testCases: 10,
        },
      };
      mockPrismaService.component.findUnique.mockResolvedValue(usedComponent);

      try {
        await service.remove('component-1');
      } catch (error) {
        expect(error.message).toContain('5 stories');
        expect(error.message).toContain('3 use cases');
        expect(error.message).toContain('10 test cases');
        expect(error.message).toContain('Consider deprecating instead');
      }
    });
  });
});
