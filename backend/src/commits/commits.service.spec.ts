import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { WorkersService } from '../workers/workers.service';
import { CommitsService } from './commits.service';
import { LinkCommitDto } from './dto';

describe('CommitsService', () => {
  let service: CommitsService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    commit: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    project: {
      findUnique: jest.fn(),
    },
    story: {
      findUnique: jest.fn(),
    },
  };

  const mockWorkersService = {
    enqueueCodeAnalysis: jest.fn(),
  };

  const mockProject = {
    id: 'project-id',
    name: 'Test Project',
  };

  const mockStory = {
    id: 'story-id',
    key: 'ST-1',
    title: 'Test Story',
  };

  const mockCommit = {
    hash: 'abc123',
    projectId: 'project-id',
    author: 'test@example.com',
    timestamp: new Date(),
    message: 'Test commit',
    storyId: 'story-id',
    epicId: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommitsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: WorkersService, useValue: mockWorkersService },
      ],
    }).compile();

    service = module.get<CommitsService>(CommitsService);
    prismaService = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('linkCommit', () => {
    const linkDto: LinkCommitDto = {
      hash: 'abc123',
      projectId: 'project-id',
      author: 'test@example.com',
      timestamp: new Date().toISOString(),
      message: 'Test commit',
      storyId: 'story-id',
      files: [
        {
          filePath: 'src/test.ts',
          locAdded: 10,
          locDeleted: 5,
          complexityBefore: 5,
          complexityAfter: 6,
          coverageBefore: 80,
          coverageAfter: 85,
        },
      ],
    };

    it('should create a new commit with files', async () => {
      mockPrismaService.commit.findUnique.mockResolvedValue(null);
      mockPrismaService.commit.create.mockResolvedValue({
        ...mockCommit,
        project: mockProject,
        story: mockStory,
        epic: null,
        files: [
          {
            id: 1,
            filePath: 'src/test.ts',
            locAdded: 10,
            locDeleted: 5,
            complexityBefore: 5,
            complexityAfter: 6,
            coverageBefore: 80,
            coverageAfter: 85,
          },
        ],
      });

      const result = await service.linkCommit(linkDto);

      expect(result).toBeDefined();
      expect(result.hash).toBe('abc123');
      expect(mockPrismaService.commit.create).toHaveBeenCalled();
    });

    it('should update existing commit if hash already exists', async () => {
      mockPrismaService.commit.findUnique.mockResolvedValue(mockCommit);
      mockPrismaService.commit.update.mockResolvedValue({
        ...mockCommit,
        project: mockProject,
        story: mockStory,
        epic: null,
        files: [],
      });

      const result = await service.linkCommit(linkDto);

      expect(result).toBeDefined();
      expect(mockPrismaService.commit.update).toHaveBeenCalledWith({
        where: { hash: 'abc123' },
        data: {
          storyId: 'story-id',
          epicId: undefined,
        },
        include: expect.any(Object),
      });
    });

    it('should create commit without files', async () => {
      const dtoWithoutFiles = { ...linkDto };
      delete dtoWithoutFiles.files;

      mockPrismaService.commit.findUnique.mockResolvedValue(null);
      mockPrismaService.commit.create.mockResolvedValue({
        ...mockCommit,
        project: mockProject,
        story: mockStory,
        epic: null,
        files: [],
      });

      const result = await service.linkCommit(dtoWithoutFiles);

      expect(result).toBeDefined();
      expect(mockPrismaService.commit.create).toHaveBeenCalled();
    });
  });

  describe('findByStory', () => {
    it('should return commits for a story', async () => {
      mockPrismaService.story.findUnique.mockResolvedValue(mockStory);
      mockPrismaService.commit.findMany.mockResolvedValue([
        {
          ...mockCommit,
          files: [],
        },
      ]);

      const result = await service.findByStory('story-id');

      expect(result).toHaveLength(1);
      expect(mockPrismaService.commit.findMany).toHaveBeenCalledWith({
        where: { storyId: 'story-id' },
        include: expect.any(Object),
        orderBy: { timestamp: 'desc' },
      });
    });

    it('should throw NotFoundException if story not found', async () => {
      mockPrismaService.story.findUnique.mockResolvedValue(null);

      await expect(service.findByStory('nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findByProject', () => {
    it('should return commits for a project', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.commit.findMany.mockResolvedValue([
        {
          ...mockCommit,
          files: [],
        },
      ]);

      const result = await service.findByProject('project-id');

      expect(result).toHaveLength(1);
      expect(mockPrismaService.commit.findMany).toHaveBeenCalledWith({
        where: { projectId: 'project-id' },
        include: expect.any(Object),
        orderBy: { timestamp: 'desc' },
        take: 20,
      });
    });

    it('should throw NotFoundException if project not found', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(null);

      await expect(service.findByProject('nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should use default limit of 50', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.commit.findMany.mockResolvedValue([]);

      await service.findByProject('project-id');

      expect(mockPrismaService.commit.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 50,
        }),
      );
    });
  });
});
