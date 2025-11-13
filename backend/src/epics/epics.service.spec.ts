import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { EpicsService } from './epics.service';
import { PrismaService } from '../prisma/prisma.service';
import { AppWebSocketGateway } from '../websocket/websocket.gateway';
import { CreateEpicDto, UpdateEpicDto, FilterEpicDto } from './dto';

describe('EpicsService', () => {
  let service: EpicsService;
  let prismaService: PrismaService;
  let wsGateway: AppWebSocketGateway;

  const mockPrismaService = {
    project: {
      findUnique: jest.fn(),
    },
    epic: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  const mockWebSocketGateway = {
    broadcastEpicCreated: jest.fn(),
    broadcastEpicUpdated: jest.fn(),
  };

  const mockProject = {
    id: 'project-id',
    name: 'Test Project',
  };

  const mockEpic = {
    id: 'epic-id',
    projectId: 'project-id',
    key: 'EP-1',
    title: 'Test Epic',
    description: 'Test epic description',
    status: 'planning' as any,
    priority: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EpicsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AppWebSocketGateway, useValue: mockWebSocketGateway },
      ],
    }).compile();

    service = module.get<EpicsService>(EpicsService);
    prismaService = module.get<PrismaService>(PrismaService);
    wsGateway = module.get<AppWebSocketGateway>(AppWebSocketGateway);

    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto: CreateEpicDto = {
      projectId: 'project-id',
      title: 'Test Epic',
      description: 'Test epic description',
      priority: 5,
    };

    it('should create a new epic', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.epic.findFirst.mockResolvedValue(null);
      mockPrismaService.epic.create.mockResolvedValue({
        ...mockEpic,
        project: mockProject,
        _count: { stories: 0, commits: 0 },
      });

      const result = await service.create(createDto);

      expect(result).toBeDefined();
      expect(result.key).toBe('EP-1');
      expect(mockPrismaService.project.findUnique).toHaveBeenCalledWith({
        where: { id: 'project-id' },
      });
      expect(mockWebSocketGateway.broadcastEpicCreated).toHaveBeenCalled();
    });

    it('should throw NotFoundException if project does not exist', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(null);

      await expect(service.create(createDto)).rejects.toThrow(NotFoundException);
    });

    it('should auto-generate key starting from EP-1', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.epic.findFirst.mockResolvedValue(null);
      mockPrismaService.epic.create.mockResolvedValue({
        ...mockEpic,
        key: 'EP-1',
        project: mockProject,
        _count: { stories: 0, commits: 0 },
      });

      const result = await service.create(createDto);

      expect(result.key).toBe('EP-1');
    });

    it('should auto-increment key from last epic', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.epic.findFirst.mockResolvedValue({ key: 'EP-3' });
      mockPrismaService.epic.create.mockResolvedValue({
        ...mockEpic,
        key: 'EP-4',
        project: mockProject,
        _count: { stories: 0, commits: 0 },
      });

      const result = await service.create(createDto);

      expect(result.key).toBe('EP-4');
    });
  });

  describe('findAll', () => {
    it('should return all epics for a project', async () => {
      mockPrismaService.epic.findMany.mockResolvedValue([
        { ...mockEpic, project: mockProject, _count: { stories: 0, commits: 0 } },
      ]);

      const result = await service.findAll({ projectId: 'project-id' });

      expect(result).toHaveLength(1);
      expect(mockPrismaService.epic.findMany).toHaveBeenCalled();
    });

    it('should filter by status', async () => {
      mockPrismaService.epic.findMany.mockResolvedValue([
        { ...mockEpic, project: mockProject, _count: { stories: 0, commits: 0 } },
      ]);

      await service.findAll({ projectId: 'project-id', status: 'planning' as any });

      expect(mockPrismaService.epic.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            projectId: 'project-id',
            status: 'planning',
          }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a single epic', async () => {
      mockPrismaService.epic.findUnique.mockResolvedValue({
        ...mockEpic,
        project: mockProject,
        stories: [],
        _count: { stories: 0, commits: 0 },
      });

      const result = await service.findOne('epic-id');

      expect(result).toBeDefined();
      expect(result.id).toBe('epic-id');
    });

    it('should throw NotFoundException if epic not found', async () => {
      mockPrismaService.epic.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const updateDto: UpdateEpicDto = {
      title: 'Updated Epic',
      description: 'Updated description',
    };

    it('should update an epic', async () => {
      mockPrismaService.epic.findUnique.mockResolvedValue(mockEpic);
      mockPrismaService.epic.update.mockResolvedValue({
        ...mockEpic,
        ...updateDto,
        project: mockProject,
        _count: { stories: 0, commits: 0 },
      });

      const result = await service.update('epic-id', updateDto);

      expect(result.title).toBe('Updated Epic');
      expect(mockWebSocketGateway.broadcastEpicUpdated).toHaveBeenCalled();
    });

    it('should throw NotFoundException if epic not found', async () => {
      mockPrismaService.epic.findUnique.mockResolvedValue(null);

      await expect(service.update('nonexistent-id', updateDto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('should delete an epic', async () => {
      mockPrismaService.epic.findUnique.mockResolvedValue({
        ...mockEpic,
        _count: { stories: 0 },
      });
      mockPrismaService.epic.delete.mockResolvedValue(mockEpic);

      await service.remove('epic-id');

      expect(mockPrismaService.epic.delete).toHaveBeenCalledWith({
        where: { id: 'epic-id' },
      });
    });

    it('should throw NotFoundException if epic not found', async () => {
      mockPrismaService.epic.findUnique.mockResolvedValue(null);

      await expect(service.remove('nonexistent-id')).rejects.toThrow(NotFoundException);
    });
  });
});
