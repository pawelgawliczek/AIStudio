import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { RunsService } from './runs.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRunDto } from './dto';

describe('RunsService', () => {
  let service: RunsService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    run: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockRun = {
    id: 'run-id',
    projectId: 'project-id',
    storyId: 'story-id',
    subtaskId: 'subtask-id',
    agentId: 'agent-id',
    frameworkId: 'framework-id',
    origin: 'manual' as any,
    tokensInput: 1000,
    tokensOutput: 500,
    startedAt: new Date(),
    finishedAt: new Date(),
    success: true,
    errorType: null,
    iterations: 1,
    metadata: {},
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RunsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<RunsService>(RunsService);
    prismaService = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto: CreateRunDto = {
      projectId: 'project-id',
      storyId: 'story-id',
      agentId: 'agent-id',
      frameworkId: 'framework-id',
      origin: 'manual' as any,
      tokensInput: 1000,
      tokensOutput: 500,
      startedAt: new Date().toISOString(),
    };

    it('should create a new run', async () => {
      mockPrismaService.run.create.mockResolvedValue(mockRun);

      const result = await service.create(createDto);

      expect(result).toBeDefined();
      expect(result.projectId).toBe('project-id');
      expect(mockPrismaService.run.create).toHaveBeenCalled();
    });

    it('should handle optional fields', async () => {
      const dtoWithOptional = {
        ...createDto,
        finishedAt: new Date().toISOString(),
        success: false,
        errorType: 'timeout',
        iterations: 3,
        metadata: { key: 'value' },
      };

      mockPrismaService.run.create.mockResolvedValue({
        ...mockRun,
        success: false,
        errorType: 'timeout',
        iterations: 3,
      });

      const result = await service.create(dtoWithOptional);

      expect(result.success).toBe(false);
      expect(result.errorType).toBe('timeout');
    });
  });

  describe('findByProject', () => {
    it('should return runs for a project', async () => {
      mockPrismaService.run.findMany.mockResolvedValue([mockRun]);

      const result = await service.findByProject('project-id');

      expect(result).toHaveLength(1);
      expect(mockPrismaService.run.findMany).toHaveBeenCalledWith({
        where: { projectId: 'project-id' },
        include: undefined,
        orderBy: { startedAt: 'desc' },
      });
    });

    it('should include relations when requested', async () => {
      mockPrismaService.run.findMany.mockResolvedValue([mockRun]);

      await service.findByProject('project-id', true);

      expect(mockPrismaService.run.findMany).toHaveBeenCalledWith({
        where: { projectId: 'project-id' },
        include: expect.any(Object),
        orderBy: { startedAt: 'desc' },
      });
    });
  });

  describe('findByStory', () => {
    it('should return runs for a story', async () => {
      mockPrismaService.run.findMany.mockResolvedValue([mockRun]);

      const result = await service.findByStory('story-id');

      expect(result).toHaveLength(1);
      expect(mockPrismaService.run.findMany).toHaveBeenCalledWith({
        where: { storyId: 'story-id' },
        include: undefined,
        orderBy: { startedAt: 'desc' },
      });
    });
  });

  describe('findByFramework', () => {
    it('should return runs for a framework', async () => {
      mockPrismaService.run.findMany.mockResolvedValue([mockRun]);

      const result = await service.findByFramework('framework-id');

      expect(result).toHaveLength(1);
      expect(mockPrismaService.run.findMany).toHaveBeenCalledWith({
        where: { frameworkId: 'framework-id' },
        include: undefined,
        orderBy: { startedAt: 'desc' },
      });
    });
  });

  describe('findOne', () => {
    it('should return a single run', async () => {
      mockPrismaService.run.findUnique.mockResolvedValue(mockRun);

      const result = await service.findOne('run-id');

      expect(result).toBeDefined();
      expect(result.id).toBe('run-id');
    });

    it('should throw NotFoundException if run not found', async () => {
      mockPrismaService.run.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent-id')).rejects.toThrow(NotFoundException);
    });
  });
});
