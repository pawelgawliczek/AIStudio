import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateUseCaseDto,
  UpdateUseCaseDto,
  SearchUseCasesDto,
  LinkUseCaseToStoryDto,
} from './dto';
import { UseCasesService } from './use-cases.service';

// Mock OpenAI module
jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      embeddings: {
        create: jest.fn().mockResolvedValue({
          data: [{ embedding: Array(1536).fill(0.1) }],
        }),
      },
    })),
  };
});

describe('UseCasesService', () => {
  let service: UseCasesService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    project: {
      findUnique: jest.fn(),
    },
    useCase: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    useCaseVersion: {
      findMany: jest.fn(),
    },
    story: {
      findUnique: jest.fn(),
    },
    storyUseCaseLink: {
      findFirst: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      upsert: jest.fn(),
    },
    $transaction: jest.fn(),
    $executeRaw: jest.fn(),
    $queryRaw: jest.fn(),
  };

  const mockUseCase = {
    id: 'use-case-id',
    projectId: 'project-id',
    key: 'UC-TEST-001',
    title: 'Test Use Case',
    area: 'Authentication',
    componentId: null,
    layerId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUseCaseVersion = {
    id: 'version-id',
    useCaseId: 'use-case-id',
    version: 1,
    summary: 'Test summary',
    content: 'Test content',
    createdById: 'user-id',
    createdAt: new Date(),
    linkedStoryId: null,
    linkedDefectId: null,
    createdBy: {
      id: 'user-id',
      name: 'Test User',
      email: 'test@example.com',
    },
  };

  const mockProject = {
    id: 'project-id',
    name: 'Test Project',
    description: 'Test description',
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UseCasesService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<UseCasesService>(UseCasesService);
    prismaService = module.get<PrismaService>(PrismaService);

    // Clear the mock calls before each test
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto: CreateUseCaseDto = {
      projectId: 'project-id',
      key: 'UC-TEST-001',
      title: 'Test Use Case',
      area: 'Authentication',
      content: 'Test content for use case',
      summary: 'Test summary',
    };

    it('should create a new use case with initial version', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.useCase.findUnique.mockResolvedValue(null);
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback({
          useCase: {
            create: jest.fn().mockResolvedValue(mockUseCase),
          },
          $executeRaw: jest.fn().mockResolvedValue(1),
        });
      });
      mockPrismaService.useCase.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({
        ...mockUseCase,
        versions: [mockUseCaseVersion],
        storyLinks: [],
      });

      const result = await service.create(createDto, 'user-id');

      expect(result).toBeDefined();
      expect(mockPrismaService.project.findUnique).toHaveBeenCalledWith({
        where: { id: createDto.projectId },
      });
    });

    it('should throw NotFoundException if project does not exist', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(null);

      await expect(service.create(createDto, 'user-id')).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.project.findUnique).toHaveBeenCalledWith({
        where: { id: createDto.projectId },
      });
    });

    it('should throw BadRequestException if use case key already exists', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.useCase.findUnique.mockResolvedValue(mockUseCase);

      await expect(service.create(createDto, 'user-id')).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('should return all use cases without filters', async () => {
      mockPrismaService.useCase.findMany.mockResolvedValue([
        {
          ...mockUseCase,
          versions: [mockUseCaseVersion],
          storyLinks: [],
        },
      ]);

      const result = await service.findAll();

      expect(result).toHaveLength(1);
      expect(mockPrismaService.useCase.findMany).toHaveBeenCalledWith({
        where: {},
        include: expect.any(Object),
        orderBy: { updatedAt: 'desc' },
      });
    });

    it('should filter use cases by projectId', async () => {
      mockPrismaService.useCase.findMany.mockResolvedValue([
        {
          ...mockUseCase,
          versions: [mockUseCaseVersion],
          storyLinks: [],
        },
      ]);

      const result = await service.findAll('project-id');

      expect(result).toHaveLength(1);
      expect(mockPrismaService.useCase.findMany).toHaveBeenCalledWith({
        where: { projectId: 'project-id' },
        include: expect.any(Object),
        orderBy: { updatedAt: 'desc' },
      });
    });

    it('should filter use cases by area', async () => {
      mockPrismaService.useCase.findMany.mockResolvedValue([
        {
          ...mockUseCase,
          versions: [mockUseCaseVersion],
          storyLinks: [],
        },
      ]);

      const result = await service.findAll(undefined, 'Authentication');

      expect(result).toHaveLength(1);
      expect(mockPrismaService.useCase.findMany).toHaveBeenCalledWith({
        where: { area: 'Authentication' },
        include: expect.any(Object),
        orderBy: { updatedAt: 'desc' },
      });
    });

    it('should filter use cases by projectId and area', async () => {
      mockPrismaService.useCase.findMany.mockResolvedValue([
        {
          ...mockUseCase,
          versions: [mockUseCaseVersion],
          storyLinks: [],
        },
      ]);

      const result = await service.findAll('project-id', 'Authentication');

      expect(result).toHaveLength(1);
      expect(mockPrismaService.useCase.findMany).toHaveBeenCalledWith({
        where: { projectId: 'project-id', area: 'Authentication' },
        include: expect.any(Object),
        orderBy: { updatedAt: 'desc' },
      });
    });
  });

  describe('findOne', () => {
    it('should return a single use case', async () => {
      mockPrismaService.useCase.findUnique.mockResolvedValue({
        ...mockUseCase,
        versions: [mockUseCaseVersion],
        storyLinks: [],
      });

      const result = await service.findOne('use-case-id');

      expect(result).toBeDefined();
      expect(result.id).toBe('use-case-id');
      expect(mockPrismaService.useCase.findUnique).toHaveBeenCalledWith({
        where: { id: 'use-case-id' },
        include: expect.any(Object),
      });
    });

    it('should throw NotFoundException if use case not found', async () => {
      mockPrismaService.useCase.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const updateDto: UpdateUseCaseDto = {
      title: 'Updated Title',
      area: 'Updated Area',
      content: 'Updated content',
      summary: 'Updated summary',
    };

    it('should update a use case and create new version', async () => {
      mockPrismaService.useCase.findUnique
        .mockResolvedValueOnce({
          ...mockUseCase,
          versions: [{ ...mockUseCaseVersion, version: 1 }],
        })
        .mockResolvedValueOnce({
          ...mockUseCase,
          versions: [{ ...mockUseCaseVersion, version: 1 }],
        })
        .mockResolvedValueOnce({
          ...mockUseCase,
          ...updateDto,
          versions: [{ ...mockUseCaseVersion, version: 2 }],
          storyLinks: [],
        });
      mockPrismaService.useCaseVersion.findMany.mockResolvedValue([
        { ...mockUseCaseVersion, version: 1 },
      ]);
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback({
          useCase: {
            update: jest.fn().mockResolvedValue({ ...mockUseCase, ...updateDto }),
          },
          $executeRaw: jest.fn().mockResolvedValue(1),
        });
      });

      const result = await service.update('use-case-id', updateDto, 'user-id');

      expect(result).toBeDefined();
      expect(mockPrismaService.useCase.findUnique).toHaveBeenCalled();
    });

    it('should throw NotFoundException if use case not found', async () => {
      mockPrismaService.useCase.findUnique.mockResolvedValue(null);

      await expect(service.update('nonexistent-id', updateDto, 'user-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('should delete a use case', async () => {
      mockPrismaService.useCase.findUnique.mockResolvedValue(mockUseCase);
      mockPrismaService.useCase.delete.mockResolvedValue(mockUseCase);

      await service.remove('use-case-id');

      expect(mockPrismaService.useCase.delete).toHaveBeenCalledWith({
        where: { id: 'use-case-id' },
      });
    });

    it('should throw NotFoundException if use case not found', async () => {
      mockPrismaService.useCase.findUnique.mockResolvedValue(null);

      await expect(service.remove('nonexistent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('search', () => {
    const searchDto: SearchUseCasesDto = {
      projectId: 'project-id',
      query: 'auth',
      limit: 20,
      offset: 0,
    };

    it('should search use cases with query', async () => {
      mockPrismaService.useCase.findMany.mockResolvedValue([
        {
          ...mockUseCase,
          versions: [mockUseCaseVersion],
          storyLinks: [],
        },
      ]);

      const result = await service.search(searchDto);

      expect(result).toHaveLength(1);
      expect(mockPrismaService.useCase.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            projectId: 'project-id',
            OR: expect.any(Array),
          }),
        }),
      );
    });

    it('should filter by area', async () => {
      mockPrismaService.useCase.findMany.mockResolvedValue([
        {
          ...mockUseCase,
          versions: [mockUseCaseVersion],
          storyLinks: [],
        },
      ]);

      const result = await service.search({ ...searchDto, area: 'Authentication', query: undefined });

      expect(result).toHaveLength(1);
      expect(mockPrismaService.useCase.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            projectId: 'project-id',
            area: 'Authentication',
          }),
        }),
      );
    });

    it('should filter by multiple areas', async () => {
      mockPrismaService.useCase.findMany.mockResolvedValue([
        {
          ...mockUseCase,
          versions: [mockUseCaseVersion],
          storyLinks: [],
        },
      ]);

      const result = await service.search({
        ...searchDto,
        areas: ['Authentication', 'Authorization'],
        query: undefined,
      });

      expect(result).toHaveLength(1);
      expect(mockPrismaService.useCase.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            projectId: 'project-id',
            area: { in: ['Authentication', 'Authorization'] },
          }),
        }),
      );
    });

    it('should filter by storyId', async () => {
      mockPrismaService.useCase.findMany.mockResolvedValue([
        {
          ...mockUseCase,
          versions: [mockUseCaseVersion],
          storyLinks: [{ storyId: 'story-id' }],
        },
      ]);

      const result = await service.search({ ...searchDto, storyId: 'story-id', query: undefined });

      expect(result).toHaveLength(1);
      expect(mockPrismaService.useCase.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            projectId: 'project-id',
            storyLinks: {
              some: {
                storyId: 'story-id',
              },
            },
          }),
        }),
      );
    });

    it('should apply pagination', async () => {
      mockPrismaService.useCase.findMany.mockResolvedValue([]);

      await service.search({ ...searchDto, limit: 10, offset: 20, query: undefined });

      expect(mockPrismaService.useCase.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
          take: 10,
        }),
      );
    });
  });

  describe('linkToStory', () => {
    const linkDto: LinkUseCaseToStoryDto = {
      useCaseId: 'use-case-id',
      storyId: 'story-id',
      relation: 'implements' as any,
    };

    it('should link use case to story', async () => {
      mockPrismaService.useCase.findUnique.mockResolvedValue(mockUseCase);
      mockPrismaService.story.findUnique.mockResolvedValue({
        id: 'story-id',
        key: 'ST-1',
        title: 'Test Story',
      });
      mockPrismaService.storyUseCaseLink.findFirst.mockResolvedValue(null);
      mockPrismaService.storyUseCaseLink.create.mockResolvedValue({
        storyId: 'story-id',
        useCaseId: 'use-case-id',
        relation: 'implements',
        createdAt: new Date(),
      });

      await service.linkToStory(linkDto);

      expect(mockPrismaService.storyUseCaseLink.create).toHaveBeenCalledWith({
        data: {
          useCaseId: 'use-case-id',
          storyId: 'story-id',
          relation: 'implements',
        },
      });
    });

    it('should throw NotFoundException if use case not found', async () => {
      mockPrismaService.useCase.findUnique.mockResolvedValue(null);

      await expect(service.linkToStory(linkDto)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if story not found', async () => {
      mockPrismaService.useCase.findUnique.mockResolvedValue(mockUseCase);
      mockPrismaService.story.findUnique.mockResolvedValue(null);

      await expect(service.linkToStory(linkDto)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if link already exists', async () => {
      mockPrismaService.useCase.findUnique.mockResolvedValue(mockUseCase);
      mockPrismaService.story.findUnique.mockResolvedValue({ id: 'story-id' });
      mockPrismaService.storyUseCaseLink.findFirst.mockResolvedValue({
        storyId: 'story-id',
        useCaseId: 'use-case-id',
      });

      await expect(service.linkToStory(linkDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('unlinkFromStory', () => {
    it('should unlink use case from story', async () => {
      mockPrismaService.storyUseCaseLink.findFirst.mockResolvedValue({
        storyId: 'story-id',
        useCaseId: 'use-case-id',
      });
      mockPrismaService.storyUseCaseLink.delete.mockResolvedValue({
        storyId: 'story-id',
        useCaseId: 'use-case-id',
      });

      await service.unlinkFromStory('use-case-id', 'story-id');

      expect(mockPrismaService.storyUseCaseLink.delete).toHaveBeenCalledWith({
        where: {
          storyId_useCaseId: {
            storyId: 'story-id',
            useCaseId: 'use-case-id',
          },
        },
      });
    });

    it('should throw NotFoundException if link not found', async () => {
      mockPrismaService.storyUseCaseLink.findFirst.mockResolvedValue(null);

      await expect(service.unlinkFromStory('use-case-id', 'story-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findManyByIds', () => {
    it('should return use cases by ids', async () => {
      mockPrismaService.useCase.findMany.mockResolvedValue([
        {
          ...mockUseCase,
          versions: [mockUseCaseVersion],
          storyLinks: [],
        },
      ]);

      const result = await service.findManyByIds(['use-case-id']);

      expect(result).toHaveLength(1);
      expect(mockPrismaService.useCase.findMany).toHaveBeenCalledWith({
        where: {
          id: {
            in: ['use-case-id'],
          },
        },
        include: expect.any(Object),
      });
    });

    it('should return empty array for empty ids', async () => {
      mockPrismaService.useCase.findMany.mockResolvedValue([]);

      const result = await service.findManyByIds([]);

      expect(result).toEqual([]);
      expect(mockPrismaService.useCase.findMany).toHaveBeenCalledWith({
        where: {
          id: {
            in: [],
          },
        },
        include: expect.any(Object),
      });
    });
  });
});
