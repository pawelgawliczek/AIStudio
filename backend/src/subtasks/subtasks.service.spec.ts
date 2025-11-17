import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { AppWebSocketGateway } from '../websocket/websocket.gateway';
import { CreateSubtaskDto, UpdateSubtaskDto, FilterSubtaskDto } from './dto';
import { SubtasksService } from './subtasks.service';

describe('SubtasksService', () => {
  let service: SubtasksService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    story: {
      findUnique: jest.fn(),
    },
    subtask: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  const mockWebSocketGateway = {
    broadcastSubtaskCreated: jest.fn(),
    broadcastSubtaskUpdated: jest.fn(),
  };

  const mockStory = {
    id: 'story-id',
    projectId: 'project-id',
    key: 'ST-1',
    title: 'Test Story',
  };

  const mockSubtask = {
    id: 'subtask-id',
    storyId: 'story-id',
    title: 'Test Subtask',
    description: 'Test description',
    status: 'todo' as any,
    layer: 'frontend' as any,
    assigneeType: 'developer' as any,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubtasksService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AppWebSocketGateway, useValue: mockWebSocketGateway },
      ],
    }).compile();

    service = module.get<SubtasksService>(SubtasksService);
    prismaService = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto: CreateSubtaskDto = {
      storyId: 'story-id',
      title: 'Test Subtask',
      description: 'Test description',
      layer: 'frontend' as any,
      assigneeType: 'developer' as any,
    };

    it('should create a new subtask', async () => {
      mockPrismaService.story.findUnique.mockResolvedValue(mockStory);
      mockPrismaService.subtask.create.mockResolvedValue({
        ...mockSubtask,
        story: mockStory,
      });

      const result = await service.create(createDto);

      expect(result).toBeDefined();
      expect(result.title).toBe('Test Subtask');
      expect(mockPrismaService.subtask.create).toHaveBeenCalled();
      expect(mockWebSocketGateway.broadcastSubtaskCreated).toHaveBeenCalled();
    });

    it('should throw NotFoundException if story does not exist', async () => {
      mockPrismaService.story.findUnique.mockResolvedValue(null);

      await expect(service.create(createDto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('should return all subtasks for a story', async () => {
      mockPrismaService.subtask.findMany.mockResolvedValue([
        { ...mockSubtask, story: mockStory },
      ]);

      const result = await service.findAll({ storyId: 'story-id' });

      expect(result).toHaveLength(1);
      expect(mockPrismaService.subtask.findMany).toHaveBeenCalled();
    });

    it('should filter by status', async () => {
      mockPrismaService.subtask.findMany.mockResolvedValue([
        { ...mockSubtask, story: mockStory },
      ]);

      await service.findAll({ storyId: 'story-id', status: 'todo' as any });

      expect(mockPrismaService.subtask.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            storyId: 'story-id',
            status: 'todo',
          }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a single subtask', async () => {
      mockPrismaService.subtask.findUnique.mockResolvedValue({
        ...mockSubtask,
        story: mockStory,
      });

      const result = await service.findOne('subtask-id');

      expect(result).toBeDefined();
      expect(result.id).toBe('subtask-id');
    });

    it('should throw NotFoundException if subtask not found', async () => {
      mockPrismaService.subtask.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const updateDto: UpdateSubtaskDto = {
      title: 'Updated Subtask',
      status: 'in_progress' as any,
    };

    it('should update a subtask', async () => {
      mockPrismaService.subtask.findUnique.mockResolvedValue({
        ...mockSubtask,
        story: mockStory,
      });
      mockPrismaService.subtask.update.mockResolvedValue({
        ...mockSubtask,
        ...updateDto,
        story: mockStory,
      });

      const result = await service.update('subtask-id', updateDto);

      expect(result.title).toBe('Updated Subtask');
      expect(mockWebSocketGateway.broadcastSubtaskUpdated).toHaveBeenCalled();
    });

    it('should throw NotFoundException if subtask not found', async () => {
      mockPrismaService.subtask.findUnique.mockResolvedValue(null);

      await expect(service.update('nonexistent-id', updateDto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('should delete a subtask', async () => {
      mockPrismaService.subtask.findUnique.mockResolvedValue(mockSubtask);
      mockPrismaService.subtask.delete.mockResolvedValue(mockSubtask);

      await service.remove('subtask-id');

      expect(mockPrismaService.subtask.delete).toHaveBeenCalledWith({
        where: { id: 'subtask-id' },
      });
    });

    it('should throw NotFoundException if subtask not found', async () => {
      mockPrismaService.subtask.findUnique.mockResolvedValue(null);

      await expect(service.remove('nonexistent-id')).rejects.toThrow(NotFoundException);
    });
  });
});
